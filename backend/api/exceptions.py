"""
Excepciones personalizadas para la API de Inventrix
"""
from rest_framework.exceptions import APIException
from rest_framework import status


class InsufficientStockException(APIException):
    """Excepción cuando no hay suficiente stock"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Stock insuficiente para completar la operación'
    default_code = 'insufficient_stock'


class InvalidOrderStateException(APIException):
    """Excepción cuando el estado de la orden no permite la operación"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'El estado actual de la orden no permite esta operación'
    default_code = 'invalid_order_state'


class ProductNotFoundException(APIException):
    """Excepción cuando no se encuentra un producto"""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Producto no encontrado'
    default_code = 'product_not_found'


class OrderNotFoundException(APIException):
    """Excepción cuando no se encuentra una orden"""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Orden no encontrada'
    default_code = 'order_not_found'


class ValidationException(APIException):
    """Excepción para errores de validación"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Error de validación'
    default_code = 'validation_error'


class BusinessLogicException(APIException):
    """Excepción para errores de lógica de negocio"""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = 'Error en la lógica de negocio'
    default_code = 'business_logic_error'
