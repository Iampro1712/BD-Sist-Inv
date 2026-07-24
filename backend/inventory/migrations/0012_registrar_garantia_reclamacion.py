"""
R03 — mismo patrón de la categoría D, encontrado al validar esta serie de
migraciones con `makemigrations --check --dry-run`: Garantia y
ReclamacionGarantia se crearon con `RunSQL` directo en
0005_garantia_reclamacion.py (tablas reales, con `IF NOT EXISTS`), pero esa
migración nunca actualizó el estado de Django con un `CreateModel` — los
modelos quedaron sin ningún registro en el historial de migraciones, pese
a ser `managed=True` y funcionar en producción hoy.

Estado generado mecánicamente con `ModelState.from_model`. No genera DDL:
las tablas ya existen (creadas por 0005).
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0011_crear_marcas_categorias'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Garantia',
                    fields=[
                        ('id_garantia', models.AutoField(primary_key=True, serialize=False)),
                        ('id_producto', models.ForeignKey(db_column='id_producto', db_constraint=False, on_delete=django.db.models.deletion.PROTECT, related_name='garantias', to='inventory.producto')),
                        ('id_venta', models.IntegerField()),
                        ('id_cliente', models.IntegerField()),
                        ('cantidad', models.IntegerField(default=1)),
                        ('fecha_inicio', models.DateField()),
                        ('fecha_fin', models.DateField()),
                        ('estado', models.CharField(choices=[('activa', 'Activa'), ('vencida', 'Vencida'), ('reclamada', 'Reclamada')], default='activa', max_length=20)),
                        ('notas', models.TextField(blank=True, null=True)),
                    ],
                    options={
                        'verbose_name': 'Garantía',
                        'verbose_name_plural': 'Garantías',
                        'db_table': 'garantias',
                        'ordering': ['-fecha_inicio'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
                migrations.CreateModel(
                    name='ReclamacionGarantia',
                    fields=[
                        ('id_reclamacion', models.AutoField(primary_key=True, serialize=False)),
                        ('garantia', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reclamaciones', to='inventory.garantia')),
                        ('descripcion_problema', models.TextField()),
                        ('fecha_reclamacion', models.DateField(auto_now_add=True)),
                        ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('en_proceso', 'En proceso'), ('resuelto', 'Resuelto'), ('rechazado', 'Rechazado')], default='pendiente', max_length=20)),
                        ('resolucion', models.TextField(blank=True, null=True)),
                        ('fecha_resolucion', models.DateField(blank=True, null=True)),
                    ],
                    options={
                        'verbose_name': 'Reclamación de Garantía',
                        'verbose_name_plural': 'Reclamaciones de Garantía',
                        'db_table': 'reclamaciones_garantia',
                        'ordering': ['-fecha_reclamacion'],
                        'indexes': [],
                        'constraints': [],
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
