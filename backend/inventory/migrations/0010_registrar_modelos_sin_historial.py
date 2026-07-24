"""
R03 (categoría D): Moto, ServicioMoto, Servicio, PagoVenta,
BitacoraServicio, AuditoriaProducto, Cotizacion y Devolucion nunca
aparecieron en el historial de migraciones (0001-0006) — sus tablas reales
ya coinciden con los modelos actuales, solo faltaba registrarlas. Estado
generado mecánicamente con `ModelState.from_model` para evitar errores de
transcripción. No genera DDL: las tablas ya existen y funcionan hoy.

Orden dentro de la lista: Moto antes que ServicioMoto (FK), y ambas antes
que BitacoraServicio (FK a las dos). PagoVenta depende de OrdenVenta, ya
recreado en 0008.
"""
import datetime
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0009_movimiento_inventario_managed'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Moto',
                    fields=[
                        ('id_moto', models.AutoField(primary_key=True, serialize=False)),
                        ('id_cliente', models.ForeignKey(db_column='id_cliente', on_delete=django.db.models.deletion.CASCADE, related_name='motos', to='inventory.cliente')),
                        ('marca', models.CharField(max_length=100)),
                        ('modelo', models.CharField(max_length=100)),
                        ('anio', models.IntegerField(db_column='aÑo')),
                        ('placa', models.CharField(max_length=20, unique=True)),
                    ],
                    options={
                        'verbose_name': 'Moto',
                        'verbose_name_plural': 'Motos',
                        'db_table': 'motos',
                        'ordering': ['marca', 'modelo'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='ServicioMoto',
                    fields=[
                        ('id_servicio', models.AutoField(primary_key=True, serialize=False)),
                        ('id_moto', models.ForeignKey(db_column='id_moto', on_delete=django.db.models.deletion.CASCADE, related_name='servicios', to='inventory.moto')),
                        ('fecha_servicio', models.DateField()),
                        ('tipo_servicio', models.CharField(max_length=255)),
                        ('descripcion', models.TextField(blank=True, null=True)),
                        ('costo', models.DecimalField(decimal_places=2, max_digits=10)),
                    ],
                    options={
                        'verbose_name': 'Servicio de Moto',
                        'verbose_name_plural': 'Servicios de Motos',
                        'db_table': 'servicio_motos',
                        'ordering': ['-fecha_servicio'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='BitacoraServicio',
                    fields=[
                        ('id_bitacora', models.AutoField(primary_key=True, serialize=False)),
                        ('id_servicio', models.ForeignKey(db_column='id_servicio', on_delete=django.db.models.deletion.CASCADE, related_name='bitacoras', to='inventory.serviciomoto')),
                        ('id_moto', models.ForeignKey(db_column='id_moto', on_delete=django.db.models.deletion.CASCADE, related_name='bitacoras', to='inventory.moto')),
                        ('modulo', models.CharField(choices=[('recepcion', 'Recepción'), ('diagnostico', 'Diagnóstico'), ('reparacion', 'Reparación'), ('entrega', 'Entrega')], max_length=50)),
                        ('fecha_registro', models.DateTimeField(auto_now_add=True)),
                        ('notas', models.TextField(blank=True, null=True)),
                        ('nivel_gasolina', models.CharField(blank=True, max_length=50, null=True)),
                        ('rayones_previos', models.TextField(blank=True, null=True)),
                        ('fallas_encontradas', models.TextField(blank=True, null=True)),
                        ('trabajo_realizado', models.TextField(blank=True, null=True)),
                        ('tecnico_responsable', models.CharField(blank=True, max_length=255, null=True)),
                        ('checklist_salida', models.TextField(blank=True, null=True)),
                        ('firma_cliente', models.CharField(blank=True, max_length=255, null=True)),
                        ('imagenes', models.JSONField(blank=True, default=list)),
                        ('creado_por', models.CharField(blank=True, max_length=255, null=True)),
                        ('actualizado_en', models.DateTimeField(auto_now=True)),
                    ],
                    options={
                        'verbose_name': 'Bitácora de Servicio',
                        'verbose_name_plural': 'Bitácoras de Servicios',
                        'db_table': 'bitacora_servicio',
                        'ordering': ['-fecha_registro'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='Servicio',
                    fields=[
                        ('id_servicio', models.AutoField(primary_key=True, serialize=False)),
                        ('nombre', models.CharField(max_length=255)),
                        ('tipo', models.CharField(max_length=255)),
                        ('precio_mano_obra', models.DecimalField(decimal_places=2, max_digits=10)),
                        ('diagnostico', models.TextField(blank=True, null=True)),
                        ('fecha_realizacion', models.DateField(blank=True, null=True)),
                        ('id_empleado', models.IntegerField(blank=True, null=True)),
                        ('id_moto', models.IntegerField(blank=True, null=True)),
                    ],
                    options={
                        'verbose_name': 'Servicio',
                        'verbose_name_plural': 'Servicios',
                        'db_table': 'servicios',
                        'ordering': ['nombre'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='PagoVenta',
                    fields=[
                        ('id_pago', models.AutoField(primary_key=True, serialize=False)),
                        ('id_venta', models.ForeignKey(db_column='id_venta', on_delete=django.db.models.deletion.CASCADE, related_name='pagos', to='inventory.ordenventa')),
                        ('monto', models.DecimalField(decimal_places=2, max_digits=10)),
                        ('fecha_pago', models.DateField(default=datetime.date.today)),
                        ('metodo_pago', models.CharField(choices=[('efectivo', 'Efectivo'), ('tarjeta', 'Tarjeta'), ('transferencia', 'Transferencia'), ('deposito', 'Depósito'), ('cheque', 'Cheque')], default='efectivo', max_length=50)),
                        ('referencia', models.CharField(blank=True, max_length=100, null=True)),
                        ('notas', models.TextField(blank=True, null=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'verbose_name': 'Pago de Venta',
                        'verbose_name_plural': 'Pagos de Ventas',
                        'db_table': 'pagos_venta',
                        'ordering': ['-fecha_pago', '-created_at'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='AuditoriaProducto',
                    fields=[
                        ('id_auditoria', models.AutoField(primary_key=True, serialize=False)),
                        ('id_producto', models.IntegerField()),
                        ('sku_producto', models.CharField(blank=True, max_length=100, null=True)),
                        ('nombre_producto', models.CharField(blank=True, max_length=255, null=True)),
                        ('operacion', models.CharField(max_length=10)),
                        ('cantidad_anterior', models.IntegerField(blank=True, null=True)),
                        ('precio_compra_anterior', models.IntegerField(blank=True, null=True)),
                        ('precio_final_anterior', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                        ('cantidad_nueva', models.IntegerField(blank=True, null=True)),
                        ('precio_compra_nuevo', models.IntegerField(blank=True, null=True)),
                        ('precio_final_nuevo', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                        ('diferencia_cantidad', models.IntegerField(blank=True, null=True)),
                        ('diferencia_precio_compra', models.IntegerField(blank=True, null=True)),
                        ('diferencia_precio_final', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                        ('fecha_cambio', models.DateTimeField(auto_now_add=True)),
                        ('usuario', models.CharField(blank=True, max_length=255, null=True)),
                        ('ip_address', models.CharField(blank=True, max_length=50, null=True)),
                        ('datos_anteriores', models.JSONField(blank=True, null=True)),
                        ('datos_nuevos', models.JSONField(blank=True, null=True)),
                    ],
                    options={
                        'verbose_name': 'Auditoría de Producto',
                        'verbose_name_plural': 'Auditorías de Productos',
                        'db_table': 'auditoria_productos',
                        'ordering': ['-fecha_cambio'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='Cotizacion',
                    fields=[
                        ('id_cotizacion', models.AutoField(primary_key=True, serialize=False)),
                        ('id_cliente', models.IntegerField()),
                        ('fecha', models.DateField(default=datetime.date.today)),
                        ('validez_dias', models.IntegerField(default=15)),
                        ('total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                        ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('aprobada', 'Aprobada'), ('rechazada', 'Rechazada'), ('convertida', 'Convertida en venta')], default='pendiente', max_length=20)),
                        ('id_venta', models.IntegerField(blank=True, null=True)),
                        ('notas', models.TextField(blank=True, null=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'verbose_name': 'Cotización',
                        'verbose_name_plural': 'Cotizaciones',
                        'db_table': 'cotizaciones',
                        'ordering': ['-fecha', '-id_cotizacion'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='Devolucion',
                    fields=[
                        ('id_devolucion', models.AutoField(primary_key=True, serialize=False)),
                        ('id_venta', models.IntegerField(blank=True, null=True)),
                        ('id_cliente', models.IntegerField(blank=True, null=True)),
                        ('fecha', models.DateField(default=datetime.date.today)),
                        ('motivo', models.TextField(blank=True, null=True)),
                        ('total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                        ('estado', models.CharField(choices=[('procesada', 'Procesada'), ('anulada', 'Anulada')], default='procesada', max_length=20)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'verbose_name': 'Devolución',
                        'verbose_name_plural': 'Devoluciones',
                        'db_table': 'devoluciones',
                        'ordering': ['-fecha', '-id_devolucion'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
