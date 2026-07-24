"""
Bug en vivo descubierto mientras se investigaba R03 (no era parte del
riesgo original, pero mismo origen): Marca y Categoria ya son
`managed=True` y su estado en 0001_initial coincide con los modelos
actuales, pero las tablas "marcas"/"categorias" nunca se crearon
físicamente en la base de datos real — probablemente 0001_initial se
marcó aplicada (`--fake`) junto con el resto del esquema "greenfield"
abandonado, sin llegar a ejecutarse para estos dos modelos tampoco.

Confirmado con consulta directa: `Marca.objects.count()` lanza
`relation "marcas" does not exist`. Los endpoints /api/marcas/ y
/api/categorias/ devuelven 500 hoy, y `Categorias.jsx` en el frontend
depende de ellos.

A diferencia de las demás migraciones de este lote, esta SÍ genera DDL
real (CREATE TABLE), pero es aditivo y de bajo riesgo: dos tablas nuevas
y vacías, sin relación con ninguna tabla existente. El estado de Django
ya es correcto (no hace falta tocarlo), por eso `state_operations` va
vacío y solo se ejecuta `database_operations`.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0010_registrar_modelos_sin_historial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[],
            database_operations=[
                migrations.CreateModel(
                    name='Marca',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('nombre', models.CharField(max_length=255, unique=True)),
                        ('descripcion', models.TextField(blank=True, null=True)),
                        ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'verbose_name': 'Marca',
                        'verbose_name_plural': 'Marcas',
                        'db_table': 'marcas',
                        'ordering': ['nombre'],
                    },
                ),
                migrations.CreateModel(
                    name='Categoria',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('nombre', models.CharField(max_length=255, unique=True)),
                        ('descripcion', models.TextField(blank=True, null=True)),
                        ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'verbose_name': 'Categoría',
                        'verbose_name_plural': 'Categorías',
                        'db_table': 'categorias',
                        'ordering': ['nombre'],
                    },
                ),
            ],
        ),
    ]
