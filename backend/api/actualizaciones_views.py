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

TIMEOUT_GITHUB = 10


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
        return None, (
            'El servidor no tiene configurada la publicación de actualizaciones '
            '(faltan GITHUB_DESKTOP_TOKEN o GITHUB_DESKTOP_REPO).'
        )

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
            # Repo sin releases todavía, o el token no alcanza a verlo.
            return None, 'Todavía no hay ninguna versión publicada.'
        if e.code in (401, 403):
            logger.error('GitHub rechazó el token de actualizaciones (HTTP %s)', e.code)
            return None, 'El servidor no pudo autenticarse contra GitHub.'
        logger.error('GitHub respondió HTTP %s al pedir %s', e.code, ruta)
        return None, 'GitHub devolvió un error al consultar la última versión.'
    except (urllib.error.URLError, TimeoutError) as e:
        logger.warning('No se pudo contactar con GitHub: %s', e)
        return None, 'No se pudo contactar con GitHub.'
    except json.JSONDecodeError:
        logger.error('GitHub devolvió una respuesta no JSON al pedir %s', ruta)
        return None, 'GitHub devolvió una respuesta inesperada.'


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

    datos, error = _pedir_a_github('/releases/latest')
    if error:
        return Response({'detail': error}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    assets = datos.get('assets') or []
    instalador = _elegir_instalador(assets)
    if not instalador:
        return Response(
            {'detail': 'La última versión publicada no incluye un instalador para Windows.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # El tag suele venir como "v1.0.2"; la app compara versiones sin la "v".
    etiqueta = (datos.get('tag_name') or '').lstrip('vV')

    respuesta = {
        'version': etiqueta,
        'notas': datos.get('body') or '',
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
    datos, error = _pedir_a_github('/releases/latest')
    if error:
        return Response({'detail': error}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    instalador = _elegir_instalador(datos.get('assets') or [])
    if not instalador:
        return Response(
            {'detail': 'La última versión publicada no incluye un instalador para Windows.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # En un repo privado, `browser_download_url` exige autenticación. Se pide a
    # la API el asset con Accept: octet-stream y GitHub responde 302 con una URL
    # firmada y temporal; esa es la que se le pasa a la app.
    url_asset = instalador.get('url')
    if not url_asset:
        return Response(
            {'detail': 'El release no expone una URL de descarga utilizable.'},
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
                {'detail': 'GitHub no devolvió una URL de descarga redirigible.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except urllib.error.HTTPError as e:
        destino = e.headers.get('Location') if e.code in (301, 302, 303, 307, 308) else None
        if destino:
            return redirect(destino)
        logger.error('GitHub respondió HTTP %s al pedir el instalador', e.code)
        return Response(
            {'detail': 'No se pudo obtener el enlace de descarga desde GitHub.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except (urllib.error.URLError, TimeoutError) as e:
        logger.warning('No se pudo contactar con GitHub para descargar: %s', e)
        return Response(
            {'detail': 'No se pudo contactar con GitHub.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
