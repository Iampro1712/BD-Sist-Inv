"""
Modelos Django para Inventrix
Basados en el Modelo Relacional establecido
"""
from datetime import date
from decimal import Decimal

from django.db import connection, models


class Proveedor(models.Model):
    """Modelo para proveedores"""
    id_proveedor = models.AutoField(primary_key=True)
    nombre_empresa = models.CharField(max_length=255)
    persona_contacto = models.CharField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=255, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'proveedores'
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'
        ordering = ['nombre_empresa']

    def __str__(self):
        return self.nombre_empresa


class Marca(models.Model):
    """Modelo para marcas de productos"""
    nombre = models.CharField(max_length=255, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'marcas'
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Categoria(models.Model):
    """Modelo para categorías de productos"""
    nombre = models.CharField(max_length=255, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categorias'
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    """Modelo para productos del inventario - Mapea tabla existente"""
    TIPO_GARANTIA_CHOICES = [
        ('fabricante', 'Fabricante'),
        ('proveedor', 'Proveedor'),
        ('tienda', 'Tienda'),
    ]

    id_producto = models.AutoField(primary_key=True)
    sku_producto = models.CharField(max_length=100)
    nombre = models.CharField(max_length=255)
    cantidad_actual = models.IntegerField(default=0)
    cantidad_total = models.IntegerField(default=0)
    cantidad_minima = models.IntegerField(default=0)
    precio_compra_unitario = models.IntegerField()
    precio_final = models.DecimalField(max_digits=10, decimal_places=2)
    id_proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='productos',
        db_column='id_proveedor'
    )
    meses_garantia = models.IntegerField(default=0)
    descripcion_garantia = models.TextField(null=True, blank=True)
    tipo_garantia = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        choices=TIPO_GARANTIA_CHOICES,
    )

    class Meta:
        managed = False  # No modificar la tabla existente
        db_table = 'productos'
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.sku_producto} - {self.nombre}"


class Cliente(models.Model):
    """Modelo para clientes"""
    id_cliente = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'cliente'
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Moto(models.Model):
    """Modelo para motos de clientes"""
    id_moto = models.AutoField(primary_key=True)
    id_cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='motos',
        db_column='id_cliente'
    )
    marca = models.CharField(max_length=100)
    modelo = models.CharField(max_length=100)
    anio = models.IntegerField(db_column='aÑo')
    placa = models.CharField(max_length=20, unique=True)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'motos'
        verbose_name = 'Moto'
        verbose_name_plural = 'Motos'
        ordering = ['marca', 'modelo']

    def __str__(self):
        return f"{self.marca} {self.modelo} ({self.placa})"


class ServicioMoto(models.Model):
    """Modelo para servicios realizados a motos"""
    id_servicio = models.AutoField(primary_key=True)
    id_moto = models.ForeignKey(
        Moto,
        on_delete=models.CASCADE,
        related_name='servicios',
        db_column='id_moto'
    )
    fecha_servicio = models.DateField()
    tipo_servicio = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    costo = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'servicio_motos'
        verbose_name = 'Servicio de Moto'
        verbose_name_plural = 'Servicios de Motos'
        ordering = ['-fecha_servicio']

    def __str__(self):
        return f"{self.tipo_servicio} - {self.id_moto}"


class Servicio(models.Model):
    """Modelo para catálogo de servicios disponibles"""
    id_servicio = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=255)
    precio_mano_obra = models.DecimalField(max_digits=10, decimal_places=2)
    diagnostico = models.TextField(blank=True, null=True)
    fecha_realizacion = models.DateField(blank=True, null=True)
    id_empleado = models.IntegerField(blank=True, null=True)
    id_moto = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'servicios'
        verbose_name = 'Servicio'
        verbose_name_plural = 'Servicios'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} - C${self.precio_mano_obra}"


class OrdenCompra(models.Model):
    """Modelo para órdenes de compra"""
    id_orden = models.AutoField(primary_key=True)
    id_proveedor = models.IntegerField()
    id_estado = models.IntegerField()
    fecha_creacion = models.DateField()

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'orden_compra'
        verbose_name = 'Orden de Compra'
        verbose_name_plural = 'Órdenes de Compra'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"Orden #{self.id_orden}"


