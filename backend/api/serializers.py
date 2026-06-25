"""
Serializers para la API de Inventrix
"""
from rest_framework import serializers
from django.db import connection
from inventory.models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, DetalleOrdenCompra, OrdenVenta, DetalleOrdenVenta,
    MovimientoInventario, Moto, ServicioMoto, Servicio, BitacoraServicio,
    AuditoriaProducto, Garantia, ReclamacionGarantia, PagoVenta
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
    productos_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Marca
        fields = ['id', 'nombre', 'descripcion', 'fecha_creacion', 'productos_count']
        read_only_fields = ['fecha_creacion', 'productos_count']

    def get_productos_count(self, obj):
        """Retorna el número de productos asociados a esta marca"""
        return obj.productos.count()


class CategoriaSerializer(serializers.ModelSerializer):
    """Serializer básico para Categoria"""
    productos_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'descripcion', 'fecha_creacion', 'productos_count']
        read_only_fields = ['fecha_creacion', 'productos_count']

    def get_productos_count(self, obj):
        """Retorna el número de productos asociados a esta categoría"""
        return obj.productos.count()


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

class ProductoListSerializer(serializers.ModelSerializer):
    """Serializer para listado de productos"""
    proveedor_nombre = serializers.CharField(source='id_proveedor.nombre_empresa', read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id_producto', 'sku_producto', 'nombre', 'cantidad_actual',
            'cantidad_minima', 'cantidad_total', 'precio_compra_unitario', 'precio_final',
            'id_proveedor', 'proveedor_nombre',
            'meses_garantia', 'tipo_garantia', 'descripcion_garantia',
        ]


class ProductoDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para producto"""
    proveedor_nombre = serializers.CharField(source='id_proveedor.nombre_empresa', read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id_producto', 'sku_producto', 'nombre', 'cantidad_actual',
            'cantidad_minima', 'cantidad_total', 'precio_compra_unitario', 'precio_final',
            'id_proveedor', 'proveedor_nombre',
            'meses_garantia', 'tipo_garantia', 'descripcion_garantia',
        ]


class ProductoCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar productos"""
    class Meta:
        model = Producto
        fields = [
            'sku_producto', 'nombre', 'cantidad_actual', 'cantidad_minima',
            'cantidad_total', 'precio_compra_unitario', 'precio_final', 'id_proveedor',
            'meses_garantia', 'tipo_garantia', 'descripcion_garantia',
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

class DetalleOrdenCompraSerializer(serializers.ModelSerializer):
    """Serializer para detalles de orden de compra"""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    
    class Meta:
        model = DetalleOrdenCompra
        fields = [
            'id', 'producto', 'producto_nombre', 'producto_codigo',
            'cantidad', 'precio_unitario', 'subtotal'
        ]
        read_only_fields = ['subtotal']


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
            'estado', 'estado_display', 'fecha_creacion', 'total'
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
    """Mapa {id_orden: total} con una única agregación para todo el lote."""
    ids = [o.id_orden for o in _root_instances(root)]
    if not ids:
        return {}
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT op.id_orden, SUM(p.precio_compra_unitario)
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

    class Meta:
        model = OrdenCompra
        fields = [
            'id_orden', 'id_proveedor', 'proveedor_nombre', 'proveedor_contacto',
            'id_estado', 'estado', 'estado_display', 'fecha_creacion',
            'total', 'subtotal', 'productos', 'notas'
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
        from django.db import connection, ProgrammingError
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT notas FROM orden_compra WHERE id_orden = %s", [obj.id_orden])
                row = cursor.fetchone()
                return row[0] if row and row[0] else None
        except ProgrammingError:
            return None
    
    def get_productos(self, obj):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    p.id_producto,
                    p.nombre,
                    p.sku_producto,
                    p.precio_compra_unitario
                FROM orden_compra oc
                INNER JOIN orden_producto op ON op.id_orden = oc.id_orden
                INNER JOIN productos p ON p.id_producto = op.id_producto
                WHERE oc.id_orden = %s
            """, [obj.id_orden])
            productos = []
            for row in cursor.fetchall():
                productos.append({
                    'id_producto': row[0],
                    'nombre': row[1],
                    'sku': row[2],
                    'precio_compra': float(row[3]) if row[3] else 0.0
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
    
    # Campos de solo lectura para la respuesta
    id_orden = serializers.IntegerField(read_only=True)
    id_proveedor = serializers.IntegerField(read_only=True)
    id_estado = serializers.IntegerField(read_only=True)
    fecha_creacion = serializers.DateField(read_only=True)
    
    def create(self, validated_data):
        from django.db import connection
        
        detalles_data = validated_data.pop('detalles')
        
        # Insertar en la tabla orden_compra con estado pendiente (2)
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO orden_compra (id_proveedor, id_estado, fecha_creacion)
                VALUES (%s, %s, %s)
                RETURNING id_orden
            """, [
                validated_data['id_proveedor'],
                2,  # Estado pendiente
                validated_data['fecha_creacion']
            ])
            id_orden = cursor.fetchone()[0]
            
            # Insertar productos en orden_producto
            for detalle in detalles_data:
                cursor.execute("""
                    INSERT INTO orden_producto (id_orden, id_producto)
                    VALUES (%s, %s)
                """, [
                    id_orden,
                    detalle['producto']
                ])
        
        # Retornar la orden creada
        return OrdenCompra.objects.get(id_orden=id_orden)
    
    def to_representation(self, instance):
        """Usar el serializer de detalle para la respuesta"""
        return OrdenCompraDetailSerializer(instance).data


# ============================================================================
# ORDEN VENTA SERIALIZERS
# ============================================================================

class DetalleOrdenVentaSerializer(serializers.ModelSerializer):
    """Serializer para detalles de orden de venta"""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    
    class Meta:
        model = DetalleOrdenVenta
        fields = [
            'id', 'producto', 'producto_nombre', 'producto_codigo',
            'cantidad', 'precio_unitario', 'subtotal'
        ]
        read_only_fields = ['subtotal']


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
        pago = PagoVenta.objects.create(id_venta=venta, **validated_data)
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
            
            # Si no hay productos, verificar si es un servicio de moto
            if not productos:
                cursor.execute("""
                    SELECT 
                        sm.id_servicio,
                        sm.tipo_servicio,
                        sm.descripcion,
                        sm.costo,
                        m.marca,
                        m.modelo,
                        m.placa
                    FROM ventas v
                    INNER JOIN servicio_motos sm ON sm.fecha_servicio = v.fecha
                    INNER JOIN motos m ON m.id_moto = sm.id_moto
                    WHERE v.id_venta = %s
                    AND m.id_cliente = v.id_cliente
                    AND sm.costo = v.total
                    LIMIT 1
                """, [obj.id_venta])
                servicio = cursor.fetchone()
                if servicio:
                    productos.append({
                        'id_producto': None,
                        'nombre': f"Servicio: {servicio[1]}",
                        'sku': f"SERVICIO-{servicio[0]}",
                        'precio_unitario': float(servicio[3]) if servicio[3] else 0.0,
                        'cantidad': 1,
                        'subtotal': float(servicio[3]) if servicio[3] else 0.0,
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
        from django.db import connection
        from datetime import date
        from calendar import monthrange

        def sumar_meses(d, meses):
            month = d.month - 1 + meses
            year = d.year + month // 12
            month = month % 12 + 1
            day = min(d.day, monthrange(year, month)[1])
            return d.replace(year=year, month=month, day=day)

        detalles_data = validated_data.pop('detalles')

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
                cursor.execute("""
                    INSERT INTO producto_venta (id_venta, id_producto, cantidad, precio_unitario)
                    VALUES (%s, %s, %s, %s)
                """, [
                    id_venta,
                    detalle['producto'],
                    detalle['cantidad'],
                    detalle['precio_unitario']
                ])

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

        return OrdenVenta.objects.get(id_venta=id_venta)
    
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

class ServicioMotoSerializer(serializers.ModelSerializer):
    """Serializer para servicios de motos"""
    class Meta:
        model = ServicioMoto
        fields = [
            'id_servicio', 'id_moto', 'fecha_servicio',
            'tipo_servicio', 'descripcion', 'costo'
        ]


class MotoSerializer(serializers.ModelSerializer):
    """Serializer para motos con servicios"""
    servicios = ServicioMotoSerializer(many=True, read_only=True)
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
    """Serializer para catálogo de servicios"""
    class Meta:
        model = Servicio
        fields = ['id_servicio', 'nombre', 'tipo', 'precio_mano_obra']


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
