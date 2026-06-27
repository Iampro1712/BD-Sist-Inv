"""
URL configuration for API endpoints
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProveedorViewSet, MarcaViewSet, CategoriaViewSet,
    ProductoViewSet, ClienteViewSet,
    OrdenCompraViewSet, OrdenVentaViewSet,
    MovimientoInventarioViewSet, MotoViewSet, ServicioMotoViewSet, ServicioViewSet,
    BitacoraServicioViewSet, ServicioMotoConBitacoraViewSet, AuditoriaProductoViewSet,
    GarantiaViewSet, ReclamacionViewSet,
    CotizacionViewSet, DevolucionViewSet,
    UsuarioViewSet,
)
from .auth_views import LoginView, logout_view, me_view
from rest_framework_simplejwt.views import TokenRefreshView
from .reportes_views import (
    reporte_inventario,
    reporte_ventas,
    reporte_compras,
    productos_mas_vendidos,
    cuentas_por_cobrar,
    reporte_rentabilidad,
    reporte_stock_muerto,
)
from .backup_views import exportar_backup

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
router.register(r'bitacora', BitacoraServicioViewSet, basename='bitacora')
router.register(r'servicios-con-bitacora', ServicioMotoConBitacoraViewSet, basename='servicio-con-bitacora')
router.register(r'auditoria-productos', AuditoriaProductoViewSet, basename='auditoria-producto')
router.register(r'garantias', GarantiaViewSet, basename='garantia')
router.register(r'reclamaciones', ReclamacionViewSet, basename='reclamacion')
router.register(r'cotizaciones', CotizacionViewSet, basename='cotizacion')
router.register(r'devoluciones', DevolucionViewSet, basename='devolucion')
router.register(r'usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('', include(router.urls)),
    # Autenticación (JWT)
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', logout_view, name='auth-logout'),
    path('auth/me/', me_view, name='auth-me'),
    # Reportes endpoints
    path('reportes/inventario/', reporte_inventario, name='reporte-inventario'),
    path('reportes/ventas/', reporte_ventas, name='reporte-ventas'),
    path('reportes/compras/', reporte_compras, name='reporte-compras'),
    path('reportes/productos_mas_vendidos/', productos_mas_vendidos, name='productos-mas-vendidos'),
    path('reportes/cuentas-por-cobrar/', cuentas_por_cobrar, name='cuentas-por-cobrar'),
    path('reportes/rentabilidad/', reporte_rentabilidad, name='reporte-rentabilidad'),
    path('reportes/stock-muerto/', reporte_stock_muerto, name='reporte-stock-muerto'),
    path('backup/', exportar_backup, name='backup'),
]
