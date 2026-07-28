"""
Modelos Django para Inventrix
Basados en el Modelo Relacional establecido
"""
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.db import connection, models
from django.db.models import Q, Sum

from .encryption import EncryptedCharField, EncryptedEmailField


class Proveedor(models.Model):
    """Modelo para proveedores"""
    id_proveedor = models.AutoField(primary_key=True)
    nombre_empresa = models.CharField(max_length=255)
    persona_contacto = models.CharField(max_length=255, blank=True, null=True)
    telefono = EncryptedCharField(max_length=50, blank=True, null=True)
    email = EncryptedEmailField(max_length=255, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    # Cuántos días tarda habitualmente en entregar. Lo usa el pronóstico de
    # demanda para saber con cuánta antelación recomprar: sin plazo solo se
    # puede decir "te quedan N días", no "pedí hoy".
    #
    # Es una estimación a mano porque el plazo medido sale de `fecha_recepcion`,
    # que existe desde 1.7.0 pero todavía sin historial. Cuando haya recepciones
    # reales el pronóstico prefiere el promedio medido y este campo pasa a ser
    # el respaldo.
    dias_entrega_estimado = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Días que suele tardar en entregar. Vacío = se usa el valor '
                  'por defecto del sistema.')

    class Meta:
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


class Ubicacion(models.Model):
    """Lugar físico donde se guarda un producto: bodega, pasillo, estante y
    gaveta.

    Una fila es un lugar concreto, no un nivel de jerarquía. Se eligió una sola
    tabla en vez de cuatro catálogos anidados a propósito: `marcas` y
    `categorias` se construyeron con todo su CRUD y quedaron en cero filas, sin
    llegar siquiera a vincularse a `productos`. Con 75 productos, cuatro
    pantallas de mantenimiento serían el mismo camino.
    """
    id_ubicacion = models.AutoField(primary_key=True)
    # Hoy hay una sola bodega, pero se planean más; el default evita que sea
    # fricción al dar de alta lugares mientras siga habiendo una.
    bodega = models.CharField(max_length=100, default='Principal')
    pasillo = models.CharField(max_length=50, blank=True, null=True)
    estante = models.CharField(max_length=50, blank=True, null=True)
    gaveta = models.CharField(max_length=50, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'ubicacion'
        verbose_name = 'Ubicación'
        verbose_name_plural = 'Ubicaciones'
        ordering = ['bodega', 'pasillo', 'estante', 'gaveta']
        constraints = [
            # Sin esto se acumulan lugares repetidos, que es justo como
            # empiezan a ensuciarse los catálogos.
            #
            # `nulls_distinct=False` es imprescindible: por defecto Postgres
            # considera cada NULL distinto de los demás, así que dos lugares con
            # los niveles opcionales vacíos ("Principal" sin pasillo ni estante)
            # pasarían el constraint sin problema. Verificado insertando el
            # duplicado a mano.
            models.UniqueConstraint(
                fields=['bodega', 'pasillo', 'estante', 'gaveta'],
                name='ubicacion_unica',
                nulls_distinct=False,
            ),
        ]

    @property
    def codigo(self):
        """Etiqueta corta para mostrar, saltando los niveles vacíos."""
        partes = [self.bodega]
        for prefijo, valor in (('P', self.pasillo), ('E', self.estante), ('G', self.gaveta)):
            if valor:
                partes.append(f'{prefijo}{valor}')
        return ' · '.join(partes)

    def __str__(self):
        return self.codigo


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
    # Dónde está guardado. SET_NULL: borrar un lugar no puede borrar productos.
    id_ubicacion = models.ForeignKey(
        Ubicacion,
        on_delete=models.SET_NULL,
        db_column='id_ubicacion',
        related_name='productos',
        null=True, blank=True,
    )

    class Meta:
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
    telefono = EncryptedCharField(max_length=50, blank=True, null=True)
    email = EncryptedEmailField(max_length=255, blank=True, null=True)

    class Meta:
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
        db_table = 'motos'
        verbose_name = 'Moto'
        verbose_name_plural = 'Motos'
        ordering = ['marca', 'modelo']

    def __str__(self):
        return f"{self.marca} {self.modelo} ({self.placa})"


class ServicioMoto(models.Model):
    """Orden de trabajo del taller: una moto que entra, avanza por estados y
    sale facturada.

    Antes esta tabla solo registraba trabajo ya terminado. Ahora lleva el ciclo
    de vida completo (`estado`), la cita, el mecánico asignado y la venta que
    generó al entregarse.
    """
    ESTADO_CHOICES = [
        ('agendada', 'Agendada'),
        ('recibida', 'Recibida'),
        ('en_diagnostico', 'En diagnóstico'),
        ('en_reparacion', 'En reparación'),
        ('esperando_repuesto', 'Esperando repuesto'),
        ('lista', 'Lista para entrega'),
        ('entregada', 'Entregada'),
        ('cancelada', 'Cancelada'),
    ]

    # Transiciones permitidas. 'entregada' y 'cancelada' son terminales.
    TRANSICIONES = {
        'agendada': ['recibida', 'cancelada'],
        'recibida': ['en_diagnostico', 'en_reparacion', 'cancelada'],
        'en_diagnostico': ['en_reparacion', 'esperando_repuesto', 'lista', 'cancelada'],
        'en_reparacion': ['esperando_repuesto', 'lista', 'cancelada'],
        'esperando_repuesto': ['en_reparacion', 'cancelada'],
        # Se permite volver a reparación si al revisar la entrega algo falla.
        'lista': ['entregada', 'en_reparacion', 'cancelada'],
        'entregada': [],
        'cancelada': [],
    }

    # Estados que dejan constancia en la bitácora (bitacora_servicio.modulo).
    MODULO_POR_ESTADO = {
        'recibida': 'recepcion',
        'en_diagnostico': 'diagnostico',
        'en_reparacion': 'reparacion',
        'entregada': 'entrega',
    }

    id_servicio = models.AutoField(primary_key=True)
    id_moto = models.ForeignKey(
        Moto,
        on_delete=models.CASCADE,
        related_name='servicios',
        db_column='id_moto'
    )
    # Fecha de ingreso de la moto al taller (histórico: fecha del trabajo).
    fecha_servicio = models.DateField()
    tipo_servicio = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    # Total de la orden. Derivado por calcular_total(); NOT NULL por el esquema
    # existente, así que se siembra en 0 al agendar.
    costo = models.DecimalField(max_digits=10, decimal_places=2)

    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='agendada')
    fecha_cita = models.DateTimeField(null=True, blank=True)
    fecha_entrega = models.DateTimeField(null=True, blank=True)

    id_mecanico = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='servicios_asignados',
        db_column='id_mecanico',
        null=True, blank=True,
    )
    # Solo debe apuntar a filas de catálogo (Servicio.es_plantilla=True).
    id_tipo_servicio = models.ForeignKey(
        'Servicio',
        on_delete=models.SET_NULL,
        related_name='ordenes_trabajo',
        db_column='id_tipo_servicio',
        null=True, blank=True,
    )
    # Precio de mano de obra congelado al agendar: si el catálogo sube de
    # precio, las órdenes viejas no deben cambiar de total.
    precio_mano_obra = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # La venta generada al entregar. Reemplaza el cruce por fecha+costo+cliente.
    id_venta = models.ForeignKey(
        'OrdenVenta',
        on_delete=models.SET_NULL,
        related_name='ordenes_taller',
        db_column='id_venta',
        null=True, blank=True,
    )

    # Mantenimiento preventivo.
    km_actual = models.IntegerField(null=True, blank=True)
    proximo_mantenimiento_fecha = models.DateField(null=True, blank=True)
    proximo_mantenimiento_km = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'servicio_motos'
        verbose_name = 'Servicio de Moto'
        verbose_name_plural = 'Servicios de Motos'
        ordering = ['-fecha_servicio']

    def total_repuestos(self):
        return self.repuestos.aggregate(
            t=Sum(models.F('cantidad') * models.F('precio_unitario'),
                  output_field=models.DecimalField(max_digits=12, decimal_places=2))
        )['t'] or Decimal('0')

    def calcular_total(self, guardar=True):
        """Total de la orden = mano de obra + repuestos consumidos."""
        total = (self.precio_mano_obra or Decimal('0')) + self.total_repuestos()
        self.costo = total
        if guardar:
            self.save(update_fields=['costo'])
        return total

    def puede_pasar_a(self, nuevo_estado):
        return nuevo_estado in self.TRANSICIONES.get(self.estado, [])

    def presupuesto_vigente(self):
        """Último presupuesto de la orden (el que manda si hay varios).

        Se ordena en Python y no con `order_by()` para poder aprovechar el
        `prefetch_related('presupuestos')` del listado: con order_by, Django
        descarta la caché del prefetch y lanza una consulta por orden (N+1).
        """
        return max(self.presupuestos.all(),
                   key=lambda p: p.id_cotizacion, default=None)

    def reparacion_autorizada(self):
        """Si hay presupuesto, el cliente tiene que haberlo aprobado.

        Sin presupuesto se permite reparar: un trabajo chico no necesita uno, y
        así el flujo que ya existía sigue funcionando.
        """
        presupuesto = self.presupuesto_vigente()
        if presupuesto is None:
            return True
        return presupuesto.estado in ('aprobada', 'convertida')

    def __str__(self):
        return f"{self.tipo_servicio} - {self.id_moto}"


