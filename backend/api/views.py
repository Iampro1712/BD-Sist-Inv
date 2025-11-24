"""
ViewSets para la API de Inventrix
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.db.models import Q, Sum, F
from inventory.models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, OrdenVenta, MovimientoInventario, Moto, ServicioMoto, Servicio
)
from .serializers import (
    ProveedorListSerializer, ProveedorDetailSerializer,
    MarcaSerializer, CategoriaSerializer,
    ProductoListSerializer, ProductoDetailSerializer, ProductoCreateSerializer,
    ClienteListSerializer, ClienteDetailSerializer,
    OrdenCompraListSerializer, OrdenCompraDetailSerializer, OrdenCompraCreateSerializer,
    OrdenVentaListSerializer, OrdenVentaDetailSerializer, OrdenVentaCreateSerializer,
    MovimientoInventarioSerializer, MovimientoInventarioCreateSerializer,
    MotoSerializer, ServicioMotoSerializer, ClienteConMotosSerializer, ServicioSerializer
)
from .services import (
    InventoryService, OrdenCompraService, OrdenVentaService,
    InsufficientStockException, InvalidOrderStateException
)


# ============================================================================
# VIEWSETS BÁSICOS
# ============================================================================

class ProveedorViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de proveedores"""
    queryset = Proveedor.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre_empresa', 'persona_contacto', 'email', 'telefono']
    ordering_fields = ['nombre_empresa']
    ordering = ['nombre_empresa']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProveedorListSerializer
        return ProveedorDetailSerializer

    def perform_destroy(self, instance):
        """Eliminar proveedor usando SQL directo para evitar verificación de relaciones"""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM proveedores WHERE id_proveedor = %s", [instance.id_proveedor])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MarcaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de marcas"""
    queryset = Marca.objects.all()
    serializer_class = MarcaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre']
    ordering_fields = ['nombre', 'fecha_creacion']
    ordering = ['nombre']


class CategoriaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de categorías"""
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre']
    ordering_fields = ['nombre', 'fecha_creacion']
    ordering = ['nombre']


class ProductoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de productos"""
    queryset = Producto.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sku_producto', 'nombre']
    ordering_fields = ['nombre', 'sku_producto', 'cantidad_actual', 'precio_final']
    ordering = ['nombre']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductoListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ProductoCreateSerializer
        return ProductoDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtro por stock bajo
        bajo_stock = self.request.query_params.get('bajo_stock', None)
        if bajo_stock and bajo_stock.lower() == 'true':
            queryset = queryset.filter(cantidad_actual__lte=F('cantidad_minima'))
        
        return queryset

    def perform_destroy(self, instance):
        """Eliminar producto usando SQL directo para evitar verificación de relaciones"""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM productos WHERE id_producto = %s", [instance.id_producto])

    @action(detail=False, methods=['get'])
    def bajo_stock(self, request):
        """Obtiene productos con stock bajo el mínimo"""
        productos = self.get_queryset().filter(
            cantidad_actual__lte=F('cantidad_minima')
        )
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)


class ClienteViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de clientes"""
    queryset = Cliente.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'telefono', 'email']
    ordering_fields = ['nombre']
    ordering = ['nombre']

    def get_serializer_class(self):
        if self.action == 'list':
            return ClienteListSerializer
        return ClienteDetailSerializer

    def perform_destroy(self, instance):
        """Eliminar cliente usando SQL directo para evitar verificación de relaciones"""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM cliente WHERE id_cliente = %s", [instance.id_cliente])
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrdenCompraViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de órdenes de compra"""
    queryset = OrdenCompra.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_orden']
    ordering_fields = ['fecha_creacion']
    ordering = ['-fecha_creacion']

    def get_serializer_class(self):
        if self.action == 'list':
            return OrdenCompraListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return OrdenCompraCreateSerializer
        return OrdenCompraDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtro por estado
        estado = self.request.query_params.get('estado', None)
        if estado:
            # Mapear el nombre del estado al ID
            estados_map = {
                'cancelado': 1,
                'pendiente': 2,
                'completado': 3
            }
            estado_id = estados_map.get(estado.lower())
            if estado_id:
                queryset = queryset.filter(id_estado=estado_id)
        
        # Filtro por proveedor
        proveedor = self.request.query_params.get('proveedor', None)
        if proveedor:
            queryset = queryset.filter(id_proveedor=proveedor)
        
        # Filtro por fecha inicio
        fecha_inicio = self.request.query_params.get('fecha_inicio', None)
        if fecha_inicio:
            queryset = queryset.filter(fecha_creacion__gte=fecha_inicio)
        
        # Filtro por fecha fin
        fecha_fin = self.request.query_params.get('fecha_fin', None)
        if fecha_fin:
            queryset = queryset.filter(fecha_creacion__lte=fecha_fin)
        
        return queryset

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        """Marca una orden de compra como recibida y actualiza el inventario"""
        try:
            orden = self.get_object()
            OrdenCompraService.recibir_orden(orden.id)
            return Response({'status': 'Orden recibida exitosamente'})
        except InvalidOrderStateException as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error al recibir orden: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """Cancela una orden de compra"""
        try:
            orden = self.get_object()
            OrdenCompraService.cancelar_orden(orden.id)
            return Response({'status': 'Orden cancelada exitosamente'})
        except InvalidOrderStateException as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class OrdenVentaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de órdenes de venta"""
    queryset = OrdenVenta.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_venta']
    ordering_fields = ['fecha', 'total']
    ordering = ['-fecha']

    def get_serializer_class(self):
        if self.action == 'list':
            return OrdenVentaListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return OrdenVentaCreateSerializer
        return OrdenVentaDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        cliente = self.request.query_params.get('cliente', None)
        if cliente:
            queryset = queryset.filter(id_cliente=cliente)
        
        fecha_inicio = self.request.query_params.get('fecha_inicio', None)
        if fecha_inicio:
            queryset = queryset.filter(fecha__gte=fecha_inicio)
        
        fecha_fin = self.request.query_params.get('fecha_fin', None)
        if fecha_fin:
            queryset = queryset.filter(fecha__lte=fecha_fin)
        
        return queryset

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        """Marca una orden de venta como completada y actualiza el inventario"""
        try:
            orden = self.get_object()
            OrdenVentaService.completar_orden(orden.id)
            return Response({'status': 'Orden completada exitosamente'})
        except (InvalidOrderStateException, InsufficientStockException) as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error al completar orden: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """Cancela una orden de venta"""
        try:
            orden = self.get_object()
            OrdenVentaService.cancelar_orden(orden.id)
            return Response({'status': 'Orden cancelada exitosamente'})
        except InvalidOrderStateException as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de movimientos de inventario"""
    queryset = MovimientoInventario.objects.select_related('producto').all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['producto__nombre', 'producto__codigo', 'referencia']
    ordering_fields = ['fecha']
    ordering = ['-fecha']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MovimientoInventarioCreateSerializer
        return MovimientoInventarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        tipo = self.request.query_params.get('tipo', None)
        if tipo:
            queryset = queryset.filter(tipo=tipo.upper())
        
        producto = self.request.query_params.get('producto', None)
        if producto:
            queryset = queryset.filter(producto_id=producto)
        
        return queryset


# Dashboard y reportes removidos temporalmente
# Se implementarán cuando se necesiten


# ============================================================================
# VIEWSETS PARA MOTOS Y SERVICIOS
# ============================================================================

class MotoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de motos"""
    queryset = Moto.objects.all().select_related('id_cliente').prefetch_related('servicios')
    serializer_class = MotoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['marca', 'modelo', 'placa', 'id_cliente__nombre']
    ordering_fields = ['marca', 'modelo', 'anio']
    ordering = ['-anio']

    def get_queryset(self):
        """Filtrar motos por cliente si se proporciona el parámetro"""
        queryset = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente', None)
        if cliente_id:
            queryset = queryset.filter(id_cliente=cliente_id)
        return queryset


class ServicioMotoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de servicios de motos"""
    queryset = ServicioMoto.objects.all().select_related('id_moto')
    serializer_class = ServicioMotoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tipo_servicio', 'descripcion', 'id_moto__placa']
    ordering_fields = ['fecha_servicio', 'costo']
    ordering = ['-fecha_servicio']

    def get_queryset(self):
        """Filtrar servicios por moto si se proporciona el parámetro"""
        queryset = super().get_queryset()
        moto_id = self.request.query_params.get('moto', None)
        if moto_id:
            queryset = queryset.filter(id_moto=moto_id)
        return queryset



class ServicioViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para catálogo de servicios (solo lectura)"""
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'tipo']
    ordering_fields = ['nombre', 'precio_mano_obra']
    ordering = ['nombre']
    
    def list(self, request, *args, **kwargs):
        """Listar servicios únicos por nombre"""
        from django.db.models import Min
        
        # Obtener servicios únicos por nombre con el precio mínimo
        servicios_unicos = Servicio.objects.values('nombre').annotate(
            precio_mano_obra=Min('precio_mano_obra'),
            tipo=Min('tipo')
        ).order_by('nombre')
        
        return Response(list(servicios_unicos))
