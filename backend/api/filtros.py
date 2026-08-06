"""
Ayudas para leer filtros de la query string.
"""
from rest_framework.exceptions import ValidationError


def id_de_query(valor, nombre):
    """Convierte un parámetro de filtro a entero, o rechaza la petición.

    Sin esto, `?proveedor=abc` llegaba tal cual al ORM y Postgres reventaba con
    un error de tipo que salía como **500**: el cliente mandó algo inválido pero
    la respuesta decía que la culpa era del servidor, y el traceback quedaba en
    los registros como si fuera una falla real.

    :return: el entero, o `None` si el parámetro venía vacío (no hay filtro).
    """
    if valor in (None, ''):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValidationError(
            {nombre: f'Tiene que ser un número. Se recibió: "{valor}".'})
