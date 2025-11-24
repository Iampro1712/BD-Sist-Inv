"""
Middleware para manejo de errores global
"""
import logging
import traceback
from django.http import JsonResponse
from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from rest_framework.exceptions import APIException
from rest_framework import status

logger = logging.getLogger(__name__)


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
