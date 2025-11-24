"""
Servicios de lógica de negocio para Inventrix
"""
from django.db import transaction
from django.db.models import Sum, F, Q
from decimal import Decimal
from datetime import datetime, date
from inventory.models import (
    Producto, MovimientoInventario, OrdenCompra, DetalleOrdenCompra,
    OrdenVenta, DetalleOrdenVenta
)


# ============================================================================
# EXCEPCIONES PERSONALIZADAS
# ============================================================================

class InsufficientStockException(Exception):
    """Excepción cuando no hay stock suficiente"""
    pass


class InvalidOrderStateException(Exception):
    """Excepción cuando el estado de la orden no permite la operación"""
    pass


class DuplicateCodeException(Exception):
    """Excepción cuando se intenta crear un producto con código duplicado"""
    pass


# ============================================================================
# INVENTORY SERVICE
# ============================================================================

class InventoryService:
    """Servicio para gestión de inventario"""

    @staticmethod
    @transaction.atomic
    def actualizar_stock(producto_id, cantidad, tipo, referencia=None, tipo_referencia=None, notas=None):
        """
        Actualiza el stock de un producto y crea un movimiento de inventario
        
        Args:
            producto_id: ID del producto
            cantidad: Cantidad a agregar (positivo) o quitar (negativo)
            tipo: Tipo de movimiento ('entrada', 'salida', 'ajuste')
            referencia: Referencia del movimiento (ej: número de orden)
            tipo_referencia: Tipo de referencia (ej: 'orden_compra', 'orden_venta')
            notas: Notas adicionales
            
        Returns:
            MovimientoInventario: El movimiento creado
            
        Raises:
            InsufficientStockException: Si no hay stock suficiente para salida
        """
        try:
            producto = Producto.objects.select_for_update().get(id=producto_id)
        except Producto.DoesNotExist:
            raise ValueError(f"Producto con ID {producto_id} no existe")

        # Validar stock suficiente para salidas
        if tipo == 'salida' and producto.stock_actual < cantidad:
            raise InsufficientStockException(
                f"Stock insuficiente para {producto.nombre}. "
                f"Disponible: {producto.stock_actual}, Requerido: {cantidad}"
            )

        # Actualizar stock según el tipo de movimiento
        if tipo == 'entrada':
            producto.stock_actual += cantidad
        elif tipo == 'salida':
            producto.stock_actual -= cantidad
        elif tipo == 'ajuste':
            # Para ajustes, la cantidad puede ser positiva o negativa
            producto.stock_actual = cantidad
        else:
            raise ValueError(f"Tipo de movimiento inválido: {tipo}")

        producto.save()

        # Crear movimiento de inventario
        movimiento = MovimientoInventario.objects.create(
            producto=producto,
            tipo=tipo,
            cantidad=cantidad,
            referencia=referencia,
            tipo_referencia=tipo_referencia,
            notas=notas
        )

        return movimiento

    @staticmethod
    def verificar_stock_disponible(producto_id, cantidad):
        """
        Verifica si hay stock disponible para un producto
        
        Args:
            producto_id: ID del producto
            cantidad: Cantidad requerida
            
        Returns:
            bool: True si hay stock suficiente, False en caso contrario
        """
        try:
            producto = Producto.objects.get(id=producto_id)
            return producto.stock_actual >= cantidad
        except Producto.DoesNotExist:
            return False

    @staticmethod
    def calcular_valor_inventario():
        """
        Calcula el valor total del inventario
        
        Returns:
            dict: Diccionario con el valor total y desglose por categoría
        """
        # Valor total del inventario
        valor_total = Producto.objects.filter(activo=True).aggregate(
            total=Sum(F('stock_actual') * F('precio_compra'))
        )['total'] or Decimal('0.00')

        # Valor por categoría
        from django.db.models import CharField, Value
        from django.db.models.functions import Concat

        valor_por_categoria = Producto.objects.filter(activo=True).values(
            'categoria__nombre'
        ).annotate(
            valor=Sum(F('stock_actual') * F('precio_compra')),
            cantidad_productos=Sum('stock_actual')
        ).order_by('-valor')

        return {
            'valor_total': float(valor_total),
            'por_categoria': list(valor_por_categoria)
        }

    @staticmethod
    def obtener_productos_stock_bajo():
        """
        Obtiene productos con stock por debajo del mínimo
        
        Returns:
            QuerySet: Productos con stock bajo
        """
        return Producto.objects.filter(
            activo=True,
            stock_actual__lt=F('stock_minimo')
        ).select_related('categoria', 'marca', 'proveedor').order_by('stock_actual')

    @staticmethod
    def obtener_historial_movimientos(producto_id, fecha_inicio=None, fecha_fin=None):
        """
        Obtiene el historial de movimientos de un producto
        
        Args:
            producto_id: ID del producto
            fecha_inicio: Fecha de inicio del rango (opcional)
            fecha_fin: Fecha de fin del rango (opcional)
            
        Returns:
            QuerySet: Movimientos del producto
        """
        movimientos = MovimientoInventario.objects.filter(
            producto_id=producto_id
        ).select_related('producto')

        if fecha_inicio:
            movimientos = movimientos.filter(fecha__gte=fecha_inicio)
        if fecha_fin:
            movimientos = movimientos.filter(fecha__lte=fecha_fin)

        return movimientos.order_by('-fecha')



