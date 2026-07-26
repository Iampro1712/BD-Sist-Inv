"""
Serializers para la API de Inventrix
"""
from datetime import date
from decimal import Decimal

from rest_framework import serializers
from django.db import connection, models
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from inventory.models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, OrdenVenta,
    MovimientoInventario, Moto, ServicioMoto, Servicio, BitacoraServicio,
    AuditoriaProducto, Garantia, ReclamacionGarantia, PagoVenta,
    Cotizacion, Devolucion, SesionCaja, MovimientoCaja,
    CategoriaGasto, Gasto, PagoCompra, ServicioRepuesto, ServicioCotizacion,
    Ubicacion, DevolucionCompra, ProductoDevolucionCompra,
)


# ============================================================================
# HELPERS PARA EVITAR N+1 EN LISTADOS
# ============================================================================

def _root_instances(serializer):
    """Devuelve la lista completa de objetos que se están serializando.

    En un listado (many=True) el `parent` es el ListSerializer y su `.instance`
    es la página completa; en detalle es el propio objeto. Permite precargar
    datos relacionados una sola vez por lote en vez de una query por fila.
    """
    root = serializer.parent if serializer.parent is not None else serializer
    inst = root.instance
    if inst is None:
        return []
    if isinstance(inst, (list, tuple)):
        return list(inst)
    try:
        return list(inst)
    except TypeError:
        return [inst]


def _batch_cache(serializer, attr_name, builder):
    """Construye (y cachea en el serializer raíz) un dict de lookup por lote."""
    root = serializer.parent if serializer.parent is not None else serializer
    cache = getattr(root, attr_name, None)
    if cache is None:
        cache = builder(root)
        setattr(root, attr_name, cache)
    return cache


# ============================================================================
# SERIALIZERS BÁSICOS (para relaciones anidadas)
# ============================================================================

class MarcaSerializer(serializers.ModelSerializer):
    """Serializer básico para Marca"""
    # Nota: Producto no tiene relación con Marca en el esquema actual
    # (no existe columna marca_id en productos), por eso no hay un
    # "productos_count" aquí — nada que contar todavía.
    class Meta:
        model = Marca
        fields = ['id', 'nombre', 'descripcion', 'fecha_creacion']
        read_only_fields = ['fecha_creacion']


class CategoriaSerializer(serializers.ModelSerializer):
    """Serializer básico para Categoria"""
    # Nota: Producto no tiene relación con Categoria en el esquema actual
    # (no existe columna categoria_id en productos).
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'descripcion', 'fecha_creacion']
        read_only_fields = ['fecha_creacion']


class ProveedorListSerializer(serializers.ModelSerializer):
    """Serializer para listado de proveedores"""
    class Meta:
        model = Proveedor
        fields = [
            'id_proveedor', 'nombre_empresa', 'persona_contacto', 'telefono',
            'email', 'direccion'
        ]


class ProveedorDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para proveedor"""
    
    class Meta:
        model = Proveedor
        fields = [
            'id_proveedor', 'nombre_empresa', 'persona_contacto', 'telefono', 'email',
            'direccion'
        ]

# MasterDev
# ============================================================================
# PRODUCTO SERIALIZERS
# ============================================================================

class UbicacionSerializer(serializers.ModelSerializer):
    """Lugar físico de almacenamiento."""
    codigo = serializers.CharField(read_only=True)
    total_productos = serializers.SerializerMethodField()
    valor_inventario = serializers.SerializerMethodField()

    class Meta:
        model = Ubicacion
        fields = [
            'id_ubicacion', 'bodega', 'pasillo', 'estante', 'gaveta',
            'notas', 'activo', 'codigo', 'total_productos', 'valor_inventario',
        ]

    def _agregados(self, obj):
        """Se calcula con una anotación cuando el ViewSet la provee, para no
        disparar dos consultas por fila en el listado."""
        if hasattr(obj, 'num_productos'):
            return obj.num_productos, obj.valor_guardado or 0
        datos = obj.productos.aggregate(
            n=models.Count('id_producto'),
            v=models.Sum(models.F('cantidad_actual') * models.F('precio_final'),
                         output_field=models.DecimalField(max_digits=14, decimal_places=2)),
        )
        return datos['n'] or 0, datos['v'] or 0

    def get_total_productos(self, obj):
        return self._agregados(obj)[0]

    def get_valor_inventario(self, obj):
        return float(self._agregados(obj)[1])

    def validate(self, attrs):
        """Mensaje claro en vez del error crudo del constraint de BD."""
        datos = {**({} if self.instance is None else {
            'bodega': self.instance.bodega, 'pasillo': self.instance.pasillo,
            'estante': self.instance.estante, 'gaveta': self.instance.gaveta,
        }), **attrs}
        qs = Ubicacion.objects.filter(
            bodega=datos.get('bodega') or 'Principal',
            pasillo=datos.get('pasillo') or None,
            estante=datos.get('estante') or None,
            gaveta=datos.get('gaveta') or None,
        )
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe una ubicación con esos datos.')
        return attrs


class ProductoListSerializer(serializers.ModelSerializer):
    """Serializer para listado de productos"""
    proveedor_nombre = serializers.CharField(source='id_proveedor.nombre_empresa', read_only=True)
    ubicacion_codigo = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id_producto', 'sku_producto', 'nombre', 'cantidad_actual',
            'cantidad_minima', 'cantidad_total', 'precio_compra_unitario', 'precio_final',
            'id_proveedor', 'proveedor_nombre',
            'meses_garantia', 'tipo_garantia', 'descripcion_garantia',
            'id_ubicacion', 'ubicacion_codigo',
        ]

    def get_ubicacion_codigo(self, obj):
        return obj.id_ubicacion.codigo if obj.id_ubicacion else None


class ProductoDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para producto"""
    proveedor_nombre = serializers.CharField(source='id_proveedor.nombre_empresa', read_only=True)
    # Objeto completo acá (no solo el código) para poder pre-cargar el selector
    # de ubicación al editar el producto.
    ubicacion = UbicacionSerializer(source='id_ubicacion', read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id_producto', 'sku_producto', 'nombre', 'cantidad_actual',
            'cantidad_minima', 'cantidad_total', 'precio_compra_unitario', 'precio_final',
            'id_proveedor', 'proveedor_nombre',
            'meses_garantia', 'tipo_garantia', 'descripcion_garantia',
            'id_ubicacion', 'ubicacion',
        ]


class ProductoCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar productos"""
    class Meta:
        model = Producto
        fields = [
            'sku_producto', 'nombre', 'cantidad_actual', 'cantidad_minima',
            'cantidad_total', 'precio_compra_unitario', 'precio_final', 'id_proveedor',
            'meses_garantia', 'tipo_garantia', 'descripcion_garantia',
            'id_ubicacion',
        ]


# ============================================================================
# CLIENTE SERIALIZERS
# ============================================================================

class ClienteListSerializer(serializers.ModelSerializer):
    """Serializer para listado de clientes"""
    class Meta:
        model = Cliente
        fields = [
            'id_cliente', 'nombre', 'telefono', 'email'
        ]


class ClienteDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para cliente"""
    
    class Meta:
        model = Cliente
        fields = [
            'id_cliente', 'nombre', 'telefono', 'email'
        ]


# ============================================================================
# ORDEN COMPRA SERIALIZERS
# ============================================================================

ESTADO_ID_MAP = {
    1: 'cancelada',
    2: 'pendiente',
    3: 'recibida',
}

ESTADO_LABEL_MAP = {
    1: 'Cancelada',
    2: 'Pendiente',
    3: 'Recibida',
}


class OrdenCompraListSerializer(serializers.ModelSerializer):
    """Serializer para listado de órdenes de compra"""
    proveedor_nombre = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = OrdenCompra
        fields = [
            'id_orden', 'id_proveedor', 'proveedor_nombre', 'id_estado',
            'estado', 'estado_display', 'fecha_creacion', 'total',
            'monto_pagado', 'saldo_pendiente', 'estado_pago', 'stock_aplicado',
            'fecha_recepcion', 'fecha_esperada',
        ]

    def get_proveedor_nombre(self, obj):
        cache = _batch_cache(self, '_oc_proveedor_nombre', _build_proveedor_nombre_map)
        return cache.get(obj.id_proveedor, 'Proveedor no encontrado')

    def get_estado(self, obj):
        return ESTADO_ID_MAP.get(obj.id_estado, 'pendiente')

    def get_estado_display(self, obj):
        return ESTADO_LABEL_MAP.get(obj.id_estado, 'Desconocido')

    def get_total(self, obj):
        cache = _batch_cache(self, '_oc_total', _build_orden_compra_total_map)
        return cache.get(obj.id_orden, 0.0)


def _build_proveedor_nombre_map(root):
    """Mapa {id_proveedor: nombre_empresa} para todos los proveedores del lote."""
    ids = {getattr(o, 'id_proveedor', None) for o in _root_instances(root)}
    ids.discard(None)
    return dict(
        Proveedor.objects.filter(id_proveedor__in=ids)
        .values_list('id_proveedor', 'nombre_empresa')
    )


