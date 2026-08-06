from django.db import migrations


class Migration(migrations.Migration):
    """`producto_venta.precio_unitario` pasa de entero a numérico con centavos.

    La columna guardaba el precio de cada línea de venta como INTEGER, mientras
    que `productos.precio_final` y `ventas.total` son NUMERIC(10,2). Cualquier
    precio con centavos se redondeaba al guardarlo, así que la suma de las
    líneas dejaba de cuadrar con el total facturado: 3 unidades a C$10.10 se
    cobraban como C$30.30 pero las líneas sumaban C$30.00.

    Eso no era cosmético. `OrdenVenta.calcular_total()` suma las líneas, y de
    ahí sale el saldo: el cobro correcto de C$30.30 se rechazaba por "excede el
    saldo pendiente", y al pagar C$30.00 la venta se daba por saldada perdiendo
    la diferencia. Con precios que redondean hacia arriba pasaba al revés y
    quedaba una deuda fantasma imposible de cobrar.

    Las tablas hermanas —`producto_cotizacion` y `producto_devolucion`— ya eran
    NUMERIC(10,2); ésta se quedó atrás.

    `producto_venta` no tiene modelo Django (se maneja con SQL crudo en los
    serializers), así que va como RunSQL, igual que la 0015 con `orden_producto`.
    """

    dependencies = [
        ('inventory', '0024_pronostico_plazo_entrega'),
    ]

    operations = [
        migrations.RunSQL(
            # Ensanchar el tipo no pierde nada: los enteros que ya están pasan a
            # tener dos decimales en cero. Lo que NO recupera es el centavo que
            # las ventas viejas ya perdieron al guardarse — ese dato no existe
            # en ninguna parte. `verificar_totales_venta` los lista.
            sql="""
                ALTER TABLE producto_venta
                    ALTER COLUMN precio_unitario TYPE NUMERIC(10,2);
            """,
            # La reversa SÍ pierde datos: volver a INTEGER redondea los centavos
            # de las ventas hechas mientras la columna era numérica. Se deja
            # escrita para poder deshacer la migración en un entorno de pruebas,
            # pero contra datos reales implica perder esos centavos.
            reverse_sql="""
                ALTER TABLE producto_venta
                    ALTER COLUMN precio_unitario TYPE INTEGER
                    USING ROUND(precio_unitario);
            """,
        ),
    ]