# ============================================================================
# ORDEN COMPRA SERVICE
# ============================================================================

class OrdenCompraService:
    """Servicio para gestión de órdenes de compra"""

    @staticmethod
    def generar_numero_orden():
        """
        Genera un número de orden único
        
        Returns:
            str: Número de orden en formato OC-YYYYMMDD-XXXX
        """
        fecha_actual = datetime.now()
        prefijo = fecha_actual.strftime('OC-%Y%m%d')
        
        # Obtener el último número del día
        ultima_orden = OrdenCompra.objects.filter(
            numero_orden__startswith=prefijo
        ).order_by('-numero_orden').first()
        
        if ultima_orden:
            # Extraer el número secuencial y sumar 1
            ultimo_numero = int(ultima_orden.numero_orden.split('-')[-1])
            nuevo_numero = ultimo_numero + 1
        else:
            nuevo_numero = 1
        
        return f"{prefijo}-{nuevo_numero:04d}"

    @staticmethod
    @transaction.atomic
    def crear_orden(data):
        """
        Crea una orden de compra con sus detalles
        
        Args:
            data: Diccionario con datos de la orden
                {
                    'proveedor_id': int,
                    'fecha': date,
                    'notas': str (opcional),
                    'detalles': [
                        {
                            'producto_id': int,
                            'cantidad': int,
                            'precio_unitario': Decimal
                        },
                        ...
                    ]
                }
                
        Returns:
            OrdenCompra: La orden creada
        """
        # Generar número de orden si no se proporciona
        if 'numero_orden' not in data or not data['numero_orden']:
            data['numero_orden'] = OrdenCompraService.generar_numero_orden()

        # Extraer detalles
        detalles_data = data.pop('detalles', [])
        
        if not detalles_data:
            raise ValueError("La orden debe tener al menos un detalle")

        # Calcular totales
        subtotal = Decimal('0.00')
        for detalle in detalles_data:
            cantidad = detalle['cantidad']
            precio_unitario = Decimal(str(detalle['precio_unitario']))
            subtotal += cantidad * precio_unitario

        # Crear orden
        orden = OrdenCompra.objects.create(
            numero_orden=data['numero_orden'],
            proveedor_id=data['proveedor_id'],
            fecha=data.get('fecha', date.today()),
            estado='pendiente',
            subtotal=subtotal,
            total=subtotal,
            notas=data.get('notas', '')
        )

        # Crear detalles
        for detalle_data in detalles_data:
            cantidad = detalle_data['cantidad']
            precio_unitario = Decimal(str(detalle_data['precio_unitario']))
            subtotal_detalle = cantidad * precio_unitario

            DetalleOrdenCompra.objects.create(
                orden_compra=orden,
                producto_id=detalle_data['producto_id'],
                cantidad=cantidad,
                precio_unitario=precio_unitario,
                subtotal=subtotal_detalle
            )

        return orden

    @staticmethod
    @transaction.atomic
    def confirmar_orden(orden_id):
        """
        Confirma una orden de compra (cambia estado a confirmada)
        
        Args:
            orden_id: ID de la orden
            
        Returns:
            OrdenCompra: La orden confirmada
            
        Raises:
            InvalidOrderStateException: Si la orden no está en estado pendiente
        """
        try:
            orden = OrdenCompra.objects.get(id=orden_id)
        except OrdenCompra.DoesNotExist:
            raise ValueError(f"Orden de compra con ID {orden_id} no existe")

        if orden.estado != 'pendiente':
            raise InvalidOrderStateException(
                f"La orden debe estar en estado 'pendiente' para confirmarla. "
                f"Estado actual: {orden.estado}"
            )

        orden.estado = 'confirmada'
        orden.save()

        return orden

    @staticmethod
    @transaction.atomic
    def recibir_orden(orden_id):
        """
        Marca una orden como recibida y actualiza el stock de los productos
        
        Args:
            orden_id: ID de la orden
            
        Returns:
            OrdenCompra: La orden recibida
            
        Raises:
            InvalidOrderStateException: Si la orden no está confirmada
        """
        try:
            orden = OrdenCompra.objects.select_related('proveedor').prefetch_related(
                'detalles__producto'
            ).get(id=orden_id)
        except OrdenCompra.DoesNotExist:
            raise ValueError(f"Orden de compra con ID {orden_id} no existe")

        if orden.estado != 'confirmada':
            raise InvalidOrderStateException(
                f"La orden debe estar en estado 'confirmada' para recibirla. "
                f"Estado actual: {orden.estado}"
            )

        # Actualizar stock de cada producto
        for detalle in orden.detalles.all():
            InventoryService.actualizar_stock(
                producto_id=detalle.producto.id,
                cantidad=detalle.cantidad,
                tipo='entrada',
                referencia=orden.numero_orden,
                tipo_referencia='orden_compra',
                notas=f"Recepción de orden de compra {orden.numero_orden}"
            )

        # Cambiar estado de la orden
        orden.estado = 'recibida'
        orden.save()

        return orden

    @staticmethod
    @transaction.atomic
    def cancelar_orden(orden_id, motivo=None):
        """
        Cancela una orden de compra
        
        Args:
            orden_id: ID de la orden
            motivo: Motivo de cancelación (opcional)
            
        Returns:
            OrdenCompra: La orden cancelada
            
        Raises:
            InvalidOrderStateException: Si la orden ya está recibida
        """
        try:
            orden = OrdenCompra.objects.get(id=orden_id)
        except OrdenCompra.DoesNotExist:
            raise ValueError(f"Orden de compra con ID {orden_id} no existe")

        if orden.estado == 'recibida':
            raise InvalidOrderStateException(
                "No se puede cancelar una orden que ya fue recibida"
            )

        orden.estado = 'cancelada'
        if motivo:
            orden.notas = f"{orden.notas}\n\nMotivo de cancelación: {motivo}" if orden.notas else f"Motivo de cancelación: {motivo}"
        orden.save()

        return orden

    @staticmethod
    def obtener_ordenes_por_estado(estado):
        """
        Obtiene órdenes de compra por estado
        
        Args:
            estado: Estado de las órdenes
            
        Returns:
            QuerySet: Órdenes filtradas
        """
        return OrdenCompra.objects.filter(
            estado=estado
        ).select_related('proveedor').order_by('-fecha_creacion')

    @staticmethod
    def obtener_ordenes_por_proveedor(proveedor_id, fecha_inicio=None, fecha_fin=None):
        """
        Obtiene órdenes de compra de un proveedor
        
        Args:
            proveedor_id: ID del proveedor
            fecha_inicio: Fecha de inicio del rango (opcional)
            fecha_fin: Fecha de fin del rango (opcional)
            
        Returns:
            QuerySet: Órdenes del proveedor
        """
        ordenes = OrdenCompra.objects.filter(
            proveedor_id=proveedor_id
        ).select_related('proveedor')

        if fecha_inicio:
            ordenes = ordenes.filter(fecha__gte=fecha_inicio)
        if fecha_fin:
            ordenes = ordenes.filter(fecha__lte=fecha_fin)

        return ordenes.order_by('-fecha')



