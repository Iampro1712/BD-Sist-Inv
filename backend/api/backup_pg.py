"""
Respaldo restaurable de la base, con `pg_dump` en formato custom.

Por qué existe, si ya había un respaldo: el volcado JSON de `backup_utils` es
**solo datos**. No lleva el esquema, ni las secuencias de los contadores, ni las
funciones y disparadores —entre ellos el de auditoría de productos—. Medido
sobre esta base: 4 disparadores, 9 funciones y 28 secuencias que ese respaldo no
guarda. Restaurar desde él obligaba a reconstruir el esquema a mano desde el
repositorio y a reajustar cada contador, algo que nadie quiere descubrir a las
tres de la mañana con el negocio parado.

Un archivo de `pg_dump -Fc` restaura todo de una sola vez con `pg_restore`.

Decisiones que vale explicar:

- **Se verifica el archivo recién creado** leyendo su índice con `pg_restore
  --list`. Un respaldo que nunca se probó es una esperanza, no un respaldo, y el
  costo de comprobarlo es milisegundos.
- **La contraseña va por variable de entorno**, no en los argumentos: lo que se
  pasa por línea de comandos es visible para cualquier proceso de la máquina.
- **Se excluyen solo las tablas efímeras** de sesión y tokens. Ver
  `TABLAS_EFIMERAS`.
"""

import logging
import os
import re
import subprocess
from datetime import datetime

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)

# Tablas que NO van al respaldo.
#
# Son solo las efímeras: tokens de sesión y sesiones de Django. No sirven para
# nada al restaurar (son credenciales de un momento que ya pasó) y su filtración
# permite entrar al sistema — se encontraron tokens vigentes en un respaldo
# público, que fue el origen de todo este trabajo.
#
# El resto SÍ va, a diferencia del respaldo JSON, y es deliberado: acá el
# objetivo es poder volver a operar. Un respaldo sin `auth_user` deja una base
# donde nadie puede iniciar sesión, o sea que no restaura el sistema. Las claves
# de IA de `configuracion_ia` van cifradas con FIELD_ENCRYPTION_KEY, que no
# viaja en el archivo, así que sin esa clave aparte no sirven de nada.
TABLAS_EFIMERAS = (
    'token_blacklist_outstandingtoken',
    'token_blacklist_blacklistedtoken',
    'django_session',
)

# Cortes de seguridad: un respaldo no debería tardar horas ni colgarse.
TIMEOUT_DUMP = 900      # 15 min
TIMEOUT_VERIFICAR = 60


def _mayor(texto):
    """Extrae la versión mayor de un `x.y` o `x.y (Debian ...)`."""
    m = re.search(r'(\d+)', texto or '')
    return int(m.group(1)) if m else None


def version_pg_dump():
    """Versión mayor de `pg_dump`, o None si no está instalado."""
    try:
        r = subprocess.run(['pg_dump', '--version'], capture_output=True,
                           text=True, timeout=15)
    except (FileNotFoundError, subprocess.SubprocessError, OSError):
        return None
    if r.returncode != 0:
        return None
    # "pg_dump (PostgreSQL) 17.10 (Debian ...)" -> 17
    m = re.search(r'\)\s*(\d+)', r.stdout)
    return int(m.group(1)) if m else None


def version_servidor():
    """Versión mayor del Postgres al que apunta el sistema."""
    with connection.cursor() as c:
        c.execute('SHOW server_version')
        return _mayor(c.fetchone()[0])


def _entorno_con_password():
    """Copia del entorno con PGPASSWORD, sin tocar el del proceso.

    En los argumentos no va nunca: `ps` los muestra a cualquier proceso.
    """
    db = settings.DATABASES['default']
    env = os.environ.copy()
    if db.get('PASSWORD'):
        env['PGPASSWORD'] = str(db['PASSWORD'])
    return env


def _conexion_args():
    db = settings.DATABASES['default']
    args = []
    if db.get('HOST'):
        args += ['-h', str(db['HOST'])]
    if db.get('PORT'):
        args += ['-p', str(db['PORT'])]
    if db.get('USER'):
        args += ['-U', str(db['USER'])]
    return args + ['-d', str(db['NAME'])]


