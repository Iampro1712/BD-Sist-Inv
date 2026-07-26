"""
Los logs de auditoría mostraban `postgres` como autor de todos los cambios.

Causa: el trigger `fn_auditoria_productos` nunca escribía la columna `usuario`,
así que tomaba su valor por defecto `CURRENT_USER`, que es el rol de conexión de
la base de datos, no la persona que hizo el cambio.

Se reescribe la función para que lea el username que el middleware
`AuditoriaUsuarioMiddleware` deja en una variable de sesión, y se quita el
DEFAULT para que no vuelva a colarse el rol de la base de datos.

La lógica de qué se audita no cambia.
"""
from django.db import migrations


# Se guarda la definición vieja para poder revertir.
FUNCION_ANTERIOR = """
CREATE OR REPLACE FUNCTION public.fn_auditoria_productos()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_datos_anteriores JSONB;
    v_datos_nuevos JSONB;
BEGIN
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        v_datos_anteriores := jsonb_build_object(
            'id_producto', OLD.id_producto,
            'sku_producto', OLD.sku_producto,
            'nombre', OLD.nombre,
            'cantidad_actual', OLD.cantidad_actual,
            'cantidad_total', OLD.cantidad_total,
            'cantidad_minima', OLD.cantidad_minima,
            'precio_compra_unitario', OLD.precio_compra_unitario,
            'precio_final', OLD.precio_final
        );
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_datos_nuevos := jsonb_build_object(
            'id_producto', NEW.id_producto,
            'sku_producto', NEW.sku_producto,
            'nombre', NEW.nombre,
            'cantidad_actual', NEW.cantidad_actual,
            'cantidad_total', NEW.cantidad_total,
            'cantidad_minima', NEW.cantidad_minima,
            'precio_compra_unitario', NEW.precio_compra_unitario,
            'precio_final', NEW.precio_final
        );
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria_productos (
            id_producto, sku_producto, nombre_producto, operacion,
            cantidad_nueva, precio_compra_nuevo, precio_final_nuevo, datos_nuevos
        ) VALUES (
            NEW.id_producto, NEW.sku_producto, NEW.nombre, 'INSERT',
            NEW.cantidad_actual, NEW.precio_compra_unitario, NEW.precio_final,
            v_datos_nuevos
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.cantidad_actual <> NEW.cantidad_actual
           OR OLD.precio_compra_unitario <> NEW.precio_compra_unitario
           OR OLD.precio_final <> NEW.precio_final
           OR OLD.nombre <> NEW.nombre
           OR OLD.sku_producto <> NEW.sku_producto THEN

            INSERT INTO auditoria_productos (
                id_producto, sku_producto, nombre_producto, operacion,
                cantidad_anterior, precio_compra_anterior, precio_final_anterior,
                cantidad_nueva, precio_compra_nuevo, precio_final_nuevo,
                diferencia_cantidad, diferencia_precio_compra, diferencia_precio_final,
                datos_anteriores, datos_nuevos
            ) VALUES (
                NEW.id_producto, NEW.sku_producto, NEW.nombre, 'UPDATE',
                OLD.cantidad_actual, OLD.precio_compra_unitario, OLD.precio_final,
                NEW.cantidad_actual, NEW.precio_compra_unitario, NEW.precio_final,
                NEW.cantidad_actual - OLD.cantidad_actual,
                NEW.precio_compra_unitario - OLD.precio_compra_unitario,
                NEW.precio_final - OLD.precio_final,
                v_datos_anteriores, v_datos_nuevos
            );
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria_productos (
            id_producto, sku_producto, nombre_producto, operacion,
            cantidad_anterior, precio_compra_anterior, precio_final_anterior,
            datos_anteriores
        ) VALUES (
            OLD.id_producto, OLD.sku_producto, OLD.nombre, 'DELETE',
            OLD.cantidad_actual, OLD.precio_compra_unitario, OLD.precio_final,
            v_datos_anteriores
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$function$
"""