class Servicio(models.Model):
    """Catálogo de tipos de servicio con su precio de mano de obra.

    Ojo con el histórico: esta tabla nació como registro de trabajos
    realizados (cada fila con su `id_moto` y `fecha_realizacion`), y 98 ventas
    apuntan a esas filas vía `ventas.id_servicio`, así que no se pueden borrar.
    `es_plantilla` separa las dos poblaciones: True = fila de catálogo
    (seleccionable al agendar), False = registro histórico intocable.
    """
    id_servicio = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=255)
    precio_mano_obra = models.DecimalField(max_digits=10, decimal_places=2)
    diagnostico = models.TextField(blank=True, null=True)
    # Columnas que solo tienen sentido en las filas históricas.
    fecha_realizacion = models.DateField(blank=True, null=True)
    id_empleado = models.IntegerField(blank=True, null=True)
    id_moto = models.IntegerField(blank=True, null=True)
    es_plantilla = models.BooleanField(default=False)

    class Meta:
        db_table = 'servicios'
        verbose_name = 'Servicio'
        verbose_name_plural = 'Servicios'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} - C${self.precio_mano_obra}"


class OrdenCompra(models.Model):
    """Modelo para órdenes de compra"""
    ESTADO_PAGO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('parcial', 'Pago Parcial'),
        ('pagado', 'Pagado'),
    ]

    # Estados del catálogo `estado`: 1 = cancelada, 2 = pendiente, 3 = recibida.
    ESTADO_CANCELADA = 1
    ESTADO_PENDIENTE = 2
    ESTADO_RECIBIDA = 3

    id_orden = models.AutoField(primary_key=True)
    id_proveedor = models.IntegerField()
    id_estado = models.IntegerField()
    fecha_creacion = models.DateField()
    # Cuentas por pagar (espejo de OrdenVenta): lo que se le debe al proveedor.
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    saldo_pendiente = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    estado_pago = models.CharField(
        max_length=20, choices=ESTADO_PAGO_CHOICES, default='pendiente'
    )
    # Guarda de idempotencia de la recepción: recibir dos veces no puede sumar
    # el stock dos veces. Las órdenes históricas quedan en False porque su stock
    # nunca se aplicó (recibir solo cambiaba el estado), y eso es la verdad.
    #
    # `db_default` además del default de Python: esta tabla se inserta con SQL
    # crudo en `OrdenCompraCreateSerializer`, y los defaults de Django no
    # aplican ahí. Sin el default en la base, crear una compra reventaría por
    # violación de NOT NULL (ya pasó al agregar monto_pagado y estado_pago).
    stock_aplicado = models.BooleanField(default=False, db_default=False)

    # Cuándo llegó la mercadería. Sin esta fecha no se puede medir cuánto tarda
    # un proveedor en entregar, que es la métrica central de su desempeño.
    fecha_recepcion = models.DateTimeField(null=True, blank=True)
    # Fecha que prometió el proveedor. Opcional: sin ella se mide la velocidad
    # (cuántos días tardó), con ella también la puntualidad (si cumplió).
    fecha_esperada = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'orden_compra'
        verbose_name = 'Orden de Compra'
        verbose_name_plural = 'Órdenes de Compra'
        ordering = ['-fecha_creacion']

    def _fecha_recepcion_local(self):
        """Fecha de recepción en la zona del negocio.

        `fecha_recepcion` se guarda con zona (UTC) y `fecha_creacion` es una fecha
        local. Convertir con `.date()` directo toma el día UTC: una recepción de
        las 7 de la noche cae al día siguiente y el proveedor aparece un día más
        lento de lo que fue.
        """
        from django.utils import timezone
        if not self.fecha_recepcion:
            return None
        return timezone.localtime(self.fecha_recepcion).date()

    def dias_entrega(self):
        """Días que tardó el proveedor en entregar. None si no se recibió aún."""
        recibido = self._fecha_recepcion_local()
        if not recibido or not self.fecha_creacion:
            return None
        return (recibido - self.fecha_creacion).days

    def entregado_a_tiempo(self):
        """None si no hay fecha prometida: no se puede juzgar puntualidad sin
        una promesa contra la cual comparar."""
        recibido = self._fecha_recepcion_local()
        if not recibido or not self.fecha_esperada:
            return None
        return recibido <= self.fecha_esperada

    def lineas_recepcion(self):
        """Líneas con cantidad usable para sumar al inventario.

        Las órdenes creadas antes de que `orden_producto` tuviera columna de
        cantidad (migración 0015) devuelven lista vacía: no se puede saber
        cuánto stock sumar.
        """
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id_producto, cantidad
                FROM orden_producto
                WHERE id_orden = %s AND cantidad IS NOT NULL AND cantidad > 0
            """, [self.id_orden])
            return cursor.fetchall()

    def calcular_total(self):
        """Total de la compra = Σ(cantidad * precio_unitario) de sus líneas.
        Las líneas viven en orden_producto (sin modelo Django). Órdenes
        históricas sin cantidad/precio dan 0 (el dato nunca se guardó)."""
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT SUM(cantidad * precio_unitario)
                FROM orden_producto
                WHERE id_orden = %s
                """,
                [self.id_orden],
            )
            row = cursor.fetchone()
        return Decimal(str(row[0])) if row and row[0] else Decimal('0')

    def total_devuelto(self):
        """Valor de la mercadería devuelta al proveedor."""
        return self.devoluciones.aggregate(t=models.Sum('total'))['t'] or Decimal('0')

    def total_reembolsado(self):
        """Dinero que el proveedor ya devolvió por esa mercadería."""
        return self.devoluciones.aggregate(t=models.Sum('reembolso'))['t'] or Decimal('0')

    def calcular_saldo(self):
        """Recalcula monto pagado, saldo y estado.

        saldo = comprado − devuelto − pagado + reembolsado

        Las devoluciones se restan porque no se puede seguir debiendo mercadería
        que se mandó de vuelta (sin esto, devolver dejaba la deuda intacta en
        cuentas por pagar). Los reembolsos se suman de nuevo: si el proveedor ya
        devolvió el dinero, esa parte deja de ser un saldo a favor.

        Un saldo negativo significa que el proveedor debe, no que se le deba.
        """
        pagado = self.pagos.aggregate(total=models.Sum('monto'))['total'] or Decimal('0')
        total = self.calcular_total()
        devuelto = self.total_devuelto()
        reembolsado = self.total_reembolsado()

        neto = total - devuelto          # lo que realmente se quedó el negocio
        self.monto_pagado = pagado
        self.saldo_pendiente = neto - pagado + reembolsado

        if self.saldo_pendiente <= 0:
            # Incluye el caso de saldo a favor: no hay nada pendiente de pagar.
            self.estado_pago = 'pagado'
        elif pagado <= 0:
            self.estado_pago = 'pendiente'
        else:
            self.estado_pago = 'parcial'

        self.save(update_fields=['monto_pagado', 'saldo_pendiente', 'estado_pago'])

    def saldo_a_favor(self):
        """Cuánto debe el proveedor por mercadería devuelta y no reembolsada."""
        saldo = self.saldo_pendiente or Decimal('0')
        return -saldo if saldo < 0 else Decimal('0')

    def __str__(self):
        return f"Orden #{self.id_orden}"


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
        db_table = 'ventas'
        verbose_name = 'Orden de Venta'
        verbose_name_plural = 'Órdenes de Venta'
        ordering = ['-fecha']

    def calcular_total(self):
        """Total real de la venta: productos vendidos + mano de obra del taller.

        Trampa #1: para ventas de PRODUCTOS el total se calcula sumando
        producto_venta (precio_unitario * cantidad). La columna ``ventas.total``
        solo es fiable cuando la venta no tiene líneas propias, por lo que se usa
        únicamente como respaldo. Esta es la MISMA fuente que usa
        ``OrdenVentaDetailSerializer.get_total`` para no descuadrar el saldo.

        Trampa #2: una venta de taller lleva las dos cosas. Los repuestos van en
        producto_venta, pero la mano de obra NO puede ir ahí (esa tabla exige un
        id_producto real), así que se suma desde la orden de trabajo ligada. Sin
        esto la mano de obra desaparecía del saldo: una venta de C$250 (C$150 de
        trabajo + C$100 de piezas) se daba por pagada al abonar C$100.
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
            total_productos = Decimal(str(row[0])) if row and row[0] else Decimal('0')

            # Mano de obra de las órdenes de trabajo que generaron esta venta.
            cursor.execute(
                """
                SELECT SUM(sm.precio_mano_obra)
                FROM servicio_motos sm
                WHERE sm.id_venta = %s
                """,
                [self.id_venta],
            )
            row = cursor.fetchone()
            total_mano_obra = Decimal(str(row[0])) if row and row[0] else Decimal('0')

        calculado = total_productos + total_mano_obra
        if calculado:
            return calculado
        return Decimal(str(self.total or 0))

    def total_devuelto(self):
        """Valor de la mercadería que el cliente devolvió de esta venta.

        Se filtra por estado: una devolución anulada no reduce nada. Y se
        consulta por `id_venta` en vez de una relación inversa porque
        `Devolucion.id_venta` es un entero suelto, sin llave foránea real.
        """
        from django.apps import apps
        Devolucion = apps.get_model('inventory', 'Devolucion')
        return Devolucion.objects.filter(
            id_venta=self.id_venta, estado='procesada'
        ).aggregate(t=models.Sum('total'))['t'] or Decimal('0')

    def calcular_saldo(self):
        """Recalcula monto pagado, saldo pendiente y estado.

        saldo = vendido − devuelto − pagado

        Se reconstruye desde el agregado de ``pagos`` (no de forma incremental)
        para que registrar o eliminar un abono nunca deje descuadres.

        Las devoluciones se restan porque no se le puede seguir cobrando al
        cliente mercadería que devolvió. Sin este término, una venta a crédito de
        C$5.000 con C$2.000 devueltos seguía apareciendo como C$5.000 de deuda en
        cuentas por cobrar, y el sistema le exigía pagar todo. Es el mismo
        arreglo que ya tenía `OrdenCompra.calcular_saldo` del lado de compras:
        acá faltaba el espejo.

        Un saldo negativo es saldo a favor del cliente: le pagó al negocio más de
        lo que se quedó. Ver `saldo_a_favor`.
        """
        pagado = self.pagos.aggregate(total=models.Sum('monto'))['total'] or Decimal('0')
        total = self.calcular_total()
        devuelto = self.total_devuelto()

        neto = total - devuelto          # lo que el cliente efectivamente se quedó
        self.monto_pagado = pagado
        self.saldo_pendiente = neto - pagado

        if self.saldo_pendiente <= 0:
            # Incluye el saldo a favor: no hay nada pendiente de cobrar.
            self.estado_pago = 'pagado'
        elif pagado <= 0:
            self.estado_pago = 'pendiente'
        else:
            self.estado_pago = 'parcial'

        self.save(update_fields=['monto_pagado', 'saldo_pendiente', 'estado_pago'])

    def saldo_a_favor(self):
        """Cuánto le debe el negocio al cliente por mercadería devuelta.

        Aparece cuando la venta estaba pagada y después hubo una devolución. El
        sistema no descuenta ese crédito automáticamente en una venta futura,
        pero al menos deja de fingir que el cliente sigue debiendo.
        """
        saldo = self.saldo_pendiente or Decimal('0')
        return -saldo if saldo < 0 else Decimal('0')

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
    # Sesión de caja en la que se cobró este pago. Nullable: pagos históricos
    # (previos a la feature de caja) y no se puede exigir retroactivamente.
    sesion = models.ForeignKey(
        'SesionCaja',
        on_delete=models.PROTECT,
        related_name='pagos',
        db_column='id_sesion',
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'pagos_venta'
        verbose_name = 'Pago de Venta'
        verbose_name_plural = 'Pagos de Ventas'
        ordering = ['-fecha_pago', '-created_at']

    def __str__(self):
        return f"Pago #{self.id_pago} - Venta #{self.id_venta_id} - C${self.monto}"


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
        ('SERVICIO_TALLER', 'Servicio de Taller'),
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
        db_table = 'movimientos_inventario'
        verbose_name = 'Movimiento de Inventario'
        verbose_name_plural = 'Movimientos de Inventario'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} - {self.cantidad}"


class ServicioRepuesto(models.Model):
    """Repuesto consumido por una orden de trabajo del taller.

    Es el enlace que faltaba entre taller e inventario: antes los repuestos que
    el mecánico usaba no descontaban stock en ninguna parte.
    """
    id_servicio_repuesto = models.AutoField(primary_key=True)
    id_servicio = models.ForeignKey(
        ServicioMoto,
        on_delete=models.CASCADE,
        related_name='repuestos',
        db_column='id_servicio',
    )
    id_producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='usos_en_taller',
        db_column='id_producto',
    )
    cantidad = models.IntegerField()
    # Precio congelado al momento de consumirlo.
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'servicio_repuesto'
        verbose_name = 'Repuesto de Servicio'
        verbose_name_plural = 'Repuestos de Servicios'
        ordering = ['id_servicio_repuesto']

    def subtotal(self):
        return (self.cantidad or 0) * (self.precio_unitario or Decimal('0'))

    def __str__(self):
        return f"{self.cantidad} x {self.id_producto} (servicio #{self.id_servicio_id})"


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
    """Cotización de productos (proforma) o presupuesto de reparación.

    Las dos cosas comparten documento, estados y PDF; `tipo` las distingue.
    Un presupuesto de reparación nace de una orden de trabajo del taller y su
    aprobación es lo que autoriza empezar a reparar. No afecta inventario: el
    stock se mueve cuando el presupuesto se aprueba y se carga a la orden.
    """
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
        ('convertida', 'Convertida en venta'),
    ]

    TIPO_CHOICES = [
        ('producto', 'Proforma de productos'),
        ('reparacion', 'Presupuesto de reparación'),
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

    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='producto')
    # Solo para tipo='reparacion'.
    id_moto = models.ForeignKey(
        'Moto', on_delete=models.SET_NULL, db_column='id_moto',
        related_name='presupuestos', null=True, blank=True,
    )
    id_servicio = models.ForeignKey(
        'ServicioMoto', on_delete=models.CASCADE, db_column='id_servicio',
        related_name='presupuestos', null=True, blank=True,
    )
    # Las fallas encontradas: es lo que justifica el precio ante el cliente.
    diagnostico = models.TextField(null=True, blank=True)
    fecha_aprobacion = models.DateTimeField(null=True, blank=True)
    aprobado_por = models.CharField(max_length=255, null=True, blank=True)
    # Guarda de idempotencia: sin esto, aprobar dos veces duplicaría los
    # repuestos en la orden y descontaría el stock otra vez.
    cargado_a_orden = models.BooleanField(default=False)

    class Meta:
        db_table = 'cotizaciones'
        verbose_name = 'Cotización'
        verbose_name_plural = 'Cotizaciones'
        ordering = ['-fecha', '-id_cotizacion']

    def total_mano_obra(self):
        return self.servicios.aggregate(
            t=Sum(models.F('cantidad') * models.F('precio_unitario'),
                  output_field=models.DecimalField(max_digits=12, decimal_places=2))
        )['t'] or Decimal('0')

    def total_repuestos(self):
        """Líneas de producto. Viven en `producto_cotizacion`, que no tiene
        modelo Django (ni primary key), así que se consulta por SQL crudo."""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
                FROM producto_cotizacion WHERE id_cotizacion = %s
            """, [self.id_cotizacion])
            return cursor.fetchone()[0] or Decimal('0')

    def calcular_total(self, guardar=True):
        total = self.total_mano_obra() + self.total_repuestos()
        self.total = total
        if guardar:
            self.save(update_fields=['total'])
        return total

    def esta_vencido(self):
        if not self.fecha or not self.validez_dias:
            return False
        from datetime import timedelta
        return date.today() > self.fecha + timedelta(days=self.validez_dias)

    def __str__(self):
        if self.tipo == 'reparacion':
            return f"Presupuesto #{self.id_cotizacion}"
        return f"Cotización #{self.id_cotizacion}"