# ============================================================================
# ORDEN VENTA SERVICE
# ============================================================================

class OrdenVentaService:
    """Servicio para gestión de órdenes de venta"""

    @staticmethod
    def generar_numero_orden():
        """
        Genera un número de orden único
        
        Returns:
            str: Número de orden en formato OV-YYYYMMDD-XXXX
        """
        fecha_actual = datetime.now()
        prefijo = fecha_actual.strftime('OV-%Y%m%d')
        
        # Obtener el último número del día
        ultima_orden = OrdenVenta.objects.filter(
            numero_orden__startswith=prefijo
        ).order_by('-numero_orden').first()
        
        if ultima_orden:
            # Extraer el número secuencial y sumar 1
            ultimo_numero = int(ultima_orden.numero_orden.split('-')[-1])
            nuevo_numero = ultimo_numero + 1
        else:
            nuevo_numero = 1
        
        return f"{prefijo}-{nuevo_numero:04d}"

    @staticmethod
    @transaction.atomic
    def crear_orden(data, confirmar_inmediatamente=False):
        """
        Crea una orden de venta con sus detalles
        
        Args:
            data: Diccionario con datos de la orden
                {
                    'cliente_id': int,
                    'fecha': date,
                    'descuento': Decimal (opcional),
                    'notas': str (opcional),
                    'detalles': [
                        {
                            'producto_id': int,
                            'cantidad': int,
                            'precio_unitario': Decimal
                        },
                        ...
                    ]
                }
            confirmar_inmediatamente: Si True, confirma la orden y reduce stock
                
        Returns:
            OrdenVenta: La orden creada
            
        Raises:
            InsufficientStockException: Si no hay stock suficiente
        """
        # Generar número de orden si no se proporciona
        if 'numero_orden' not in data or not data['numero_orden']:
            data['numero_orden'] = OrdenVentaService.generar_numero_orden()

        # Extraer detalles
        detalles_data = data.pop('detalles', [])
        
        if not detalles_data:
            raise ValueError("La orden debe tener al menos un detalle")

        # Validar stock disponible
        for detalle in detalles_data:
            if not InventoryService.verificar_stock_disponible(
                detalle['producto_id'],
                detalle['cantidad']
            ):
                producto = Producto.objects.get(id=detalle['producto_id'])
                raise InsufficientStockException(
                    f"Stock insuficiente para {producto.nombre}. "
                    f"Disponible: {producto.stock_actual}, Requerido: {detalle['cantidad']}"
                )

        # Calcular totales
        subtotal = Decimal('0.00')
        for detalle in detalles_data:
            cantidad = detalle['cantidad']
            precio_unitario = Decimal(str(detalle['precio_unitario']))
            subtotal += cantidad * precio_unitario

        descuento = Decimal(str(data.get('descuento', '0.00')))
        total = subtotal - descuento

        # Crear orden
        orden = OrdenVenta.objects.create(
            numero_orden=data['numero_orden'],
            cliente_id=data['cliente_id'],
            fecha=data.get('fecha', date.today()),
            estado='pendiente',
            subtotal=subtotal,
            descuento=descuento,
            total=total,
            notas=data.get('notas', '')
        )

        # Crear detalles
        for detalle_data in detalles_data:
            cantidad = detalle_data['cantidad']
            precio_unitario = Decimal(str(detalle_data['precio_unitario']))
            subtotal_detalle = cantidad * precio_unitario

            DetalleOrdenVenta.objects.create(
                orden_venta=orden,
                producto_id=detalle_data['producto_id'],
                cantidad=cantidad,
                precio_unitario=precio_unitario,
                subtotal=subtotal_detalle
            )

        # Confirmar inmediatamente si se solicita
        if confirmar_inmediatamente:
            orden = OrdenVentaService.confirmar_orden(orden.id)

        return orden

    @staticmethod
    @transaction.atomic
    def confirmar_orden(orden_id):
        """
        Confirma una orden de venta y reduce el stock de los productos
        
        Args:
            orden_id: ID de la orden
            
        Returns:
            OrdenVenta: La orden confirmada
            
        Raises:
            InvalidOrderStateException: Si la orden no está en estado pendiente
            InsufficientStockException: Si no hay stock suficiente
        """
        try:
            orden = OrdenVenta.objects.select_related('cliente').prefetch_related(
                'detalles__producto'
            ).get(id=orden_id)
        except OrdenVenta.DoesNotExist:
            raise ValueError(f"Orden de venta con ID {orden_id} no existe")

        if orden.estado != 'pendiente':
            raise InvalidOrderStateException(
                f"La orden debe estar en estado 'pendiente' para confirmarla. "
                f"Estado actual: {orden.estado}"
            )

        # Validar stock disponible antes de confirmar
        for detalle in orden.detalles.all():
            if not InventoryService.verificar_stock_disponible(
                detalle.producto.id,
                detalle.cantidad
            ):
                raise InsufficientStockException(
                    f"Stock insuficiente para {detalle.producto.nombre}. "
                    f"Disponible: {detalle.producto.stock_actual}, Requerido: {detalle.cantidad}"
                )

        # Reducir stock de cada producto
        for detalle in orden.detalles.all():
            InventoryService.actualizar_stock(
                producto_id=detalle.producto.id,
                cantidad=detalle.cantidad,
                tipo='salida',
                referencia=orden.numero_orden,
                tipo_referencia='orden_venta',
                notas=f"Venta - Orden {orden.numero_orden}"
            )

        # Cambiar estado de la orden
        orden.estado = 'confirmada'
        orden.save()

        return orden

    @staticmethod
    @transaction.atomic
    def cancelar_orden(orden_id, motivo=None):
        """
        Cancela una orden de venta y devuelve el stock si ya estaba confirmada
        
        Args:
            orden_id: ID de la orden
            motivo: Motivo de cancelación (opcional)
            
        Returns:
            OrdenVenta: La orden cancelada
            
        Raises:
            InvalidOrderStateException: Si la orden ya está entregada
        """
        try:
            orden = OrdenVenta.objects.select_related('cliente').prefetch_related(
                'detalles__producto'
            ).get(id=orden_id)
        except OrdenVenta.DoesNotExist:
            raise ValueError(f"Orden de venta con ID {orden_id} no existe")

        if orden.estado == 'entregada':
            raise InvalidOrderStateException(
                "No se puede cancelar una orden que ya fue entregada"
            )

        # Si la orden estaba confirmada, devolver el stock
        if orden.estado == 'confirmada':
            for detalle in orden.detalles.all():
                InventoryService.actualizar_stock(
                    producto_id=detalle.producto.id,
                    cantidad=detalle.cantidad,
                    tipo='entrada',
                    referencia=orden.numero_orden,
                    tipo_referencia='cancelacion_venta',
                    notas=f"Devolución por cancelación de orden {orden.numero_orden}"
                )

        orden.estado = 'cancelada'
        if motivo:
            orden.notas = f"{orden.notas}\n\nMotivo de cancelación: {motivo}" if orden.notas else f"Motivo de cancelación: {motivo}"
        orden.save()

        return orden

    @staticmethod
    @transaction.atomic
    def aplicar_descuento(orden_id, descuento):
        """
        Aplica un descuento a una orden y recalcula el total
        
        Args:
            orden_id: ID de la orden
            descuento: Monto del descuento
            
        Returns:
            OrdenVenta: La orden actualizada
            
        Raises:
            InvalidOrderStateException: Si la orden no está en estado pendiente
        """
        try:
            orden = OrdenVenta.objects.get(id=orden_id)
        except OrdenVenta.DoesNotExist:
            raise ValueError(f"Orden de venta con ID {orden_id} no existe")

        if orden.estado != 'pendiente':
            raise InvalidOrderStateException(
                "Solo se puede aplicar descuento a órdenes pendientes"
            )

        descuento = Decimal(str(descuento))
        if descuento < 0:
            raise ValueError("El descuento no puede ser negativo")

        if descuento > orden.subtotal:
            raise ValueError("El descuento no puede ser mayor al subtotal")

        orden.descuento = descuento
        orden.total = orden.subtotal - descuento
        orden.save()

        return orden

    @staticmethod
    def obtener_ordenes_por_estado(estado):
        """
        Obtiene órdenes de venta por estado
        
        Args:
            estado: Estado de las órdenes
            
        Returns:
            QuerySet: Órdenes filtradas
        """
        return OrdenVenta.objects.filter(
            estado=estado
        ).select_related('cliente').order_by('-fecha_creacion')

    @staticmethod
    def obtener_ordenes_por_cliente(cliente_id, fecha_inicio=None, fecha_fin=None):
        """
        Obtiene órdenes de venta de un cliente
        
        Args:
            cliente_id: ID del cliente
            fecha_inicio: Fecha de inicio del rango (opcional)
            fecha_fin: Fecha de fin del rango (opcional)
            
        Returns:
            QuerySet: Órdenes del cliente
        """
        ordenes = OrdenVenta.objects.filter(
            cliente_id=cliente_id
        ).select_related('cliente')

        if fecha_inicio:
            ordenes = ordenes.filter(fecha__gte=fecha_inicio)
        if fecha_fin:
            ordenes = ordenes.filter(fecha__lte=fecha_fin)

        return ordenes.order_by('-fecha')



