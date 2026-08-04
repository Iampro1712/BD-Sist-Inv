"""
Paginación del API.
"""
from rest_framework.pagination import PageNumberPagination


class PaginacionConfigurable(PageNumberPagination):
    """Deja que el cliente pida cuántos elementos quiere por página.

    `PageNumberPagination` a secas **ignora en silencio** cualquier `page_size`
    que mande el cliente: sin `page_size_query_param` definido, el parámetro
    simplemente no se lee y siempre se devuelve `PAGE_SIZE`.

    Eso rompía funciones enteras sin dar ningún error. El selector de clientes
    de "Agendar servicio" pide `page_size=200` y recibía 20: del cliente número
    21 en adelante no se podía elegir a nadie. Al Kanban del taller le pasaba lo
    mismo con las órdenes activas, y al selector de proveedores de Productos.

    `max_page_size` acota el otro lado: sin tope, un `?page_size=100000` desde
    fuera obliga al servidor a serializar la tabla entera.
    """
    page_size_query_param = 'page_size'
    max_page_size = 500
