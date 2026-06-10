from django.db import migrations


# Índices para columnas filtradas/ordenadas/unidas con frecuencia en viewsets
# y reportes. Se crean con CONCURRENTLY para no bloquear escrituras en prod e
# IF NOT EXISTS para ser idempotentes (varias tablas son managed=False / legacy).
INDEXES = [
    ('idx_orden_compra_proveedor', 'orden_compra', 'id_proveedor'),
    ('idx_orden_compra_estado', 'orden_compra', 'id_estado'),
    ('idx_orden_compra_fecha', 'orden_compra', 'fecha_creacion'),
    ('idx_ventas_cliente', 'ventas', 'id_cliente'),
    ('idx_ventas_fecha', 'ventas', 'fecha'),
    ('idx_motos_cliente', 'motos', 'id_cliente'),
    ('idx_servicio_motos_moto', 'servicio_motos', 'id_moto'),
    ('idx_movimientos_producto', 'movimientos_inventario', 'producto_id'),
    ('idx_garantias_cliente', 'garantias', 'id_cliente'),
    ('idx_garantias_venta', 'garantias', 'id_venta'),
    ('idx_reclamaciones_garantia', 'reclamaciones_garantia', 'garantia_id'),
    ('idx_orden_producto_orden', 'orden_producto', 'id_orden'),
    ('idx_orden_producto_producto', 'orden_producto', 'id_producto'),
    ('idx_producto_venta_venta', 'producto_venta', 'id_venta'),
    ('idx_producto_venta_producto', 'producto_venta', 'id_producto'),
]


# La tabla django_migrations (esquema legacy) no tiene secuencia/DEFAULT en
# su columna id, por lo que registrar CUALQUIER migración nueva falla con
# "null value in column id". Esta operación lo repara de forma idempotente
# antes de registrar esta migración (y deja la DB sana para las futuras).
FIX_DJANGO_MIGRATIONS_SEQ = """
DO $$
BEGIN
    IF pg_get_serial_sequence('django_migrations', 'id') IS NULL THEN
        CREATE SEQUENCE IF NOT EXISTS django_migrations_id_seq;
        PERFORM setval(
            'django_migrations_id_seq',
            (SELECT COALESCE(MAX(id), 0) FROM django_migrations)
        );
        ALTER TABLE django_migrations
            ALTER COLUMN id SET DEFAULT nextval('django_migrations_id_seq');
        ALTER SEQUENCE django_migrations_id_seq OWNED BY django_migrations.id;
    END IF;
END $$;
"""


def _build_operations():
    operations = [
        migrations.RunSQL(
            sql=FIX_DJANGO_MIGRATIONS_SEQ,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]
    for name, table, column in INDEXES:
        operations.append(
            migrations.RunSQL(
                sql=f'CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} '
                    f'ON {table} ({column});',
                reverse_sql=f'DROP INDEX CONCURRENTLY IF EXISTS {name};',
            )
        )
    return operations


class Migration(migrations.Migration):

    # CONCURRENTLY no puede ejecutarse dentro de una transacción.
    atomic = False

    dependencies = [
        ('inventory', '0005_garantia_reclamacion'),
    ]

    operations = _build_operations()