def _build_orden_compra_total_map(root):
    """Mapa {id_orden: total} con una única agregación para todo el lote.

    Total = Σ(cantidad * precio_unitario) de las líneas. Para órdenes viejas
    sin cantidad/precio (creadas antes de guardar el detalle), cae al costo
    actual del producto como aproximación."""
    ids = [o.id_orden for o in _root_instances(root)]
    if not ids:
        return {}
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT op.id_orden,
                   SUM(COALESCE(op.cantidad, 1) * COALESCE(op.precio_unitario, p.precio_compra_unitario, 0))
            FROM orden_producto op
            INNER JOIN productos p ON p.id_producto = op.id_producto
            WHERE op.id_orden = ANY(%s)
            GROUP BY op.id_orden
        """, [ids])
        return {row[0]: float(row[1]) if row[1] else 0.0 for row in cursor.fetchall()}


class OrdenCompraDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para orden de compra"""
    proveedor_nombre = serializers.SerializerMethodField()
    proveedor_contacto = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    productos = serializers.SerializerMethodField()
    notas = serializers.SerializerMethodField()
    puede_recibirse = serializers.SerializerMethodField()
    dias_entrega = serializers.SerializerMethodField()
    total_devuelto = serializers.SerializerMethodField()
    saldo_a_favor = serializers.SerializerMethodField()
    devoluciones = serializers.SerializerMethodField()

    class Meta:
        model = OrdenCompra
        fields = [
            'id_orden', 'id_proveedor', 'proveedor_nombre', 'proveedor_contacto',
            'id_estado', 'estado', 'estado_display', 'fecha_creacion',
            'total', 'subtotal', 'productos', 'notas',
            'monto_pagado', 'saldo_pendiente', 'estado_pago',
            'stock_aplicado', 'puede_recibirse',
            'fecha_recepcion', 'fecha_esperada', 'dias_entrega',
            'total_devuelto', 'saldo_a_favor', 'devoluciones',
        ]

    def _get_proveedor(self, obj):
        """Carga el proveedor una sola vez por objeto (nombre + contacto)."""
        if not hasattr(self, '_proveedor_obj'):
            self._proveedor_obj = Proveedor.objects.filter(
                id_proveedor=obj.id_proveedor
            ).first()
        return self._proveedor_obj

    def get_proveedor_nombre(self, obj):
        proveedor = self._get_proveedor(obj)
        return proveedor.nombre_empresa if proveedor else 'Proveedor no encontrado'

    def get_proveedor_contacto(self, obj):
        proveedor = self._get_proveedor(obj)
        return proveedor.persona_contacto if proveedor else None

    def get_estado(self, obj):
        return ESTADO_ID_MAP.get(obj.id_estado, 'pendiente')

    def get_estado_display(self, obj):
        return ESTADO_LABEL_MAP.get(obj.id_estado, 'Desconocido')

    def get_notas(self, obj):
        # orden_compra puede no tener columna `notas` (esquema legado). Se
        # consulta dentro de un savepoint (atomic) para que, si la columna no
        # existe, el error NO aborte la transacción de la petición.
        from django.db import connection, ProgrammingError, transaction
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SELECT notas FROM orden_compra WHERE id_orden = %s", [obj.id_orden])
                    row = cursor.fetchone()
                    return row[0] if row and row[0] else None
        except ProgrammingError:
            return None

    def get_puede_recibirse(self, obj):
        """Si la orden se puede recibir sumando stock.

        Las órdenes creadas antes de que `orden_producto` guardara cantidades no
        se pueden recibir: no hay forma de saber cuánto sumar. La interfaz lo
        avisa en vez de dejar que el usuario choque con el error.
        """
        return (
            obj.id_estado == OrdenCompra.ESTADO_PENDIENTE
            and not obj.stock_aplicado
            and bool(obj.lineas_recepcion())
        )

    def get_dias_entrega(self, obj):
        return obj.dias_entrega()

    def get_total_devuelto(self, obj):
        return float(obj.total_devuelto())

    def get_saldo_a_favor(self, obj):
        """Lo que el proveedor debe por mercadería devuelta y no reembolsada."""
        return float(obj.saldo_a_favor())

    def get_devoluciones(self, obj):
        # Se serializa acá y no con un campo anidado porque
        # DevolucionCompraSerializer se define más abajo en este módulo.
        return DevolucionCompraSerializer(obj.devoluciones.all(), many=True).data

    def get_productos(self, obj):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    p.id_producto,
                    p.nombre,
                    p.sku_producto,
                    COALESCE(op.precio_unitario, p.precio_compra_unitario, 0) AS precio_unitario,
                    COALESCE(op.cantidad, 1) AS cantidad
                FROM orden_compra oc
                INNER JOIN orden_producto op ON op.id_orden = oc.id_orden
                INNER JOIN productos p ON p.id_producto = op.id_producto
                WHERE oc.id_orden = %s
            """, [obj.id_orden])
            productos = []
            for row in cursor.fetchall():
                precio = float(row[3]) if row[3] else 0.0
                cantidad = int(row[4]) if row[4] else 0
                productos.append({
                    'id_producto': row[0],
                    'nombre': row[1],
                    'sku': row[2],
                    'precio_unitario': precio,
                    'precio_compra': precio,  # compat con el front actual
                    'cantidad': cantidad,
                    'subtotal': round(precio * cantidad, 2),
                })
            return productos

    def get_subtotal(self, obj):
        # El subtotal es igual al total en este caso
        return self.get_total(obj)

    def get_total(self, obj):
        cache = _batch_cache(self, '_oc_total', _build_orden_compra_total_map)
        return cache.get(obj.id_orden, 0.0)


class OrdenCompraCreateSerializer(serializers.Serializer):
    """Serializer para crear órdenes de compra"""
    proveedor = serializers.IntegerField(required=True, source='id_proveedor')
    fecha = serializers.DateField(required=True, source='fecha_creacion')
    notas = serializers.CharField(required=False, allow_blank=True)
    detalles = serializers.ListField(child=serializers.DictField(), required=True, write_only=True)
    # Fecha que promete el proveedor: es contra esto que se mide la puntualidad.
    fecha_esperada = serializers.DateField(required=False, allow_null=True)

    # Campos de solo lectura para la respuesta
    id_orden = serializers.IntegerField(read_only=True)
    id_proveedor = serializers.IntegerField(read_only=True)
    id_estado = serializers.IntegerField(read_only=True)
    fecha_creacion = serializers.DateField(read_only=True)

    def create(self, validated_data):
        from django.db import connection

        detalles_data = validated_data.pop('detalles')

        # Insertar en orden_compra con estado pendiente (2). Se fijan también
        # monto_pagado/estado_pago porque son NOT NULL y el INSERT crudo no
        # hereda los defaults a nivel de app de Django (luego calcular_saldo
        # ajusta el saldo real).
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO orden_compra
                    (id_proveedor, id_estado, fecha_creacion, monto_pagado, estado_pago,
                     fecha_esperada)
                VALUES (%s, %s, %s, 0, 'pendiente', %s)
                RETURNING id_orden
            """, [
                validated_data['id_proveedor'],
                2,  # Estado pendiente
                validated_data['fecha_creacion'],
                validated_data.get('fecha_esperada'),
            ])
            id_orden = cursor.fetchone()[0]

            # Insertar productos con cantidad + precio (para el total real y
            # las cuentas por pagar). Si no vienen, se usan 1 y el costo actual.
            for detalle in detalles_data:
                cantidad = int(detalle.get('cantidad') or 1)
                precio = detalle.get('precio_unitario')
                if precio in (None, ''):
                    prod = Producto.objects.filter(pk=detalle['producto']).first()
                    precio = prod.precio_compra_unitario if prod else 0
                cursor.execute("""
                    INSERT INTO orden_producto (id_orden, id_producto, cantidad, precio_unitario)
                    VALUES (%s, %s, %s, %s)
                """, [id_orden, detalle['producto'], cantidad, precio])

        # Inicializar el saldo de cuentas por pagar (total pendiente).
        orden = OrdenCompra.objects.get(id_orden=id_orden)
        orden.calcular_saldo()
        return orden
    
    def to_representation(self, instance):
        """Usar el serializer de detalle para la respuesta"""
        return OrdenCompraDetailSerializer(instance).data


# ============================================================================
# ORDEN VENTA SERIALIZERS
# ============================================================================

class PagoVentaSerializer(serializers.ModelSerializer):
    """Serializer de lectura para un pago/abono de venta."""
    metodo_pago_display = serializers.CharField(source='get_metodo_pago_display', read_only=True)
    id_venta = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PagoVenta
        fields = [
            'id_pago', 'id_venta', 'monto', 'fecha_pago',
            'metodo_pago', 'metodo_pago_display', 'referencia',
            'notas', 'created_at'
        ]
        read_only_fields = ['created_at']


class PagoVentaCreateSerializer(serializers.ModelSerializer):
    """Serializer para registrar un pago/abono.

    Recibe la venta desde la vista (no del body). Valida monto > 0 y que no
    exceda el saldo pendiente calculado con la MISMA fuente que el detalle.
    """
    class Meta:
        model = PagoVenta
        fields = ['monto', 'fecha_pago', 'metodo_pago', 'referencia', 'notas']

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero')
        return value

    def validate(self, data):
        from django.db.models import Sum
        venta = self.context['venta']
        total = venta.calcular_total()
        pagado = venta.pagos.aggregate(total=Sum('monto'))['total'] or 0
        saldo = total - pagado
        if data['monto'] > saldo:
            raise serializers.ValidationError({
                'monto': f'El monto excede el saldo pendiente de C${saldo:.2f}'
            })
        return data

    def create(self, validated_data):
        venta = self.context['venta']
        # Todo cobro debe ocurrir dentro de un turno de caja abierto (permite
        # el arqueo). Se etiqueta el pago con la sesión; sin sesión abierta,
        # se bloquea el cobro (aplica al POS y a los abonos).
        sesion = SesionCaja.objects.filter(estado='abierta').first()
        if sesion is None:
            raise serializers.ValidationError(
                {'caja': 'No hay una caja abierta. Abre la caja antes de cobrar.'}
            )
        pago = PagoVenta.objects.create(id_venta=venta, sesion=sesion, **validated_data)
        venta.calcular_saldo()
        return pago


