"""
Permisos personalizados para la segregación de funciones por rol (US-04).

Modelo de roles del sistema:
  - Administrador (is_staff=True): puede todo.
  - Usuario (autenticado, no staff): opera el día a día — ventas, pagos, POS,
    cotizaciones, devoluciones, y alta/edición de clientes/proveedores — pero
    NO puede realizar acciones destructivas sobre el catálogo/inventario
    (borrar productos/clientes/proveedores, importar, ajustar stock, gestionar
    órdenes de compra).
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrReadOnly(BasePermission):
    """Lectura para cualquier usuario autenticado; escritura (POST/PUT/PATCH/
    DELETE y acciones custom con métodos no seguros) solo para is_staff."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user.is_staff)