class ServicioCotizacion(models.Model):
    """Línea de mano de obra de un presupuesto.

    Espejo de `producto_cotizacion` (las líneas de repuestos) pero con primary
    key propia: esa tabla no tiene ninguna, lo que hace imposible referenciar o
    borrar una línea concreta.

    Apunta al catálogo de servicios en vez de a texto libre, para que el PDF
    muestre el desglose real y no se repita la deriva de nombres que ya pasó con
    `servicio_motos.tipo_servicio`.
    """
    id_servicio_cotizacion = models.AutoField(primary_key=True)
    id_cotizacion = models.ForeignKey(
        Cotizacion, on_delete=models.CASCADE, db_column='id_cotizacion',
        related_name='servicios',
    )
    id_servicio = models.ForeignKey(
        'Servicio', on_delete=models.PROTECT, db_column='id_servicio',
        related_name='lineas_presupuesto',
    )
    cantidad = models.IntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'servicio_cotizacion'
        verbose_name = 'Mano de obra presupuestada'
        verbose_name_plural = 'Mano de obra presupuestada'
        ordering = ['id_servicio_cotizacion']

    def subtotal(self):
        return (self.cantidad or 0) * (self.precio_unitario or Decimal('0'))

    def __str__(self):
        return f"{self.cantidad} x {self.id_servicio} (presupuesto #{self.id_cotizacion_id})"


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
        db_table = 'devoluciones'
        verbose_name = 'Devolución'
        verbose_name_plural = 'Devoluciones'
        ordering = ['-fecha', '-id_devolucion']

    def __str__(self):
        return f"Devolución #{self.id_devolucion}"