class OrdenVentaListSerializer(serializers.ModelSerializer):
    """Serializer para listado de órdenes de venta"""
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    estado_pago_display = serializers.CharField(source='get_estado_pago_display', read_only=True)

    class Meta:
        model = OrdenVenta
        fields = [
            'id_venta', 'id_cliente', 'cliente_nombre',
            'fecha', 'estado_display', 'total',
            'monto_pagado', 'saldo_pendiente', 'estado_pago', 'estado_pago_display'
        ]
    
    def get_cliente_nombre(self, obj):
        cache = _batch_cache(self, '_ov_cliente_nombre', _build_cliente_nombre_map)
        return cache.get(obj.id_cliente, 'Cliente no encontrado')

    def get_estado_display(self, obj):
        # Por ahora retornamos un estado por defecto
        return 'Completado'


def _build_cliente_nombre_map(root):
    """Mapa {id_cliente: nombre} para todos los clientes del lote."""
    ids = {getattr(o, 'id_cliente', None) for o in _root_instances(root)}
    ids.discard(None)
    return dict(
        Cliente.objects.filter(id_cliente__in=ids).values_list('id_cliente', 'nombre')
    )


class OrdenVentaDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para orden de venta"""
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    productos = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    pagos = serializers.SerializerMethodField()
    estado_pago_display = serializers.CharField(source='get_estado_pago_display', read_only=True)

    class Meta:
        model = OrdenVenta
        fields = [
            'id_venta', 'id_cliente', 'cliente_nombre',
            'fecha', 'estado_display', 'total', 'productos',
            'monto_pagado', 'saldo_pendiente', 'estado_pago', 'estado_pago_display',
            'pagos'
        ]

    def get_pagos(self, obj):
        pagos = obj.pagos.all()
        return PagoVentaSerializer(pagos, many=True).data
    
    def get_cliente_nombre(self, obj):
        try:
            cliente = Cliente.objects.get(id_cliente=obj.id_cliente)
            return cliente.nombre
        except Cliente.DoesNotExist:
            return 'Cliente no encontrado'
    
    def get_estado_display(self, obj):
        return 'Completado'
    
    def get_total(self, obj):
        """Total real de la venta. Reutiliza OrdenVenta.calcular_total() para que el
        total mostrado y el saldo de pagos provengan de la misma fuente (Trampa #1)."""
        return float(obj.calcular_total())

    def get_productos(self, obj):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    p.id_producto,
                    p.nombre,
                    p.sku_producto,
                    pv.precio_unitario,
                    pv.cantidad,
                    (pv.precio_unitario * pv.cantidad) as subtotal
                FROM ventas v
                INNER JOIN producto_venta pv ON pv.id_venta = v.id_venta
                INNER JOIN productos p ON p.id_producto = pv.id_producto
                WHERE v.id_venta = %s
            """, [obj.id_venta])
            productos = []
            for row in cursor.fetchall():
                productos.append({
                    'id_producto': row[0],
                    'nombre': row[1],
                    'sku': row[2],
                    'precio_unitario': float(row[3]) if row[3] else 0.0,
                    'cantidad': int(row[4]) if row[4] else 0,
                    'subtotal': float(row[5]) if row[5] else 0.0
                })
            
            # Mano de obra del taller: se agrega como línea propia cuando la
            # venta proviene de una orden de trabajo. El vínculo es explícito
            # (servicio_motos.id_venta); antes se adivinaba cruzando
            # fecha + costo + cliente, que colisionaba entre servicios iguales
            # del mismo día y se rompía al editar el costo.
            cursor.execute("""
                SELECT sm.id_servicio, sm.tipo_servicio, sm.descripcion,
                       sm.precio_mano_obra, m.marca, m.modelo, m.placa
                FROM servicio_motos sm
                INNER JOIN motos m ON m.id_moto = sm.id_moto
                WHERE sm.id_venta = %s
                ORDER BY sm.id_servicio
            """, [obj.id_venta])
            for servicio in cursor.fetchall():
                mano_obra = float(servicio[3]) if servicio[3] else 0.0
                if not mano_obra:
                    continue
                productos.append({
                    'id_producto': None,
                    'nombre': f"Servicio: {servicio[1]}",
                    'sku': f"SERVICIO-{servicio[0]}",
                    'precio_unitario': mano_obra,
                    'cantidad': 1,
                    'subtotal': mano_obra,
                    'es_servicio': True,
                    'descripcion': servicio[2],
                    'moto': f"{servicio[4]} {servicio[5]} ({servicio[6]})"
                })

            return productos


class OrdenVentaCreateSerializer(serializers.Serializer):
    """Serializer para crear órdenes de venta"""
    cliente = serializers.IntegerField(required=True, source='id_cliente', error_messages={
        'required': 'El cliente es requerido',
        'invalid': 'Debe seleccionar un cliente válido'
    })
    fecha = serializers.DateField(required=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    detalles = serializers.ListField(child=serializers.DictField(), required=True, write_only=True)
    
    # Campos de solo lectura para la respuesta
    id_venta = serializers.IntegerField(read_only=True)
    id_cliente = serializers.IntegerField(read_only=True)
    
    def create(self, validated_data):
        from django.db import connection, transaction
        from datetime import date
        from calendar import monthrange

        def sumar_meses(d, meses):
            month = d.month - 1 + meses
            year = d.year + month // 12
            month = month % 12 + 1
            day = min(d.day, monthrange(year, month)[1])
            return d.replace(year=year, month=month, day=day)

        detalles_data = validated_data.pop('detalles')

        with transaction.atomic():
            # Bloquear y validar stock de cada producto ANTES de crear la venta,
            # para no descontar de más ni vender con stock insuficiente.
            productos_bloqueados = {}
            for detalle in detalles_data:
                producto_id = detalle['producto']
                cantidad = int(detalle['cantidad'])
                if cantidad <= 0:
                    raise serializers.ValidationError(
                        {'detalles': 'La cantidad de cada producto debe ser mayor a cero'}
                    )
                # US-11: precio no puede ser negativo (evita descuadrar el total).
                if float(detalle.get('precio_unitario', 0)) < 0:
                    raise serializers.ValidationError(
                        {'detalles': 'El precio unitario no puede ser negativo'}
                    )
                if producto_id in productos_bloqueados:
                    productos_bloqueados[producto_id]['cantidad'] += cantidad
                    continue
                try:
                    producto = Producto.objects.select_for_update().get(pk=producto_id)
                except Producto.DoesNotExist:
                    raise serializers.ValidationError(
                        {'detalles': f'El producto {producto_id} no existe'}
                    )
                productos_bloqueados[producto_id] = {'producto': producto, 'cantidad': cantidad}

            for info in productos_bloqueados.values():
                if info['producto'].cantidad_actual < info['cantidad']:
                    raise serializers.ValidationError(
                        {'detalles': (
                            f'Stock insuficiente para "{info["producto"].nombre}". '
                            f'Disponible: {info["producto"].cantidad_actual}, '
                            f'requerido: {info["cantidad"]}'
                        )}
                    )

            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO ventas (id_cliente, fecha, total)
                    VALUES (%s, %s, %s)
                    RETURNING id_venta
                """, [
                    validated_data['id_cliente'],
                    validated_data['fecha'],
                    validated_data['total']
                ])
                id_venta = cursor.fetchone()[0]

                for detalle in detalles_data:
                    producto_id = detalle['producto']
                    cantidad = int(detalle['cantidad'])
                    cursor.execute("""
                        INSERT INTO producto_venta (id_venta, id_producto, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [
                        id_venta,
                        producto_id,
                        cantidad,
                        detalle['precio_unitario']
                    ])
                    # Descontar stock y dejar rastro en movimientos_inventario
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = cantidad_actual - %s WHERE id_producto = %s",
                        [cantidad, producto_id],
                    )
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                        VALUES (%s, 'SALIDA', %s, NOW(), %s, 'ORDEN_VENTA', %s)
                    """, [producto_id, cantidad, f'VENTA-{id_venta}', f'Venta #{id_venta}'])

        # Auto-crear garantías para productos que las tengan
        fecha_venta = validated_data['fecha']
        id_cliente = validated_data['id_cliente']
        for detalle in detalles_data:
            try:
                producto = Producto.objects.get(pk=detalle['producto'])
                if producto.meses_garantia and producto.meses_garantia > 0:
                    Garantia.objects.create(
                        id_producto=producto,
                        id_venta=id_venta,
                        id_cliente=id_cliente,
                        cantidad=detalle.get('cantidad', 1),
                        fecha_inicio=fecha_venta,
                        fecha_fin=sumar_meses(fecha_venta, producto.meses_garantia),
                        estado='activa',
                    )
            except Producto.DoesNotExist:
                pass

        orden = OrdenVenta.objects.get(id_venta=id_venta)
        # `saldo_pendiente` es nullable y el INSERT crudo de arriba no lo setea.
        # Sin esto la venta queda con saldo NULL y el reporte de cuentas por
        # cobrar (que filtra por COALESCE(saldo_pendiente,0) > 0) no la muestra:
        # la deuda existe pero es invisible hasta que alguien registre un pago.
        orden.calcular_saldo()
        return orden

    def to_representation(self, instance):
        """Usar el serializer de detalle para la respuesta"""
        return OrdenVentaDetailSerializer(instance).data


