"""
Catálogo de proveedores de IA.

Todo lo específico de cada proveedor vive acá: agregar uno nuevo es sumar una
entrada a `PROVEEDORES`, sin tocar el modelo de datos, la migración ni el
frontend.

Sobre los modelos: **no se guarda una lista acá**. Los proveedores sacan modelos
nuevos cada pocos meses, así que cualquier lista escrita a mano queda vieja y
termina ofreciendo modelos retirados mientras esconde los nuevos. En vez de eso
se le pregunta al proveedor con la clave del usuario (`listar_modelos`). Por eso
el modelo solo se puede elegir **después** de cargar la clave: antes no hay a
quién preguntarle.

`modelo_sugerido` sí queda como texto: es solo cuál preseleccionar si aparece en
la respuesta del proveedor, no una restricción.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

PROVEEDORES = {
    'openai': {
        'nombre': 'OpenAI',
        'url_base': 'https://api.openai.com/v1',
        # Con qué empieza la clave: sirve para avisar de un pegado equivocado
        # antes de guardarla.
        'prefijo_clave': 'sk-',
        'donde_obtenerla': 'https://platform.openai.com/api-keys',
        'modelo_sugerido': 'gpt-5.6-luna',
    },
    'gemini': {
        'nombre': 'Google Gemini',
        'url_base': 'https://generativelanguage.googleapis.com/v1beta',
        'prefijo_clave': 'AIza',
        'donde_obtenerla': 'https://aistudio.google.com/app/apikey',
        'modelo_sugerido': 'gemini-3.6-flash',
    },
    'deepseek': {
        'nombre': 'DeepSeek',
        'url_base': 'https://api.deepseek.com/v1',
        'prefijo_clave': 'sk-',
        'donde_obtenerla': 'https://platform.deepseek.com/api_keys',
        'modelo_sugerido': 'deepseek-chat',
    },
    'anthropic': {
        'nombre': 'Anthropic (Claude)',
        'url_base': 'https://api.anthropic.com/v1',
        'prefijo_clave': 'sk-ant-',
        'donde_obtenerla': 'https://console.anthropic.com/settings/keys',
        'modelo_sugerido': 'claude-sonnet-5',
    },
}

# Para el campo `proveedor` del modelo. Se deriva del catálogo para que no haya
# dos listas que mantener sincronizadas.
PROVEEDOR_CHOICES = [(k, v['nombre']) for k, v in PROVEEDORES.items()]


def catalogo_publico():
    """Catálogo para el frontend, sin datos internos.

    No incluye modelos: esos se piden aparte, ya con la clave cargada. Tampoco
    la url_base — el frontend nunca llama al proveedor directamente, porque eso
    expondría la clave en el navegador.
    """
    return [
        {
            'id': clave,
            'nombre': datos['nombre'],
            'modelo_sugerido': datos['modelo_sugerido'],
            'prefijo_clave': datos['prefijo_clave'],
            'donde_obtenerla': datos['donde_obtenerla'],
        }
        for clave, datos in PROVEEDORES.items()
    ]


def enmascarar(clave):
    """Deja solo lo justo para reconocer la clave: `sk-…4f2a`.

    La clave completa nunca sale del backend. Una clave de IA es dinero: quien
    la tenga puede gastar de la cuenta, así que ni siquiera se le devuelve a un
    administrador para "verificarla".
    """
    if not clave:
        return None
    if len(clave) <= 8:
        return '••••'
    return f'{clave[:3]}…{clave[-4:]}'


# ============================================================================
# LLAMADAS AL PROVEEDOR
#
# Siempre desde el backend. Si las hiciera el navegador, la clave tendría que
# viajar hasta el cliente, que es justo lo que se quiere evitar.
# ============================================================================

def _pedir_modelos(proveedor, api_key, timeout):
    """GET al endpoint de modelos del proveedor.

    Devuelve `(codigo, cuerpo, error)`: `codigo` es el HTTP (None si ni siquiera
    se pudo conectar), `cuerpo` el JSON ya parseado (None si no hubo o no era
    JSON) y `error` un texto listo para mostrar cuando falló el transporte.

    Se elige "listar modelos" y no un mensaje de prueba porque es gratis en los
    cuatro proveedores: verificar una clave no debería costar tokens.
    """
    datos = PROVEEDORES.get(proveedor)
    if not datos:
        return None, None, f'Proveedor desconocido: {proveedor}'

    url = f"{datos['url_base']}/models"
    cabeceras = {}
    if proveedor in ('openai', 'deepseek'):
        # Ambos exponen la API de OpenAI.
        cabeceras['Authorization'] = f'Bearer {api_key}'
    elif proveedor == 'gemini':
        url += '?' + urllib.parse.urlencode({'key': api_key, 'pageSize': 200})
    elif proveedor == 'anthropic':
        cabeceras['x-api-key'] = api_key
        cabeceras['anthropic-version'] = '2023-06-01'
        url += '?' + urllib.parse.urlencode({'limit': 100})
    else:
        return None, None, 'Este proveedor no tiene consulta de modelos.'

    peticion = urllib.request.Request(url, headers=cabeceras, method='GET')
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as r:
            crudo = r.read()
            codigo = r.status
    except urllib.error.HTTPError as e:
        # El cuerpo del error no se lee a propósito: puede traer de vuelta la
        # clave o datos internos del proveedor, y esto termina guardado en la
        # base y mostrado en pantalla.
        return e.code, None, None
    except TimeoutError:
        return None, None, 'El proveedor no respondió a tiempo. Reintentá en un momento.'
    except urllib.error.URLError as e:
        return None, None, f'No se pudo conectar con el proveedor: {e.reason}'

    try:
        return codigo, json.loads(crudo.decode('utf-8')), None
    except (ValueError, UnicodeDecodeError):
        return codigo, None, 'El proveedor respondió algo que no se pudo interpretar.'


def _explicar(codigo):
    """Traduce el código HTTP a algo accionable. `None` si salió bien."""
    if codigo == 200:
        return None
    if codigo in (401, 403):
        return 'El proveedor rechazó la clave: está mal copiada o fue revocada.'
    if codigo == 429:
        return 'La clave es válida, pero la cuenta llegó a su límite de uso.'
    if codigo == 402:
        return 'La clave es válida pero la cuenta no tiene saldo.'
    return f'El proveedor respondió con un error (HTTP {codigo}).'


def probar_credencial(proveedor, api_key, timeout=12):
    """Pregunta al proveedor si la clave sirve. Devuelve (ok, detalle).

    Sin esto, una clave mal pegada se descubre recién cuando una función de IA
    falla frente al usuario.
    """
    codigo, _, error = _pedir_modelos(proveedor, api_key, timeout)
    if error:
        return False, error
    if codigo == 200:
        return True, 'La clave funciona.'
    # Un 429 dice que la cuenta llegó al tope, no que la clave esté mal.
    if codigo == 429:
        return True, _explicar(codigo)
    return False, _explicar(codigo)


# Modelos de OpenAI que no sirven para conversar: imágenes, audio, embeddings,
# moderación. La API los devuelve mezclados con los de chat y no hay un campo
# que los distinga, así que se filtran por nombre. Es aproximado a propósito: si
# se cuela uno de más o falta alguno, el campo acepta escribir el nombre a mano.
_OPENAI_NO_CHAT = (
    'embedding', 'whisper', 'tts', 'dall-e', 'moderation', 'audio', 'realtime',
    'transcribe', 'image', 'search', 'davinci', 'babbage', 'codex',
)


def _modelos_openai(cuerpo):
    ids = [m.get('id', '') for m in (cuerpo.get('data') or [])]
    return [
        {'id': i, 'nombre': i}
        for i in ids
        if (i.startswith(('gpt-', 'chatgpt-', 'o1', 'o3', 'o4'))
            and not any(x in i for x in _OPENAI_NO_CHAT))
    ]


def _modelos_deepseek(cuerpo):
    # DeepSeek devuelve solo modelos de chat, no hace falta filtrar.
    return [{'id': m['id'], 'nombre': m['id']}
            for m in (cuerpo.get('data') or []) if m.get('id')]


def _modelos_gemini(cuerpo):
    salida = []
    for m in (cuerpo.get('models') or []):
        # Gemini sí marca para qué sirve cada modelo: se queda con los que
        # generan texto y deja fuera los de embeddings.
        if 'generateContent' not in (m.get('supportedGenerationMethods') or []):
            continue
        # Viene como "models/gemini-2.0-flash"; se usa el nombre pelado.
        ident = (m.get('name') or '').removeprefix('models/')
        if ident:
            salida.append({'id': ident, 'nombre': m.get('displayName') or ident})
    return salida


def _modelos_anthropic(cuerpo):
    return [{'id': m['id'], 'nombre': m.get('display_name') or m['id']}
            for m in (cuerpo.get('data') or []) if m.get('id')]


_PARSEADORES = {
    'openai': _modelos_openai,
    'deepseek': _modelos_deepseek,
    'gemini': _modelos_gemini,
    'anthropic': _modelos_anthropic,
}


def listar_modelos(proveedor, api_key, timeout=12):
    """Modelos que el proveedor ofrece hoy para esta clave.

    Devuelve `(ok, modelos, detalle)`. Se consulta en vivo en vez de guardar una
    lista: así aparecen los modelos nuevos sin esperar una actualización del
    sistema, y no se ofrecen los que el proveedor ya retiró.

    Ojo que la lista es **de esta clave**: dos cuentas del mismo proveedor pueden
    tener acceso a modelos distintos según su plan.
    """
    codigo, cuerpo, error = _pedir_modelos(proveedor, api_key, timeout)
    if error:
        return False, [], error
    if codigo != 200:
        return False, [], _explicar(codigo)
    if cuerpo is None:
        return False, [], 'El proveedor respondió algo que no se pudo interpretar.'

    try:
        modelos = _PARSEADORES[proveedor](cuerpo)
    except (KeyError, AttributeError, TypeError):
        # Si el proveedor cambia la forma de su respuesta, se avisa en vez de
        # reventar: el campo permite escribir el nombre del modelo a mano.
        return False, [], 'El proveedor cambió el formato de su lista de modelos.'

    if not modelos:
        return False, [], 'La cuenta no tiene ningún modelo de chat disponible.'

    # El sugerido primero (si esta cuenta lo tiene), el resto alfabético.
    sugerido = PROVEEDORES[proveedor]['modelo_sugerido']
    modelos.sort(key=lambda m: (m['id'] != sugerido, m['id']))
    return True, modelos, f'{len(modelos)} modelos disponibles.'
