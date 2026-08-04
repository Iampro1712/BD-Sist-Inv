"""
Actualizaciones de la aplicación de escritorio (Inventrix Desktop).

La app de escritorio necesita saber si hay una versión nueva y descargarla, pero
su repositorio de GitHub es **privado**. Si la app consultara GitHub directamente
tendría que llevar un token dentro del ejecutable, y cualquiera que lo
descompilara obtendría acceso de lectura al repositorio.

Estas dos vistas hacen de intermediario: el token vive sólo en el `.env` del
servidor y la app nunca lo ve.

    GET /api/desktop/version/     -> metadatos de la última versión publicada
    GET /api/desktop/descargar/   -> redirección al instalador

Ambas son **públicas** (`AllowAny`), lo cual es una excepción deliberada en este
proyecto: el resto del API exige JWT. Se justifica porque:
  - La app necesita comprobar actualizaciones **antes** de que nadie inicie
    sesión (si la versión instalada tuviera un fallo en el propio login, exigir
    autenticación para actualizar dejaría el equipo bloqueado sin remedio).
  - No reciben parámetros de entrada ni tocan la base de datos.
  - Sólo exponen lo que ya es público de facto: que existe una versión X del
    instalador. No revelan código, datos del taller ni configuración.
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

logger = logging.getLogger(__name__)

# GitHub limita a 5.000 peticiones/hora por token. Con varios equipos del taller
# consultando al arrancar y cada 6 h no se llegaría al límite, pero cachear evita
# depender de GitHub para algo que cambia una vez por release.
CACHE_TTL_SEGUNDOS = 15 * 60
CACHE_CLAVE = 'desktop:ultima_version'

# El release crudo de GitHub, compartido por las dos vistas. Sin esto,
# /descargar/ pedía a GitHub en **cada** petición: como es un endpoint público,
# bastaba con llamarlo en bucle para agotar la cuota del token (y dejar sin
# actualizaciones a todo el taller) y, peor, para ocupar un worker de Gunicorn
# durante hasta 20 s por petición, tumbando la API entera —caja y POS incluidos—
# sin necesidad de credenciales.
CACHE_CLAVE_RELEASE = 'desktop:release_crudo'

# La URL firmada que devuelve GitHub es temporal. Se cachea poco: lo justo para
# que una ráfaga de descargas no se traduzca en una ráfaga de llamadas salientes,
# pero no tanto como para entregar un enlace ya vencido.
CACHE_TTL_DESCARGA = 5 * 60
CACHE_CLAVE_DESCARGA = 'desktop:url_descarga'

TIMEOUT_GITHUB = 10

# Sólo se redirige a GitHub y por HTTPS. El `Location` viene de una respuesta
# ajena, y es lo único que separa a los equipos del taller de descargar un
# ejecutable de donde sea; se valida antes de reenviarlo.
HOSTS_DESCARGA_PERMITIDOS = (
    'github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
)


def _destino_confiable(url):
    """¿Es `url` una descarga de GitHub por HTTPS?"""
    try:
        partes = urllib.parse.urlsplit(url)
    except ValueError:
        return False
    if partes.scheme != 'https':
        return False
    host = (partes.hostname or '').lower()
    return host in HOSTS_DESCARGA_PERMITIDOS or host.endswith('.githubusercontent.com')


# Las notas de cada release en este proyecto se redactan a partir del propio
# CHANGELOG (ver ejemplos en CHANGELOG.md: "auditoría de seguridad", "el
# reporte de compras calculaba mal el total", "lo que se le debe a un
# proveedor ya no se le muestra a los vendedores"...). Ese nivel de detalle es
# justo lo que un atacante necesita para apuntar contra los equipos que
# todavía no se actualizaron: el endpoint es público y el repo del que salen
# es privado a propósito.
#
# No se puede distinguir automáticamente "arreglé un bug" de "arreglé una
# vulnerabilidad" con certeza, así que se filtra con un criterio amplio y
# deliberadamente conservador: cualquier sección o línea que toque seguridad,
# permisos o datos sensibles se cae entera antes de salir del servidor. Mejor
# perder una nota inofensiva que dejar pasar una que no lo era.
_PALABRAS_SENSIBLES = (
    'seguridad', 'vulnerab', 'cve', 'exploit', 'hallazgo', 'auditor',
    'credencial', 'contraseñ', 'contrasen', 'secreto', 'fuga', 'ataque',
    'backdoor', 'inyecci', 'csrf', 'xss', 'token', 'brecha', 'permiso',
    'autenticaci', 'autorizaci', 'privileg', 'expone', 'exponía', 'filtra',
)

_ENCABEZADOS_SENSIBLES = ('security', 'seguridad')

# Mensaje único para todo fallo al resolver la última versión.
#
# Estos endpoints son públicos, así que el texto de error es información que se
# regala. Distinguir "el token no sirve" de "GitHub no responde" de "falta
# configurar" le dibuja a cualquiera dónde vive el binario y en qué estado está
# la credencial del servidor — y el estado de la credencial es justamente lo que
# tantea quien busca una ventana. El detalle real va al log, que es donde le
# sirve a quien opera el sistema.
ERROR_GENERICO = 'No se pudo comprobar si hay actualizaciones en este momento.'


def _sanear_notas(texto):
    """Filtra de las notas de release cualquier cosa con sabor a seguridad.

    Trabaja por bloques (separados por encabezados markdown "### ..."): un
    bloque cuyo encabezado sea de seguridad se descarta entero. Dentro de los
    bloques que quedan, se descarta línea por línea cualquiera que toque una
    palabra sensible, aunque no esté bajo ese encabezado (el CHANGELOG de este
    proyecto mezcla texto introductorio con detalle de la corrección, sin
    encabezado propio, en varias versiones).
    """
    if not texto:
        return ''

    bloques = []
    actual = []
    for linea in texto.splitlines():
        if linea.strip().startswith('#'):
            if actual:
                bloques.append(actual)
            actual = [linea]
        else:
            actual.append(linea)
    if actual:
        bloques.append(actual)

    salida = []
    for bloque in bloques:
        encabezado = bloque[0].strip().lstrip('#').strip().lower()
        if any(p in encabezado for p in _ENCABEZADOS_SENSIBLES):
            continue
        for linea in bloque:
            if any(p in linea.lower() for p in _PALABRAS_SENSIBLES):
                continue
            salida.append(linea)

    resultado = '\n'.join(salida).strip()
    if not resultado:
        return 'Mejoras y correcciones.'
    return resultado


class ActualizacionThrottle(ScopedRateThrottle):
    """Límite propio para no competir con el de login (5/min) ni el anónimo."""
    scope = 'desktop_version'


def _pedir_a_github(ruta):
    """Llama a la API de GitHub con el token del servidor.

    :return: (datos, None) si fue bien, (None, mensaje_de_error) si falló.
    """
    token = getattr(settings, 'GITHUB_DESKTOP_TOKEN', '')
    repo = getattr(settings, 'GITHUB_DESKTOP_REPO', '')

    if not token or not repo:
        logger.error(
            'Actualizaciones sin configurar: faltan GITHUB_DESKTOP_TOKEN o '
            'GITHUB_DESKTOP_REPO.'
        )
        return None, ERROR_GENERICO

    url = f'https://api.github.com/repos/{repo}{ruta}'
    peticion = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Inventrix-Backend',
    })

    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_GITHUB) as resp:
            return json.loads(resp.read().decode('utf-8')), None
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Repo sin releases todavía, o el token no alcanza a verlo. Son dos
            # causas distintas para el operador (y por eso van al log separadas)
            # pero para quien llama significan lo mismo: no hay nada que bajar.
            logger.info('GitHub devolvió 404 al pedir %s (¿sin releases?)', ruta)
            return None, 'No hay versiones publicadas todavía.'
        if e.code in (401, 403):
            logger.error('GitHub rechazó el token de actualizaciones (HTTP %s)', e.code)
            return None, ERROR_GENERICO
        logger.error('GitHub respondió HTTP %s al pedir %s', e.code, ruta)
        return None, ERROR_GENERICO
    except (urllib.error.URLError, TimeoutError) as e:
        logger.warning('No se pudo contactar con GitHub: %s', e)
        return None, ERROR_GENERICO
    except json.JSONDecodeError:
        logger.error('GitHub devolvió una respuesta no JSON al pedir %s', ruta)
        return None, ERROR_GENERICO


def _release_mas_reciente():
    """El último release, cacheado, para no llamar a GitHub en cada petición.

    Lo usan las dos vistas: una release cambia una vez cada varios días, así que
    servir la copia cacheada es tan correcto como preguntar, y deja de convertir
    un endpoint público en un amplificador contra la cuota de GitHub y contra los
    workers del propio servidor.
    """
    cacheado = cache.get(CACHE_CLAVE_RELEASE)
    if cacheado is not None:
        return cacheado, None

    datos, error = _pedir_a_github('/releases/latest')
    if error:
        return None, error

    cache.set(CACHE_CLAVE_RELEASE, datos, CACHE_TTL_SEGUNDOS)
    return datos, None


def _elegir_instalador(assets):
    """Localiza el instalador de Windows entre los adjuntos del release."""
    for asset in assets:
        nombre = (asset.get('name') or '').lower()
        if nombre.endswith('.exe') or nombre.endswith('.msi'):
            return asset
    return None


def _leer_sha256(assets):
    """Lee el SHA-256 del adjunto `*.sha256`, si el release lo trae.

    La app verifica este hash antes de ejecutar el instalador descargado. Sin él
    estaría ejecutando un binario sin comprobar su integridad, así que se publica
    siempre junto al `.exe` (lo hace `scripts/publicar-release.ps1`).
    """
    for asset in assets:
        if (asset.get('name') or '').lower().endswith('.sha256'):
            # Se usa la URL de la API, NO `browser_download_url`: en un repo
            # privado esa segunda devuelve la página HTML de login de GitHub en
            # vez del archivo, y el checksum acabaría siendo basura o None.
            url = asset.get('url')
            if not url:
                return None
            try:
                peticion = urllib.request.Request(url, headers={
                    'Authorization': f'Bearer {settings.GITHUB_DESKTOP_TOKEN}',
                    'Accept': 'application/octet-stream',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'Inventrix-Backend',
                })
                with urllib.request.urlopen(peticion, timeout=TIMEOUT_GITHUB) as resp:
                    contenido = resp.read().decode('utf-8', errors='replace').strip()

                # Formato de `sha256sum`: "<hash>  <nombre de archivo>"
                hash_leido = contenido.split()[0] if contenido else None
                # Un SHA-256 son 64 dígitos hexadecimales. Si no lo es, algo
                # devolvió otra cosa (una redirección a HTML, por ejemplo) y es
                # mejor no publicar un checksum inválido: la app rechazaría la
                # descarga y el fallo parecería del instalador.
                if hash_leido and len(hash_leido) == 64:
                    try:
                        int(hash_leido, 16)
                        return hash_leido.lower()
                    except ValueError:
                        pass
                logger.warning('El archivo .sha256 del release no contiene un hash válido')
                return None
            except (urllib.error.URLError, TimeoutError, OSError, IndexError) as e:
                logger.warning('No se pudo leer el checksum del release: %s', e)
                return None
    return None


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([ActualizacionThrottle])
def version_escritorio(request):
    """Metadatos de la última versión publicada de la app de escritorio."""
    cacheado = cache.get(CACHE_CLAVE)
    if cacheado is not None:
        return Response(cacheado)

    datos, error = _release_mas_reciente()
    if error:
        return Response({'detail': error}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    assets = datos.get('assets') or []
    instalador = _elegir_instalador(assets)
    if not instalador:
        logger.error('El release publicado no trae ningún .exe/.msi adjunto.')
        return Response(
            {'detail': ERROR_GENERICO},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # El tag suele venir como "v1.0.2"; la app compara versiones sin la "v".
    etiqueta = (datos.get('tag_name') or '').lstrip('vV')

    respuesta = {
        'version': etiqueta,
        'notas': _sanear_notas(datos.get('body') or ''),
        'url_descarga': request.build_absolute_uri('/api/desktop/descargar/'),
        'nombre_archivo': instalador.get('name'),
        'tamano': instalador.get('size'),
        'sha256': _leer_sha256(assets),
        'publicado_en': datos.get('published_at'),
        # Reservado: permite marcar una versión como obligatoria más adelante sin
        # cambiar el contrato del endpoint.
        'version_minima': None,
    }

    cache.set(CACHE_CLAVE, respuesta, CACHE_TTL_SEGUNDOS)
    return Response(respuesta)


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([ActualizacionThrottle])
def descargar_escritorio(request):
    """Redirige al instalador de la última versión.

    Se responde con un 302 hacia la URL firmada de GitHub en vez de hacer de
    proxy del contenido: el instalador pesa ~160 MB y transmitirlo por Django
    ocuparía un worker de Gunicorn durante toda la descarga.
    """
    # Si ya se resolvió hace poco, se reenvía el mismo enlace firmado sin volver
    # a molestar a GitHub. Se revalida igual que un destino recién obtenido: es
    # el mismo dato cruzando la misma frontera de confianza, sólo que llegó por
    # caché en vez de por la respuesta de GitHub.
    url_cacheada = cache.get(CACHE_CLAVE_DESCARGA)
    if url_cacheada and _destino_confiable(url_cacheada):
        return redirect(url_cacheada)

    datos, error = _release_mas_reciente()
    if error:
        return Response({'detail': error}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    instalador = _elegir_instalador(datos.get('assets') or [])
    if not instalador:
        logger.error('El release publicado no trae ningún .exe/.msi adjunto.')
        return Response(
            {'detail': ERROR_GENERICO},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # En un repo privado, `browser_download_url` exige autenticación. Se pide a
    # la API el asset con Accept: octet-stream y GitHub responde 302 con una URL
    # firmada y temporal; esa es la que se le pasa a la app.
    url_asset = instalador.get('url')
    if not url_asset:
        logger.error('El asset del release no expone una URL utilizable.')
        return Response(
            {'detail': ERROR_GENERICO},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    class _SinRedirecciones(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None   # no seguir: sólo queremos conocer el destino

    peticion = urllib.request.Request(url_asset, headers={
        'Authorization': f'Bearer {settings.GITHUB_DESKTOP_TOKEN}',
        'Accept': 'application/octet-stream',
        'User-Agent': 'Inventrix-Backend',
    })

    try:
        opener = urllib.request.build_opener(_SinRedirecciones)
        with opener.open(peticion, timeout=TIMEOUT_GITHUB) as resp:
            # Sin redirección: GitHub sirvió el binario directamente. No se puede
            # reenviar sin hacer de proxy, así que se avisa en vez de colgarse.
            logger.warning('GitHub sirvió el asset sin redirección (HTTP %s)', resp.status)
            return Response(
                {'detail': ERROR_GENERICO},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except urllib.error.HTTPError as e:
        destino = e.headers.get('Location') if e.code in (301, 302, 303, 307, 308) else None
        if destino:
            if not _destino_confiable(destino):
                logger.error(
                    'GitHub redirigió a un destino no permitido; no se reenvía.'
                )
                return Response(
                    {'detail': ERROR_GENERICO},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            cache.set(CACHE_CLAVE_DESCARGA, destino, CACHE_TTL_DESCARGA)
            return redirect(destino)
        logger.error('GitHub respondió HTTP %s al pedir el instalador', e.code)
        return Response(
            {'detail': ERROR_GENERICO},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except (urllib.error.URLError, TimeoutError) as e:
        logger.warning('No se pudo contactar con GitHub para descargar: %s', e)
        return Response(
            {'detail': ERROR_GENERICO},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
