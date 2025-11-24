"""
Configuración del admin de Django para los modelos de inventario
"""
from django.contrib import admin
from .models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, DetalleOrdenCompra, OrdenVenta, DetalleOrdenVenta,
    MovimientoInventario
)


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = ['nombre_empresa', 'persona_contacto', 'telefono', 'email']
    search_fields = ['nombre_empresa', 'persona_contacto', 'email']
    ordering = ['nombre_empresa']


@admin.register(Marca)
class MarcaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'fecha_creacion']
    search_fields = ['nombre']
    ordering = ['nombre']


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'fecha_creacion']
    search_fields = ['nombre']
    ordering = ['nombre']


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = [
        'sku_producto', 'nombre', 'cantidad_actual', 'cantidad_minima', 'precio_final'
    ]
    search_fields = ['sku_producto', 'nombre']
    ordering = ['nombre']


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'telefono', 'email']
    search_fields = ['nombre', 'telefono', 'email']
    ordering = ['nombre']


class DetalleOrdenCompraInline(admin.TabularInline):
    model = DetalleOrdenCompra
    extra = 1
    fields = ['producto', 'cantidad', 'precio_unitario', 'subtotal']
    readonly_fields = ['subtotal']


@admin.register(OrdenCompra)
class OrdenCompraAdmin(admin.ModelAdmin):
    list_display = ['id_orden', 'id_proveedor', 'id_estado', 'fecha_creacion']
    list_filter = ['id_estado', 'fecha_creacion']
    search_fields = ['id_orden']
    ordering = ['-fecha_creacion']
    readonly_fields = ['fecha_creacion']


# DetalleOrdenVentaInline comentado - no existe en la estructura actual de la BD
# class DetalleOrdenVentaInline(admin.TabularInline):
#     model = DetalleOrdenVenta
#     extra = 1
#     fields = ['producto', 'cantidad', 'precio_unitario', 'subtotal']
#     readonly_fields = ['subtotal']


@admin.register(OrdenVenta)
class OrdenVentaAdmin(admin.ModelAdmin):
    list_display = [
        'id_venta', 'id_cliente', 'fecha', 'total'
    ]
    list_filter = ['fecha']
    search_fields = ['id_venta']
    ordering = ['-fecha']
    readonly_fields = ['id_venta']


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = [
        'producto', 'tipo', 'cantidad', 'fecha',
        'referencia', 'tipo_referencia'
    ]
    list_filter = ['tipo', 'fecha', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo', 'referencia']
    ordering = ['-fecha']
    readonly_fields = ['fecha']
