"""
Cliente para pedirle un análisis al proveedor de IA configurado.

`ia_catalogo` sabe *qué* proveedores existen y valida claves; acá se los usa
para trabajar. La separación importa porque las formas de pedir difieren: los
cuatro proveedores tienen APIs de chat distintas y las respuestas hay que
normalizarlas a una sola.

Reglas que se sostienen en todo el módulo:

- **La clave no se registra nunca**, ni en logs ni en mensajes de error.
- **Los errores se devuelven, no se lanzan.** Quien llama decide qué hacer; una
  función de IA caída no debe tumbar la pantalla que la usa.
- **Se pide JSON y se valida.** Un modelo puede devolver texto suelto o JSON
  envuelto en ```; si no se puede interpretar, se informa en vez de reventar.
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from .ia_catalogo import PROVEEDORES

logger = logging.getLogger(__name__)

# Tope de tokens de la respuesta. Alcanza para un análisis de varios productos
# y evita que un modelo verborrágico dispare el costo de una consulta.
MAX_TOKENS = 2000


def _armar_peticion(proveedor, api_key, modelo, instruccion, prompt):
    """Traduce (instrucción, prompt) al formato de cada proveedor.

    Devuelve `(url, cabeceras, cuerpo)` o `(None, None, None)` si el proveedor
    no está soportado.
    """
    datos = PROVEEDORES.get(proveedor)
    if not datos:
        return None, None, None

    base = datos['url_base']

    if proveedor in ('openai', 'deepseek'):
        # Ambos hablan la API de OpenAI.
        return (
            f'{base}/chat/completions',
            {'Authorization': f'Bearer {api_key}',
             'Content-Type': 'application/json'},
            {
                'model': modelo,
                'max_completion_tokens': MAX_TOKENS,
                'messages': [
                    {'role': 'system', 'content': instruccion},
                    {'role': 'user', 'content': prompt},
                ],
            },
        )

    if proveedor == 'gemini':
        # Gemini manda la clave en la URL y llama `systemInstruction` a lo que
        # los otros ponen como mensaje de sistema.
        url = (f'{base}/models/{urllib.parse.quote(modelo)}:generateContent?'
               + urllib.parse.urlencode({'key': api_key}))
        return (
            url,
            {'Content-Type': 'application/json'},
            {
                'systemInstruction': {'parts': [{'text': instruccion}]},
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'maxOutputTokens': MAX_TOKENS},
            },
        )

    if proveedor == 'anthropic':
        # Anthropic usa `x-api-key` (no Bearer) y `system` como campo aparte;
        # `max_tokens` es obligatorio, no opcional como en los demás.
        return (
            f'{base}/messages',
            {'x-api-key': api_key,
             'anthropic-version': '2023-06-01',
             'Content-Type': 'application/json'},
            {
                'model': modelo,
                'max_tokens': MAX_TOKENS,
                'system': instruccion,
                'messages': [{'role': 'user', 'content': prompt}],
            },
        )

    return None, None, None


def _extraer_texto(proveedor, cuerpo):
    """Saca el texto de la respuesta, que cada proveedor anida distinto."""
    try:
        if proveedor in ('openai', 'deepseek'):
            return cuerpo['choices'][0]['message']['content']
        if proveedor == 'gemini':
            partes = cuerpo['candidates'][0]['content']['parts']
            return ''.join(p.get('text', '') for p in partes)
        if proveedor == 'anthropic':
            return ''.join(b.get('text', '') for b in cuerpo['content']
                           if b.get('type') == 'text')
    except (KeyError, IndexError, TypeError):
        return None
    return None


def _interpretar_json(texto):
    """Convierte la respuesta del modelo en un dict.

    Los modelos suelen envolver el JSON en un bloque ```json ... ``` aunque se
    les pida que no lo hagan, así que se recorta antes de interpretar. Devuelve
    `None` si no hay JSON aprovechable.
    """
    if not texto:
        return None
    limpio = texto.strip()

    if limpio.startswith('```'):
        # Quita la primera línea (```json) y el cierre.
        limpio = limpio.split('\n', 1)[-1]
        if limpio.rstrip().endswith('```'):
            limpio = limpio.rstrip()[:-3]

    # Último recurso: quedarse con lo que hay entre el primer { y el último }.
    if not limpio.lstrip().startswith('{'):
        inicio, fin = limpio.find('{'), limpio.rfind('}')
        if inicio == -1 or fin <= inicio:
            return None
        limpio = limpio[inicio:fin + 1]

    try:
        datos = json.loads(limpio)
    except ValueError:
        return None
    return datos if isinstance(datos, dict) else None


def preguntar_json(config, instruccion, prompt, timeout=45):
    """Le pide al proveedor configurado un análisis y espera JSON de vuelta.

    `config` es una `ConfiguracionIA` con clave y modelo. Devuelve
    `(datos, error)`: uno de los dos siempre es `None`.

    El timeout es generoso (45 s) porque un análisis razona sobre varios
    productos, pero acotado: la pantalla que llama muestra sus números primero y
    esto solo agrega notas, así que es preferible rendirse a colgar la petición.
    """
    if not config or not config.api_key:
        return None, 'No hay proveedor de IA configurado.'
    if not config.modelo:
        return None, 'El proveedor configurado no tiene modelo elegido.'

    url, cabeceras, cuerpo = _armar_peticion(
        config.proveedor, config.api_key, config.modelo, instruccion, prompt)
    if not url:
        return None, f'Proveedor no soportado: {config.proveedor}'

    peticion = urllib.request.Request(
        url, data=json.dumps(cuerpo).encode('utf-8'),
        headers=cabeceras, method='POST')

    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as r:
            crudo = r.read()
    except urllib.error.HTTPError as e:
        # El cuerpo del error se descarta a propósito: puede repetir la clave o
        # traer datos internos del proveedor, y esto se muestra en pantalla.
        logger.warning('IA (%s) respondió HTTP %s', config.proveedor, e.code)
        if e.code in (401, 403):
            return None, ('El proveedor rechazó la clave. Probala de nuevo en '
                          'Configuración.')
        if e.code == 429:
            return None, 'La cuenta del proveedor llegó a su límite de uso.'
        if e.code == 402:
            return None, 'La cuenta del proveedor no tiene saldo.'
        if e.code == 404:
            return None, (f'El modelo "{config.modelo}" no existe o no está '
                          'habilitado en esta cuenta.')
        return None, f'El proveedor respondió con un error (HTTP {e.code}).'
    except TimeoutError:
        return None, 'El proveedor tardó demasiado en responder.'
    except urllib.error.URLError as e:
        return None, f'No se pudo conectar con el proveedor: {e.reason}'

    try:
        respuesta = json.loads(crudo.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return None, 'El proveedor respondió algo que no se pudo interpretar.'

    texto = _extraer_texto(config.proveedor, respuesta)
    if not texto:
        # Pasa cuando el modelo corta por límite de tokens o filtra el
        # contenido: hay respuesta HTTP 200 pero viene sin texto útil.
        return None, 'El proveedor devolvió una respuesta vacía.'

    datos = _interpretar_json(texto)
    if datos is None:
        return None, 'El análisis no vino en el formato esperado.'
    return datos, None
