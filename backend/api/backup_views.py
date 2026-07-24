"""
Respaldo / exportación de datos con un clic.

Genera un volcado lógico (JSON) de todas las tablas de negocio de la base de
datos y lo entrega como descarga directa. Pensado para un dueño sin equipo de
IT: bajar una copia de seguridad cuando quiera y guardarla.
"""
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

from .backup_utils import generar_backup_json


@api_view(['GET'])
@permission_classes([IsAdminUser])
def exportar_backup(request):
    """Devuelve un archivo JSON descargable con todas las tablas de negocio.

    Solo administradores: el respaldo contiene TODA la base de negocio
    (clientes, ventas, márgenes, PII), un empleado no debe poder exfiltrarla.
    """
    contenido, nombre = generar_backup_json()

    resp = HttpResponse(contenido, content_type='application/json; charset=utf-8')
    resp['Content-Disposition'] = 'attachment; filename="%s"' % nombre
    return resp
