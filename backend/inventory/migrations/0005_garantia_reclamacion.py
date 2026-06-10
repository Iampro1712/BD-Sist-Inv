from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_alter_cliente_options_and_more'),
    ]

    operations = [
        # Fase 1: agregar campos de garantía a la tabla productos (managed=False)
        migrations.RunSQL(
            sql="""
                ALTER TABLE productos
                    ADD COLUMN IF NOT EXISTS meses_garantia INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS descripcion_garantia TEXT,
                    ADD COLUMN IF NOT EXISTS tipo_garantia VARCHAR(50);
            """,
            reverse_sql="""
                ALTER TABLE productos
                    DROP COLUMN IF EXISTS meses_garantia,
                    DROP COLUMN IF EXISTS descripcion_garantia,
                    DROP COLUMN IF EXISTS tipo_garantia;
            """
        ),

        # Fase 2: tabla garantías (managed=True, Django la crea)
        migrations.CreateModel(
            name='Garantia',
            fields=[
                ('id_garantia', models.AutoField(primary_key=True, serialize=False)),
                ('id_producto', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='garantias',
                    to='inventory.producto',
                    db_column='id_producto',
                    db_constraint=False,
                )),
                ('id_venta', models.IntegerField()),
                ('id_cliente', models.IntegerField()),
                ('cantidad', models.IntegerField(default=1)),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin', models.DateField()),
                ('estado', models.CharField(
                    choices=[('activa', 'Activa'), ('vencida', 'Vencida'), ('reclamada', 'Reclamada')],
                    default='activa',
                    max_length=20,
                )),
                ('notas', models.TextField(blank=True, null=True)),
            ],
            options={
                'db_table': 'garantias',
                'ordering': ['-fecha_inicio'],
            },
        ),

        # Fase 3: tabla reclamaciones (managed=True)
        migrations.CreateModel(
            name='ReclamacionGarantia',
            fields=[
                ('id_reclamacion', models.AutoField(primary_key=True, serialize=False)),
                ('garantia', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reclamaciones',
                    to='inventory.garantia',
                )),
                ('descripcion_problema', models.TextField()),
                ('fecha_reclamacion', models.DateField(auto_now_add=True)),
                ('estado', models.CharField(
                    choices=[
                        ('pendiente', 'Pendiente'),
                        ('en_proceso', 'En proceso'),
                        ('resuelto', 'Resuelto'),
                        ('rechazado', 'Rechazado'),
                    ],
                    default='pendiente',
                    max_length=20,
                )),
                ('resolucion', models.TextField(blank=True, null=True)),
                ('fecha_resolucion', models.DateField(blank=True, null=True)),
            ],
            options={
                'db_table': 'reclamaciones_garantia',
                'ordering': ['-fecha_reclamacion'],
            },
        ),
    ]