class DevolucionCompra(models.Model):
    """Mercadería que se le devuelve a un proveedor. Saca stock.

    Es el espejo de `Devolucion` (la del cliente), pero en tabla aparte a
    propósito: las dos mueven el inventario en direcciones opuestas, y en una
    sola tabla cualquier consulta que olvide filtrar por tipo sumaría entradas
    con salidas de stock sin que nadie lo note.

    Siempre nace de una orden de compra recibida: sin eso no hay contra qué
    validar cantidades ni de qué deuda descontar.
    """
    METODO_REEMBOLSO_CHOICES = [
        ('credito', 'Nota de crédito'),
        ('efectivo', 'Efectivo'),
        ('transferencia', 'Transferencia'),
        ('deposito', 'Depósito'),
        ('cheque', 'Cheque'),
    ]

    id_devolucion_compra = models.AutoField(primary_key=True)
    id_orden = models.ForeignKey(
        OrdenCompra,
        on_delete=models.PROTECT,      # una compra con devoluciones no se borra
        db_column='id_orden',
        related_name='devoluciones',
    )
    id_proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        db_column='id_proveedor',
        related_name='devoluciones_recibidas',
    )
    fecha = models.DateField(default=date.today)
    motivo = models.TextField(null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Dinero que el proveedor devolvió en el momento. Si es 0, lo devuelto queda
    # como saldo a favor contra la compra.
    reembolso = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    metodo_reembolso = models.CharField(
        max_length=20, choices=METODO_REEMBOLSO_CHOICES, default='credito')
    # Solo el efectivo toca el cajón.
    sesion = models.ForeignKey(
        'SesionCaja',
        on_delete=models.PROTECT,
        db_column='id_sesion',
        related_name='reembolsos',
        null=True, blank=True,
    )

    creado_por = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'devolucion_compra'
        verbose_name = 'Devolución a proveedor'
        verbose_name_plural = 'Devoluciones a proveedores'
        ordering = ['-fecha', '-id_devolucion_compra']

    def __str__(self):
        return f"Devolución a proveedor #{self.id_devolucion_compra}"


class ProductoDevolucionCompra(models.Model):
    """Línea de una devolución a proveedor.

    Con primary key propia, a diferencia de `producto_devolucion` y
    `producto_cotizacion` del esquema legado, que no la tienen y por eso no
    permiten referenciar ni borrar una línea concreta.
    """
    id_producto_devolucion_compra = models.AutoField(primary_key=True)
    id_devolucion_compra = models.ForeignKey(
        DevolucionCompra,
        on_delete=models.CASCADE,
        db_column='id_devolucion_compra',
        related_name='detalles',
    )
    id_producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        db_column='id_producto',
        related_name='devoluciones_a_proveedor',
    )
    cantidad = models.IntegerField()
    # Congelado: el precio al que se compró, no el actual.
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'producto_devolucion_compra'
        verbose_name = 'Línea de devolución a proveedor'
        verbose_name_plural = 'Líneas de devolución a proveedor'
        ordering = ['id_producto_devolucion_compra']

    def subtotal(self):
        return (self.cantidad or 0) * (self.precio_unitario or Decimal('0'))

    def __str__(self):
        return f"{self.cantidad} x {self.id_producto}"


