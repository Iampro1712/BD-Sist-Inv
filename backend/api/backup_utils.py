"""
Lógica compartida para generar el volcado lógico (JSON) de las tablas de
negocio. Usada tanto por el endpoint de descarga manual (backup_views.py)
como por el comando de respaldo automático (management/commands/backup_db.py).
"""
import json
from datetime import datetime, date
from decimal import Decimal

from django.db import connection

# Tablas internas de Django/auth: no son datos de negocio, se excluyen del respaldo.
EXCLUIR = {
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


def generar_backup_json():
    """Genera el respaldo completo y devuelve (contenido_str, nombre_archivo)."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        # Los nombres provienen del catálogo del sistema (no de input del usuario),
        # por eso es seguro interpolarlos entre comillas dobles.
        tablas = [r[0] for r in cursor.fetchall() if r[0] not in EXCLUIR]

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
    return contenido, nombre