class DetalleOrdenCompra(models.Model):
    """Modelo para detalles de órdenes de compra"""
    orden_compra = models.ForeignKey(
        OrdenCompra,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_compra'
    )
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'detalles_orden_compra'
        verbose_name = 'Detalle de Orden de Compra'
        verbose_name_plural = 'Detalles de Órdenes de Compra'

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.orden_compra.numero_orden} - {self.producto.nombre}"


class OrdenVenta(models.Model):
    """Modelo para órdenes de venta (tabla ventas)"""
    ESTADO_PAGO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('parcial', 'Pago Parcial'),
        ('pagado', 'Pagado'),
    ]

    id_venta = models.AutoField(primary_key=True)
    id_cliente = models.IntegerField()
    fecha = models.DateField()
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    saldo_pendiente = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    estado_pago = models.CharField(
        max_length=20, choices=ESTADO_PAGO_CHOICES, default='pendiente'
    )

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'ventas'
        verbose_name = 'Orden de Venta'
        verbose_name_plural = 'Órdenes de Venta'
        ordering = ['-fecha']

    def calcular_total(self):
        """Total real de la venta.

        Trampa #1: para ventas de PRODUCTOS el total se calcula sumando
        producto_venta (precio_unitario * cantidad). La columna ``ventas.total``
        solo es fiable cuando la venta no tiene productos (p. ej. servicios), por
        lo que se usa únicamente como respaldo. Esta es la MISMA fuente que usa
        ``OrdenVentaDetailSerializer.get_total`` para no descuadrar el saldo.
        """
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT SUM(pv.precio_unitario * pv.cantidad)
                FROM producto_venta pv
                WHERE pv.id_venta = %s
                """,
                [self.id_venta],
            )
            row = cursor.fetchone()
        total_productos = row[0] if row and row[0] else None
        if total_productos:
            return Decimal(str(total_productos))
        return Decimal(str(self.total or 0))

    def calcular_saldo(self):
        """Recalcula monto pagado, saldo pendiente y estado a partir de los pagos.

        Se reconstruye desde el agregado de ``pagos`` (no de forma incremental)
        para que registrar o eliminar un abono nunca deje descuadres.
        """
        pagado = self.pagos.aggregate(total=models.Sum('monto'))['total'] or Decimal('0')
        total = self.calcular_total()

        self.monto_pagado = pagado
        self.saldo_pendiente = total - pagado

        if pagado <= 0:
            self.estado_pago = 'pendiente'
        elif pagado >= total:
            self.estado_pago = 'pagado'
        else:
            self.estado_pago = 'parcial'

        self.save(update_fields=['monto_pagado', 'saldo_pendiente', 'estado_pago'])

    def __str__(self):
        return f"Venta #{self.id_venta}"


class PagoVenta(models.Model):
    """Pago/abono registrado contra una orden de venta (pago por adelantado)."""
    METODO_PAGO_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('tarjeta', 'Tarjeta'),
        ('transferencia', 'Transferencia'),
        ('deposito', 'Depósito'),
        ('cheque', 'Cheque'),
    ]

    id_pago = models.AutoField(primary_key=True)
    id_venta = models.ForeignKey(
        OrdenVenta,
        on_delete=models.CASCADE,
        related_name='pagos',
        db_column='id_venta',
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = models.DateField(default=date.today)
    metodo_pago = models.CharField(
        max_length=50, choices=METODO_PAGO_CHOICES, default='efectivo'
    )
    referencia = models.CharField(max_length=100, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False  # tabla creada por SQL_FILES/create_pagos_venta_table.sql
        db_table = 'pagos_venta'
        verbose_name = 'Pago de Venta'
        verbose_name_plural = 'Pagos de Ventas'
        ordering = ['-fecha_pago', '-created_at']

    def __str__(self):
        return f"Pago #{self.id_pago} - Venta #{self.id_venta_id} - C${self.monto}"


class DetalleOrdenVenta(models.Model):
    """Modelo para detalles de órdenes de venta"""
    orden_venta = models.ForeignKey(
        OrdenVenta,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_venta'
    )
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'detalles_orden_venta'
        verbose_name = 'Detalle de Orden de Venta'
        verbose_name_plural = 'Detalles de Órdenes de Venta'

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.orden_venta.numero_orden} - {self.producto.nombre}"


class MovimientoInventario(models.Model):
    """Modelo para movimientos de inventario"""
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
        ('AJUSTE', 'Ajuste'),
    ]
    
    TIPO_REFERENCIA_CHOICES = [
        ('ORDEN_COMPRA', 'Orden de Compra'),
        ('ORDEN_VENTA', 'Orden de Venta'),
        ('AJUSTE_MANUAL', 'Ajuste Manual'),
    ]
    
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='movimientos'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    cantidad = models.IntegerField()
    fecha = models.DateTimeField(auto_now_add=True)
    referencia = models.CharField(max_length=100, blank=True, null=True)
    tipo_referencia = models.CharField(max_length=20, choices=TIPO_REFERENCIA_CHOICES, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'movimientos_inventario'
        verbose_name = 'Movimiento de Inventario'
        verbose_name_plural = 'Movimientos de Inventario'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} - {self.cantidad}"


class BitacoraServicio(models.Model):
    """Modelo para bitácora de servicios de motos con imágenes en R2"""
    MODULO_CHOICES = [
        ('recepcion', 'Recepción'),
        ('diagnostico', 'Diagnóstico'),
        ('reparacion', 'Reparación'),
        ('entrega', 'Entrega'),
    ]
    
    id_bitacora = models.AutoField(primary_key=True)
    id_servicio = models.ForeignKey(
        ServicioMoto,
        on_delete=models.CASCADE,
        related_name='bitacoras',
        db_column='id_servicio'
    )
    id_moto = models.ForeignKey(
        Moto,
        on_delete=models.CASCADE,
        related_name='bitacoras',
        db_column='id_moto'
    )
    
    # Módulo de la bitácora
    modulo = models.CharField(max_length=50, choices=MODULO_CHOICES)
    
    # Información del registro
    fecha_registro = models.DateTimeField(auto_now_add=True)
    notas = models.TextField(blank=True, null=True)
    
    # Campos específicos por módulo
    # Recepción
    nivel_gasolina = models.CharField(max_length=50, blank=True, null=True)
    rayones_previos = models.TextField(blank=True, null=True)
    
    # Diagnóstico
    fallas_encontradas = models.TextField(blank=True, null=True)
    
    # Reparación
    trabajo_realizado = models.TextField(blank=True, null=True)
    tecnico_responsable = models.CharField(max_length=255, blank=True, null=True)
    
    # Entrega
    checklist_salida = models.TextField(blank=True, null=True)
    firma_cliente = models.CharField(max_length=255, blank=True, null=True)
    
    # Imágenes almacenadas en R2 (JSONB)
    imagenes = models.JSONField(default=list, blank=True)
    
    # Metadata
    creado_por = models.CharField(max_length=255, blank=True, null=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'bitacora_servicio'
        verbose_name = 'Bitácora de Servicio'
        verbose_name_plural = 'Bitácoras de Servicios'
        ordering = ['-fecha_registro']

    def __str__(self):
        return f"Bitácora {self.modulo} - Servicio #{self.id_servicio.id_servicio}"


class AuditoriaProducto(models.Model):
    """Modelo para auditoría de cambios en productos"""
    id_auditoria = models.AutoField(primary_key=True)
    id_producto = models.IntegerField()
    sku_producto = models.CharField(max_length=100, blank=True, null=True)
    nombre_producto = models.CharField(max_length=255, blank=True, null=True)
    
    # Operación realizada
    operacion = models.CharField(max_length=10)  # INSERT, UPDATE, DELETE
    
    # Datos anteriores
    cantidad_anterior = models.IntegerField(blank=True, null=True)
    precio_compra_anterior = models.IntegerField(blank=True, null=True)
    precio_final_anterior = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Datos nuevos
    cantidad_nueva = models.IntegerField(blank=True, null=True)
    precio_compra_nuevo = models.IntegerField(blank=True, null=True)
    precio_final_nuevo = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Cambios calculados
    diferencia_cantidad = models.IntegerField(blank=True, null=True)
    diferencia_precio_compra = models.IntegerField(blank=True, null=True)
    diferencia_precio_final = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Metadata
    fecha_cambio = models.DateTimeField(auto_now_add=True)
    usuario = models.CharField(max_length=255, blank=True, null=True)
    ip_address = models.CharField(max_length=50, blank=True, null=True)
    
    # Datos completos en JSON
    datos_anteriores = models.JSONField(blank=True, null=True)
    datos_nuevos = models.JSONField(blank=True, null=True)

    class Meta:
        managed = False  # No modificar tabla (manejada por trigger)
        db_table = 'auditoria_productos'
        verbose_name = 'Auditoría de Producto'
        verbose_name_plural = 'Auditorías de Productos'
        ordering = ['-fecha_cambio']

    def __str__(self):
        return f"{self.operacion} - {self.nombre_producto} ({self.fecha_cambio})"


class Garantia(models.Model):
    """Garantía generada automáticamente al registrar una venta"""
    ESTADO_CHOICES = [
        ('activa', 'Activa'),
        ('vencida', 'Vencida'),
        ('reclamada', 'Reclamada'),
    ]

    id_garantia = models.AutoField(primary_key=True)
    id_producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='garantias',
        db_column='id_producto',
        db_constraint=False,
    )
    id_venta = models.IntegerField()
    id_cliente = models.IntegerField()
    cantidad = models.IntegerField(default=1)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activa')
    notas = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'garantias'
        verbose_name = 'Garantía'
        verbose_name_plural = 'Garantías'
        ordering = ['-fecha_inicio']

    def __str__(self):
        return f"Garantía #{self.id_garantia} - {self.id_producto.nombre}"


class ReclamacionGarantia(models.Model):
    """Reclamación asociada a una garantía activa"""
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_proceso', 'En proceso'),
        ('resuelto', 'Resuelto'),
        ('rechazado', 'Rechazado'),
    ]

    id_reclamacion = models.AutoField(primary_key=True)
    garantia = models.ForeignKey(
        Garantia,
        on_delete=models.CASCADE,
        related_name='reclamaciones',
    )
    descripcion_problema = models.TextField()
    fecha_reclamacion = models.DateField(auto_now_add=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    resolucion = models.TextField(null=True, blank=True)
    fecha_resolucion = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'reclamaciones_garantia'
        verbose_name = 'Reclamación de Garantía'
        verbose_name_plural = 'Reclamaciones de Garantía'
        ordering = ['-fecha_reclamacion']

    def __str__(self):
        return f"Reclamación #{self.id_reclamacion} - Garantía #{self.garantia_id}"


class Cotizacion(models.Model):
    """Cotización / proforma (tabla cotizaciones). No afecta inventario."""
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
        ('convertida', 'Convertida en venta'),
    ]

    id_cotizacion = models.AutoField(primary_key=True)
    id_cliente = models.IntegerField()
    fecha = models.DateField(default=date.today)
    validez_dias = models.IntegerField(default=15)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    id_venta = models.IntegerField(null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False  # tabla creada por SQL_FILES/create_cotizaciones_devoluciones_tables.sql
        db_table = 'cotizaciones'
        verbose_name = 'Cotización'
        verbose_name_plural = 'Cotizaciones'
        ordering = ['-fecha', '-id_cotizacion']

    def __str__(self):
        return f"Cotización #{self.id_cotizacion}"


class Devolucion(models.Model):
    """Devolución / nota de crédito (tabla devoluciones). Reingresa stock."""
    ESTADO_CHOICES = [
        ('procesada', 'Procesada'),
        ('anulada', 'Anulada'),
    ]

    id_devolucion = models.AutoField(primary_key=True)
    id_venta = models.IntegerField(null=True, blank=True)
    id_cliente = models.IntegerField(null=True, blank=True)
    fecha = models.DateField(default=date.today)
    motivo = models.TextField(null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='procesada')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False  # tabla creada por SQL_FILES/create_cotizaciones_devoluciones_tables.sql
        db_table = 'devoluciones'
        verbose_name = 'Devolución'
        verbose_name_plural = 'Devoluciones'
        ordering = ['-fecha', '-id_devolucion']

    def __str__(self):
        return f"Devolución #{self.id_devolucion}"