# ============================================================================
# MOVIMIENTO INVENTARIO SERIALIZERS
# ============================================================================

class MovimientoInventarioSerializer(serializers.ModelSerializer):
    """Serializer para movimientos de inventario"""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    
    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'producto', 'producto_nombre', 'producto_codigo',
            'tipo', 'cantidad', 'fecha', 'referencia',
            'tipo_referencia', 'notas'
        ]
        read_only_fields = ['fecha']


class MovimientoInventarioCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear movimientos de inventario"""
    class Meta:
        model = MovimientoInventario
        fields = [
            'producto', 'tipo', 'cantidad', 'referencia',
            'tipo_referencia', 'notas'
        ]


# ============================================================================
# MOTO Y SERVICIO SERIALIZERS
# ============================================================================

class ServicioRepuestoSerializer(serializers.ModelSerializer):
    """Repuesto consumido por una orden de trabajo."""
    producto_nombre = serializers.CharField(source='id_producto.nombre', read_only=True)
    producto_sku = serializers.CharField(source='id_producto.sku_producto', read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = ServicioRepuesto
        fields = [
            'id_servicio_repuesto', 'id_servicio', 'id_producto',
            'producto_nombre', 'producto_sku', 'cantidad', 'precio_unitario',
            'subtotal', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_subtotal(self, obj):
        return float(obj.subtotal())


class ServicioMotoSerializer(serializers.ModelSerializer):
    """Orden de trabajo del taller."""
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    repuestos = ServicioRepuestoSerializer(many=True, read_only=True)
    total_repuestos = serializers.SerializerMethodField()
    mecanico_nombre = serializers.SerializerMethodField()
    tipo_servicio_nombre = serializers.CharField(
        source='id_tipo_servicio.nombre', read_only=True, default=None)
    moto_info = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    cliente_telefono = serializers.SerializerMethodField()
    transiciones_posibles = serializers.SerializerMethodField()
    dias_en_taller = serializers.SerializerMethodField()
    presupuesto = serializers.SerializerMethodField()
    reparacion_autorizada = serializers.SerializerMethodField()

    class Meta:
        model = ServicioMoto
        fields = [
            'id_servicio', 'id_moto', 'fecha_servicio',
            'tipo_servicio', 'descripcion', 'costo',
            'estado', 'estado_display', 'fecha_cita', 'fecha_entrega',
            'id_mecanico', 'mecanico_nombre',
            'id_tipo_servicio', 'tipo_servicio_nombre', 'precio_mano_obra',
            'id_venta', 'km_actual',
            'proximo_mantenimiento_fecha', 'proximo_mantenimiento_km',
            'repuestos', 'total_repuestos',
            'moto_info', 'cliente_nombre', 'cliente_telefono',
            'transiciones_posibles', 'dias_en_taller',
            'presupuesto', 'reparacion_autorizada',
        ]
        # El total y la venta los calcula/asigna el backend, no el cliente.
        read_only_fields = ['costo', 'id_venta', 'fecha_entrega']

    def get_total_repuestos(self, obj):
        return float(obj.total_repuestos())

    def get_mecanico_nombre(self, obj):
        if not obj.id_mecanico:
            return None
        return obj.id_mecanico.get_full_name() or obj.id_mecanico.username

    def get_moto_info(self, obj):
        m = obj.id_moto
        return f"{m.marca} {m.modelo} ({m.placa})" if m else None

    def get_cliente_nombre(self, obj):
        return obj.id_moto.id_cliente.nombre if obj.id_moto else None

    def get_cliente_telefono(self, obj):
        # Campo cifrado: se descifra al leer el modelo.
        return obj.id_moto.id_cliente.telefono if obj.id_moto else None

    def get_transiciones_posibles(self, obj):
        return ServicioMoto.TRANSICIONES.get(obj.estado, [])

    def get_dias_en_taller(self, obj):
        """Días desde el ingreso; para órdenes cerradas, hasta la entrega."""
        if not obj.fecha_servicio:
            return None
        fin = obj.fecha_entrega.date() if obj.fecha_entrega else date.today()
        return (fin - obj.fecha_servicio).days

    def get_presupuesto(self, obj):
        """Resumen del presupuesto vigente (el detalle completo va por
        /api/cotizaciones/<id>/, que es lo que alimenta el PDF)."""
        p = obj.presupuesto_vigente()
        if p is None:
            return None
        return {
            'id_cotizacion': p.id_cotizacion,
            'estado': p.estado,
            'estado_display': p.get_estado_display(),
            'total': float(p.total or 0),
            'fecha': p.fecha,
            'validez_dias': p.validez_dias,
            'vencido': p.esta_vencido(),
            'cargado_a_orden': p.cargado_a_orden,
        }

    def get_reparacion_autorizada(self, obj):
        return obj.reparacion_autorizada()


class ServicioMotoResumenSerializer(serializers.ModelSerializer):
    """Versión liviana para anidar en el historial de una moto.

    No se usa `ServicioMotoSerializer` acá a propósito: ese trae repuestos,
    mecánico y tipo de servicio, y anidado en el listado de clientes/motos
    dispararía varias consultas por cada servicio (N+1).
    """
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = ServicioMoto
        fields = [
            'id_servicio', 'id_moto', 'fecha_servicio', 'tipo_servicio',
            'descripcion', 'costo', 'estado', 'estado_display', 'id_venta',
        ]


class MotoSerializer(serializers.ModelSerializer):
    """Serializer para motos con servicios"""
    servicios = ServicioMotoResumenSerializer(many=True, read_only=True)
    total_servicios = serializers.SerializerMethodField()
    ultimo_servicio = serializers.SerializerMethodField()
    
    class Meta:
        model = Moto
        fields = [
            'id_moto', 'id_cliente', 'marca', 'modelo',
            'anio', 'placa', 'servicios', 'total_servicios',
            'ultimo_servicio'
        ]
    
    def get_total_servicios(self, obj):
        """Retorna el número total de servicios realizados (usa el prefetch)"""
        return len(obj.servicios.all())

    def get_ultimo_servicio(self, obj):
        """Retorna la fecha del último servicio (usa el prefetch)"""
        fechas = [s.fecha_servicio for s in obj.servicios.all() if s.fecha_servicio]
        return max(fechas) if fechas else None


class ClienteConMotosSerializer(serializers.ModelSerializer):
    """Serializer para cliente con sus motos y servicios"""
    motos = MotoSerializer(many=True, read_only=True)
    total_motos = serializers.SerializerMethodField()
    
    class Meta:
        model = Cliente
        fields = [
            'id_cliente', 'nombre', 'telefono', 'email',
            'motos', 'total_motos'
        ]
    
    def get_total_motos(self, obj):
        """Retorna el número total de motos del cliente"""
        return obj.motos.count()



class ServicioSerializer(serializers.ModelSerializer):
    """Catálogo de tipos de servicio (filas con es_plantilla=True)."""
    class Meta:
        model = Servicio
        fields = ['id_servicio', 'nombre', 'tipo', 'precio_mano_obra', 'es_plantilla']
        read_only_fields = ['es_plantilla']

    def create(self, validated_data):
        # Todo lo que se cree por la API es catálogo, nunca histórico.
        validated_data['es_plantilla'] = True
        return super().create(validated_data)


# ============================================================================
# BITÁCORA SERIALIZERS
# ============================================================================

class BitacoraServicioSerializer(serializers.ModelSerializer):
    """Serializer para bitácora de servicios"""
    modulo_display = serializers.CharField(source='get_modulo_display', read_only=True)
    moto_info = serializers.SerializerMethodField()
    
    class Meta:
        model = BitacoraServicio
        fields = [
            'id_bitacora', 'id_servicio', 'id_moto', 'modulo', 'modulo_display',
            'fecha_registro', 'notas', 'nivel_gasolina', 'rayones_previos',
            'fallas_encontradas', 'trabajo_realizado', 'tecnico_responsable',
            'checklist_salida', 'firma_cliente', 'imagenes', 'creado_por',
            'actualizado_en', 'moto_info'
        ]
        read_only_fields = ['fecha_registro', 'actualizado_en']
    
    def get_moto_info(self, obj):
        """Retorna información básica de la moto"""
        return {
            'marca': obj.id_moto.marca,
            'modelo': obj.id_moto.modelo,
            'placa': obj.id_moto.placa
        }


class BitacoraServicioCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear registros de bitácora con imágenes"""
    imagenes_files = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = BitacoraServicio
        fields = [
            'id_servicio', 'id_moto', 'modulo', 'notas',
            'nivel_gasolina', 'rayones_previos', 'fallas_encontradas',
            'trabajo_realizado', 'tecnico_responsable', 'checklist_salida',
            'firma_cliente', 'creado_por', 'imagenes_files'
        ]
    
    def create(self, validated_data):
        from api.storage import r2_storage
        
        # Extraer archivos de imágenes
        imagenes_files = validated_data.pop('imagenes_files', [])
        
        # Crear el registro de bitácora
        bitacora = BitacoraServicio.objects.create(**validated_data)
        
        # Subir imágenes a R2 si existen (opcional)
        if imagenes_files and r2_storage.enabled:
            folder = validated_data.get('modulo', 'bitacora')
            urls = r2_storage.upload_multiple_files(imagenes_files, folder)
            if urls:  # Solo guardar si se subieron correctamente
                bitacora.imagenes = urls
                bitacora.save()
        
        return bitacora
    
    def to_representation(self, instance):
        """Usar el serializer de detalle para la respuesta"""
        return BitacoraServicioSerializer(instance).data