# Igual que la anterior, pero registrando usuario e IP de la aplicación.
FUNCION_NUEVA = """
CREATE OR REPLACE FUNCTION public.fn_auditoria_productos()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_datos_anteriores JSONB;
    v_datos_nuevos JSONB;
    v_usuario VARCHAR(255);
    v_ip VARCHAR(50);
BEGIN
    -- Quién hizo el cambio. El middleware de la aplicación deja el username en
    -- una variable de sesión; el segundo argumento en true hace que devuelva
    -- NULL en vez de error cuando no está definida (scripts, psql, migraciones).
    v_usuario := NULLIF(current_setting('inventrix.usuario', true), '');
    v_ip := NULLIF(current_setting('inventrix.ip', true), '');

    -- Sin usuario de aplicación, se deja constancia de que fue un proceso
    -- directo sobre la base y con qué rol, en vez de un nombre que parezca una
    -- persona.
    IF v_usuario IS NULL THEN
        v_usuario := 'sistema (' || CURRENT_USER || ')';
    END IF;

    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        v_datos_anteriores := jsonb_build_object(
            'id_producto', OLD.id_producto,
            'sku_producto', OLD.sku_producto,
            'nombre', OLD.nombre,
            'cantidad_actual', OLD.cantidad_actual,
            'cantidad_total', OLD.cantidad_total,
            'cantidad_minima', OLD.cantidad_minima,
            'precio_compra_unitario', OLD.precio_compra_unitario,
            'precio_final', OLD.precio_final
        );
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_datos_nuevos := jsonb_build_object(
            'id_producto', NEW.id_producto,
            'sku_producto', NEW.sku_producto,
            'nombre', NEW.nombre,
            'cantidad_actual', NEW.cantidad_actual,
            'cantidad_total', NEW.cantidad_total,
            'cantidad_minima', NEW.cantidad_minima,
            'precio_compra_unitario', NEW.precio_compra_unitario,
            'precio_final', NEW.precio_final
        );
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria_productos (
            id_producto, sku_producto, nombre_producto, operacion,
            cantidad_nueva, precio_compra_nuevo, precio_final_nuevo, datos_nuevos,
            usuario, ip_address
        ) VALUES (
            NEW.id_producto, NEW.sku_producto, NEW.nombre, 'INSERT',
            NEW.cantidad_actual, NEW.precio_compra_unitario, NEW.precio_final,
            v_datos_nuevos,
            v_usuario, v_ip
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.cantidad_actual <> NEW.cantidad_actual
           OR OLD.precio_compra_unitario <> NEW.precio_compra_unitario
           OR OLD.precio_final <> NEW.precio_final
           OR OLD.nombre <> NEW.nombre
           OR OLD.sku_producto <> NEW.sku_producto THEN

            INSERT INTO auditoria_productos (
                id_producto, sku_producto, nombre_producto, operacion,
                cantidad_anterior, precio_compra_anterior, precio_final_anterior,
                cantidad_nueva, precio_compra_nuevo, precio_final_nuevo,
                diferencia_cantidad, diferencia_precio_compra, diferencia_precio_final,
                datos_anteriores, datos_nuevos,
                usuario, ip_address
            ) VALUES (
                NEW.id_producto, NEW.sku_producto, NEW.nombre, 'UPDATE',
                OLD.cantidad_actual, OLD.precio_compra_unitario, OLD.precio_final,
                NEW.cantidad_actual, NEW.precio_compra_unitario, NEW.precio_final,
                NEW.cantidad_actual - OLD.cantidad_actual,
                NEW.precio_compra_unitario - OLD.precio_compra_unitario,
                NEW.precio_final - OLD.precio_final,
                v_datos_anteriores, v_datos_nuevos,
                v_usuario, v_ip
            );
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria_productos (
            id_producto, sku_producto, nombre_producto, operacion,
            cantidad_anterior, precio_compra_anterior, precio_final_anterior,
            datos_anteriores,
            usuario, ip_address
        ) VALUES (
            OLD.id_producto, OLD.sku_producto, OLD.nombre, 'DELETE',
            OLD.cantidad_actual, OLD.precio_compra_unitario, OLD.precio_final,
            v_datos_anteriores,
            v_usuario, v_ip
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$function$
"""

# El DEFAULT CURRENT_USER es lo que ponía `postgres` en cada fila. Ahora el
# trigger escribe la columna siempre, así que el default solo sería una trampa
# para cualquier INSERT futuro que la omita.
QUITAR_DEFAULT = """
ALTER TABLE auditoria_productos ALTER COLUMN usuario DROP DEFAULT;
"""
RESTAURAR_DEFAULT = """
ALTER TABLE auditoria_productos ALTER COLUMN usuario SET DEFAULT CURRENT_USER;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0021_devoluciones_proveedor'),
    ]

    operations = [
        migrations.RunSQL(sql=FUNCION_NUEVA, reverse_sql=FUNCION_ANTERIOR),
        migrations.RunSQL(sql=QUITAR_DEFAULT, reverse_sql=RESTAURAR_DEFAULT),
    ]
