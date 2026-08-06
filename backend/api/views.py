"""
ViewSets para la API de Inventrix
"""
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.exceptions import (
    PermissionDenied, ValidationError as DRFValidationError,
)
from .permissions import IsAdminOrReadOnly
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection, models, transaction
from django.db.utils import IntegrityError
from django.db.models import Q, Sum, F
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from inventory.models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, OrdenVenta, MovimientoInventario, Moto, ServicioMoto, Servicio,
    BitacoraServicio, AuditoriaProducto, Garantia, ReclamacionGarantia, PagoVenta,
    Cotizacion, Devolucion, SesionCaja, MovimientoCaja,
    CategoriaGasto, Gasto, PagoCompra, ServicioRepuesto, Ubicacion,
    DevolucionCompra, ConfiguracionIA,
)
from .ia_catalogo import (
    PROVEEDORES, catalogo_publico, listar_modelos, probar_credencial,
)
from .filtros import id_de_query
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
    SesionCajaSerializer, MovimientoCajaSerializer, AbrirCajaSerializer, CerrarCajaSerializer,
    CategoriaGastoSerializer, GastoSerializer, GastoCreateSerializer,
    PagoCompraSerializer, PagoCompraCreateSerializer,
    ServicioRepuestoSerializer, UbicacionSerializer,
    DevolucionCompraSerializer, DevolucionCompraCreateSerializer,
    ConfiguracionIASerializer, ConfiguracionIAGuardarSerializer,
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
        # El context es obligatorio: `CostoSoloAdminMixin` lo usa para decidir si
        # oculta el precio de compra. Sin él, el costo se filtraría por acá.
        serializer = ProductoListSerializer(
            productos, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def ordenes(self, request, pk=None):
        proveedor = self.get_object()
        # Dos fallos encadenados hacían que esto respondiera 500 siempre:
        #
        # 1. `OrdenCompra.id_proveedor` es un IntegerField pelado, no una clave
        #    foránea, así que hay que filtrar por el id y no por la instancia.
        # 2. `fecha` no existe en el modelo; la columna es `fecha_creacion`.
        ordenes = OrdenCompra.objects.filter(
            id_proveedor=proveedor.id_proveedor).order_by('-fecha_creacion')
        # El context es obligatorio: `CamposSoloAdminMixin` lo usa para decidir
        # si oculta los montos, y sin él da por hecho que quien pregunta es
        # admin. El 500 venía tapando esta fuga.
        serializer = OrdenCompraListSerializer(
            ordenes, many=True, context=self.get_serializer_context())
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


class UbicacionViewSet(viewsets.ModelViewSet):
    """Lugares físicos de almacenamiento (bodega / pasillo / estante / gaveta).

    Lectura para cualquier usuario (el POS muestra dónde está el producto);
    administrarlos es de admin (US-04).
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = UbicacionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bodega', 'pasillo', 'estante', 'gaveta', 'notas']
    ordering_fields = ['bodega', 'pasillo', 'estante', 'gaveta']
    ordering = ['bodega', 'pasillo', 'estante', 'gaveta']

    def get_queryset(self):
        # Se anotan los agregados acá para que el listado no haga dos consultas
        # por cada ubicación (ver UbicacionSerializer._agregados).
        queryset = Ubicacion.objects.annotate(
            num_productos=models.Count('productos'),
            valor_guardado=Sum(
                F('productos__cantidad_actual') * F('productos__precio_final'),
                output_field=models.DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        bodega = self.request.query_params.get('bodega')
        if bodega:
            queryset = queryset.filter(bodega=bodega)
        if self.request.query_params.get('activo') == 'true':
            queryset = queryset.filter(activo=True)
        return queryset

    @action(detail=True, methods=['get'])
    def productos(self, request, pk=None):
        """Qué hay guardado en este lugar."""
        ubicacion = self.get_object()
        productos = ubicacion.productos.select_related('id_proveedor').order_by('nombre')
        # Con context: `CostoSoloAdminMixin` lo necesita para ocultar el costo.
        return Response(ProductoListSerializer(
            productos, many=True, context=self.get_serializer_context()).data)

    @action(detail=False, methods=['get'])
    def bodegas(self, request):
        """Bodegas existentes, para poblar filtros sin traer todo el catálogo."""
        nombres = (Ubicacion.objects.values_list('bodega', flat=True)
                   .distinct().order_by('bodega'))
        return Response(list(nombres))


class ProductoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de productos.

    Lectura para cualquier usuario (POS/ventas la necesitan); crear, editar,
    borrar e importar productos son acciones de administrador (US-04).
    """
    permission_classes = [IsAdminOrReadOnly]
    queryset = Producto.objects.select_related('id_ubicacion', 'id_proveedor').all()
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

        # Filtros de ubicación
        ubicacion_id = self.request.query_params.get('ubicacion', None)
        if ubicacion_id:
            queryset = queryset.filter(id_ubicacion_id=ubicacion_id)
        bodega = self.request.query_params.get('bodega', None)
        if bodega:
            queryset = queryset.filter(id_ubicacion__bodega=bodega)
        # Lo que falta por ubicar: sin esto no hay forma de saber cuánto queda
        # de la tarea y se abandona a medias.
        if self.request.query_params.get('sin_ubicacion') == 'true':
            queryset = queryset.filter(id_ubicacion__isnull=True)

        return queryset

    @action(detail=True, methods=['get'], url_path='precios-proveedores',
            permission_classes=[IsAdminUser])
    def precios_proveedores(self, request, pk=None):
        """A qué precio le vendió cada proveedor este producto. Solo admin.

        Alimenta el aviso del formulario de compra: es el único punto donde ver
        que otro proveedor lo daba más barato sirve para cambiar la decisión.

        Antes era legible por cualquier autenticado, con el argumento de que el
        permiso del ViewSet ya permitía GET. Pero devuelve costos históricos de
        compra, o sea el mismo dato que los reportes protegen con `IsAdminUser` y
        que ahora se oculta del listado de productos: dejarlo abierto hacía que
        todo ese trabajo no sirviera. El único que lo consume es el formulario de
        órdenes de compra, que ya es admin-only, así que no cambia nada de uso.
        """
        producto = self.get_object()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT oc.id_proveedor, pr.nombre_empresa,
                       COUNT(*)                AS veces,
                       AVG(op.precio_unitario) AS promedio,
                       MAX(oc.fecha_creacion)  AS ultima_fecha,
                       -- Desempate por id_orden: dos compras el mismo día al
                       -- mismo proveedor dejarían el último precio indefinido.
                       (ARRAY_AGG(op.precio_unitario
                                  ORDER BY oc.fecha_creacion DESC, oc.id_orden DESC))[1]
                                               AS ultimo_precio
                FROM orden_producto op
                JOIN orden_compra oc ON oc.id_orden = op.id_orden
                JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
                WHERE op.id_producto = %s
                  AND op.precio_unitario IS NOT NULL AND op.precio_unitario > 0
                  AND oc.id_estado <> 1
                GROUP BY oc.id_proveedor, pr.nombre_empresa
                ORDER BY 6
            """, [producto.id_producto])
            proveedores = [{
                'id_proveedor': r[0],
                'proveedor': r[1],
                'veces_comprado': int(r[2]),
                'precio_promedio': round(float(r[3]), 2),
                'ultima_fecha': r[4],
                'ultimo_precio': round(float(r[5]), 2),
            } for r in cursor.fetchall()]

        mejor = proveedores[0] if proveedores else None
        return Response({
            'id_producto': producto.id_producto,
            'nombre': producto.nombre,
            'proveedor_asignado': producto.id_proveedor_id,
            'mejor_precio': mejor['ultimo_precio'] if mejor else None,
            'mejor_proveedor': mejor['proveedor'] if mejor else None,
            'proveedores': proveedores,
        })

    @action(detail=False, methods=['post'], url_path='asignar-ubicacion')
    def asignar_ubicacion(self, request):
        """Asigna una ubicación a varios productos de una vez.

        Es la palanca de adopción de la función: ubicar 75 productos entrando
        uno por uno es la fricción que dejó `marcas` y `categorias` en cero
        filas. Enviar `id_ubicacion: null` desasigna.
        """
        if not request.user.is_staff:
            return Response({'error': 'Solo un administrador puede asignar ubicaciones.'},
                            status=status.HTTP_403_FORBIDDEN)

        ids = request.data.get('productos') or []
        id_ubicacion = request.data.get('id_ubicacion')

        if not isinstance(ids, list) or not ids:
            return Response({'error': 'Enviá la lista de productos a ubicar.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if id_ubicacion is not None:
            if not Ubicacion.objects.filter(pk=id_ubicacion).exists():
                return Response({'error': 'La ubicación no existe.'},
                                status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            actualizados = Producto.objects.filter(id_producto__in=ids).update(
                id_ubicacion_id=id_ubicacion)

        return Response({
            'actualizados': actualizados,
            'id_ubicacion': id_ubicacion,
        })

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

    def get_permissions(self):
        # Registrar un pago a proveedor lo puede hacer cualquier usuario
        # autenticado: un pago en efectivo es un egreso del turno y sin eso el
        # arqueo no cierra. Gestionar la orden (crear/confirmar/recibir) sigue
        # siendo del dueño.
        if self.action in ('registrar_pago', 'eliminar_pago'):
            return [IsAuthenticated()]
        # Listar los pagos, en cambio, es del dueño: sumando los montos se
        # reconstruye el `monto_pagado` que `CamposSoloAdminMixin` acababa de
        # ocultar en el listado y el detalle de la compra. Era un rodeo que
        # devolvía justo el dato reservado. Ninguna pantalla lo usa (el servicio
        # del frontend lo declara pero no lo llama), así que no se pierde nada.
        #
        # Va `IsAdminUser` y no `IsAdminOrReadOnly` porque esto es un GET, y esa
        # otra clase deja pasar cualquier lectura: es justo lo que no se quiere.
        if self.action == 'pagos':
            return [IsAdminUser()]
        return [IsAdminOrReadOnly()]

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
        proveedor = id_de_query(
            self.request.query_params.get('proveedor'), 'proveedor')
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

    def _recibir_orden(self, orden, usuario):
        """Recibe la mercadería: suma el stock y deja el rastro del movimiento.

        Antes recibir una orden solo cambiaba `id_estado`, sin tocar inventario:
        la mercadería entraba a la bodega y el sistema nunca se enteraba (y la
        interfaz igual anunciaba "stock actualizado"). Acá se hace de verdad.

        Devuelve `(respuesta_error, resumen)`: si `respuesta_error` no es None,
        no se aplicó nada.
        """
        if orden.id_estado == OrdenCompra.ESTADO_CANCELADA:
            return Response(
                {'error': 'La orden está cancelada; no se puede recibir.'},
                status=status.HTTP_400_BAD_REQUEST), None

        if orden.stock_aplicado:
            return Response(
                {'error': f'La orden #{orden.id_orden} ya fue recibida y su stock '
                          f'ya se sumó al inventario.'},
                status=status.HTTP_400_BAD_REQUEST), None

        if orden.id_estado != OrdenCompra.ESTADO_PENDIENTE:
            return Response(
                {'error': 'Solo se puede recibir una orden pendiente.'},
                status=status.HTTP_400_BAD_REQUEST), None

        lineas = orden.lineas_recepcion()
        if not lineas:
            # Sin cantidades no hay forma de saber cuánto sumar. Se rechaza en
            # vez de "recibir" sin mover nada: un no-op silencioso es lo que
            # hacía que la interfaz mintiera.
            return Response(
                {'error': 'Esta orden no tiene cantidades registradas en su detalle, '
                          'así que no se puede saber cuánto stock sumar. Es una orden '
                          'creada antes de que el sistema guardara las cantidades.'},
                status=status.HTTP_400_BAD_REQUEST), None

        aplicadas = []
        with transaction.atomic():
            # Se relee con bloqueo: dos recepciones simultáneas no pueden pasar
            # ambas la guarda de stock_aplicado.
            orden = OrdenCompra.objects.select_for_update().get(pk=orden.pk)
            if orden.stock_aplicado:
                return Response(
                    {'error': f'La orden #{orden.id_orden} ya fue recibida.'},
                    status=status.HTTP_400_BAD_REQUEST), None

            with connection.cursor() as cursor:
                for id_producto, cantidad in lineas:
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = cantidad_actual + %s "
                        "WHERE id_producto = %s",
                        [cantidad, id_producto],
                    )
                    if cursor.rowcount == 0:
                        # El producto se borró después de crear la orden.
                        continue
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                        VALUES (%s, 'ENTRADA', %s, NOW(), %s, 'ORDEN_COMPRA', %s)
                    """, [id_producto, cantidad, f'COMPRA-{orden.id_orden}',
                          f'Recepción de la orden de compra #{orden.id_orden} por {usuario}'])
                    aplicadas.append((id_producto, cantidad))

            orden.id_estado = OrdenCompra.ESTADO_RECIBIDA
            orden.stock_aplicado = True
            # Sin esta fecha no se puede medir cuánto tardó el proveedor.
            orden.fecha_recepcion = timezone.now()
            orden.save(update_fields=['id_estado', 'stock_aplicado', 'fecha_recepcion'])

        return None, {
            'lineas_aplicadas': len(aplicadas),
            'unidades_ingresadas': sum(c for _, c in aplicadas),
            'dias_entrega': orden.dias_entrega(),
        }

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        """Alias histórico de `recibir`.

        El catálogo `estado` solo tiene cancelada/pendiente/recibida, así que no
        existe un estado "confirmada" intermedio: confirmar y recibir son la
        misma transición. Se mantiene el endpoint porque la interfaz lo usaba, y
        delega para que el stock se sume igual por cualquiera de los dos.
        """
        return self.recibir(request, pk)

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        """Recibe la orden: suma el stock de cada línea al inventario."""
        usuario = request.user.get_full_name() or request.user.username
        error, resumen = self._recibir_orden(self.get_object(), usuario)
        if error is not None:
            return error
        return Response({
            'status': 'Orden recibida y stock actualizado',
            **resumen,
        })

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

    # ------------------------------------------------------------------
    # Cuentas por pagar: abonos a proveedores (espejo de OrdenVentaViewSet)
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'], url_path='pagos')
    def pagos(self, request, pk=None):
        """Lista los pagos/abonos de una compra (más reciente primero)."""
        orden = self.get_object()
        return Response(PagoCompraSerializer(orden.pagos.all(), many=True).data)

    @action(detail=True, methods=['post'], url_path='registrar-pago')
    def registrar_pago(self, request, pk=None):
        """Registra un pago a proveedor y recalcula el saldo de la compra."""
        from django.db import transaction
        with transaction.atomic():
            orden = OrdenCompra.objects.select_for_update().get(pk=pk)
            if orden.estado_pago == 'pagado':
                return Response(
                    {'error': 'Esta compra ya está completamente pagada'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # El `request` va en el contexto porque el mensaje de saldo
            # insuficiente sólo lleva la cifra exacta si quien paga es el dueño.
            serializer = PagoCompraCreateSerializer(
                data=request.data, context={'orden': orden, 'request': request}
            )
            serializer.is_valid(raise_exception=True)
            pago = serializer.save()
        return Response(PagoCompraSerializer(pago).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'pagos/(?P<id_pago>[^/.]+)')
    def eliminar_pago(self, request, pk=None, id_pago=None):
        """Elimina un pago (solo el último registrado) y recalcula el saldo."""
        from django.db import transaction
        with transaction.atomic():
            orden = OrdenCompra.objects.select_for_update().get(pk=pk)
            try:
                pago = orden.pagos.get(pk=id_pago)
            except PagoCompra.DoesNotExist:
                return Response({'error': 'Pago no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            ultimo = orden.pagos.order_by('-created_at', '-id_pago').first()
            if ultimo and pago.id_pago != ultimo.id_pago:
                return Response(
                    {'error': 'Solo se puede eliminar el último pago registrado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pago.delete()
            orden.calcular_saldo()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrdenVentaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de órdenes de venta.

    Una venta **no se borra ni se edita**: se cancela con la acción `cancelar`,
    que restituye el stock, registra los movimientos de inventario y deja la
    venta con estado cancelado.

    El borrado directo estaba habilitado para cualquier usuario autenticado y
    era el único camino que no dejaba rastro: `DELETE /api/ordenes-venta/{id}/`
    borraba la fila sin devolver stock, sin movimiento y sin auditoría (el
    disparador de auditoría cubre `productos`, no `ventas`). O sea que el camino
    correcto era auditable y el desprotegido no — justo lo que se necesita para
    tapar un faltante de caja.

    Nota: el método DELETE sigue habilitado en el ViewSet porque lo usa la
    subruta `pagos/<id>` para anular un abono; lo que se bloquea es el borrado de
    la venta en sí.
    """
    queryset = OrdenVenta.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_venta']
    ordering_fields = ['fecha', 'total']
    ordering = ['-fecha']

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Una venta no se borra. Usá "cancelar" para anularla: '
                      'devuelve el stock y queda registrado.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def update(self, request, *args, **kwargs):
        # `OrdenVentaCreateSerializer` no implementa `update()`, así que esto
        # daba un 500. Modificar los productos de una venta ya registrada
        # descuadraría el stock: se cancela y se hace de nuevo.
        return Response(
            {'error': 'Una venta registrada no se edita. Cancelala y volvé a '
                      'registrarla.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

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

            # Una venta con devoluciones ya fue revertida en parte, y cancelarla
            # volvía a reingresar TODO lo vendido: se vendían 10, se devolvían 4
            # (que ya habían vuelto al inventario) y al cancelar entraban otros
            # 10, dejando 4 unidades fantasma que el sistema creía tener.
            #
            # No se intenta descontar lo devuelto y seguir: la devolución además
            # movió dinero y dejó su propio rastro, y borrar la venta la dejaría
            # huérfana. Deshacer las dos cosas de forma coordinada es
            # justamente lo que este sistema decidió no hacer —una devolución no
            # se edita ni se borra—, así que se bloquea y se dice por qué.
            devuelto = orden.total_devuelto()
            if devuelto and devuelto > 0:
                raise DRFValidationError({'error': (
                    f'Esta venta tiene devoluciones registradas por C${devuelto}. '
                    f'Cancelarla reingresaría mercadería que ya volvió al '
                    f'inventario. Si hay que revertir el resto, registrá una '
                    f'devolución por lo que queda.'
                )})

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
        
        producto = id_de_query(self.request.query_params.get('producto'), 'producto')
        if producto:
            queryset = queryset.filter(producto_id=producto)
        
        return queryset

    @action(detail=False, methods=['post'])
    def ajuste(self, request):
        """Crear un ajuste manual de inventario.

        Todo dentro de una transacción y con la fila del producto bloqueada,
        como ya hacía `aplicar_conteo` acá abajo. Antes se leía el stock, se
        calculaba el nuevo valor en Python y recién después se guardaba, con
        tres consecuencias:

        - Si entraba una venta entre la lectura y el guardado, se perdía: un
          ajuste de +5 sobre un stock de 10 dejaba 15 aunque en el medio se
          hubieran vendido 2, y esas 2 unidades reaparecían en el inventario.
        - El `save()` sin `update_fields` reescribía la fila entera desde una
          copia vieja, así que un cambio de precio o de ubicación hecho en
          paralelo se revertía solo.
        - Sin transacción, si fallaba el guardado quedaba el movimiento
          registrado sin el cambio de stock, y la bitácora dejaba de explicar
          el inventario.
        """
        producto_id = id_de_query(request.data.get('producto_id'), 'producto_id')
        cantidad = request.data.get('cantidad')
        notas = request.data.get('notas', '')

        if not producto_id or cantidad is None:
            return Response(
                {'error': 'Se requieren producto_id y cantidad'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cantidad = int(cantidad)
        except (ValueError, TypeError):
            return Response(
                {'error': 'La cantidad debe ser un número entero'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            try:
                producto = Producto.objects.select_for_update().get(
                    id_producto=producto_id)
            except Producto.DoesNotExist:
                return Response(
                    {'error': 'Producto no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Se lee con la fila ya bloqueada: nadie puede moverla hasta commit.
            nuevo_stock = producto.cantidad_actual + cantidad
            if nuevo_stock < 0:
                return Response(
                    {'error': f'El ajuste dejaría el stock en {nuevo_stock}. '
                              f'No se puede tener stock negativo.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = MovimientoInventarioCreateSerializer(data={
                'producto': producto_id,
                'tipo': 'AJUSTE',
                'cantidad': cantidad,
                'referencia': 'AJUSTE_MANUAL',
                'notas': notas,
            })
            # `raise_exception` en vez de devolver los errores a mano: un
            # `return` desde dentro de un bloque atómico hace commit, no
            # rollback, y dejaría el movimiento a medias.
            serializer.is_valid(raise_exception=True)
            movimiento = serializer.save()

            producto.cantidad_actual = nuevo_stock
            producto.save(update_fields=['cantidad_actual'])

        return Response(
            MovimientoInventarioSerializer(movimiento).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'], url_path='aplicar-conteo')
    def aplicar_conteo(self, request):
        """Cuadra el inventario con lo que se contó físicamente.

        La acción `ajuste` de arriba corrige un producto a la vez, así que un
        conteo completo eran 75 formularios y en la práctica no se hacía. Acá se
        recibe todo el conteo de una pasada.

        Solo se ajusta lo que difiere: los productos que cuadran no generan
        movimiento, para que la bitácora de inventario no se llene de ruido.
        Se usa `tipo_referencia='AJUSTE_MANUAL'` (ya permitido por el CHECK de la
        tabla) con la referencia `CONTEO-<fecha>` para poder distinguirlos.
        """
        if not request.user.is_staff:
            return Response({'error': 'Solo un administrador puede aplicar un conteo.'},
                            status=status.HTTP_403_FORBIDDEN)

        conteos = request.data.get('conteos') or []
        if not isinstance(conteos, list) or not conteos:
            return Response({'error': 'Enviá el conteo de al menos un producto.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Se valida TODO antes de tocar nada: un conteo aplicado a medias sería
        # peor que no aplicarlo.
        pendientes = []
        for fila in conteos:
            id_producto = fila.get('id_producto')
            contado = fila.get('contado')
            if id_producto is None or contado is None or contado == '':
                continue  # producto no contado: se deja como está
            try:
                contado = int(contado)
            except (TypeError, ValueError):
                return Response(
                    {'error': f'La cantidad contada del producto {id_producto} no es un número.'},
                    status=status.HTTP_400_BAD_REQUEST)
            if contado < 0:
                return Response(
                    {'error': f'La cantidad contada del producto {id_producto} no puede ser negativa.'},
                    status=status.HTTP_400_BAD_REQUEST)
            pendientes.append((id_producto, contado))

        if not pendientes:
            return Response({'error': 'No se anotó ninguna cantidad contada.'},
                            status=status.HTTP_400_BAD_REQUEST)

        referencia = f'CONTEO-{timezone.now().date().isoformat()}'
        usuario = request.user.get_full_name() or request.user.username
        notas_extra = (request.data.get('notas') or '').strip()

        resumen = {'cuadrados': 0, 'sobrantes': 0, 'faltantes': 0,
                   'ajustados': 0, 'impacto': Decimal('0'), 'diferencias': []}

        with transaction.atomic():
            productos = {
                p.id_producto: p for p in Producto.objects.select_for_update()
                .filter(id_producto__in=[i for i, _ in pendientes])
            }
            faltan = [i for i, _ in pendientes if i not in productos]
            if faltan:
                return Response({'error': f'Productos inexistentes: {faltan}'},
                                status=status.HTTP_404_NOT_FOUND)

            with connection.cursor() as cursor:
                for id_producto, contado in pendientes:
                    producto = productos[id_producto]
                    diferencia = contado - producto.cantidad_actual

                    if diferencia == 0:
                        resumen['cuadrados'] += 1
                        continue

                    if diferencia > 0:
                        resumen['sobrantes'] += 1
                    else:
                        resumen['faltantes'] += 1
                    resumen['ajustados'] += 1
                    resumen['impacto'] += diferencia * (producto.precio_final or Decimal('0'))
                    resumen['diferencias'].append({
                        'id_producto': id_producto,
                        'nombre': producto.nombre,
                        'sistema': producto.cantidad_actual,
                        'contado': contado,
                        'diferencia': diferencia,
                    })

                    nota = (f'Conteo físico por {usuario}: sistema '
                            f'{producto.cantidad_actual}, contado {contado}.')
                    if notas_extra:
                        nota = f'{nota} {notas_extra}'
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                        VALUES (%s, 'AJUSTE', %s, NOW(), %s, 'AJUSTE_MANUAL', %s)
                    """, [id_producto, diferencia, referencia, nota])

                    producto.cantidad_actual = contado
                    producto.save(update_fields=['cantidad_actual'])

        return Response({
            'referencia': referencia,
            'contados': len(pendientes),
            'cuadrados': resumen['cuadrados'],
            'ajustados': resumen['ajustados'],
            'sobrantes': resumen['sobrantes'],
            'faltantes': resumen['faltantes'],
            'impacto': float(resumen['impacto']),
            'diferencias': resumen['diferencias'],
        })


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
        cliente_id = id_de_query(self.request.query_params.get('cliente'), 'cliente')
        if cliente_id:
            queryset = queryset.filter(id_cliente=cliente_id)
        return queryset


class ServicioMotoViewSet(viewsets.ModelViewSet):
    """Órdenes de trabajo del taller: agenda, estados, repuestos y entrega."""
    queryset = ServicioMoto.objects.all().select_related(
        'id_moto', 'id_moto__id_cliente', 'id_mecanico', 'id_tipo_servicio'
    ).prefetch_related('repuestos__id_producto', 'presupuestos')
    serializer_class = ServicioMotoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tipo_servicio', 'descripcion', 'id_moto__placa']
    ordering_fields = ['fecha_servicio', 'costo', 'fecha_cita']
    ordering = ['-fecha_servicio']

    # Trabajar el día a día del taller (mover estados, consumir repuestos,
    # entregar) es tarea del operador/mecánico; borrar órdenes es de admin.
    ACCIONES_OPERATIVAS = {
        'cambiar_estado', 'agregar_repuesto', 'eliminar_repuesto', 'entregar',
        'presupuestar',
        'create', 'update', 'partial_update', 'list', 'retrieve',
    }

    def get_permissions(self):
        if self.action in self.ACCIONES_OPERATIVAS:
            return [IsAuthenticated()]
        return [IsAdminOrReadOnly()]

    def get_queryset(self):
        queryset = super().get_queryset()
        moto_id = id_de_query(self.request.query_params.get('moto'), 'moto')
        if moto_id:
            queryset = queryset.filter(id_moto=moto_id)
        estado = self.request.query_params.get('estado', None)
        if estado:
            queryset = queryset.filter(estado=estado)
        # El Kanban solo muestra lo que está en curso.
        if self.request.query_params.get('activas') == 'true':
            queryset = queryset.exclude(estado__in=['entregada', 'cancelada'])
        mecanico = self.request.query_params.get('mecanico', None)
        if mecanico:
            queryset = queryset.filter(id_mecanico=mecanico)
        return queryset

    def perform_create(self, serializer):
        """Agenda la orden de trabajo.

        Ojo: antes esto creaba además una venta automáticamente, con SQL crudo
        y sin guardar el vínculo servicio↔venta. Eso quedaba facturado antes de
        que el trabajo existiera y obligaba a adivinar el enlace después. Ahora
        la venta se genera al entregar (acción `entregar`), una sola vez y
        referenciada en `id_venta`.
        """
        # `costo` es NOT NULL en el esquema y es de solo lectura en la API
        # (lo calcula el backend), así que hay que sembrarlo al agendar.
        datos = {'costo': 0}
        tipo = serializer.validated_data.get('id_tipo_servicio')
        if tipo is not None:
            # Precio congelado: si el catálogo cambia, esta orden no se mueve.
            if not serializer.validated_data.get('precio_mano_obra'):
                datos['precio_mano_obra'] = tipo.precio_mano_obra
            if not serializer.validated_data.get('tipo_servicio'):
                datos['tipo_servicio'] = tipo.nombre
        servicio = serializer.save(**datos)
        servicio.calcular_total()
        return servicio

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        """Avanza la orden de estado y deja constancia en la bitácora.

        La bitácora se llenaba a mano y se abandonaba: de 7 registros históricos
        ninguno llegó a 'reparacion' ni 'entrega'. Al colgarla de la transición
        de estado, avanzar el trabajo es lo que la va escribiendo.
        """
        from django.db import transaction

        nuevo_estado = request.data.get('estado')
        if not nuevo_estado:
            return Response({'error': 'Se requiere el campo "estado".'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            orden = ServicioMoto.objects.select_for_update().get(pk=self.get_object().pk)

            if nuevo_estado == orden.estado:
                return Response({'error': f'La orden ya está en "{nuevo_estado}".'},
                                status=status.HTTP_400_BAD_REQUEST)
            if not orden.puede_pasar_a(nuevo_estado):
                permitidas = ServicioMoto.TRANSICIONES.get(orden.estado, [])
                return Response(
                    {'error': f'No se puede pasar de "{orden.estado}" a "{nuevo_estado}".',
                     'transiciones_posibles': permitidas},
                    status=status.HTTP_400_BAD_REQUEST)
            if nuevo_estado == 'entregada':
                return Response(
                    {'error': 'Para entregar usá la acción "entregar": genera la venta.'},
                    status=status.HTTP_400_BAD_REQUEST)

            # No se empieza a gastar sin el visto bueno del cliente. Si la orden
            # no tiene presupuesto se permite (un trabajo chico no necesita uno).
            if nuevo_estado == 'en_reparacion' and not orden.reparacion_autorizada():
                presupuesto = orden.presupuesto_vigente()
                return Response(
                    {'error': f'El presupuesto #{presupuesto.id_cotizacion} está '
                              f'"{presupuesto.get_estado_display()}": el cliente todavía no '
                              f'autorizó la reparación.',
                     'id_presupuesto': presupuesto.id_cotizacion,
                     'estado_presupuesto': presupuesto.estado},
                    status=status.HTTP_400_BAD_REQUEST)

            orden.estado = nuevo_estado
            campos = ['estado']
            if request.data.get('km_actual') is not None:
                orden.km_actual = request.data['km_actual']
                campos.append('km_actual')
            if request.data.get('id_mecanico') is not None:
                orden.id_mecanico_id = request.data['id_mecanico']
                campos.append('id_mecanico')
            orden.save(update_fields=campos)

            self._registrar_bitacora(orden, nuevo_estado, request)

        return Response(ServicioMotoSerializer(orden).data)

    def _registrar_bitacora(self, orden, estado, request):
        """Crea la entrada de bitácora del módulo que corresponde al estado."""
        modulo = ServicioMoto.MODULO_POR_ESTADO.get(estado)
        if not modulo:
            return None

        usuario = request.user
        campos = {
            'id_servicio': orden,
            'id_moto': orden.id_moto,
            'modulo': modulo,
            'notas': request.data.get('notas'),
            'creado_por': usuario.get_full_name() or usuario.username,
        }
        # Cada módulo tiene sus propios campos en bitacora_servicio.
        opcionales = {
            'recepcion': ['nivel_gasolina', 'rayones_previos'],
            'diagnostico': ['fallas_encontradas'],
            'reparacion': ['trabajo_realizado', 'tecnico_responsable'],
            'entrega': ['checklist_salida', 'firma_cliente'],
        }
        for campo in opcionales.get(modulo, []):
            if request.data.get(campo) is not None:
                campos[campo] = request.data[campo]
        if modulo == 'reparacion' and 'tecnico_responsable' not in campos:
            mecanico = orden.id_mecanico
            if mecanico:
                campos['tecnico_responsable'] = (
                    mecanico.get_full_name() or mecanico.username)

        return BitacoraServicio.objects.create(**campos)

    @action(detail=True, methods=['post'], url_path='agregar-repuesto')
    def agregar_repuesto(self, request, pk=None):
        """Consume un repuesto del inventario para esta orden.

        Descuenta `productos.cantidad_actual` y deja el movimiento, igual que
        una venta. Antes los repuestos del taller no descontaban stock en
        ninguna parte.
        """
        from django.db import connection, transaction

        id_producto = request.data.get('id_producto')
        cantidad = request.data.get('cantidad')
        if not id_producto or not cantidad:
            return Response({'error': 'Se requieren "id_producto" y "cantidad".'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            cantidad = int(cantidad)
        except (TypeError, ValueError):
            return Response({'error': 'La cantidad debe ser un número entero.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if cantidad <= 0:
            return Response({'error': 'La cantidad debe ser mayor a cero.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            orden = ServicioMoto.objects.select_for_update().get(pk=self.get_object().pk)
            if orden.estado in ('entregada', 'cancelada'):
                return Response(
                    {'error': f'No se pueden agregar repuestos a una orden {orden.estado}.'},
                    status=status.HTTP_400_BAD_REQUEST)

            try:
                producto = Producto.objects.select_for_update().get(pk=id_producto)
            except Producto.DoesNotExist:
                return Response({'error': 'Producto no encontrado.'},
                                status=status.HTTP_404_NOT_FOUND)

            if producto.cantidad_actual < cantidad:
                return Response(
                    {'error': f'Stock insuficiente de "{producto.nombre}": '
                              f'hay {producto.cantidad_actual}, se piden {cantidad}.'},
                    status=status.HTTP_400_BAD_REQUEST)

            precio = request.data.get('precio_unitario')
            if precio in (None, ''):
                precio = producto.precio_final

            repuesto = ServicioRepuesto.objects.create(
                id_servicio=orden, id_producto=producto,
                cantidad=cantidad, precio_unitario=precio,
            )

            producto.cantidad_actual -= cantidad
            producto.save(update_fields=['cantidad_actual'])

            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO movimientos_inventario
                        (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                    VALUES (%s, 'SALIDA', %s, NOW(), %s, 'SERVICIO_TALLER', %s)
                """, [producto.id_producto, cantidad, f'TALLER-{orden.id_servicio}',
                      f'Repuesto usado en orden de trabajo #{orden.id_servicio}'])

            orden.calcular_total()

        return Response(ServicioRepuestoSerializer(repuesto).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='eliminar-repuesto/(?P<repuesto_id>[^/.]+)')
    def eliminar_repuesto(self, request, pk=None, repuesto_id=None):
        """Quita un repuesto de la orden y devuelve el stock al inventario."""
        from django.db import connection, transaction

        with transaction.atomic():
            orden = ServicioMoto.objects.select_for_update().get(pk=self.get_object().pk)
            if orden.estado in ('entregada', 'cancelada'):
                return Response(
                    {'error': f'No se pueden quitar repuestos de una orden {orden.estado}.'},
                    status=status.HTTP_400_BAD_REQUEST)

            try:
                repuesto = orden.repuestos.select_related('id_producto').get(pk=repuesto_id)
            except ServicioRepuesto.DoesNotExist:
                return Response({'error': 'Repuesto no encontrado en esta orden.'},
                                status=status.HTTP_404_NOT_FOUND)

            producto = Producto.objects.select_for_update().get(
                pk=repuesto.id_producto_id)
            cantidad = repuesto.cantidad
            repuesto.delete()

            producto.cantidad_actual += cantidad
            producto.save(update_fields=['cantidad_actual'])

            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO movimientos_inventario
                        (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                    VALUES (%s, 'ENTRADA', %s, NOW(), %s, 'SERVICIO_TALLER', %s)
                """, [producto.id_producto, cantidad, f'TALLER-REV-{orden.id_servicio}',
                      f'Repuesto devuelto de orden de trabajo #{orden.id_servicio}'])

            orden.calcular_total()

        return Response({'status': 'Repuesto eliminado, stock restituido.'})

    @action(detail=True, methods=['post'])
    def presupuestar(self, request, pk=None):
        """Crea el presupuesto de reparación de esta orden, para que el cliente
        autorice el costo antes de que se gaste su plata.

        Importante: NO toca stock. Los repuestos acá son una propuesta; se
        consumen recién cuando el cliente aprueba (ver
        `CotizacionViewSet.cambiar_estado`). Presupuestar algo y descontarlo del
        inventario en el mismo paso vaciaría la bodega con trabajos que nunca se
        autorizan.
        """
        from django.db import transaction

        servicios = request.data.get('servicios') or []
        productos = request.data.get('productos') or []
        if not servicios and not productos:
            return Response(
                {'error': 'Agregá al menos una línea de mano de obra o un repuesto.'},
                status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            orden = ServicioMoto.objects.select_for_update().get(pk=self.get_object().pk)
            if orden.estado in ('entregada', 'cancelada'):
                return Response(
                    {'error': f'No se puede presupuestar una orden {orden.estado}.'},
                    status=status.HTTP_400_BAD_REQUEST)

            vigente = orden.presupuesto_vigente()
            if vigente and vigente.estado == 'pendiente':
                return Response(
                    {'error': f'Esta orden ya tiene el presupuesto #{vigente.id_cotizacion} '
                              f'esperando respuesta del cliente.',
                     'id_presupuesto': vigente.id_cotizacion},
                    status=status.HTTP_400_BAD_REQUEST)

            # El diagnóstico viene de la bitácora, que es donde el mecánico
            # anotó las fallas al revisar la moto.
            diagnostico = request.data.get('diagnostico')
            if not diagnostico:
                bitacora = orden.bitacoras.filter(modulo='diagnostico').order_by(
                    '-fecha_registro').first()
                if bitacora:
                    diagnostico = bitacora.fallas_encontradas or bitacora.notas

            datos = {
                'cliente': orden.id_moto.id_cliente_id,
                'fecha': str(date.today()),
                'validez_dias': request.data.get('validez_dias', 15),
                'notas': request.data.get('notas'),
                'tipo': 'reparacion',
                'id_moto': orden.id_moto_id,
                'id_servicio': orden.id_servicio,
                'diagnostico': diagnostico,
                'servicios': servicios,
                'detalles': productos,
            }
            serializer = CotizacionCreateSerializer(data=datos)
            serializer.is_valid(raise_exception=True)
            presupuesto = serializer.save()

        return Response(CotizacionDetailSerializer(presupuesto).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def entregar(self, request, pk=None):
        """Cierra la orden y genera su venta (mano de obra + repuestos).

        Genera UNA sola venta y guarda la referencia en `id_venta`. La venta
        queda con estado_pago 'pendiente': el cobro sigue por el flujo normal
        de pagos, que ya exige caja abierta.
        """
        from django.db import connection, transaction

        with transaction.atomic():
            orden = ServicioMoto.objects.select_for_update().get(pk=self.get_object().pk)

            if orden.id_venta_id:
                return Response(
                    {'error': f'Esta orden ya generó la venta #{orden.id_venta_id}.'},
                    status=status.HTTP_400_BAD_REQUEST)
            if not orden.puede_pasar_a('entregada'):
                return Response(
                    {'error': f'No se puede entregar una orden en estado "{orden.estado}".',
                     'transiciones_posibles': ServicioMoto.TRANSICIONES.get(orden.estado, [])},
                    status=status.HTTP_400_BAD_REQUEST)

            total = orden.calcular_total(guardar=False)
            if total <= 0:
                return Response(
                    {'error': 'La orden no tiene monto: definí la mano de obra o agregá repuestos.'},
                    status=status.HTTP_400_BAD_REQUEST)

            cliente_id = orden.id_moto.id_cliente_id
            fecha_entrega = timezone.now()

            with connection.cursor() as cursor:
                # `id_servicio` apunta al catálogo (qué tipo de servicio se
                # vendió), no a la orden de trabajo: son tablas distintas.
                cursor.execute("""
                    INSERT INTO ventas (id_cliente, fecha, total, id_servicio,
                                        monto_pagado, saldo_pendiente, estado_pago)
                    VALUES (%s, %s, %s, %s, 0, %s, 'pendiente')
                    RETURNING id_venta
                """, [cliente_id, fecha_entrega.date(), total,
                      orden.id_tipo_servicio_id, total])
                id_venta = cursor.fetchone()[0]

                # Los repuestos se facturan como líneas normales: la venta
                # queda itemizada en vez de ser un monto opaco.
                for repuesto in orden.repuestos.all():
                    cursor.execute("""
                        INSERT INTO producto_venta (id_venta, id_producto, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [id_venta, repuesto.id_producto_id,
                          repuesto.cantidad, repuesto.precio_unitario])

            orden.estado = 'entregada'
            orden.costo = total
            orden.fecha_entrega = fecha_entrega
            orden.id_venta_id = id_venta
            campos = ['estado', 'costo', 'fecha_entrega', 'id_venta']

            # Mantenimiento preventivo sugerido.
            meses = request.data.get('proximo_mantenimiento_meses')
            if meses:
                try:
                    orden.proximo_mantenimiento_fecha = (
                        fecha_entrega.date() + timedelta(days=int(meses) * 30))
                    campos.append('proximo_mantenimiento_fecha')
                except (TypeError, ValueError):
                    pass
            km_proximo = request.data.get('proximo_mantenimiento_km')
            if km_proximo:
                try:
                    orden.proximo_mantenimiento_km = int(km_proximo)
                    campos.append('proximo_mantenimiento_km')
                except (TypeError, ValueError):
                    pass
            orden.save(update_fields=campos)

            self._registrar_bitacora(orden, 'entregada', request)

        return Response({
            'status': 'Orden entregada y venta generada.',
            'id_venta': id_venta,
            'total': float(total),
            'orden': ServicioMotoSerializer(orden).data,
        })


class ServicioViewSet(viewsets.ModelViewSet):
    """Catálogo de tipos de servicio con su mano de obra.

    Solo expone las filas marcadas como plantilla: la tabla `servicios` también
    guarda 100 registros históricos de trabajos realizados (referenciados por
    ventas antiguas) que no son seleccionables.
    """
    queryset = Servicio.objects.filter(es_plantilla=True)
    serializer_class = ServicioSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'tipo']
    ordering_fields = ['nombre', 'precio_mano_obra']
    ordering = ['nombre']


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
        id_moto = id_de_query(self.request.query_params.get('id_moto'), 'id_moto')
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
        id_moto = id_de_query(self.request.query_params.get('id_moto'), 'id_moto')
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
        id_producto = id_de_query(
            self.request.query_params.get('id_producto'), 'id_producto')
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

        cliente = id_de_query(self.request.query_params.get('cliente'), 'cliente')
        if cliente:
            queryset = queryset.filter(id_cliente=cliente)

        producto = self.request.query_params.get('producto')
        if producto:
            queryset = queryset.filter(id_producto_id=producto)

        venta = id_de_query(self.request.query_params.get('venta'), 'venta')
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
        cliente = id_de_query(self.request.query_params.get('cliente'), 'cliente')
        if cliente:
            queryset = queryset.filter(id_cliente=cliente)
        estado = self.request.query_params.get('estado', None)
        if estado:
            queryset = queryset.filter(estado=estado)
        tipo = self.request.query_params.get('tipo', None)
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        return queryset

    @action(detail=True, methods=['post'], url_path='convertir-venta')
    def convertir_venta(self, request, pk=None):
        """Convierte la cotización en una orden de venta real.

        Descuenta el stock y deja el movimiento de inventario, igual que el POS.
        Antes no lo hacía: insertaba la venta y sus líneas y nada más, así que la
        mercadería salía del local y el sistema seguía contándola en inventario.
        Tampoco comprobaba que hubiera stock, con lo cual se podía "vender" algo
        con existencia cero.

        Los importes se calculan con `Decimal`, no con `float`: sumar precios en
        coma flotante deja el total de la venta con centavos que no cuadran
        contra la suma de sus líneas.
        """
        from django.db import transaction
        with transaction.atomic():
            cot = Cotizacion.objects.select_for_update().get(pk=pk)
            if cot.estado == 'convertida' or cot.id_venta:
                raise DRFValidationError(
                    {'error': 'Esta cotización ya fue convertida en venta'})

            # Un presupuesto de reparación aprobado YA sacó sus repuestos del
            # inventario: lo hizo `_cargar_presupuesto_en_orden` al aprobarlo, y
            # por eso quedó marcado `cargado_a_orden`. Convertirlo además en
            # venta por acá descontaba el stock una segunda vez y facturaba dos
            # veces los mismos repuestos.
            #
            # Ese presupuesto se cobra al entregar la orden de trabajo, que es
            # la que genera la venta con la mano de obra incluida.
            if cot.cargado_a_orden:
                raise DRFValidationError({'error': (
                    'Este presupuesto ya se cargó a una orden de trabajo y sus '
                    'repuestos ya salieron del inventario. Se cobra al entregar '
                    'la orden, no convirtiéndolo en venta.'
                )})

            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id_producto, cantidad, precio_unitario
                    FROM producto_cotizacion WHERE id_cotizacion = %s
                """, [cot.id_cotizacion])
                items = cursor.fetchall()

            if not items:
                raise DRFValidationError(
                    {'error': 'La cotización no tiene productos'})

            # Se agrupan las líneas repetidas antes de validar por dos motivos.
            #
            # Uno: una cotización puede traer el mismo producto dos veces y el
            # stock hay que comprobarlo contra la suma, no contra cada línea por
            # separado (dos líneas de 3 sobre un stock de 5 pasan sueltas y no
            # deberían).
            #
            # Dos: `producto_venta` tiene la clave primaria en
            # (id_venta, id_producto), así que insertar una fila por línea
            # reventaba con violación de clave duplicada — un 500 en la cara del
            # usuario. Va una fila por producto con la cantidad total.
            requerido = {}
            subtotales = {}
            for id_producto, cantidad, precio in items:
                cantidad = int(cantidad)
                requerido[id_producto] = requerido.get(id_producto, 0) + cantidad
                subtotales[id_producto] = (
                    subtotales.get(id_producto, Decimal('0'))
                    + Decimal(str(precio)) * cantidad)

            bloqueados = {}
            for id_producto in sorted(requerido):
                try:
                    bloqueados[id_producto] = (
                        Producto.objects.select_for_update().get(pk=id_producto))
                except Producto.DoesNotExist:
                    raise DRFValidationError(
                        {'error': f'El producto {id_producto} ya no existe.'})

            for id_producto, cantidad in requerido.items():
                producto = bloqueados[id_producto]
                if producto.cantidad_actual < cantidad:
                    raise DRFValidationError({'error': (
                        f'Stock insuficiente de "{producto.nombre}": hay '
                        f'{producto.cantidad_actual} y la cotización pide {cantidad}.'
                    )})

            total = sum(subtotales.values())

            with connection.cursor() as cursor:
                # `saldo_pendiente` se setea explícitamente: es nullable y sin
                # él la venta queda invisible en el reporte de cuentas por
                # cobrar, que filtra por COALESCE(saldo_pendiente,0) > 0.
                cursor.execute("""
                    INSERT INTO ventas (id_cliente, fecha, total,
                                        monto_pagado, saldo_pendiente, estado_pago)
                    VALUES (%s, CURRENT_DATE, %s, 0, %s, 'pendiente')
                    RETURNING id_venta
                """, [cot.id_cliente, total, total])
                id_venta = cursor.fetchone()[0]

                for id_producto, cantidad in requerido.items():
                    # El precio unitario se deriva del subtotal para que
                    # cantidad × precio siga cuadrando con el total de la venta
                    # cuando la cotización trae el mismo producto a precios
                    # distintos (un promedio ponderado, no el primero que salga).
                    precio = subtotales[id_producto] / cantidad
                    cursor.execute("""
                        INSERT INTO producto_venta (id_venta, id_producto, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [id_venta, id_producto, cantidad, precio])

                for id_producto, cantidad in requerido.items():
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = cantidad_actual - %s "
                        "WHERE id_producto = %s", [cantidad, id_producto])
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                        VALUES (%s, 'SALIDA', %s, NOW(), %s, 'ORDEN_VENTA', %s)
                    """, [id_producto, cantidad, f'VENTA-{id_venta}',
                          f'Venta desde cotización #{cot.id_cotizacion}'])

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
        """Cambia el estado (aprobada / rechazada / pendiente).

        Aprobar un presupuesto de reparación además lo **carga a la orden de
        trabajo**: fija la mano de obra y consume los repuestos del inventario.
        Es todo o nada: si falta stock de una pieza, la aprobación falla completa
        en vez de dejar la orden a medio cargar.
        """
        from django.db import transaction

        nuevo = request.data.get('estado')
        if nuevo not in ('pendiente', 'aprobada', 'rechazada'):
            return Response({'error': 'Estado inválido'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            cot = Cotizacion.objects.select_for_update().get(pk=self.get_object().pk)
            if cot.estado == 'convertida':
                return Response(
                    {'error': 'No se puede cambiar el estado de una cotización convertida'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            aprobando_reparacion = (
                nuevo == 'aprobada'
                and cot.tipo == 'reparacion'
                and cot.id_servicio_id
                and not cot.cargado_a_orden
            )

            campos = ['estado']
            cot.estado = nuevo
            if nuevo == 'aprobada':
                cot.fecha_aprobacion = timezone.now()
                cot.aprobado_por = (
                    request.user.get_full_name() or request.user.username)
                campos += ['fecha_aprobacion', 'aprobado_por']

            if aprobando_reparacion:
                # Si falla lanza ValidationError, que sí revierte la transacción.
                self._cargar_presupuesto_en_orden(cot)
                cot.cargado_a_orden = True
                campos.append('cargado_a_orden')

            cot.save(update_fields=campos)

        cot.refresh_from_db()
        return Response(CotizacionDetailSerializer(cot).data)

    def _cargar_presupuesto_en_orden(self, cot):
        """Pasa lo presupuestado a la orden de trabajo.

        **Lanza `ValidationError`** en vez de devolver una Response de error, y
        eso es lo que hace que funcione: esta función corre dentro del
        `transaction.atomic()` de `cambiar_estado`, y un `return` desde adentro
        de un bloque atómico **hace commit**, no rollback. Con la versión
        anterior, un presupuesto de tres repuestos donde el tercero no tenía
        stock dejaba los dos primeros ya descontados del inventario y
        commiteados, mientras que `cargado_a_orden` no se guardaba (se asigna
        después). Al reintentar la aprobación se descontaban de nuevo: stock
        perdido y líneas duplicadas que después se facturaban dos veces.
        """
        orden = ServicioMoto.objects.select_for_update().get(pk=cot.id_servicio_id)
        if orden.estado in ('entregada', 'cancelada'):
            raise DRFValidationError(
                {'error': f'La orden de trabajo ya está {orden.estado}.'})

        # Mano de obra: la suma de las líneas presupuestadas.
        orden.precio_mano_obra = cot.total_mano_obra()
        orden.save(update_fields=['precio_mano_obra'])

        # Repuestos: recién acá salen del inventario.
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id_producto, cantidad, precio_unitario
                FROM producto_cotizacion WHERE id_cotizacion = %s
            """, [cot.id_cotizacion])
            lineas = cursor.fetchall()

            for id_producto, cantidad, precio in lineas:
                producto = Producto.objects.select_for_update().get(pk=id_producto)
                if producto.cantidad_actual < cantidad:
                    raise DRFValidationError(
                        {'error': f'Stock insuficiente de "{producto.nombre}" para aprobar: '
                                  f'hay {producto.cantidad_actual}, el presupuesto pide {cantidad}.'})

                ServicioRepuesto.objects.create(
                    id_servicio=orden, id_producto=producto,
                    cantidad=cantidad, precio_unitario=precio,
                )
                producto.cantidad_actual -= cantidad
                producto.save(update_fields=['cantidad_actual'])

                cursor.execute("""
                    INSERT INTO movimientos_inventario
                        (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                    VALUES (%s, 'SALIDA', %s, NOW(), %s, 'SERVICIO_TALLER', %s)
                """, [id_producto, cantidad, f'TALLER-{orden.id_servicio}',
                      f'Repuesto aprobado en presupuesto #{cot.id_cotizacion}'])

        orden.calcular_total()
        return None


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
        cliente = id_de_query(self.request.query_params.get('cliente'), 'cliente')
        if cliente:
            queryset = queryset.filter(id_cliente=cliente)
        venta = id_de_query(self.request.query_params.get('venta'), 'venta')
        if venta:
            queryset = queryset.filter(id_venta=venta)
        return queryset


class DevolucionCompraViewSet(viewsets.ModelViewSet):
    """Devoluciones de mercadería a proveedores. Saca stock y baja la deuda.

    Espejo de DevolucionViewSet pero en la otra dirección. Igual que las
    devoluciones de cliente, no se editan ni se borran: deshacerlas implicaría
    revertir stock, deuda y caja de forma coordinada. Si hay un error, se
    corrige con un ajuste de inventario, que deja su propio rastro.
    """
    permission_classes = [IsAdminUser]
    queryset = DevolucionCompra.objects.select_related(
        'id_proveedor', 'id_orden').prefetch_related('detalles__id_producto')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id_devolucion_compra', 'motivo']
    ordering_fields = ['fecha', 'total']
    ordering = ['-fecha', '-id_devolucion_compra']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return DevolucionCompraCreateSerializer
        return DevolucionCompraSerializer

    def get_serializer_context(self):
        contexto = super().get_serializer_context()
        usuario = self.request.user
        contexto['usuario'] = usuario.get_full_name() or usuario.username
        return contexto

    def get_queryset(self):
        queryset = super().get_queryset()
        proveedor = id_de_query(
            self.request.query_params.get('proveedor'), 'proveedor')
        if proveedor:
            queryset = queryset.filter(id_proveedor=proveedor)
        orden = id_de_query(self.request.query_params.get('orden'), 'orden')
        if orden:
            queryset = queryset.filter(id_orden=orden)
        return queryset

    @action(detail=False, methods=['get'], url_path='devolvible/(?P<id_orden>[^/.]+)')
    def devolvible(self, request, id_orden=None):
        """Cuánto se puede devolver de cada producto de una compra.

        Es lo que el formulario necesita para mostrar el máximo por línea, en
        vez de dejar que el usuario escriba una cantidad que el backend va a
        rechazar. El tope es el menor entre lo que queda por devolver y lo que
        físicamente hay en stock.
        """
        try:
            orden = OrdenCompra.objects.get(pk=id_orden)
        except OrdenCompra.DoesNotExist:
            return Response({'error': 'La orden no existe'},
                            status=status.HTTP_404_NOT_FOUND)

        if not orden.stock_aplicado or orden.id_estado == OrdenCompra.ESTADO_CANCELADA:
            return Response({
                'id_orden': orden.id_orden,
                'puede_devolverse': False,
                'motivo': ('La orden está cancelada.'
                           if orden.id_estado == OrdenCompra.ESTADO_CANCELADA
                           else 'La orden todavía no se recibió.'),
                'productos': [],
            })

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT op.id_producto, p.nombre, p.sku_producto,
                       SUM(op.cantidad)                       AS recibido,
                       MAX(op.precio_unitario)                AS precio,
                       MAX(p.cantidad_actual)                 AS stock,
                       COALESCE((
                           SELECT SUM(pdc.cantidad)
                           FROM producto_devolucion_compra pdc
                           JOIN devolucion_compra dc
                             ON dc.id_devolucion_compra = pdc.id_devolucion_compra
                           WHERE dc.id_orden = op.id_orden
                             AND pdc.id_producto = op.id_producto
                       ), 0)                                  AS ya_devuelto
                FROM orden_producto op
                JOIN productos p ON p.id_producto = op.id_producto
                WHERE op.id_orden = %s AND op.cantidad IS NOT NULL
                GROUP BY op.id_orden, op.id_producto, p.nombre, p.sku_producto
                ORDER BY p.nombre
            """, [orden.id_orden])
            productos = []
            for r in cursor.fetchall():
                recibido, stock, ya_devuelto = int(r[3]), int(r[5]), int(r[6])
                productos.append({
                    'id_producto': r[0],
                    'nombre': r[1],
                    'sku': r[2],
                    'recibido': recibido,
                    'ya_devuelto': ya_devuelto,
                    'stock_actual': stock,
                    'precio_unitario': float(r[4] or 0),
                    # El tope real: no se puede devolver lo que ya no está.
                    'max_devolvible': max(0, min(recibido - ya_devuelto, stock)),
                })

        return Response({
            'id_orden': orden.id_orden,
            'puede_devolverse': any(p['max_devolvible'] > 0 for p in productos),
            'productos': productos,
        })


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



class SesionCajaViewSet(viewsets.ReadOnlyModelViewSet):
    """Turnos de caja: abrir, cerrar, registrar movimientos y consultar arqueo.

    - Listar/ver historial: solo admin (datos financieros, como los reportes).
    - abrir / actual: cualquier usuario autenticado (el operador abre su turno).
    - cerrar / movimientos: **solo sobre el propio turno**, o cualquiera si es
      admin. Ver `_verificar_propietario`.

    Solo puede haber una sesión abierta a la vez en todo el sistema (lo impone
    `abrir` y un constraint en la base), así que "el turno propio" es el que esa
    persona abrió.
    """
    queryset = SesionCaja.objects.select_related('usuario').all()
    serializer_class = SesionCajaSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def _verificar_propietario(self, sesion):
        """Un operador solo toca el turno que abrió él; el admin, cualquiera.

        `get_permissions` reserva `list`/`retrieve` a admin porque son datos
        financieros, pero las acciones caían en `IsAuthenticated` y con eso se
        salteaba ese criterio: un operador podía pedir los movimientos de
        cualquier turno histórico —montos, motivos y quién los registró— y podía
        cerrarle el arqueo a otra persona, firmando un conteo que no hizo.

        `get_object()` no alcanza para esto: solo evalúa permisos de objeto, y
        `IsAuthenticated` los concede a todo el mundo.
        """
        if self.request.user.is_staff:
            return
        if sesion.usuario_id != self.request.user.id:
            raise PermissionDenied(
                'Solo podés operar sobre tu propio turno de caja.')

    @action(detail=False, methods=['get'])
    def actual(self, request):
        """Devuelve la sesión abierta actual, o null si no hay ninguna.

        A diferencia de `cerrar` y `movimientos`, este endpoint no se puede
        bloquear para quien no es dueño del turno: media docena de pantallas lo
        usan sólo para saber si se puede cobrar (el POS, los abonos, los
        reembolsos), y como sólo hay un turno abierto en todo el sistema,
        exigir propiedad dejaría al resto del equipo sin poder vender.

        Lo que sí se recorta es el detalle: el arqueo en vivo —fondo inicial,
        efectivo esperado, desglose por método y los movimientos con su motivo y
        su autor— es de quien tiene la caja. Antes salía entero para cualquiera,
        que es justo lo que `_verificar_propietario` evita por las otras dos
        puertas.
        """
        sesion = SesionCaja.objects.filter(estado='abierta').select_related('usuario').first()
        if sesion is None:
            return Response(None)

        propia = request.user.is_staff or sesion.usuario_id == request.user.id
        if not propia:
            # Lo justo para saber que hay caja abierta y de quién es.
            return Response({
                'id_sesion': sesion.id_sesion,
                'estado': sesion.estado,
                'usuario_nombre': sesion.usuario.get_full_name() or sesion.usuario.username,
                'fecha_apertura': sesion.fecha_apertura,
                'es_propia': False,
            })

        datos = SesionCajaSerializer(sesion).data
        datos['es_propia'] = True
        return Response(datos)

    @action(detail=False, methods=['post'])
    def abrir(self, request):
        """Abre una nueva sesión de caja con un fondo inicial."""
        serializer = AbrirCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if SesionCaja.objects.filter(estado='abierta').exists():
            return Response(
                {'error': 'Ya hay una caja abierta. Ciérrala antes de abrir otra.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            sesion = SesionCaja.objects.create(
                usuario=request.user,
                monto_apertura=serializer.validated_data['monto_apertura'],
                notas=serializer.validated_data.get('notas') or None,
            )
        except IntegrityError:
            # Carrera: otro request abrió una sesión entre el check y el create.
            return Response(
                {'error': 'Ya hay una caja abierta. Ciérrala antes de abrir otra.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(SesionCajaSerializer(sesion).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        """Cierra la sesión: congela el esperado y calcula la diferencia."""
        from django.db import transaction
        from django.utils import timezone
        serializer = CerrarCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            sesion = SesionCaja.objects.select_for_update().get(pk=pk)
            self._verificar_propietario(sesion)
            if sesion.estado != 'abierta':
                return Response(
                    {'error': 'Esta caja ya está cerrada'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            contado = serializer.validated_data['monto_cierre_contado']
            esperado = sesion.calcular_esperado()
            sesion.monto_esperado = esperado
            sesion.monto_cierre_contado = contado
            sesion.diferencia = contado - esperado
            sesion.fecha_cierre = timezone.now()
            sesion.estado = 'cerrada'
            if serializer.validated_data.get('notas'):
                sesion.notas = serializer.validated_data['notas']
            sesion.save()

        return Response(SesionCajaSerializer(sesion).data)

    @action(detail=True, methods=['get', 'post'])
    def movimientos(self, request, pk=None):
        """GET: lista los movimientos de la sesión. POST: registra uno nuevo.

        Solo sobre el propio turno (o cualquiera, si es admin): son montos,
        motivos y responsables de movimientos de efectivo.
        """
        sesion = self.get_object()
        self._verificar_propietario(sesion)
        if request.method == 'GET':
            return Response(
                MovimientoCajaSerializer(sesion.movimientos.all(), many=True).data
            )

        if sesion.estado != 'abierta':
            return Response(
                {'error': 'No se pueden registrar movimientos en una caja cerrada'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = MovimientoCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mov = MovimientoCaja.objects.create(
            sesion=sesion,
            usuario=request.user,
            tipo=serializer.validated_data['tipo'],
            monto=serializer.validated_data['monto'],
            motivo=serializer.validated_data['motivo'],
        )
        return Response(MovimientoCajaSerializer(mov).data, status=status.HTTP_201_CREATED)


class CategoriaGastoViewSet(viewsets.ModelViewSet):
    """Catálogo de categorías de gasto. Solo administradores."""
    permission_classes = [IsAdminUser]
    queryset = CategoriaGasto.objects.all()
    serializer_class = CategoriaGastoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre']
    ordering = ['nombre']


class GastoViewSet(viewsets.ModelViewSet):
    """Gastos operativos.

    Registrar (create) lo puede hacer cualquier usuario autenticado — un gasto
    en efectivo es un egreso del turno que el operador debe poder registrar
    para que el arqueo cuadre. Ver el libro, editar y borrar son admin-only
    (datos de la estructura de costos, como los reportes).
    """
    queryset = Gasto.objects.select_related('categoria', 'usuario').all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion', 'referencia']
    ordering_fields = ['fecha', 'monto']
    ordering = ['-fecha', '-created_at']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        if self.action == 'create':
            return GastoCreateSerializer
        return GastoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        categoria = self.request.query_params.get('categoria')
        if categoria:
            qs = qs.filter(categoria_id=categoria)
        fecha_inicio = self.request.query_params.get('fecha_inicio')
        if fecha_inicio:
            qs = qs.filter(fecha__gte=fecha_inicio)
        fecha_fin = self.request.query_params.get('fecha_fin')
        if fecha_fin:
            qs = qs.filter(fecha__lte=fecha_fin)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        gasto = serializer.save()
        return Response(GastoSerializer(gasto).data, status=status.HTTP_201_CREATED)


class ConfiguracionIAViewSet(viewsets.ModelViewSet):
    """Claves y modelo de cada proveedor de IA. Solo administradores.

    La clave se guarda cifrada y nunca se devuelve: la API responde con una
    versión enmascarada. La tabla además está excluida del respaldo.
    """
    permission_classes = [IsAdminUser]
    queryset = ConfiguracionIA.objects.all()
    serializer_class = ConfiguracionIASerializer
    # Se administra con las acciones de abajo (guardar/activar/probar), que
    # manejan la clave con cuidado; el CRUD genérico de escritura no aplica.
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    @action(detail=False, methods=['get'])
    def catalogo(self, request):
        """Proveedores y modelos disponibles, para poblar los selectores."""
        return Response({'proveedores': catalogo_publico()})

    @action(detail=False, methods=['get'])
    def estado(self, request):
        """Qué proveedor está activo y con qué modelo.

        Es lo que consultarán las funciones de IA cuando existan.
        """
        activo = ConfiguracionIA.objects.filter(activo=True).first()
        return Response({
            # Hace falta clave *y* modelo: con uno solo de los dos no se puede
            # llamar al proveedor, así que decir que hay proveedor activo sería
            # mentira.
            'hay_proveedor_activo': (
                activo is not None and bool(activo.api_key) and bool(activo.modelo)),
            'proveedor': activo.proveedor if activo else None,
            'nombre_proveedor': activo.nombre_proveedor if activo else None,
            'modelo': activo.modelo if activo else None,
            'verificada': activo.verificada if activo else False,
            'configurados': ConfiguracionIA.objects.exclude(
                api_key__isnull=True).count(),
        })

    @action(detail=False, methods=['post'])
    def guardar(self, request):
        """Crea o actualiza un proveedor. Si no viene clave, conserva la actual."""
        serializer = ConfiguracionIAGuardarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        proveedor = datos['proveedor']
        existente = datos.pop('_existente', None)
        usuario = request.user.get_full_name() or request.user.username

        with transaction.atomic():
            config = existente or ConfiguracionIA(proveedor=proveedor)
            clave_nueva = datos.get('api_key')
            if clave_nueva:
                config.api_key = clave_nueva
                # La clave cambió: lo verificado antes ya no dice nada de esta.
                config.verificada = False
                config.verificada_en = None
                config.ultimo_error = None

            # Si no viene modelo se deja como está (o sin nada en un alta): la
            # lista de modelos se pide al proveedor con esta clave, así que
            # recién se puede elegir uno después de guardarla.
            config.modelo = datos.get('modelo') or config.modelo
            config.actualizado_por = usuario

            if datos.get('activo'):
                # Solo uno activo: se apagan los demás antes, porque hay un
                # constraint en la base que lo impone.
                ConfiguracionIA.objects.exclude(proveedor=proveedor).update(activo=False)
                config.activo = True
            config.save()

        return Response(ConfiguracionIASerializer(config).data,
                        status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """Marca este proveedor como el que usarán las funciones de IA."""
        config = self.get_object()
        if not config.api_key:
            return Response(
                {'error': 'Este proveedor no tiene clave configurada.'},
                status=status.HTTP_400_BAD_REQUEST)
        if not config.modelo:
            return Response(
                {'error': 'Elegí primero un modelo para este proveedor.'},
                status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            ConfiguracionIA.objects.exclude(pk=config.pk).update(activo=False)
            config.activo = True
            config.actualizado_por = request.user.get_full_name() or request.user.username
            config.save(update_fields=['activo', 'actualizado_por', 'actualizado_en'])
        return Response(ConfiguracionIASerializer(config).data)

    @action(detail=True, methods=['get'])
    def modelos(self, request, pk=None):
        """Modelos que el proveedor ofrece hoy para esta clave.

        Se consulta en vivo en vez de guardar una lista: los proveedores sacan
        modelos nuevos cada pocos meses y retiran otros, así que una lista
        escrita a mano termina ofreciendo modelos muertos y escondiendo los
        nuevos. Por eso también hace falta la clave antes de poder elegir: sin
        ella no hay a quién preguntarle.
        """
        config = self.get_object()
        if not config.api_key:
            return Response(
                {'error': 'Cargá primero la clave: la lista de modelos la da el proveedor.'},
                status=status.HTTP_400_BAD_REQUEST)

        ok, modelos, detalle = listar_modelos(config.proveedor, config.api_key)
        return Response({
            'ok': ok,
            'detalle': detalle,
            'modelos': modelos,
            'modelo_actual': config.modelo,
            'modelo_sugerido': PROVEEDORES[config.proveedor]['modelo_sugerido']
                               if config.proveedor in PROVEEDORES else None,
        }, status=status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def probar(self, request, pk=None):
        """Comprueba contra el proveedor que la clave sirve.

        Sin esto, una clave mal pegada se descubre recién cuando una función de
        IA falla frente al usuario. La llamada la hace el backend: si la hiciera
        el navegador, la clave tendría que viajar hasta ahí.
        """
        config = self.get_object()
        if not config.api_key:
            return Response({'error': 'No hay clave que probar.'},
                            status=status.HTTP_400_BAD_REQUEST)

        ok, detalle = probar_credencial(config.proveedor, config.api_key)

        config.verificada = ok
        config.verificada_en = timezone.now() if ok else None
        config.ultimo_error = None if ok else detalle
        config.save(update_fields=['verificada', 'verificada_en', 'ultimo_error'])

        return Response({
            'ok': ok,
            'detalle': detalle,
            'configuracion': ConfiguracionIASerializer(config).data,
        }, status=status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        """Borrar la configuración también borra la clave (queda desconfigurado)."""
        instance.delete()