class ServicioMotoConBitacoraSerializer(serializers.ModelSerializer):
    """Serializer para servicios de motos con bitácora completa"""
    bitacoras = BitacoraServicioSerializer(many=True, read_only=True)
    bitacoras_por_modulo = serializers.SerializerMethodField()
    
    class Meta:
        model = ServicioMoto
        fields = [
            'id_servicio', 'id_moto', 'fecha_servicio',
            'tipo_servicio', 'descripcion', 'costo',
            'bitacoras', 'bitacoras_por_modulo'
        ]
    
    def get_bitacoras_por_modulo(self, obj):
        """Organiza las bitácoras por módulo (una sola pasada sobre el prefetch)"""
        grupos = {'recepcion': [], 'diagnostico': [], 'reparacion': [], 'entrega': []}
        for bitacora in obj.bitacoras.all():
            if bitacora.modulo in grupos:
                grupos[bitacora.modulo].append(bitacora)
        return {
            modulo: BitacoraServicioSerializer(items, many=True).data
            for modulo, items in grupos.items()
        }



# ============================================================================
# AUDITORÍA SERIALIZERS
# ============================================================================

class AuditoriaProductoSerializer(serializers.ModelSerializer):
    """Serializer para auditoría de productos"""
    operacion_display = serializers.SerializerMethodField()
    tipo_cambio = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditoriaProducto
        fields = [
            'id_auditoria', 'id_producto', 'sku_producto', 'nombre_producto',
            'operacion', 'operacion_display', 'tipo_cambio',
            'cantidad_anterior', 'cantidad_nueva', 'diferencia_cantidad',
            'precio_compra_anterior', 'precio_compra_nuevo', 'diferencia_precio_compra',
            'precio_final_anterior', 'precio_final_nuevo', 'diferencia_precio_final',
            'fecha_cambio', 'usuario', 'ip_address',
            'datos_anteriores', 'datos_nuevos'
        ]
    
    def get_operacion_display(self, obj):
        """Retorna el nombre legible de la operación"""
        operaciones = {
            'INSERT': 'Creación',
            'UPDATE': 'Modificación',
            'DELETE': 'Eliminación'
        }
        return operaciones.get(obj.operacion, obj.operacion)
    
    def get_tipo_cambio(self, obj):
        """Determina qué tipo de cambio se realizó"""
        cambios = []

        if obj.diferencia_cantidad and obj.diferencia_cantidad != 0:
            if obj.diferencia_cantidad > 0:
                cambios.append(f'Stock +{obj.diferencia_cantidad}')
            else:
                cambios.append(f'Stock {obj.diferencia_cantidad}')

        if obj.diferencia_precio_final and obj.diferencia_precio_final != 0:
            if obj.diferencia_precio_final > 0:
                cambios.append(f'Precio +C${obj.diferencia_precio_final}')
            else:
                cambios.append(f'Precio C${obj.diferencia_precio_final}')

        if obj.operacion == 'INSERT':
            return 'Producto creado'
        elif obj.operacion == 'DELETE':
            return 'Producto eliminado'
        elif cambios:
            return ', '.join(cambios)
        else:
            return 'Otros cambios'


# ============================================================================
# GARANTÍA SERIALIZERS
# ============================================================================

class ReclamacionListSerializer(serializers.ModelSerializer):
    """Serializer ligero para reclamaciones (usado anidado en garantías)"""
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = ReclamacionGarantia
        fields = [
            'id_reclamacion', 'descripcion_problema', 'fecha_reclamacion',
            'estado', 'estado_display', 'resolucion', 'fecha_resolucion',
        ]


