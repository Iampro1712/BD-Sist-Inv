"""
R03 (categoría A): MovimientoInventario es el único modelo cuyo estado en
0001_initial ya coincidía con la tabla real "movimientos_inventario"
(mismos campos, mismo db_table) — 0004 solo le puso `managed=False` vía
`AlterModelOptions` como parche general, sin que hiciera falta. Esta
migración revierte esa única bandera. `AlterModelOptions` es pura
metadata: no genera ningún DDL (igual que cuando 0004 la puso en False).
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0008_reconciliar_esquema_real'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='movimientoinventario',
            options={
                'verbose_name': 'Movimiento de Inventario',
                'verbose_name_plural': 'Movimientos de Inventario',
                'ordering': ['-fecha'],
            },
        ),
    ]
