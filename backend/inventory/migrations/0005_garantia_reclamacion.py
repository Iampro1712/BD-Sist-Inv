from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_alter_cliente_options_and_more'),
    ]

    operations = [
        # Arregla la secuencia de django_migrations para que esta migración
        # pueda registrarse aunque la columna id no tenga secuencia asignada.
        migrations.RunSQL(
            sql="""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_sequences
                        WHERE sequencename = 'django_migrations_id_seq'
                    ) THEN
                        CREATE SEQUENCE django_migrations_id_seq;
                        PERFORM setval(
                            'django_migrations_id_seq',
                            (SELECT COALESCE(MAX(id), 0) FROM django_migrations)
                        );
                        ALTER TABLE django_migrations
                            ALTER COLUMN id SET DEFAULT nextval('django_migrations_id_seq');
                    END IF;
                END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # Fase 1: columnas de garantía en productos (idempotente con IF NOT EXISTS)
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
            """,
        ),

        # Fase 2: tabla garantías (idempotente con IF NOT EXISTS)
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS garantias (
                    id_garantia  SERIAL PRIMARY KEY,
                    id_producto  INTEGER NOT NULL
                                 REFERENCES productos(id_producto)
                                 ON DELETE RESTRICT
                                 DEFERRABLE INITIALLY DEFERRED,
                    id_venta     INTEGER NOT NULL,
                    id_cliente   INTEGER NOT NULL,
                    cantidad     INTEGER NOT NULL DEFAULT 1,
                    fecha_inicio DATE NOT NULL,
                    fecha_fin    DATE NOT NULL,
                    estado       VARCHAR(20) NOT NULL DEFAULT 'activa'
                                 CHECK (estado IN ('activa','vencida','reclamada')),
                    notas        TEXT
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS garantias;",
        ),

        # Fase 3: tabla reclamaciones (idempotente con IF NOT EXISTS)
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS reclamaciones_garantia (
                    id_reclamacion      SERIAL PRIMARY KEY,
                    garantia_id         INTEGER NOT NULL
                                        REFERENCES garantias(id_garantia)
                                        ON DELETE CASCADE,
                    descripcion_problema TEXT NOT NULL,
                    fecha_reclamacion   DATE NOT NULL DEFAULT CURRENT_DATE,
                    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                                        CHECK (estado IN ('pendiente','en_proceso','resuelto','rechazado')),
                    resolucion          TEXT,
                    fecha_resolucion    DATE
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS reclamaciones_garantia;",
        ),
    ]