def nombre_dump(ahora=None):
    ahora = ahora or datetime.now()
    return f"inventrix-{ahora.strftime('%Y%m%d-%H%M%S')}.dump"


def comprobar_disponible():
    """¿Se puede hacer un respaldo restaurable? Devuelve (ok, detalle).

    Falla si `pg_dump` es más viejo que el servidor: en ese caso se niega a
    volcar (no es una advertencia, es un error duro), así que conviene decirlo
    con un mensaje que indique qué hacer en vez de dejar que reviente después.
    """
    cliente = version_pg_dump()
    if cliente is None:
        return False, ('pg_dump no está instalado. En el contenedor se instala '
                       'con el paquete postgresql-client (ver Dockerfile).')
    try:
        servidor = version_servidor()
    except Exception as e:
        return False, f'No se pudo consultar la versión del servidor: {e}'

    if servidor and cliente < servidor:
        return False, (
            f'pg_dump {cliente} es más viejo que el servidor {servidor} y se '
            f'niega a volcar. Actualizá postgresql-client en el Dockerfile a '
            f'la versión {servidor} o superior.')
    return True, f'pg_dump {cliente} sobre servidor {servidor}'


def generar_dump(destino):
    """Crea el respaldo restaurable en `destino`. Devuelve (ok, detalle).

    Formato custom (`-Fc`): comprimido, y `pg_restore` puede restaurarlo entero
    o por partes. No es texto plano legible, y eso está bien: para leerlo se usa
    `pg_restore --list`.
    """
    ok, detalle = comprobar_disponible()
    if not ok:
        return False, detalle

    cmd = ['pg_dump', *_conexion_args(), '-Fc', '--no-password',
           '-f', str(destino)]
    for tabla in TABLAS_EFIMERAS:
        cmd += ['--exclude-table-data', tabla]

    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           env=_entorno_con_password(), timeout=TIMEOUT_DUMP)
    except subprocess.TimeoutExpired:
        return False, f'pg_dump no terminó en {TIMEOUT_DUMP} s; se abortó.'
    except OSError as e:
        return False, f'No se pudo ejecutar pg_dump: {e}'

    if r.returncode != 0:
        # stderr de pg_dump no incluye la contraseña (va por entorno), pero se
        # recorta igual: es un mensaje para pantalla, no un volcado de depuración.
        error = (r.stderr or '').strip().splitlines()
        return False, f"pg_dump falló: {error[-1] if error else 'sin detalle'}"

    if not destino.exists() or destino.stat().st_size == 0:
        return False, 'pg_dump terminó bien pero el archivo quedó vacío.'

    return True, f'{destino.stat().st_size // 1024} KB'


def verificar_dump(ruta):
    """Comprueba que el archivo se puede leer. Devuelve (ok, detalle).

    Lee el índice con `pg_restore --list`, que recorre la estructura del archivo
    sin tocar ninguna base de datos. No prueba que los datos estén completos
    —para eso hay que restaurar de verdad— pero sí detecta un archivo truncado o
    corrupto, que es el modo de falla que deja a alguien con un respaldo inútil
    sin saberlo.
    """
    try:
        r = subprocess.run(['pg_restore', '--list', str(ruta)],
                           capture_output=True, text=True,
                           timeout=TIMEOUT_VERIFICAR)
    except subprocess.TimeoutExpired:
        return False, 'La verificación no terminó a tiempo.'
    except OSError as e:
        return False, f'No se pudo ejecutar pg_restore: {e}'

    if r.returncode != 0:
        error = (r.stderr or '').strip().splitlines()
        return False, (f"El archivo no se puede leer: "
                       f"{error[-1] if error else 'sin detalle'}")

    # El índice lista una entrada por objeto. Un archivo válido de esta base
    # tiene tablas, funciones y secuencias; si trae muy pocas entradas es que
    # algo salió mal aunque el comando no haya fallado.
    entradas = [l for l in r.stdout.splitlines()
                if l.strip() and not l.startswith(';')]
    if len(entradas) < 10:
        return False, f'El archivo solo tiene {len(entradas)} objetos: sospechoso.'

    return True, f'{len(entradas)} objetos en el archivo'