# ============================================================================
# REPORTE SERVICE
# ============================================================================

class ReporteService:
    """Servicio para generación de reportes"""

    @staticmethod
    def generar_reporte_inventario():
        """
        Genera un reporte completo del inventario
        
        Returns:
            dict: Reporte con todos los productos y sus valores
        """
        productos = Producto.objects.filter(activo=True).select_related(
            'categoria', 'marca', 'proveedor'
        ).order_by('categoria__nombre', 'nombre')

        # Calcular totales
        valor_total = Decimal('0.00')
        cantidad_total = 0

        productos_data = []
        for producto in productos:
            valor_producto = producto.stock_actual * producto.precio_compra
            valor_total += valor_producto
            cantidad_total += producto.stock_actual

            productos_data.append({
                'id': producto.id,
                'codigo': producto.codigo,
                'nombre': producto.nombre,
                'categoria': producto.categoria.nombre,
                'marca': producto.marca.nombre,
                'proveedor': producto.proveedor.nombre,
                'stock_actual': producto.stock_actual,
                'stock_minimo': producto.stock_minimo,
                'stock_bajo': producto.stock_bajo,
                'precio_compra': float(producto.precio_compra),
                'precio_venta': float(producto.precio_venta),
                'valor_inventario': float(valor_producto),
                'ubicacion': producto.ubicacion
            })

        return {
            'fecha_generacion': datetime.now().isoformat(),
            'resumen': {
                'total_productos': len(productos_data),
                'cantidad_total_unidades': cantidad_total,
                'valor_total_inventario': float(valor_total),
                'productos_stock_bajo': len([p for p in productos_data if p['stock_bajo']])
            },
            'productos': productos_data
        }

    @staticmethod
    def generar_reporte_ventas(fecha_inicio, fecha_fin):
        """
        Genera un reporte de ventas en un rango de fechas
        
        Args:
            fecha_inicio: Fecha de inicio
            fecha_fin: Fecha de fin
            
        Returns:
            dict: Reporte de ventas
        """
        ordenes = OrdenVenta.objects.filter(
            fecha__gte=fecha_inicio,
            fecha__lte=fecha_fin,
            estado__in=['confirmada', 'entregada']
        ).select_related('cliente').prefetch_related('detalles__producto')

        # Calcular totales
        total_ventas = Decimal('0.00')
        total_descuentos = Decimal('0.00')
        cantidad_ordenes = ordenes.count()

        # Productos más vendidos
        from collections import defaultdict
        productos_vendidos = defaultdict(lambda: {'cantidad': 0, 'total': Decimal('0.00')})

        ordenes_data = []
        for orden in ordenes:
            total_ventas += orden.total
            total_descuentos += orden.descuento

            detalles_data = []
            for detalle in orden.detalles.all():
                detalles_data.append({
                    'producto_codigo': detalle.producto.codigo,
                    'producto_nombre': detalle.producto.nombre,
                    'cantidad': detalle.cantidad,
                    'precio_unitario': float(detalle.precio_unitario),
                    'subtotal': float(detalle.subtotal)
                })

                # Acumular para productos más vendidos
                productos_vendidos[detalle.producto.id]['nombre'] = detalle.producto.nombre
                productos_vendidos[detalle.producto.id]['codigo'] = detalle.producto.codigo
                productos_vendidos[detalle.producto.id]['cantidad'] += detalle.cantidad
                productos_vendidos[detalle.producto.id]['total'] += detalle.subtotal

            ordenes_data.append({
                'numero_orden': orden.numero_orden,
                'fecha': orden.fecha.isoformat(),
                'cliente': orden.cliente.nombre,
                'estado': orden.estado,
                'subtotal': float(orden.subtotal),
                'descuento': float(orden.descuento),
                'total': float(orden.total),
                'detalles': detalles_data
            })

        # Top 10 productos más vendidos
        top_productos = sorted(
            [
                {
                    'producto_id': pid,
                    'codigo': data['codigo'],
                    'nombre': data['nombre'],
                    'cantidad_vendida': data['cantidad'],
                    'total_vendido': float(data['total'])
                }
                for pid, data in productos_vendidos.items()
            ],
            key=lambda x: x['cantidad_vendida'],
            reverse=True
        )[:10]

        return {
            'fecha_generacion': datetime.now().isoformat(),
            'periodo': {
                'fecha_inicio': fecha_inicio.isoformat(),
                'fecha_fin': fecha_fin.isoformat()
            },
            'resumen': {
                'cantidad_ordenes': cantidad_ordenes,
                'total_ventas': float(total_ventas),
                'total_descuentos': float(total_descuentos),
                'promedio_por_orden': float(total_ventas / cantidad_ordenes) if cantidad_ordenes > 0 else 0
            },
            'top_productos': top_productos,
            'ordenes': ordenes_data
        }

    @staticmethod
    def generar_reporte_compras(fecha_inicio, fecha_fin, proveedor_id=None):
        """
        Genera un reporte de compras en un rango de fechas
        
        Args:
            fecha_inicio: Fecha de inicio
            fecha_fin: Fecha de fin
            proveedor_id: ID del proveedor (opcional)
            
        Returns:
            dict: Reporte de compras
        """
        ordenes = OrdenCompra.objects.filter(
            fecha__gte=fecha_inicio,
            fecha__lte=fecha_fin,
            estado__in=['confirmada', 'recibida']
        ).select_related('proveedor').prefetch_related('detalles__producto')

        if proveedor_id:
            ordenes = ordenes.filter(proveedor_id=proveedor_id)

        # Calcular totales
        total_compras = Decimal('0.00')
        cantidad_ordenes = ordenes.count()

        # Compras por proveedor
        from collections import defaultdict
        compras_por_proveedor = defaultdict(lambda: {'cantidad_ordenes': 0, 'total': Decimal('0.00')})

        ordenes_data = []
        for orden in ordenes:
            total_compras += orden.total

            detalles_data = []
            for detalle in orden.detalles.all():
                detalles_data.append({
                    'producto_codigo': detalle.producto.codigo,
                    'producto_nombre': detalle.producto.nombre,
                    'cantidad': detalle.cantidad,
                    'precio_unitario': float(detalle.precio_unitario),
                    'subtotal': float(detalle.subtotal)
                })

            ordenes_data.append({
                'numero_orden': orden.numero_orden,
                'fecha': orden.fecha.isoformat(),
                'proveedor': orden.proveedor.nombre,
                'estado': orden.estado,
                'total': float(orden.total),
                'detalles': detalles_data
            })

            # Acumular por proveedor
            compras_por_proveedor[orden.proveedor.id]['nombre'] = orden.proveedor.nombre
            compras_por_proveedor[orden.proveedor.id]['cantidad_ordenes'] += 1
            compras_por_proveedor[orden.proveedor.id]['total'] += orden.total

        # Ranking de proveedores
        ranking_proveedores = sorted(
            [
                {
                    'proveedor_id': pid,
                    'nombre': data['nombre'],
                    'cantidad_ordenes': data['cantidad_ordenes'],
                    'total_comprado': float(data['total'])
                }
                for pid, data in compras_por_proveedor.items()
            ],
            key=lambda x: x['total_comprado'],
            reverse=True
        )

        return {
            'fecha_generacion': datetime.now().isoformat(),
            'periodo': {
                'fecha_inicio': fecha_inicio.isoformat(),
                'fecha_fin': fecha_fin.isoformat()
            },
            'resumen': {
                'cantidad_ordenes': cantidad_ordenes,
                'total_compras': float(total_compras),
                'promedio_por_orden': float(total_compras / cantidad_ordenes) if cantidad_ordenes > 0 else 0
            },
            'ranking_proveedores': ranking_proveedores,
            'ordenes': ordenes_data
        }

    @staticmethod
    def obtener_productos_mas_vendidos(limite=10, fecha_inicio=None, fecha_fin=None):
        """
        Obtiene los productos más vendidos
        
        Args:
            limite: Cantidad de productos a retornar
            fecha_inicio: Fecha de inicio del rango (opcional)
            fecha_fin: Fecha de fin del rango (opcional)
            
        Returns:
            list: Lista de productos más vendidos
        """
        detalles = DetalleOrdenVenta.objects.filter(
            orden_venta__estado__in=['confirmada', 'entregada']
        ).select_related('producto')

        if fecha_inicio:
            detalles = detalles.filter(orden_venta__fecha__gte=fecha_inicio)
        if fecha_fin:
            detalles = detalles.filter(orden_venta__fecha__lte=fecha_fin)

        # Agrupar por producto y sumar cantidades
        from collections import defaultdict
        productos_vendidos = defaultdict(lambda: {'cantidad': 0, 'total': Decimal('0.00')})

        for detalle in detalles:
            productos_vendidos[detalle.producto.id]['producto'] = detalle.producto
            productos_vendidos[detalle.producto.id]['cantidad'] += detalle.cantidad
            productos_vendidos[detalle.producto.id]['total'] += detalle.subtotal

        # Ordenar y limitar
        top_productos = sorted(
            [
                {
                    'producto_id': pid,
                    'codigo': data['producto'].codigo,
                    'nombre': data['producto'].nombre,
                    'categoria': data['producto'].categoria.nombre,
                    'cantidad_vendida': data['cantidad'],
                    'total_vendido': float(data['total'])
                }
                for pid, data in productos_vendidos.items()
            ],
            key=lambda x: x['cantidad_vendida'],
            reverse=True
        )[:limite]

        return top_productos
