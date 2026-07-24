"""
ViewSets para la API de Inventrix
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.exceptions import ValidationError as DRFValidationError
from .permissions import IsAdminOrReadOnly
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db.models import Q, Sum, F
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from inventory.models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, OrdenVenta, MovimientoInventario, Moto, ServicioMoto, Servicio,
    BitacoraServicio, AuditoriaProducto, Garantia, ReclamacionGarantia, PagoVenta,
    Cotizacion, Devolucion
)
from .serializers import (
    ProveedorListSerializer, ProveedorDetailSerializer,
    MarcaSerializer, CategoriaSerializer,
    ProductoListSerializer, ProductoDetailSerializer, ProductoCreateSerializer,
    ClienteListSerializer, ClienteDetailSerializer,
    OrdenCompraListSerializer, OrdenCompraDetailSerializer, OrdenCompraCreateSerializer,
    OrdenVentaListSerializer, OrdenVentaDetailSerializer, OrdenVentaCreateSerializer,
    PagoVentaSerializer, PagoVentaCreateSerializer,
    MovimientoInventarioSerializer, MovimientoInventarioCreateSerializer,
    MotoSerializer, ServicioMotoSerializer, ClienteConMotosSerializer, ServicioSerializer,
    BitacoraServicioSerializer, BitacoraServicioCreateSerializer,
    ServicioMotoConBitacoraSerializer, AuditoriaProductoSerializer,
    GarantiaListSerializer, GarantiaDetailSerializer,
    ReclamacionCreateSerializer, ReclamacionDetailSerializer, ReclamacionListSerializer,
    CotizacionListSerializer, CotizacionDetailSerializer, CotizacionCreateSerializer,
    DevolucionListSerializer, DevolucionDetailSerializer, DevolucionCreateSerializer,
    UsuarioSerializer,
)

# MasterDev
# ============================================================================
# VIEWSETS BÁSICOS
# ============================================================================

class ProveedorViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de proveedores"""
    queryset = Proveedor.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    # telefono/email quedaron fuera: se cifran en reposo (R06) y el texto
    # cifrado no admite búsqueda por substring (ILIKE).
    search_fields = ['nombre_empresa', 'persona_contacto']
    ordering_fields = ['nombre_empresa']
    ordering = ['nombre_empresa']

    def get_permissions(self):
        # Un usuario no-admin puede crear/editar proveedores (los necesita al
        # operar), pero solo un admin puede borrarlos (US-04).
        if self.action == 'destroy':
            return [IsAdminUser()]
        return [IsAuthenticated()]

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

    @action(detail=True, methods=['get'])
    def productos(self, request, pk=None):
        proveedor = self.get_object()
        productos = proveedor.productos.all().order_by('nombre')
        serializer = ProductoListSerializer(productos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def ordenes(self, request, pk=None):
        proveedor = self.get_object()
        ordenes = OrdenCompra.objects.filter(id_proveedor=proveedor).order_by('-fecha')
        serializer = OrdenCompraListSerializer(ordenes, many=True)
        return Response(serializer.data)


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
    """ViewSet para gestión de productos.

    Lectura para cualquier usuario (POS/ventas la necesitan); crear, editar,
    borrar e importar productos son acciones de administrador (US-04).
    """
    permission_classes = [IsAdminOrReadOnly]
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
        
        # Filtro por proveedor
        proveedor_id = self.request.query_params.get('proveedor', None)
        if proveedor_id:
            queryset = queryset.filter(id_proveedor_id=proveedor_id)
        
        return queryset

    def perform_destroy(self, instance):
        """Eliminar producto usando SQL directo para evitar verificación de relaciones"""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM productos WHERE id_producto = %s", [instance.id_producto])

    @method_decorator(cache_page(60))
    @action(detail=False, methods=['get'])
    def bajo_stock(self, request):
        """Obtiene productos con stock bajo el mínimo (cacheado 60s)"""
        productos = self.get_queryset().filter(
            cantidad_actual__lte=F('cantidad_minima')
        )
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        """Importación masiva de productos. Upsert por SKU.

        Body: { "productos": [ {sku_producto, nombre, cantidad_actual?,
        cantidad_minima?, precio_compra_unitario?, precio_final?, id_proveedor?}, ... ] }
        """
        filas = request.data.get('productos')
        if not isinstance(filas, list) or not filas:
            return Response(
                {'error': 'Se requiere una lista no vacía en "productos"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Campos numéricos opcionales que el serializer aceptará
        NUM_FIELDS = ['cantidad_actual', 'cantidad_minima', 'cantidad_total',
                      'precio_compra_unitario', 'precio_final', 'id_proveedor', 'meses_garantia']
        TEXT_FIELDS = ['tipo_garantia', 'descripcion_garantia']

        creados, actualizados, errores = 0, 0, []
        for i, fila in enumerate(filas):
            num = i + 1
            sku = str(fila.get('sku_producto') or '').strip()
            nombre = str(fila.get('nombre') or '').strip()
            if not sku or not nombre:
                errores.append({'fila': num, 'error': 'sku_producto y nombre son obligatorios'})
                continue

            data = {'sku_producto': sku, 'nombre': nombre}
            for f in NUM_FIELDS:
                v = fila.get(f)
                if v not in (None, ''):
                    data[f] = v
            for f in TEXT_FIELDS:
                v = fila.get(f)
                if v not in (None, ''):
                    data[f] = v

            existente = Producto.objects.filter(sku_producto=sku).first()
            serializer = ProductoCreateSerializer(
                instance=existente, data=data, partial=bool(existente)
            )
            if serializer.is_valid():
                try:
                    serializer.save()
                    if existente:
                        actualizados += 1
                    else:
                        creados += 1
                except Exception as e:  # noqa: BLE001
                    errores.append({'fila': num, 'sku': sku, 'error': str(e)})
            else:
                errores.append({'fila': num, 'sku': sku, 'error': serializer.errors})

        return Response({
            'creados': creados,
            'actualizados': actualizados,
            'errores': errores,
            'total_procesados': len(filas),
        }, status=status.HTTP_200_OK)


class ClienteViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de clientes"""
    queryset = Cliente.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    # telefono/email quedaron fuera: se cifran en reposo (R06) y el texto
    # cifrado no admite búsqueda por substring (ILIKE).
    search_fields = ['nombre']
    ordering_fields = ['nombre', 'id_cliente']
    ordering = ['nombre']

    def get_permissions(self):
        # Un usuario no-admin puede crear/editar clientes (los da de alta al
        # vender), pero solo un admin puede borrarlos (US-04).
        if self.action == 'destroy':
            return [IsAdminUser()]
        return [IsAuthenticated()]

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
    """ViewSet para gestión de órdenes de compra.

    Comprar mercancía (crear/confirmar/recibir/cancelar órdenes de compra) es
    una función de administrador; los usuarios solo pueden consultarlas (US-04).
    """
    permission_classes = [IsAdminOrReadOnly]
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
            estados_map = {
                'cancelado': 1, 'cancelada': 1,
                'pendiente': 2,
                'confirmada': 3, 'recibida': 3, 'completado': 3,
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
    def confirmar(self, request, pk=None):
        """Confirma una orden de compra (pendiente → recibida/completada)"""
        try:
            orden = self.get_object()
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE orden_compra SET id_estado = 3 WHERE id_orden = %s AND id_estado = 2",
                    [orden.id_orden]
                )
                if cursor.rowcount == 0:
                    return Response(
                        {'error': 'La orden no está en estado pendiente o no existe'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            return Response({'status': 'Orden confirmada exitosamente'})
        except Exception as e:
            return Response(
                {'error': f'Error al confirmar orden: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        """Marca una orden de compra como recibida"""
        try:
            orden = self.get_object()
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE orden_compra SET id_estado = 3 WHERE id_orden = %s AND id_estado IN (2, 3)",
                    [orden.id_orden]
                )
            return Response({'status': 'Orden recibida exitosamente'})
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
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE orden_compra SET id_estado = 1 WHERE id_orden = %s AND id_estado != 3",
                    [orden.id_orden]
                )
                if cursor.rowcount == 0:
                    return Response(
                        {'error': 'La orden ya fue recibida y no puede cancelarse'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            return Response({'status': 'Orden cancelada exitosamente'})
        except Exception as e:
            return Response(
                {'error': f'Error al cancelar orden: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
            # Intentar filtrar por ID primero, si falla buscar por nombre
            try:
                cliente_id = int(cliente)
                queryset = queryset.filter(id_cliente=cliente_id)
            except (ValueError, TypeError):
                # Si no es un número, buscar por nombre de cliente
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT id_cliente FROM cliente WHERE nombre = %s
                    """, [cliente])
                    result = cursor.fetchone()
                    if result:
                        queryset = queryset.filter(id_cliente=result[0])
                    else:
                        # Si no se encuentra el cliente, retornar queryset vacío
                        queryset = queryset.none()
        
        fecha_inicio = self.request.query_params.get('fecha_inicio', None)
        if fecha_inicio:
            queryset = queryset.filter(fecha__gte=fecha_inicio)
        
        fecha_fin = self.request.query_params.get('fecha_fin', None)
        if fecha_fin:
            queryset = queryset.filter(fecha__lte=fecha_fin)

        estado_pago = self.request.query_params.get('estado_pago', None)
        if estado_pago:
            queryset = queryset.filter(estado_pago=estado_pago)

        return queryset

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """Cancela una orden de venta: restituye el stock vendido y elimina la venta.

        No hay un estado de orden más allá del pago (ver estado_pago), así que
        cancelar significa anular la venta completa: se revierte el stock de
        cada producto vendido (con su movimiento de inventario), se eliminan
        los pagos/abonos asociados y se borra la venta.
        """
        from django.db import connection, transaction

        motivo = request.data.get('motivo') or 'Cancelación de venta'

        with transaction.atomic():
            orden = OrdenVenta.objects.select_for_update().get(pk=self.get_object().pk)

            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id_producto, cantidad FROM producto_venta WHERE id_venta = %s",
                    [orden.id_venta],
                )
                items = cursor.fetchall()

                for id_producto, cantidad in items:
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = cantidad_actual + %s WHERE id_producto = %s",
                        [cantidad, id_producto],
                    )
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                        VALUES (%s, 'ENTRADA', %s, NOW(), %s, 'ORDEN_VENTA', %s)
                    """, [id_producto, cantidad, f'CANCEL-{orden.id_venta}', motivo])

                cursor.execute("DELETE FROM producto_venta WHERE id_venta = %s", [orden.id_venta])

                # Se borra por SQL directo (no orden.delete()): los detalles
                # de la venta viven en producto_venta (ya borrados arriba),
                # no en una tabla "detalles_orden_venta" separada.
                cursor.execute("DELETE FROM pagos_venta WHERE id_venta = %s", [orden.id_venta])
                cursor.execute("DELETE FROM ventas WHERE id_venta = %s", [orden.id_venta])

        return Response({'status': 'Orden cancelada exitosamente, stock restituido'})

    # ------------------------------------------------------------------
    # Pago por adelantado / abonos
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'], url_path='pagos')
    def pagos(self, request, pk=None):
        """Lista los pagos/abonos de una venta (más reciente primero)."""
        orden = self.get_object()
        serializer = PagoVentaSerializer(orden.pagos.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='registrar-pago')
    def registrar_pago(self, request, pk=None):
        """Registra un pago/abono y recalcula el saldo de la venta."""
        from django.db import transaction
        with transaction.atomic():
            # Bloquea la fila de la venta para evitar descuadres con pagos simultáneos
            orden = OrdenVenta.objects.select_for_update().get(pk=pk)

            if orden.estado_pago == 'pagado':
                return Response(
                    {'error': 'Esta venta ya está completamente pagada'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = PagoVentaCreateSerializer(
                data=request.data, context={'venta': orden}
            )
            serializer.is_valid(raise_exception=True)
            pago = serializer.save()

        return Response(PagoVentaSerializer(pago).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'pagos/(?P<id_pago>[^/.]+)')
    def eliminar_pago(self, request, pk=None, id_pago=None):
        """Elimina un pago (solo el último registrado) y recalcula el saldo."""
        from django.db import transaction
        with transaction.atomic():
            orden = OrdenVenta.objects.select_for_update().get(pk=pk)

            try:
                pago = orden.pagos.get(pk=id_pago)
            except PagoVenta.DoesNotExist:
                return Response(
                    {'error': 'Pago no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )

            ultimo = orden.pagos.order_by('-created_at', '-id_pago').first()
            if ultimo and pago.id_pago != ultimo.id_pago:
                return Response(
                    {'error': 'Solo se puede eliminar el último pago registrado'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            pago.delete()
            orden.calcular_saldo()

        return Response(status=status.HTTP_204_NO_CONTENT)


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de movimientos de inventario.

    Ajustar stock manualmente (acción `ajuste`) o crear movimientos es función
    de administrador; los usuarios solo pueden consultar el historial (US-04).
    Las salidas por venta no pasan por aquí (las hace OrdenVentaCreateSerializer),
    así que restringir esto no bloquea el POS.
    """
    permission_classes = [IsAdminOrReadOnly]
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

    @action(detail=False, methods=['post'])
    def ajuste(self, request):
        """Crear un ajuste manual de inventario"""
        try:
            producto_id = request.data.get('producto_id')
            cantidad = request.data.get('cantidad')
            notas = request.data.get('notas', '')

            if not producto_id or cantidad is None:
                return Response(
                    {'error': 'Se requieren producto_id y cantidad'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Convertir cantidad a entero
            try:
                cantidad = int(cantidad)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'La cantidad debe ser un número entero'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Verificar que el producto existe
            try:
                producto = Producto.objects.get(id_producto=producto_id)
            except Producto.DoesNotExist:
                return Response(
                    {'error': 'Producto no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Verificar que el ajuste no deje stock negativo
            nuevo_stock = producto.cantidad_actual + cantidad
            if nuevo_stock < 0:
                return Response(
                    {'error': f'El ajuste dejaría el stock en {nuevo_stock}. No se puede tener stock negativo.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Crear el movimiento de ajuste
            movimiento_data = {
                'producto': producto_id,
                'tipo': 'AJUSTE',
                'cantidad': cantidad,
                'referencia': 'AJUSTE_MANUAL',
                'notas': notas
            }

            serializer = MovimientoInventarioCreateSerializer(data=movimiento_data)
            if serializer.is_valid():
                movimiento = serializer.save()
                
                # Actualizar el stock del producto
                producto.cantidad_actual = nuevo_stock
                producto.save()

                return Response(
                    MovimientoInventarioSerializer(movimiento).data,
                    status=status.HTTP_201_CREATED
                )
            else:
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            return Response(
                {'error': f'Error al crear ajuste: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
    
    def perform_create(self, serializer):
        """Crear servicio y registrar venta automáticamente"""
        from django.db import connection, transaction
        
        # Usar transacción para asegurar que ambas operaciones se completen
        with transaction.atomic():
            # Guardar el servicio
            servicio = serializer.save()
            
            # Obtener el cliente de la moto
            moto = servicio.id_moto
            cliente_id = moto.id_cliente.id_cliente
            
            # Crear una venta asociada al servicio
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO ventas (id_cliente, fecha, total)
                    VALUES (%s, %s, %s)
                    RETURNING id_venta
                """, [
                    cliente_id,
                    servicio.fecha_servicio,
                    servicio.costo
                ])
                id_venta = cursor.fetchone()[0]
                
                # Log para debugging
                print(f"✅ Venta creada automáticamente: ID {id_venta} para servicio {servicio.id_servicio}")
        
        return servicio



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


# ============================================================================
# BITÁCORA VIEWSETS
# ============================================================================

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from inventory.models import BitacoraServicio
from .serializers import (
    BitacoraServicioSerializer, BitacoraServicioCreateSerializer,
    ServicioMotoConBitacoraSerializer
)


class BitacoraServicioViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de bitácoras de servicios con imágenes en R2"""
    queryset = BitacoraServicio.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['modulo', 'notas', 'tecnico_responsable']
    ordering_fields = ['fecha_registro', 'modulo']
    ordering = ['-fecha_registro']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BitacoraServicioCreateSerializer
        return BitacoraServicioSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por servicio
        id_servicio = self.request.query_params.get('id_servicio', None)
        if id_servicio:
            queryset = queryset.filter(id_servicio=id_servicio)
        
        # Filtrar por moto
        id_moto = self.request.query_params.get('id_moto', None)
        if id_moto:
            queryset = queryset.filter(id_moto=id_moto)
        
        # Filtrar por módulo
        modulo = self.request.query_params.get('modulo', None)
        if modulo:
            queryset = queryset.filter(modulo=modulo)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def por_servicio(self, request):
        """Obtiene todas las bitácoras de un servicio organizadas por módulo"""
        id_servicio = request.query_params.get('id_servicio')
        if not id_servicio:
            return Response(
                {'error': 'Se requiere el parámetro id_servicio'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            servicio = ServicioMoto.objects.get(id_servicio=id_servicio)
            serializer = ServicioMotoConBitacoraSerializer(servicio)
            return Response(serializer.data)
        except ServicioMoto.DoesNotExist:
            return Response(
                {'error': 'Servicio no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['delete'])
    def eliminar_imagen(self, request, pk=None):
        """Elimina una imagen específica de la bitácora"""
        from api.storage import r2_storage
        
        bitacora = self.get_object()
        imagen_url = request.data.get('imagen_url')
        
        if not imagen_url:
            return Response(
                {'error': 'Se requiere imagen_url'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if imagen_url in bitacora.imagenes:
            try:
                # Eliminar de R2
                r2_storage.delete_file(imagen_url)
                
                # Eliminar de la lista
                bitacora.imagenes.remove(imagen_url)
                bitacora.save()
                
                return Response({'message': 'Imagen eliminada correctamente'})
            except Exception as e:
                return Response(
                    {'error': f'Error al eliminar imagen: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            return Response(
                {'error': 'Imagen no encontrada en la bitácora'},
                status=status.HTTP_404_NOT_FOUND
            )


class ServicioMotoConBitacoraViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet de solo lectura para servicios con bitácora completa"""
    queryset = ServicioMoto.objects.all()
    serializer_class = ServicioMotoConBitacoraSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tipo_servicio', 'descripcion']
    ordering_fields = ['fecha_servicio']
    ordering = ['-fecha_servicio']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por moto
        id_moto = self.request.query_params.get('id_moto', None)
        if id_moto:
            queryset = queryset.filter(id_moto=id_moto)
        
        # Prefetch bitácoras para optimizar consultas
        queryset = queryset.prefetch_related('bitacoras')
        
        return queryset



# ============================================================================
# AUDITORÍA VIEWSETS
# ============================================================================

class AuditoriaProductoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet de solo lectura para auditoría de productos.

    Solo admin: expone historial de precios/costos, usuario e IP.
    """
    permission_classes = [IsAdminUser]
    queryset = AuditoriaProducto.objects.all()
    serializer_class = AuditoriaProductoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sku_producto', 'nombre_producto', 'usuario']
    ordering_fields = ['fecha_cambio', 'operacion']
    ordering = ['-fecha_cambio']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por producto
        id_producto = self.request.query_params.get('id_producto', None)
        if id_producto:
            queryset = queryset.filter(id_producto=id_producto)
        
        # Filtrar por operación
        operacion = self.request.query_params.get('operacion', None)
        if operacion:
            queryset = queryset.filter(operacion=operacion.upper())
        
        # Filtrar por rango de fechas
        fecha_inicio = self.request.query_params.get('fecha_inicio', None)
        if fecha_inicio:
            queryset = queryset.filter(fecha_cambio__gte=fecha_inicio)
        
        fecha_fin = self.request.query_params.get('fecha_fin', None)
        if fecha_fin:
            queryset = queryset.filter(fecha_cambio__lte=fecha_fin)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Obtiene estadísticas generales de auditoría"""
        from django.db import connection
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM fn_estadisticas_auditoria();")
            row = cursor.fetchone()
            
            if row:
                return Response({
                    'total_registros': row[0],
                    'total_inserts': row[1],
                    'total_updates': row[2],
                    'total_deletes': row[3],
                    'productos_modificados': row[4],
                    'fecha_primer_registro': row[5],
                    'fecha_ultimo_registro': row[6]
                })
        
        return Response({})
    
    @action(detail=False, methods=['get'])
    def por_producto(self, request):
        """Obtiene historial de auditoría de un producto específico"""
        id_producto = request.query_params.get('id_producto')
        
        if not id_producto:
            return Response(
                {'error': 'Se requiere el parámetro id_producto'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.db import connection
        
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM fn_historial_producto(%s);",
                [id_producto]
            )
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return Response(results)


# ============================================================================
# GARANTÍA VIEWSETS
# ============================================================================

class GarantiaViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet de solo lectura para garantías (se crean automáticamente al vender)"""
    queryset = Garantia.objects.select_related('id_producto').all()
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_inicio', 'fecha_fin', 'estado']
    ordering = ['-fecha_inicio']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GarantiaDetailSerializer
        return GarantiaListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        cliente = self.request.query_params.get('cliente')
        if cliente:
            queryset = queryset.filter(id_cliente=cliente)

        producto = self.request.query_params.get('producto')
        if producto:
            queryset = queryset.filter(id_producto_id=producto)

        venta = self.request.query_params.get('venta')
        if venta:
            queryset = queryset.filter(id_venta=venta)

        return queryset

    @action(detail=False, methods=['post'])
    def actualizar_vencidas(self, request):
        """Marca como vencidas las garantías cuya fecha_fin ya pasó"""
        from datetime import date
        actualizadas = Garantia.objects.filter(
            estado='activa',
            fecha_fin__lt=date.today()
        ).update(estado='vencida')
        return Response({'actualizadas': actualizadas})


class ReclamacionViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de reclamaciones de garantía"""
    queryset = ReclamacionGarantia.objects.select_related('garantia__id_producto').all()
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['fecha_reclamacion', 'estado']
    ordering = ['-fecha_reclamacion']

    def get_serializer_class(self):
        if self.action == 'create':
            return ReclamacionCreateSerializer
        if self.action in ['list']:
            return ReclamacionListSerializer
        return ReclamacionDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        garantia = self.request.query_params.get('garantia')
        if garantia:
            queryset = queryset.filter(garantia_id=garantia)

        return queryset

    @action(detail=True, methods=['post'])
    def resolver(self, request, pk=None):
        """Marca la reclamación como resuelta y actualiza el estado de la garantía"""
        reclamacion = self.get_object()
        resolucion = request.data.get('resolucion', '')
        if not resolucion:
            return Response(
                {'error': 'El campo resolucion es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        from datetime import date
        reclamacion.estado = 'resuelto'
        reclamacion.resolucion = resolucion
        reclamacion.fecha_resolucion = date.today()
        reclamacion.save()
        reclamacion.garantia.estado = 'reclamada'
        reclamacion.garantia.save()
        return Response(ReclamacionDetailSerializer(reclamacion).data)


class CotizacionViewSet(viewsets.ModelViewSet):
    """ViewSet de cotizaciones / proformas. No afecta inventario hasta convertir."""
    queryset = Cotizacion.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_cotizacion']
    ordering_fields = ['fecha', 'total']
    ordering = ['-fecha']

    def get_serializer_class(self):
        if self.action == 'list':
            return CotizacionListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CotizacionCreateSerializer
        return CotizacionDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        cliente = self.request.query_params.get('cliente', None)
        if cliente:
            try:
                queryset = queryset.filter(id_cliente=int(cliente))
            except (ValueError, TypeError):
                pass
        estado = self.request.query_params.get('estado', None)
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset

    @action(detail=True, methods=['post'], url_path='convertir-venta')
    def convertir_venta(self, request, pk=None):
        """Convierte la cotización en una orden de venta real."""
        from django.db import transaction
        with transaction.atomic():
            cot = Cotizacion.objects.select_for_update().get(pk=pk)
            if cot.estado == 'convertida' or cot.id_venta:
                return Response(
                    {'error': 'Esta cotización ya fue convertida en venta'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id_producto, cantidad, precio_unitario
                    FROM producto_cotizacion WHERE id_cotizacion = %s
                """, [cot.id_cotizacion])
                items = cursor.fetchall()
                if not items:
                    return Response(
                        {'error': 'La cotización no tiene productos'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                total = sum(float(i[2]) * int(i[1]) for i in items)
                cursor.execute("""
                    INSERT INTO ventas (id_cliente, fecha, total)
                    VALUES (%s, CURRENT_DATE, %s) RETURNING id_venta
                """, [cot.id_cliente, total])
                id_venta = cursor.fetchone()[0]
                for id_producto, cantidad, precio in items:
                    cursor.execute("""
                        INSERT INTO producto_venta (id_venta, id_producto, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [id_venta, id_producto, cantidad, precio])
                cursor.execute(
                    "UPDATE cotizaciones SET estado = 'convertida', id_venta = %s WHERE id_cotizacion = %s",
                    [id_venta, cot.id_cotizacion],
                )
        cot.refresh_from_db()
        return Response(
            {'id_venta': id_venta, 'cotizacion': CotizacionDetailSerializer(cot).data},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def cambiar_estado(self, request, pk=None):
        """Cambia el estado de la cotización (aprobada / rechazada / pendiente)."""
        cot = self.get_object()
        nuevo = request.data.get('estado')
        if nuevo not in ('pendiente', 'aprobada', 'rechazada'):
            return Response({'error': 'Estado inválido'}, status=status.HTTP_400_BAD_REQUEST)
        if cot.estado == 'convertida':
            return Response(
                {'error': 'No se puede cambiar el estado de una cotización convertida'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cot.estado = nuevo
        cot.save(update_fields=['estado'])
        return Response(CotizacionDetailSerializer(cot).data)


class DevolucionViewSet(viewsets.ModelViewSet):
    """ViewSet de devoluciones / notas de crédito. Reingresa stock al crear."""
    queryset = Devolucion.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_devolucion']
    ordering_fields = ['fecha', 'total']
    ordering = ['-fecha']
    http_method_names = ['get', 'post', 'head', 'options']  # sin update/delete: las devoluciones no se editan

    def get_serializer_class(self):
        if self.action == 'list':
            return DevolucionListSerializer
        elif self.action == 'create':
            return DevolucionCreateSerializer
        return DevolucionDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        cliente = self.request.query_params.get('cliente', None)
        if cliente:
            try:
                queryset = queryset.filter(id_cliente=int(cliente))
            except (ValueError, TypeError):
                pass
        venta = self.request.query_params.get('venta', None)
        if venta:
            try:
                queryset = queryset.filter(id_venta=int(venta))
            except (ValueError, TypeError):
                pass
        return queryset


class UsuarioViewSet(viewsets.ModelViewSet):
    """Gestión de usuarios del sistema. Solo administradores (is_staff)."""
    queryset = User.objects.all().order_by('-is_superuser', 'username')
    serializer_class = UsuarioSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email']
    ordering_fields = ['username', 'date_joined', 'last_login']

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # No permitir auto-desactivarse
        if instance == request.user and request.data.get('is_active') is False:
            raise DRFValidationError('No puedes desactivar tu propio usuario')

        # No dejar el sistema sin administradores activos: si este es el último
        # admin activo, no se le puede quitar is_staff ni is_active (US-08).
        if instance.is_staff and instance.is_active:
            quita_staff = request.data.get('is_staff') is False
            quita_activo = request.data.get('is_active') is False
            if quita_staff or quita_activo:
                hay_otro_admin = User.objects.filter(
                    is_staff=True, is_active=True
                ).exclude(pk=instance.pk).exists()
                if not hay_otro_admin:
                    raise DRFValidationError(
                        'No puedes dejar el sistema sin administradores activos'
                    )

        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise DRFValidationError('No puedes eliminar tu propio usuario')
        if instance.is_staff and User.objects.filter(is_staff=True).count() <= 1:
            raise DRFValidationError('No puedes eliminar al último administrador')
        instance.delete()

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        """Cambia la contraseña de un usuario (validada por las políticas de Django)."""
        user = self.get_object()
        pwd = request.data.get('password')
        if not pwd:
            return Response({'error': 'Se requiere la contraseña'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(pwd, user)
        except DjangoValidationError as e:
            return Response({'password': e.messages}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(pwd)
        user.save(update_fields=['password'])
        return Response({'status': 'Contraseña actualizada'})

