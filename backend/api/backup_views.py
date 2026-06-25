"""
Respaldo / exportación de datos con un clic.

Genera un volcado lógico (JSON) de todas las tablas de negocio de la base de
datos y lo entrega como descarga directa. Pensado para un dueño sin equipo de
IT: bajar una copia de seguridad cuando quiera y guardarla.
"""
import json
from datetime import datetime, date
from decimal import Decimal

from django.db import connection
from django.http import HttpResponse
from rest_framework.decorators import api_view

# Tablas internas de Django/auth: no son datos de negocio, se excluyen del respaldo.
_EXCLUIR = {
    'django_migrations', 'django_content_type', 'django_admin_log',
    'django_session', 'auth_group', 'auth_group_permissions',
    'auth_permission', 'auth_user', 'auth_user_groups',
    'auth_user_user_permissions',
}


def _serializar(o):
    """Convierte tipos no nativos de JSON (fechas, Decimal, etc.)."""
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (bytes, memoryview)):
        return None
    return str(o)


@api_view(['GET'])
def exportar_backup(request):
    """Devuelve un archivo JSON descargable con todas las tablas de negocio."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        # Los nombres provienen del catálogo del sistema (no de input del usuario),
        # por eso es seguro interpolarlos entre comillas dobles.
        tablas = [r[0] for r in cursor.fetchall() if r[0] not in _EXCLUIR]

        data = {}
        total_filas = 0
        for t in tablas:
            cursor.execute('SELECT * FROM "%s"' % t)
            columnas = [c[0] for c in cursor.description]
            filas = cursor.fetchall()
            total_filas += len(filas)
            data[t] = {'columnas': columnas, 'filas': filas}

    ahora = datetime.now()
    backup = {
        'sistema': 'Inventrix',
        'generado_en': ahora.isoformat(),
        'total_tablas': len(data),
        'total_filas': total_filas,
        'tablas': data,
    }

    contenido = json.dumps(backup, default=_serializar, ensure_ascii=False, indent=2)
    nombre = 'inventrix-backup-%s.json' % ahora.strftime('%Y%m%d-%H%M%S')

    resp = HttpResponse(contenido, content_type='application/json; charset=utf-8')
    resp['Content-Disposition'] = 'attachment; filename="%s"' % nombre
    return resp
