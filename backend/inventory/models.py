"""
Modelos Django para Inventrix
Basados en el Modelo Relacional establecido
"""
from django.db import models


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
    id_producto = models.AutoField(primary_key=True)
    sku_producto = models.CharField(max_length=100)
    nombre = models.CharField(max_length=255)
    cantidad_actual = models.IntegerField(default=0)
    cantidad_total = models.IntegerField(default=0)
    cantidad_minima = models.IntegerField(default=0)
    precio_compra_unitario = models.IntegerField()
    precio_final = models.DecimalField(max_digits=10, decimal_places=2)

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
    id_venta = models.AutoField(primary_key=True)
    id_cliente = models.IntegerField()
    fecha = models.DateField()
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed = False  # No modificar tabla existente
        db_table = 'ventas'
        verbose_name = 'Orden de Venta'
        verbose_name_plural = 'Órdenes de Venta'
        ordering = ['-fecha']

    def __str__(self):
        return f"Venta #{self.id_venta}"


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
