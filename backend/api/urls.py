"""
URL configuration for API endpoints
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProveedorViewSet, MarcaViewSet, CategoriaViewSet,
    ProductoViewSet, ClienteViewSet,
    OrdenCompraViewSet, OrdenVentaViewSet,
    MovimientoInventarioViewSet, MotoViewSet, ServicioMotoViewSet, ServicioViewSet
)
from .reportes_views import (
    reporte_inventario,
    reporte_ventas,
    reporte_compras,
    productos_mas_vendidos
)

# Create router instance
router = DefaultRouter()

# Register viewsets
router.register(r'proveedores', ProveedorViewSet, basename='proveedor')
router.register(r'marcas', MarcaViewSet, basename='marca')
router.register(r'categorias', CategoriaViewSet, basename='categoria')
router.register(r'productos', ProductoViewSet, basename='producto')
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'ordenes-compra', OrdenCompraViewSet, basename='orden-compra')
router.register(r'ordenes-venta', OrdenVentaViewSet, basename='orden-venta')
router.register(r'movimientos', MovimientoInventarioViewSet, basename='movimiento')
router.register(r'motos', MotoViewSet, basename='moto')
router.register(r'servicios-motos', ServicioMotoViewSet, basename='servicio-moto')
router.register(r'servicios', ServicioViewSet, basename='servicio')

urlpatterns = [
    path('', include(router.urls)),
    # Reportes endpoints
    path('reportes/inventario/', reporte_inventario, name='reporte-inventario'),
    path('reportes/ventas/', reporte_ventas, name='reporte-ventas'),
    path('reportes/compras/', reporte_compras, name='reporte-compras'),
    path('reportes/productos_mas_vendidos/', productos_mas_vendidos, name='productos-mas-vendidos'),
]
