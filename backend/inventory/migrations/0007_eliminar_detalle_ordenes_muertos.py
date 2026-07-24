"""
R03 (categoría C): DetalleOrdenCompra y DetalleOrdenVenta describían tablas
("detalles_orden_compra", "detalles_orden_venta") que nunca existieron en la
base de datos real — eran parte del esquema "greenfield" original de
0001_initial, abandonado a favor del esquema legado real. Confirmado por
grep que ningún código vivo los usa (modelos, serializers y clase admin
inline ya se eliminaron de models.py/serializers.py/admin.py).

Esta migración solo corrige el ESTADO de Django (no genera DDL: no hay
tabla real que borrar). Va antes de 0008 porque estos dos modelos declaran
FKs hacia OrdenCompra/OrdenVenta/Producto, que 0008 va a recrear — deben
desaparecer del estado primero para no dejar referencias colgantes.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_performance_indexes'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='DetalleOrdenCompra'),
                migrations.DeleteModel(name='DetalleOrdenVenta'),
            ],
            database_operations=[],
        ),
    ]