class GarantiaListSerializer(serializers.ModelSerializer):
    """Serializer para listado de garantías"""
    producto_nombre = serializers.CharField(source='id_producto.nombre', read_only=True)
    producto_sku = serializers.CharField(source='id_producto.sku_producto', read_only=True)
    meses_garantia = serializers.IntegerField(source='id_producto.meses_garantia', read_only=True)
    tipo_garantia = serializers.CharField(source='id_producto.tipo_garantia', read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    dias_restantes = serializers.SerializerMethodField()

    class Meta:
        model = Garantia
        fields = [
            'id_garantia', 'id_producto_id', 'producto_nombre', 'producto_sku',
            'meses_garantia', 'tipo_garantia',
            'id_venta', 'id_cliente', 'cliente_nombre', 'cantidad',
            'fecha_inicio', 'fecha_fin', 'estado', 'estado_display', 'dias_restantes',
        ]

    def get_cliente_nombre(self, obj):
        cache = _batch_cache(self, '_g_cliente_nombre', _build_cliente_nombre_map)
        return cache.get(obj.id_cliente)

    def get_dias_restantes(self, obj):
        from datetime import date
        if obj.estado != 'activa':
            return None
        delta = obj.fecha_fin - date.today()
        return max(delta.days, 0)


class GarantiaDetailSerializer(GarantiaListSerializer):
    """Serializer detallado para garantía, incluye reclamaciones"""
    reclamaciones = ReclamacionListSerializer(many=True, read_only=True)

    class Meta(GarantiaListSerializer.Meta):
        fields = GarantiaListSerializer.Meta.fields + ['notas', 'reclamaciones']


class ReclamacionCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear una reclamación"""
    class Meta:
        model = ReclamacionGarantia
        fields = ['garantia', 'descripcion_problema']

    def validate_garantia(self, garantia):
        if garantia.estado != 'activa':
            raise serializers.ValidationError(
                'Solo se pueden reclamar garantías con estado activo.'
            )
        return garantia


class ReclamacionDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para reclamación"""
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    garantia_info = serializers.SerializerMethodField()

    class Meta:
        model = ReclamacionGarantia
        fields = [
            'id_reclamacion', 'garantia_id', 'garantia_info',
            'descripcion_problema', 'fecha_reclamacion',
            'estado', 'estado_display', 'resolucion', 'fecha_resolucion',
        ]

    def get_garantia_info(self, obj):
        return {
            'id_garantia': obj.garantia_id,
            'producto': obj.garantia.id_producto.nombre,
            'cliente_id': obj.garantia.id_cliente,
        }


# ============================================================================
# COTIZACIONES / PROFORMAS
# ============================================================================

def _items_cotizacion(id_cotizacion):
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT p.id_producto, p.nombre, p.sku_producto,
                   pc.cantidad, pc.precio_unitario,
                   (pc.cantidad * pc.precio_unitario) AS subtotal
            FROM producto_cotizacion pc
            INNER JOIN productos p ON p.id_producto = pc.id_producto
            WHERE pc.id_cotizacion = %s
        """, [id_cotizacion])
        return [{
            'id_producto': r[0], 'nombre': r[1], 'sku': r[2],
            'cantidad': int(r[3]), 'precio_unitario': float(r[4]),
            'subtotal': float(r[5]),
        } for r in cursor.fetchall()]


class ServicioCotizacionSerializer(serializers.ModelSerializer):
    """Línea de mano de obra presupuestada."""
    servicio_nombre = serializers.CharField(source='id_servicio.nombre', read_only=True)
    servicio_tipo = serializers.CharField(source='id_servicio.tipo', read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = ServicioCotizacion
        fields = [
            'id_servicio_cotizacion', 'id_cotizacion', 'id_servicio',
            'servicio_nombre', 'servicio_tipo', 'cantidad', 'precio_unitario',
            'subtotal',
        ]

    def get_subtotal(self, obj):
        return float(obj.subtotal())


class CotizacionListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    moto_info = serializers.SerializerMethodField()

    class Meta:
        model = Cotizacion
        fields = [
            'id_cotizacion', 'id_cliente', 'cliente_nombre', 'fecha',
            'validez_dias', 'total', 'estado', 'estado_display', 'id_venta',
            'tipo', 'tipo_display', 'id_moto', 'moto_info', 'id_servicio',
        ]

    def get_cliente_nombre(self, obj):
        cache = _batch_cache(self, '_cot_cliente_nombre', _build_cliente_nombre_map)
        return cache.get(obj.id_cliente, 'Cliente no encontrado')

    def get_moto_info(self, obj):
        m = obj.id_moto
        return f"{m.marca} {m.modelo} ({m.placa})" if m else None


class CotizacionDetailSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    cliente_telefono = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    productos = serializers.SerializerMethodField()
    servicios = ServicioCotizacionSerializer(many=True, read_only=True)
    # El PDF muestra mano de obra y repuestos en secciones separadas.
    subtotal_mano_obra = serializers.SerializerMethodField()
    subtotal_repuestos = serializers.SerializerMethodField()
    moto_info = serializers.SerializerMethodField()
    moto_detalle = serializers.SerializerMethodField()
    vencido = serializers.SerializerMethodField()

    class Meta:
        model = Cotizacion
        fields = [
            'id_cotizacion', 'id_cliente', 'cliente_nombre', 'cliente_telefono',
            'fecha', 'validez_dias', 'total', 'estado', 'estado_display',
            'id_venta', 'notas', 'productos', 'servicios',
            'tipo', 'tipo_display', 'id_moto', 'moto_info', 'moto_detalle',
            'id_servicio', 'diagnostico', 'fecha_aprobacion', 'aprobado_por',
            'cargado_a_orden', 'subtotal_mano_obra', 'subtotal_repuestos',
            'vencido',
        ]

    def _cliente(self, obj):
        try:
            return Cliente.objects.get(id_cliente=obj.id_cliente)
        except Cliente.DoesNotExist:
            return None

    def get_cliente_nombre(self, obj):
        cliente = self._cliente(obj)
        return cliente.nombre if cliente else 'Cliente no encontrado'

    def get_cliente_telefono(self, obj):
        # Campo cifrado: el modelo lo descifra al leerlo.
        cliente = self._cliente(obj)
        return cliente.telefono if cliente else None

    def get_productos(self, obj):
        return _items_cotizacion(obj.id_cotizacion)

    def get_subtotal_mano_obra(self, obj):
        return float(obj.total_mano_obra())

    def get_subtotal_repuestos(self, obj):
        return float(obj.total_repuestos())

    def get_moto_info(self, obj):
        m = obj.id_moto
        return f"{m.marca} {m.modelo} ({m.placa})" if m else None

    def get_moto_detalle(self, obj):
        m = obj.id_moto
        if not m:
            return None
        # El kilometraje vive en la orden de trabajo, no en la moto.
        km = obj.id_servicio.km_actual if obj.id_servicio else None
        return {
            'marca': m.marca, 'modelo': m.modelo, 'anio': m.anio,
            'placa': m.placa, 'km_actual': km,
        }

    def get_vencido(self, obj):
        return obj.esta_vencido()


class CotizacionCreateSerializer(serializers.Serializer):
    """Alta de proforma de productos o de presupuesto de reparación.

    `detalles` son líneas de producto y `servicios` líneas de mano de obra. Una
    proforma de productos solo trae `detalles`; un presupuesto de taller puede
    traer cualquiera de las dos, pero al menos una.
    """
    cliente = serializers.IntegerField(required=True, source='id_cliente')
    fecha = serializers.DateField(required=True)
    validez_dias = serializers.IntegerField(required=False, default=15)
    notas = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    detalles = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True)
    servicios = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True)

    tipo = serializers.ChoiceField(
        choices=Cotizacion.TIPO_CHOICES, required=False, default='producto')
    id_moto = serializers.IntegerField(required=False, allow_null=True)
    id_servicio = serializers.IntegerField(required=False, allow_null=True)
    diagnostico = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def _validar_lineas(self, value, etiqueta):
        for d in value:
            if int(d.get('cantidad', 0)) <= 0:
                raise serializers.ValidationError(
                    f'La cantidad de cada {etiqueta} debe ser mayor a cero')
            if float(d.get('precio_unitario', 0)) < 0:
                raise serializers.ValidationError('El precio unitario no puede ser negativo')
        return value

    def validate_detalles(self, value):
        return self._validar_lineas(value, 'producto')

    def validate_servicios(self, value):
        return self._validar_lineas(value, 'servicio')

    def validate(self, attrs):
        if not attrs.get('detalles') and not attrs.get('servicios'):
            raise serializers.ValidationError(
                'Agrega al menos un producto o un servicio de mano de obra')
        return attrs

    def create(self, validated_data):
        from django.db import transaction
        detalles = validated_data.pop('detalles', []) or []
        servicios = validated_data.pop('servicios', []) or []
        total = (
            sum(float(d['precio_unitario']) * int(d['cantidad']) for d in detalles)
            + sum(float(s['precio_unitario']) * int(s['cantidad']) for s in servicios)
        )
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO cotizaciones (id_cliente, fecha, validez_dias, total,
                                              estado, notas, tipo, id_moto, id_servicio,
                                              diagnostico, cargado_a_orden)
                    VALUES (%s, %s, %s, %s, 'pendiente', %s, %s, %s, %s, %s, FALSE)
                    RETURNING id_cotizacion
                """, [
                    validated_data['id_cliente'], validated_data['fecha'],
                    validated_data.get('validez_dias', 15), total,
                    validated_data.get('notas') or None,
                    validated_data.get('tipo') or 'producto',
                    validated_data.get('id_moto'),
                    validated_data.get('id_servicio'),
                    validated_data.get('diagnostico') or None,
                ])
                id_cotizacion = cursor.fetchone()[0]
                for d in detalles:
                    cursor.execute("""
                        INSERT INTO producto_cotizacion (id_cotizacion, id_producto, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [id_cotizacion, d['producto'], d['cantidad'], d['precio_unitario']])
                for s in servicios:
                    cursor.execute("""
                        INSERT INTO servicio_cotizacion (id_cotizacion, id_servicio, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [id_cotizacion, s['servicio'], s['cantidad'], s['precio_unitario']])
        return Cotizacion.objects.get(id_cotizacion=id_cotizacion)

    def to_representation(self, instance):
        return CotizacionDetailSerializer(instance).data


# ============================================================================
# DEVOLUCIONES / NOTAS DE CRÉDITO
# ============================================================================

def _items_devolucion(id_devolucion):
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT p.id_producto, p.nombre, p.sku_producto,
                   pd.cantidad, pd.precio_unitario,
                   (pd.cantidad * pd.precio_unitario) AS subtotal
            FROM producto_devolucion pd
            INNER JOIN productos p ON p.id_producto = pd.id_producto
            WHERE pd.id_devolucion = %s
        """, [id_devolucion])
        return [{
            'id_producto': r[0], 'nombre': r[1], 'sku': r[2],
            'cantidad': int(r[3]), 'precio_unitario': float(r[4]),
            'subtotal': float(r[5]),
        } for r in cursor.fetchall()]


class DevolucionListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Devolucion
        fields = [
            'id_devolucion', 'id_venta', 'id_cliente', 'cliente_nombre',
            'fecha', 'motivo', 'total', 'estado', 'estado_display',
        ]

    def get_cliente_nombre(self, obj):
        if not obj.id_cliente:
            return '—'
        cache = _batch_cache(self, '_dev_cliente_nombre', _build_cliente_nombre_map)
        return cache.get(obj.id_cliente, 'Cliente no encontrado')


class DevolucionDetailSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    productos = serializers.SerializerMethodField()

    class Meta:
        model = Devolucion
        fields = [
            'id_devolucion', 'id_venta', 'id_cliente', 'cliente_nombre',
            'fecha', 'motivo', 'total', 'estado', 'estado_display', 'productos',
        ]

    def get_cliente_nombre(self, obj):
        if not obj.id_cliente:
            return '—'
        try:
            return Cliente.objects.get(id_cliente=obj.id_cliente).nombre
        except Cliente.DoesNotExist:
            return 'Cliente no encontrado'

    def get_productos(self, obj):
        return _items_devolucion(obj.id_devolucion)


class DevolucionCreateSerializer(serializers.Serializer):
    venta = serializers.IntegerField(required=True, source='id_venta', error_messages={
        'required': 'La devolución debe referenciar una venta',
        'null': 'La devolución debe referenciar una venta',
    })
    cliente = serializers.IntegerField(required=False, allow_null=True, source='id_cliente')
    fecha = serializers.DateField(required=True)
    motivo = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    detalles = serializers.ListField(child=serializers.DictField(), required=True, write_only=True)

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError('Agrega al menos un producto a devolver')
        for d in value:
            if int(d.get('cantidad', 0)) <= 0:
                raise serializers.ValidationError('La cantidad a devolver debe ser mayor a cero')
        return value

    def validate(self, data):
        """US-07: una devolución no puede exceder lo realmente vendido en esa
        venta (ni incluir productos que no se vendieron). Cruza lo vendido
        (producto_venta) contra lo ya devuelto (producto_devolucion)."""
        id_venta = data.get('id_venta')
        detalles = data.get('detalles', [])

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM ventas WHERE id_venta = %s", [id_venta])
            if cursor.fetchone() is None:
                raise serializers.ValidationError({'venta': 'La venta indicada no existe'})

            # Cantidad vendida por producto en esta venta.
            cursor.execute(
                "SELECT id_producto, SUM(cantidad) FROM producto_venta "
                "WHERE id_venta = %s GROUP BY id_producto",
                [id_venta],
            )
            vendido = {row[0]: int(row[1]) for row in cursor.fetchall()}

            # Cantidad ya devuelta por producto en devoluciones previas de esta venta.
            cursor.execute(
                """
                SELECT pd.id_producto, SUM(pd.cantidad)
                FROM producto_devolucion pd
                JOIN devoluciones d ON d.id_devolucion = pd.id_devolucion
                WHERE d.id_venta = %s AND d.estado = 'procesada'
                GROUP BY pd.id_producto
                """,
                [id_venta],
            )
            ya_devuelto = {row[0]: int(row[1]) for row in cursor.fetchall()}

        # Acumular lo pedido en esta devolución por producto (puede venir repetido).
        pedido = {}
        for d in detalles:
            pid = int(d['producto'])
            pedido[pid] = pedido.get(pid, 0) + int(d['cantidad'])

        for pid, cant in pedido.items():
            if pid not in vendido:
                raise serializers.ValidationError(
                    {'detalles': f'El producto {pid} no forma parte de la venta {id_venta}'}
                )
            disponible = vendido[pid] - ya_devuelto.get(pid, 0)
            if cant > disponible:
                raise serializers.ValidationError(
                    {'detalles': (
                        f'No se puede devolver {cant} del producto {pid}: '
                        f'vendido {vendido[pid]}, ya devuelto {ya_devuelto.get(pid, 0)}, '
                        f'disponible {disponible}'
                    )}
                )

        return data

    def create(self, validated_data):
        from django.db import transaction
        detalles = validated_data.pop('detalles')
        total = sum(float(d['precio_unitario']) * int(d['cantidad']) for d in detalles)
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO devoluciones (id_venta, id_cliente, fecha, motivo, total, estado)
                    VALUES (%s, %s, %s, %s, %s, 'procesada')
                    RETURNING id_devolucion
                """, [
                    validated_data.get('id_venta') or None,
                    validated_data.get('id_cliente') or None,
                    validated_data['fecha'],
                    validated_data.get('motivo') or None,
                    total,
                ])
                id_devolucion = cursor.fetchone()[0]
                for d in detalles:
                    cursor.execute("""
                        INSERT INTO producto_devolucion (id_devolucion, id_producto, cantidad, precio_unitario)
                        VALUES (%s, %s, %s, %s)
                    """, [id_devolucion, d['producto'], d['cantidad'], d['precio_unitario']])
                    # Reingresar stock + registrar movimiento de inventario
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = cantidad_actual + %s WHERE id_producto = %s",
                        [d['cantidad'], d['producto']],
                    )
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia, tipo_referencia, notas)
                        VALUES (%s, 'ENTRADA', %s, NOW(), %s, 'ORDEN_VENTA', %s)
                    """, [
                        d['producto'], d['cantidad'], f'DEV-{id_devolucion}',
                        validated_data.get('motivo') or 'Devolución',
                    ])
        return Devolucion.objects.get(id_devolucion=id_devolucion)

    def to_representation(self, instance):
        return DevolucionDetailSerializer(instance).data


# ============================================================================
# USUARIOS (gestión de cuentas / login)
# ============================================================================

class UsuarioSerializer(serializers.ModelSerializer):
    """Crear/editar/leer usuarios. Hashea la contraseña y aplica guardas de rol."""
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=False,
        style={'input_type': 'password'}
    )
    rol = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password',
            'is_active', 'is_staff', 'is_superuser', 'rol',
            'last_login', 'date_joined',
        ]
        read_only_fields = ['last_login', 'date_joined', 'rol']

    def get_rol(self, obj):
        return 'Administrador' if obj.is_staff else 'Usuario'

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        # Anti escalación: solo un superusuario puede otorgar is_staff/is_superuser
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        if not (actor and actor.is_superuser):
            data.pop('is_superuser', None)
            data.pop('is_staff', None)
        return data

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'La contraseña es requerida'})
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


# ============================================================================
# CAJA (apertura / cierre de turno)
# ============================================================================

class MovimientoCajaSerializer(serializers.ModelSerializer):
    """Ingreso/retiro de efectivo del cajón (no ventas)."""
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = MovimientoCaja
        fields = ['id_movimiento', 'sesion', 'tipo', 'monto', 'motivo', 'fecha', 'usuario', 'usuario_nombre']
        read_only_fields = ['sesion', 'fecha', 'usuario', 'usuario_nombre']

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero')
        return value


class SesionCajaSerializer(serializers.ModelSerializer):
    """Lectura de una sesión de caja. Para la sesión abierta expone el
    efectivo esperado en vivo y el desglose por método de pago."""
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    esperado_actual = serializers.SerializerMethodField()
    totales = serializers.SerializerMethodField()
    movimientos = MovimientoCajaSerializer(many=True, read_only=True)

    class Meta:
        model = SesionCaja
        fields = [
            'id_sesion', 'usuario', 'usuario_nombre', 'estado',
            'fecha_apertura', 'monto_apertura',
            'fecha_cierre', 'monto_cierre_contado', 'monto_esperado', 'diferencia',
            'notas', 'esperado_actual', 'totales', 'movimientos',
        ]

    def get_esperado_actual(self, obj):
        # Solo tiene sentido en vivo mientras está abierta.
        if obj.estado == 'abierta':
            return float(obj.calcular_esperado())
        return float(obj.monto_esperado) if obj.monto_esperado is not None else None

    def get_totales(self, obj):
        """Desglose de lo cobrado en la sesión por método de pago + movimientos."""
        from django.db.models import Sum
        por_metodo = {
            row['metodo_pago']: float(row['t'] or 0)
            for row in obj.pagos.values('metodo_pago').annotate(t=Sum('monto'))
        }
        ingresos = obj.movimientos.filter(tipo='ingreso').aggregate(t=Sum('monto'))['t'] or 0
        retiros = obj.movimientos.filter(tipo='retiro').aggregate(t=Sum('monto'))['t'] or 0
        gastos_efectivo = obj.gastos_caja.filter(metodo_pago='efectivo').aggregate(t=Sum('monto'))['t'] or 0
        pagos_compra_efectivo = obj.pagos_compra.filter(metodo_pago='efectivo').aggregate(t=Sum('monto'))['t'] or 0
        return {
            'pagos_por_metodo': por_metodo,
            'ingresos_manuales': float(ingresos),
            'retiros_manuales': float(retiros),
            'gastos_efectivo': float(gastos_efectivo),
            'pagos_compra_efectivo': float(pagos_compra_efectivo),
        }


class AbrirCajaSerializer(serializers.Serializer):
    monto_apertura = serializers.DecimalField(max_digits=10, decimal_places=2)
    notas = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_monto_apertura(self, value):
        if value < 0:
            raise serializers.ValidationError('El fondo de apertura no puede ser negativo')
        return value


class CerrarCajaSerializer(serializers.Serializer):
    monto_cierre_contado = serializers.DecimalField(max_digits=10, decimal_places=2)
    notas = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_monto_cierre_contado(self, value):
        if value < 0:
            raise serializers.ValidationError('El monto contado no puede ser negativo')
        return value


# ============================================================================
# GASTOS OPERATIVOS
# ============================================================================

class CategoriaGastoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaGasto
        fields = ['id_categoria', 'nombre', 'descripcion', 'activo', 'created_at']
        read_only_fields = ['created_at']


class GastoSerializer(serializers.ModelSerializer):
    """Lectura de un gasto operativo."""
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    metodo_pago_display = serializers.CharField(source='get_metodo_pago_display', read_only=True)

    class Meta:
        model = Gasto
        fields = [
            'id_gasto', 'fecha', 'categoria', 'categoria_nombre', 'monto',
            'descripcion', 'metodo_pago', 'metodo_pago_display', 'referencia',
            'usuario', 'usuario_nombre', 'sesion', 'created_at',
        ]
        read_only_fields = ['usuario', 'usuario_nombre', 'sesion', 'created_at']


class GastoCreateSerializer(serializers.ModelSerializer):
    """Registrar un gasto. Si es en efectivo, debe haber caja abierta y el
    gasto se etiqueta con ella (sale del cajón). Mismo patrón que el pago."""
    class Meta:
        model = Gasto
        fields = ['fecha', 'categoria', 'monto', 'descripcion', 'metodo_pago', 'referencia']

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero')
        return value

    def create(self, validated_data):
        usuario = self.context['request'].user
        sesion = None
        if validated_data.get('metodo_pago') == 'efectivo':
            sesion = SesionCaja.objects.filter(estado='abierta').first()
            if sesion is None:
                raise serializers.ValidationError(
                    {'caja': 'No hay una caja abierta. Un gasto en efectivo sale '
                             'del cajón: abre la caja o usa otro método de pago.'}
                )
        return Gasto.objects.create(usuario=usuario, sesion=sesion, **validated_data)


# ============================================================================
# CUENTAS POR PAGAR (pagos a proveedores)
# ============================================================================

class PagoCompraSerializer(serializers.ModelSerializer):
    """Lectura de un pago/abono a una orden de compra."""
    metodo_pago_display = serializers.CharField(source='get_metodo_pago_display', read_only=True)
    id_orden = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PagoCompra
        fields = [
            'id_pago', 'id_orden', 'monto', 'fecha_pago',
            'metodo_pago', 'metodo_pago_display', 'referencia',
            'notas', 'created_at',
        ]
        read_only_fields = ['created_at']


class PagoCompraCreateSerializer(serializers.ModelSerializer):
    """Registrar un pago a proveedor. Valida que no exceda el saldo. Si es en
    efectivo, requiere caja abierta y etiqueta el pago con ella (sale del
    cajón). Espejo de PagoVentaCreateSerializer."""
    class Meta:
        model = PagoCompra
        fields = ['monto', 'fecha_pago', 'metodo_pago', 'referencia', 'notas']

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero')
        return value

    def validate(self, data):
        from django.db.models import Sum
        orden = self.context['orden']
        pagado = orden.pagos.aggregate(total=Sum('monto'))['total'] or 0
        # Lo devuelto al proveedor ya no se le debe: sin restarlo, se podría
        # pagar de más por mercadería que se mandó de vuelta.
        saldo = (orden.calcular_total() - orden.total_devuelto()
                 + orden.total_reembolsado() - pagado)
        if data['monto'] > saldo:
            raise serializers.ValidationError({
                'monto': f'El monto excede el saldo pendiente de C${saldo:.2f}'
            })
        return data

    def create(self, validated_data):
        orden = self.context['orden']
        sesion = None
        if validated_data.get('metodo_pago') == 'efectivo':
            sesion = SesionCaja.objects.filter(estado='abierta').first()
            if sesion is None:
                raise serializers.ValidationError(
                    {'caja': 'No hay una caja abierta. Un pago en efectivo sale '
                             'del cajón: abre la caja o usa otro método de pago.'}
                )
        pago = PagoCompra.objects.create(id_orden=orden, sesion=sesion, **validated_data)
        orden.calcular_saldo()
        return pago


# ============================================================================
# DEVOLUCIONES A PROVEEDORES
# ============================================================================

class ProductoDevolucionCompraSerializer(serializers.ModelSerializer):
    """Línea de una devolución a proveedor."""
    producto_nombre = serializers.CharField(source='id_producto.nombre', read_only=True)
    producto_sku = serializers.CharField(source='id_producto.sku_producto', read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = ProductoDevolucionCompra
        fields = [
            'id_producto_devolucion_compra', 'id_producto', 'producto_nombre',
            'producto_sku', 'cantidad', 'precio_unitario', 'subtotal',
        ]

    def get_subtotal(self, obj):
        return float(obj.subtotal())


class DevolucionCompraSerializer(serializers.ModelSerializer):
    """Devolución a proveedor (lectura)."""
    proveedor_nombre = serializers.CharField(
        source='id_proveedor.nombre_empresa', read_only=True)
    metodo_reembolso_display = serializers.CharField(
        source='get_metodo_reembolso_display', read_only=True)
    detalles = ProductoDevolucionCompraSerializer(many=True, read_only=True)
    saldo_a_favor = serializers.SerializerMethodField()

    class Meta:
        model = DevolucionCompra
        fields = [
            'id_devolucion_compra', 'id_orden', 'id_proveedor', 'proveedor_nombre',
            'fecha', 'motivo', 'total', 'reembolso', 'metodo_reembolso',
            'metodo_reembolso_display', 'sesion', 'creado_por', 'created_at',
            'detalles', 'saldo_a_favor',
        ]

    def get_saldo_a_favor(self, obj):
        """Lo devuelto que el proveedor todavía no reembolsó."""
        return float((obj.total or 0) - (obj.reembolso or 0))


class DevolucionCompraCreateSerializer(serializers.Serializer):
    """Registrar mercadería devuelta a un proveedor.

    Espeja la validación de la devolución de cliente (US-07) pero contra lo
    recibido en la compra, y agrega una que aquella no necesita: que la
    mercadería todavía esté en stock. Si llegaron 10 y se vendieron 8, no se
    pueden devolver 5 porque físicamente no están.
    """
    orden = serializers.IntegerField(required=True, source='id_orden')
    fecha = serializers.DateField(required=False)
    motivo = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    detalles = serializers.ListField(
        child=serializers.DictField(), required=True, write_only=True)
    reembolso = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0)
    metodo_reembolso = serializers.ChoiceField(
        choices=DevolucionCompra.METODO_REEMBOLSO_CHOICES,
        required=False, default='credito')

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError('Agrega al menos un producto a devolver')
        for d in value:
            if int(d.get('cantidad', 0)) <= 0:
                raise serializers.ValidationError(
                    'La cantidad a devolver debe ser mayor a cero')
        return value

    def validate(self, data):
        id_orden = data.get('id_orden')
        detalles = data.get('detalles', [])

        try:
            orden = OrdenCompra.objects.get(pk=id_orden)
        except OrdenCompra.DoesNotExist:
            raise serializers.ValidationError({'orden': 'La orden de compra no existe'})

        if orden.id_estado == OrdenCompra.ESTADO_CANCELADA:
            raise serializers.ValidationError(
                {'orden': 'La orden está cancelada: no hay mercadería que devolver.'})
        if not orden.stock_aplicado:
            raise serializers.ValidationError(
                {'orden': 'Esta orden todavía no se recibió, así que no hay '
                          'mercadería que devolver.'})

        with connection.cursor() as cursor:
            # Lo que el proveedor entregó en esta compra.
            cursor.execute("""
                SELECT id_producto, SUM(cantidad), MAX(precio_unitario)
                FROM orden_producto
                WHERE id_orden = %s AND cantidad IS NOT NULL
                GROUP BY id_producto
            """, [id_orden])
            recibido = {r[0]: (int(r[1]), r[2]) for r in cursor.fetchall()}

            # Lo ya devuelto de esta misma compra.
            cursor.execute("""
                SELECT pdc.id_producto, SUM(pdc.cantidad)
                FROM producto_devolucion_compra pdc
                JOIN devolucion_compra dc
                  ON dc.id_devolucion_compra = pdc.id_devolucion_compra
                WHERE dc.id_orden = %s
                GROUP BY pdc.id_producto
            """, [id_orden])
            ya_devuelto = {r[0]: int(r[1]) for r in cursor.fetchall()}

        # Acumular por producto: puede venir repetido en el mismo envío.
        pedido = {}
        for d in detalles:
            pid = int(d['producto'])
            pedido[pid] = pedido.get(pid, 0) + int(d['cantidad'])

        for pid, cant in pedido.items():
            if pid not in recibido:
                raise serializers.ValidationError(
                    {'detalles': f'El producto {pid} no forma parte de la compra {id_orden}'})

            disponible = recibido[pid][0] - ya_devuelto.get(pid, 0)
            if cant > disponible:
                raise serializers.ValidationError({'detalles': (
                    f'No se puede devolver {cant} del producto {pid}: '
                    f'recibido {recibido[pid][0]}, ya devuelto '
                    f'{ya_devuelto.get(pid, 0)}, disponible {disponible}'
                )})

            producto = Producto.objects.filter(pk=pid).first()
            if producto is None:
                raise serializers.ValidationError(
                    {'detalles': f'El producto {pid} no existe'})
            # La mercadería tiene que estar físicamente para poder mandarla.
            if cant > producto.cantidad_actual:
                raise serializers.ValidationError({'detalles': (
                    f'No hay stock suficiente de "{producto.nombre}" para devolver '
                    f'{cant}: quedan {producto.cantidad_actual} en inventario.'
                )})

        data['_orden'] = orden
        data['_recibido'] = recibido
        return data

    def create(self, validated_data):
        from django.db import transaction

        orden = validated_data.pop('_orden')
        recibido = validated_data.pop('_recibido')
        detalles = validated_data.pop('detalles')
        reembolso = validated_data.get('reembolso') or Decimal('0')
        metodo = validated_data.get('metodo_reembolso') or 'credito'

        sesion = None
        if reembolso > 0 and metodo == 'efectivo':
            sesion = SesionCaja.objects.filter(estado='abierta').first()
            if sesion is None:
                raise serializers.ValidationError(
                    {'caja': 'No hay una caja abierta. Un reembolso en efectivo '
                             'entra al cajón: abre la caja o usa otro método.'}
                )

        usuario = self.context.get('usuario')

        with transaction.atomic():
            devolucion = DevolucionCompra.objects.create(
                id_orden=orden,
                id_proveedor_id=orden.id_proveedor,
                fecha=validated_data.get('fecha') or date.today(),
                motivo=validated_data.get('motivo') or None,
                total=0,
                reembolso=reembolso,
                metodo_reembolso=metodo,
                sesion=sesion,
                creado_por=usuario,
            )

            total = Decimal('0')
            with connection.cursor() as cursor:
                for d in detalles:
                    pid = int(d['producto'])
                    cantidad = int(d['cantidad'])
                    # Precio de la compra original, no el actual del catálogo.
                    precio = d.get('precio_unitario')
                    if precio in (None, ''):
                        precio = recibido[pid][1] or 0
                    precio = Decimal(str(precio))

                    ProductoDevolucionCompra.objects.create(
                        id_devolucion_compra=devolucion,
                        id_producto_id=pid,
                        cantidad=cantidad,
                        precio_unitario=precio,
                    )
                    total += cantidad * precio

                    # Sale del inventario: la mercadería se va del local.
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = cantidad_actual - %s "
                        "WHERE id_producto = %s", [cantidad, pid])
                    # `ORDEN_COMPRA` ya está permitido por el CHECK de la tabla,
                    # así que no hace falta un tipo nuevo; la referencia
                    # DEV-COMPRA distingue estas salidas de las recepciones.
                    cursor.execute("""
                        INSERT INTO movimientos_inventario
                            (producto_id, tipo, cantidad, fecha, referencia,
                             tipo_referencia, notas)
                        VALUES (%s, 'SALIDA', %s, NOW(), %s, 'ORDEN_COMPRA', %s)
                    """, [pid, cantidad, f'DEV-COMPRA-{devolucion.id_devolucion_compra}',
                          f'Devuelto al proveedor (compra #{orden.id_orden})'
                          + (f': {devolucion.motivo}' if devolucion.motivo else '')])

            devolucion.total = total
            devolucion.save(update_fields=['total'])

            # Lo devuelto deja de deberse; el reembolso, si lo hubo, cancela el
            # saldo a favor que quedaría.
            orden.calcular_saldo()

        return devolucion

    def to_representation(self, instance):
        return DevolucionCompraSerializer(instance).data
