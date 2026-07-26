"""
Middleware para manejo de errores global y contexto de auditoría
"""
import logging
import traceback
from django.db import connection
from django.http import JsonResponse
from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from rest_framework.exceptions import APIException
from rest_framework import status

logger = logging.getLogger(__name__)


class AuditoriaUsuarioMiddleware:
    """Publica quién hace cada cambio para que el trigger de auditoría lo registre.

    La auditoría de productos la escribe un trigger de Postgres
    (`fn_auditoria_productos`), que es lo único que captura *todos* los cambios:
    buena parte del sistema actualiza `productos` con SQL crudo, así que las
    señales de Django se perderían la mayoría.

    El problema es que un trigger no sabe quién es el usuario de la aplicación:
    solo ve el rol de conexión (`postgres`), que era lo que aparecía en los logs.
    Acá se deja el username en una variable de sesión de Postgres que el trigger
    lee.

    Dos cuidados que importan:

    1. Las conexiones se reutilizan entre peticiones (`conn_max_age=600`), así
       que la variable se escribe **siempre**, incluso vacía. Si solo se
       escribiera cuando hay usuario, una petición anónima heredaría el nombre
       del usuario anterior y le atribuiría cambios que no hizo.
    2. Con JWT el usuario no está resuelto todavía en esta etapa: DRF autentica
       dentro de la vista. Por eso se resuelve el token explícitamente.
    """

    # Prefijo propio para no chocar con otras variables de sesión.
    VAR_USUARIO = 'inventrix.usuario'
    VAR_IP = 'inventrix.ip'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._publicar(self._resolver_usuario(request), self._resolver_ip(request))
        try:
            return self.get_response(request)
        finally:
            # Se limpia para que la conexión no quede "marcada" con este usuario
            # si la reutiliza otra petición.
            self._publicar('', '')

    # ------------------------------------------------------------------

    def _publicar(self, usuario, ip):
        try:
            with connection.cursor() as cursor:
                # set_config con parámetros: evita cualquier riesgo de inyección
                # al interpolar el nombre en un SET.
                cursor.execute(
                    "SELECT set_config(%s, %s, false), set_config(%s, %s, false)",
                    [self.VAR_USUARIO, usuario or '', self.VAR_IP, ip or ''],
                )
        except Exception:
            # La auditoría no puede tumbar una petición: si la conexión falla,
            # el trigger cae a su valor por defecto.
            logger.warning('No se pudo publicar el contexto de auditoría',
                           exc_info=True)

    def _resolver_usuario(self, request):
        """Username del que hace el cambio, o None si no hay sesión."""
        # Sesión de Django (admin).
        usuario = getattr(request, 'user', None)
        if usuario is not None and usuario.is_authenticated:
            return usuario.get_username()

        # JWT (el resto de la API). DRF lo resuelve dentro de la vista, después
        # de este middleware, así que acá hay que pedirlo explícitamente.
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            resultado = JWTAuthentication().authenticate(request)
            if resultado is not None:
                return resultado[0].get_username()
        except Exception:
            # Token ausente, vencido o inválido: es una petición sin usuario.
            pass
        return None

    def _resolver_ip(self, request):
        adelantada = request.META.get('HTTP_X_FORWARDED_FOR')
        if adelantada:
            # El primero de la cadena es el cliente real (Traefik agrega los suyos).
            return adelantada.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class ErrorHandlingMiddleware:
    """
    Middleware para capturar y manejar errores de forma global
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_exception(self, request, exception):
        """
        Procesa excepciones no capturadas
        """
        # Log del error
        logger.error(
            f"Error en {request.method} {request.path}: {str(exception)}",
            exc_info=True,
            extra={
                'request': request,
                'user': getattr(request, 'user', None),
            }
        )

        # Determinar el código de estado y mensaje
        if isinstance(exception, APIException):
            status_code = exception.status_code
            error_detail = exception.detail
            error_code = getattr(exception, 'default_code', 'error')
        elif isinstance(exception, ValidationError):
            status_code = status.HTTP_400_BAD_REQUEST
            error_detail = str(exception)
            error_code = 'validation_error'
        elif isinstance(exception, PermissionDenied):
            status_code = status.HTTP_403_FORBIDDEN
            error_detail = 'No tiene permisos para realizar esta acción'
            error_code = 'permission_denied'
        elif isinstance(exception, ObjectDoesNotExist):
            status_code = status.HTTP_404_NOT_FOUND
            error_detail = 'Recurso no encontrado'
            error_code = 'not_found'
        else:
            # Error genérico del servidor
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            error_detail = 'Error interno del servidor'
            error_code = 'internal_server_error'

            # En desarrollo, incluir el traceback
            if hasattr(request, 'DEBUG') and request.DEBUG:
                error_detail = str(exception)

        # Formato estandarizado de respuesta de error
        error_response = {
            'error': {
                'code': error_code,
                'message': str(error_detail),
                'status': status_code,
            }
        }

        # En desarrollo, agregar información adicional
        if hasattr(request, 'DEBUG') and request.DEBUG:
            error_response['error']['traceback'] = traceback.format_exc()
            error_response['error']['path'] = request.path
            error_response['error']['method'] = request.method

        return JsonResponse(error_response, status=status_code)
