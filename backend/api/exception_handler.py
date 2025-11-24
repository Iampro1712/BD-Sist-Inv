"""
Exception handler personalizado para Django REST Framework
"""
import logging
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Handler personalizado para excepciones de DRF
    Estandariza el formato de respuesta de errores
    """
    # Llamar al handler por defecto de DRF
    response = drf_exception_handler(exc, context)

    if response is not None:
        # Estandarizar el formato de respuesta
        custom_response_data = {
            'error': {
                'code': getattr(exc, 'default_code', 'error'),
                'message': str(exc.detail) if hasattr(exc, 'detail') else str(exc),
                'status': response.status_code,
            }
        }

        # Si hay detalles adicionales, incluirlos
        if isinstance(response.data, dict):
            if 'detail' not in response.data:
                custom_response_data['error']['details'] = response.data

        response.data = custom_response_data

        # Log del error
        logger.error(
            f"API Error: {custom_response_data['error']['code']} - {custom_response_data['error']['message']}",
            extra={
                'status_code': response.status_code,
                'view': context.get('view'),
                'request': context.get('request'),
            }
        )

    return response
