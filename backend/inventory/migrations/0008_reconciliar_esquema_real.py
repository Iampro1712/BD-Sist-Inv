"""
R03 (categoría B) — el corazón del riesgo: 0001_initial creó un esquema
"greenfield" para Cliente, Proveedor, Producto, OrdenVenta y OrdenCompra
(tablas "clientes"/"ordenes_venta"/"ordenes_compra" con campos como
`activo`, `numero_orden`, `subtotal`, `descuento`) que NUNCA existió
físicamente en la base de datos real. La app real usa hace tiempo las
tablas legadas reales ("cliente", "proveedores", "productos", "ventas",
"orden_compra") con un conjunto de campos totalmente distinto, mediante
`managed=False` como parche.

Esta migración reemplaza el estado FICTICIO (de 0001-0004) por el estado
REAL (los campos que ya están en inventory/models.py hoy, generados
mecánicamente con `ModelState.from_model` para evitar errores de
transcripción manual). No genera ningún DDL: la tabla física ya existe y
funciona en producción tal cual — `database_operations` va vacío.

Orden: todos los DeleteModel primero, luego todos los CreateModel (con
Proveedor antes que Producto, que tiene FK hacia Proveedor).
"""
import datetime
import django.db.models.deletion
from django.db import migrations, models

import inventory.encryption


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_eliminar_detalle_ordenes_muertos'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='Cliente'),
                migrations.DeleteModel(name='Proveedor'),
                migrations.DeleteModel(name='Producto'),
                migrations.DeleteModel(name='OrdenVenta'),
                migrations.DeleteModel(name='OrdenCompra'),

                migrations.CreateModel(
                    name='Cliente',
                    fields=[
                        ('id_cliente', models.AutoField(primary_key=True, serialize=False)),
                        ('nombre', models.CharField(max_length=255)),
                        ('telefono', inventory.encryption.EncryptedCharField(blank=True, max_length=50, null=True)),
                        ('email', inventory.encryption.EncryptedEmailField(blank=True, max_length=255, null=True)),
                    ],
                    options={
                        'verbose_name': 'Cliente',
                        'verbose_name_plural': 'Clientes',
                        'db_table': 'cliente',
                        'ordering': ['nombre'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='Proveedor',
                    fields=[
                        ('id_proveedor', models.AutoField(primary_key=True, serialize=False)),
                        ('nombre_empresa', models.CharField(max_length=255)),
                        ('persona_contacto', models.CharField(blank=True, max_length=255, null=True)),
                        ('telefono', inventory.encryption.EncryptedCharField(blank=True, max_length=50, null=True)),
                        ('email', inventory.encryption.EncryptedEmailField(blank=True, max_length=255, null=True)),
                        ('direccion', models.TextField(blank=True, null=True)),
                    ],
                    options={
                        'verbose_name': 'Proveedor',
                        'verbose_name_plural': 'Proveedores',
                        'db_table': 'proveedores',
                        'ordering': ['nombre_empresa'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='Producto',
                    fields=[
                        ('id_producto', models.AutoField(primary_key=True, serialize=False)),
                        ('sku_producto', models.CharField(max_length=100)),
                        ('nombre', models.CharField(max_length=255)),
                        ('cantidad_actual', models.IntegerField(default=0)),
                        ('cantidad_total', models.IntegerField(default=0)),
                        ('cantidad_minima', models.IntegerField(default=0)),
                        ('precio_compra_unitario', models.IntegerField()),
                        ('precio_final', models.DecimalField(decimal_places=2, max_digits=10)),
                        ('id_proveedor', models.ForeignKey(blank=True, db_column='id_proveedor', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='productos', to='inventory.proveedor')),
                        ('meses_garantia', models.IntegerField(default=0)),
                        ('descripcion_garantia', models.TextField(blank=True, null=True)),
                        ('tipo_garantia', models.CharField(blank=True, choices=[('fabricante', 'Fabricante'), ('proveedor', 'Proveedor'), ('tienda', 'Tienda')], max_length=50, null=True)),
                    ],
                    options={
                        'verbose_name': 'Producto',
                        'verbose_name_plural': 'Productos',
                        'db_table': 'productos',
                        'ordering': ['nombre'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='OrdenVenta',
                    fields=[
                        ('id_venta', models.AutoField(primary_key=True, serialize=False)),
                        ('id_cliente', models.IntegerField()),
                        ('fecha', models.DateField()),
                        ('total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                        ('monto_pagado', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                        ('saldo_pendiente', models.DecimalField(decimal_places=2, max_digits=10, null=True)),
                        ('estado_pago', models.CharField(choices=[('pendiente', 'Pendiente'), ('parcial', 'Pago Parcial'), ('pagado', 'Pagado')], default='pendiente', max_length=20)),
                    ],
                    options={
                        'verbose_name': 'Orden de Venta',
                        'verbose_name_plural': 'Órdenes de Venta',
                        'db_table': 'ventas',
                        'ordering': ['-fecha'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='OrdenCompra',
                    fields=[
                        ('id_orden', models.AutoField(primary_key=True, serialize=False)),
                        ('id_proveedor', models.IntegerField()),
                        ('id_estado', models.IntegerField()),
                        ('fecha_creacion', models.DateField()),
                    ],
                    options={
                        'verbose_name': 'Orden de Compra',
                        'verbose_name_plural': 'Órdenes de Compra',
                        'db_table': 'orden_compra',
                        'ordering': ['-fecha_creacion'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
