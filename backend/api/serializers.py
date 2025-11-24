"""
Serializers para la API de Inventrix
"""
from rest_framework import serializers
from inventory.models import (
    Proveedor, Marca, Categoria, Producto, Cliente,
    OrdenCompra, DetalleOrdenCompra, OrdenVenta, DetalleOrdenVenta,
    MovimientoInventario, Moto, ServicioMoto, Servicio
)


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


# ============================================================================
# PRODUCTO SERIALIZERS
# ============================================================================

class ProductoListSerializer(serializers.ModelSerializer):
    """Serializer para listado de productos"""
    class Meta:
        model = Producto
        fields = [
            'id_producto', 'sku_producto', 'nombre', 'cantidad_actual',
            'cantidad_minima', 'cantidad_total', 'precio_compra_unitario', 'precio_final'
        ]


class ProductoDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para producto"""
    class Meta:
        model = Producto
        fields = [
            'id_producto', 'sku_producto', 'nombre', 'cantidad_actual',
            'cantidad_minima', 'cantidad_total', 'precio_compra_unitario', 'precio_final'
        ]


class ProductoCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar productos"""
    class Meta:
        model = Producto
        fields = [
            'sku_producto', 'nombre', 'cantidad_actual', 'cantidad_minima',
            'cantidad_total', 'precio_compra_unitario', 'precio_final'
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


class OrdenCompraListSerializer(serializers.ModelSerializer):
    """Serializer para listado de órdenes de compra"""
    proveedor_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenCompra
        fields = [
            'id_orden', 'id_proveedor', 'proveedor_nombre', 'id_estado', 
            'estado_display', 'fecha_creacion', 'total'
        ]
    
    def get_proveedor_nombre(self, obj):
        try:
            proveedor = Proveedor.objects.get(id_proveedor=obj.id_proveedor)
            return proveedor.nombre_empresa
        except Proveedor.DoesNotExist:
            return 'Proveedor no encontrado'
    
    def get_estado_display(self, obj):
        estados = {
            1: 'Cancelado',
            2: 'Pendiente',
            3: 'Completado'
        }
        return estados.get(obj.id_estado, 'Desconocido')
    
    def get_total(self, obj):
        from django.db import connection
        with connection.cursor() as cursor:
            # Sumar los precios de compra de todos los productos en la orden
            cursor.execute("""
                SELECT SUM(p.precio_compra_unitario)
                FROM orden_compra oc
                INNER JOIN orden_producto op ON op.id_orden = oc.id_orden
                INNER JOIN productos p ON p.id_producto = op.id_producto
                WHERE oc.id_orden = %s
            """, [obj.id_orden])
            result = cursor.fetchone()
            return float(result[0]) if result and result[0] else 0.0


class OrdenCompraDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para orden de compra"""
    proveedor_nombre = serializers.SerializerMethodField()
    proveedor_contacto = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    productos = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenCompra
        fields = [
            'id_orden', 'id_proveedor', 'proveedor_nombre', 'proveedor_contacto',
            'id_estado', 'estado_display', 'fecha_creacion', 'total', 'subtotal', 'productos'
        ]
    
    def get_proveedor_nombre(self, obj):
        try:
            proveedor = Proveedor.objects.get(id_proveedor=obj.id_proveedor)
            return proveedor.nombre_empresa
        except Proveedor.DoesNotExist:
            return 'Proveedor no encontrado'
    
    def get_proveedor_contacto(self, obj):
        try:
            proveedor = Proveedor.objects.get(id_proveedor=obj.id_proveedor)
            return proveedor.persona_contacto
        except Proveedor.DoesNotExist:
            return None
    
    def get_estado_display(self, obj):
        estados = {
            1: 'Cancelado',
            2: 'Pendiente',
            3: 'Completado'
        }
        return estados.get(obj.id_estado, 'Desconocido')
    
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
        from django.db import connection
        with connection.cursor() as cursor:
            # Sumar los precios de compra de todos los productos en la orden
            cursor.execute("""
                SELECT SUM(p.precio_compra_unitario)
                FROM orden_compra oc
                INNER JOIN orden_producto op ON op.id_orden = oc.id_orden
                INNER JOIN productos p ON p.id_producto = op.id_producto
                WHERE oc.id_orden = %s
            """, [obj.id_orden])
            result = cursor.fetchone()
            return float(result[0]) if result and result[0] else 0.0


class OrdenCompraCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear órdenes de compra"""
    
    class Meta:
        model = OrdenCompra
        fields = [
            'id_proveedor', 'id_estado', 'fecha_creacion'
        ]


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


class OrdenVentaListSerializer(serializers.ModelSerializer):
    """Serializer para listado de órdenes de venta"""
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenVenta
        fields = [
            'id_venta', 'id_cliente', 'cliente_nombre',
            'fecha', 'estado_display', 'total'
        ]
    
    def get_cliente_nombre(self, obj):
        try:
            cliente = Cliente.objects.get(id_cliente=obj.id_cliente)
            return cliente.nombre
        except Cliente.DoesNotExist:
            return 'Cliente no encontrado'
    
    def get_estado_display(self, obj):
        # Por ahora retornamos un estado por defecto
        return 'Completado'


class OrdenVentaDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para orden de venta"""
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    productos = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenVenta
        fields = [
            'id_venta', 'id_cliente', 'cliente_nombre',
            'fecha', 'estado_display', 'total', 'productos'
        ]
    
    def get_cliente_nombre(self, obj):
        try:
            cliente = Cliente.objects.get(id_cliente=obj.id_cliente)
            return cliente.nombre
        except Cliente.DoesNotExist:
            return 'Cliente no encontrado'
    
    def get_estado_display(self, obj):
        return 'Completado'
    
    def get_total(self, obj):
        """Calcula el total sumando los subtotales de producto_venta"""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT SUM(pv.precio_unitario * pv.cantidad) as total
                FROM producto_venta pv
                WHERE pv.id_venta = %s
            """, [obj.id_venta])
            result = cursor.fetchone()
            return float(result[0]) if result and result[0] else 0.0
    
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
        
        detalles_data = validated_data.pop('detalles')
        
        # Insertar en la tabla ventas
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
            
            # Insertar productos en producto_venta
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
        
        # Retornar la orden creada
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
        """Retorna el número total de servicios realizados"""
        return obj.servicios.count()
    
    def get_ultimo_servicio(self, obj):
        """Retorna la fecha del último servicio"""
        ultimo = obj.servicios.order_by('-fecha_servicio').first()
        return ultimo.fecha_servicio if ultimo else None


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