class SesionCaja(models.Model):
    """Turno de caja: se abre con un fondo inicial y se cierra cuadrando el
    efectivo físico contado contra lo que el sistema calculó."""
    ESTADO_CHOICES = [
        ('abierta', 'Abierta'),
        ('cerrada', 'Cerrada'),
    ]

    id_sesion = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='sesiones_caja',
    )
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    monto_apertura = models.DecimalField(max_digits=10, decimal_places=2)

    fecha_cierre = models.DateTimeField(null=True, blank=True)
    # Efectivo físico contado por el operador al cerrar.
    monto_cierre_contado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # Efectivo que el sistema esperaba (calcular_esperado congelado al cerrar).
    monto_esperado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # contado - esperado: negativo = faltante, positivo = sobrante.
    diferencia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='abierta')
    notas = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'sesion_caja'
        verbose_name = 'Sesión de Caja'
        verbose_name_plural = 'Sesiones de Caja'
        ordering = ['-fecha_apertura']
        constraints = [
            # Solo puede existir UNA sesión abierta en todo el sistema.
            models.UniqueConstraint(
                fields=['estado'],
                condition=Q(estado='abierta'),
                name='una_sola_caja_abierta',
            ),
        ]

    def calcular_esperado(self):
        """Efectivo que debería haber en el cajón ahora mismo:
        fondo + ventas efectivo + ingresos manuales + reembolsos de proveedores
        - retiros manuales - gastos operativos en efectivo - pagos a proveedores.
        Solo el efectivo cuenta (tarjeta/transferencia no tocan el cajón)."""
        pagos_efectivo = self.pagos.filter(metodo_pago='efectivo').aggregate(
            t=Sum('monto'))['t'] or Decimal('0')
        ingresos = self.movimientos.filter(tipo='ingreso').aggregate(
            t=Sum('monto'))['t'] or Decimal('0')
        retiros = self.movimientos.filter(tipo='retiro').aggregate(
            t=Sum('monto'))['t'] or Decimal('0')
        gastos_efectivo = self.gastos_caja.filter(metodo_pago='efectivo').aggregate(
            t=Sum('monto'))['t'] or Decimal('0')
        pagos_compra_efectivo = self.pagos_compra.filter(metodo_pago='efectivo').aggregate(
            t=Sum('monto'))['t'] or Decimal('0')
        # Plata que entra: el proveedor devolvió el dinero de lo que se le
        # devolvió. Es el único movimiento con proveedores que suma al cajón.
        reembolsos_efectivo = self.reembolsos.filter(
            metodo_reembolso='efectivo').aggregate(t=Sum('reembolso'))['t'] or Decimal('0')
        return (self.monto_apertura + pagos_efectivo + ingresos + reembolsos_efectivo
                - retiros - gastos_efectivo - pagos_compra_efectivo)

    def __str__(self):
        return f"Caja #{self.id_sesion} ({self.estado}) - {self.usuario}"


class MovimientoCaja(models.Model):
    """Entrada/salida de efectivo del cajón que NO es una venta: retiro para
    depósito bancario, ingreso de cambio, o devolución en efectivo."""
    TIPO_CHOICES = [
        ('ingreso', 'Ingreso'),
        ('retiro', 'Retiro'),
    ]

    id_movimiento = models.AutoField(primary_key=True)
    sesion = models.ForeignKey(
        SesionCaja,
        on_delete=models.CASCADE,
        related_name='movimientos',
        db_column='id_sesion',
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    motivo = models.CharField(max_length=255)
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='movimientos_caja',
    )

    class Meta:
        db_table = 'movimiento_caja'
        verbose_name = 'Movimiento de Caja'
        verbose_name_plural = 'Movimientos de Caja'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.tipo} C${self.monto} - Caja #{self.sesion_id}"



class CategoriaGasto(models.Model):
    """Categoría de gasto operativo (alquiler, servicios, salarios, etc.).
    Catálogo editable por el administrador."""
    id_categoria = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categoria_gasto'
        verbose_name = 'Categoría de Gasto'
        verbose_name_plural = 'Categorías de Gasto'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Gasto(models.Model):
    """Gasto operativo: costo de operar el negocio (NO mercadería para
    revender, eso son las órdenes de compra). Un gasto en efectivo sale del
    cajón de la caja abierta (ver SesionCaja.calcular_esperado)."""
    METODO_PAGO_CHOICES = PagoVenta.METODO_PAGO_CHOICES

    id_gasto = models.AutoField(primary_key=True)
    fecha = models.DateField(default=date.today)
    categoria = models.ForeignKey(
        CategoriaGasto,
        on_delete=models.PROTECT,
        related_name='gastos',
        db_column='id_categoria',
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.TextField(blank=True, null=True)
    metodo_pago = models.CharField(
        max_length=50, choices=METODO_PAGO_CHOICES, default='efectivo'
    )
    referencia = models.CharField(max_length=100, blank=True, null=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='gastos',
    )
    # Sesión de caja de la que salió el efectivo. Solo se rellena cuando el
    # gasto es en efectivo y hay caja abierta.
    sesion = models.ForeignKey(
        'SesionCaja',
        on_delete=models.PROTECT,
        related_name='gastos_caja',
        db_column='id_sesion',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gasto'
        verbose_name = 'Gasto Operativo'
        verbose_name_plural = 'Gastos Operativos'
        ordering = ['-fecha', '-created_at']

    def __str__(self):
        return f"Gasto #{self.id_gasto} - {self.categoria_id} - C${self.monto}"


class PagoCompra(models.Model):
    """Pago/abono registrado contra una orden de compra (cuentas por pagar).
    Espejo de PagoVenta. Un pago en efectivo sale del cajón de la caja abierta
    (ver SesionCaja.calcular_esperado)."""
    METODO_PAGO_CHOICES = PagoVenta.METODO_PAGO_CHOICES

    id_pago = models.AutoField(primary_key=True)
    id_orden = models.ForeignKey(
        OrdenCompra,
        on_delete=models.CASCADE,
        related_name='pagos',
        db_column='id_orden',
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = models.DateField(default=date.today)
    metodo_pago = models.CharField(
        max_length=50, choices=METODO_PAGO_CHOICES, default='efectivo'
    )
    referencia = models.CharField(max_length=100, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Sesión de caja de la que salió el efectivo (solo pagos en efectivo).
    sesion = models.ForeignKey(
        'SesionCaja',
        on_delete=models.PROTECT,
        related_name='pagos_compra',
        db_column='id_sesion',
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'pago_compra'
        verbose_name = 'Pago de Compra'
        verbose_name_plural = 'Pagos de Compras'
        ordering = ['-fecha_pago', '-created_at']

    def __str__(self):
        return f"Pago #{self.id_pago} - Compra #{self.id_orden_id} - C${self.monto}"


class ConfiguracionIA(models.Model):
    """Credenciales y modelo elegido de cada proveedor de IA.

    Una fila por proveedor: así se pueden dejar cargadas varias claves y
    cambiar de proveedor sin volver a escribirlas. Solo una queda `activa`.

    Sobre la clave: se guarda cifrada (mismo mecanismo que protege teléfonos y
    correos) y **nunca sale del backend**. La API devuelve únicamente una
    versión enmascarada. Una clave de IA es dinero: quien la tenga puede gastar
    de la cuenta.

    La tabla está excluida del respaldo (ver `api/backup_utils.EXCLUIR`).
    """
    id_configuracion = models.AutoField(primary_key=True)
    # Los valores válidos salen del catálogo, para no mantener dos listas.
    proveedor = models.CharField(max_length=30, unique=True)
    # Cifrada en reposo. Es TEXT en la base: el cifrado agrega ~60 caracteres.
    api_key = EncryptedCharField(max_length=500, blank=True, null=True)
    modelo = models.CharField(max_length=100, blank=True, null=True)
    # Solo un proveedor activo a la vez (garantizado por constraint).
    activo = models.BooleanField(default=False)

    # Resultado de la última prueba de conexión: evita descubrir que la clave
    # estaba mal recién cuando una función de IA falla frente al usuario.
    verificada = models.BooleanField(default=False)
    verificada_en = models.DateTimeField(null=True, blank=True)
    ultimo_error = models.TextField(null=True, blank=True)

    actualizado_por = models.CharField(max_length=255, null=True, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'configuracion_ia'
        verbose_name = 'Configuración de IA'
        verbose_name_plural = 'Configuración de IA'
        ordering = ['proveedor']
        constraints = [
            # Un solo proveedor activo. Sin esto, dos filas activas dejarían el
            # sistema eligiendo una al azar.
            models.UniqueConstraint(
                fields=['activo'],
                condition=Q(activo=True),
                name='un_solo_proveedor_ia_activo',
            ),
        ]

    @property
    def nombre_proveedor(self):
        from api.ia_catalogo import PROVEEDORES
        return PROVEEDORES.get(self.proveedor, {}).get('nombre', self.proveedor)

    @property
    def api_key_enmascarada(self):
        from api.ia_catalogo import enmascarar
        return enmascarar(self.api_key)

    @property
    def tiene_clave(self):
        return bool(self.api_key)

    def __str__(self):
        estado = 'activo' if self.activo else 'inactivo'
        return f"{self.nombre_proveedor} ({estado})"
