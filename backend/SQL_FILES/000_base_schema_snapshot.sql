-- ============================================================================
-- SNAPSHOT DE ESQUEMA BASE (solo estructura, sin datos)
-- Generado con: pg_dump --schema-only --no-owner --no-privileges
--   --exclude-table=<tablas administradas por Django, ver mas abajo>
-- Fecha: 2026-07-24 (regenerado tras mitigar R03: unificacion de esquema)
--
-- Este archivo NO se ejecuta contra la base de datos de produccion/dev
-- (las tablas ya existen ahi). Su proposito es:
--   1) Dejar versionado el esquema hibrido que antes solo existia en la BD
--      real y en ningun lugar del repositorio (R03 -- ver migraciones
--      0007-0012 en inventory/migrations/ para el detalle completo de la
--      unificacion).
--   2) Servir de bootstrap para levantar una base de datos de pruebas
--      limpia en CI (ver .github/workflows/backend-ci.yml).
--
-- Se excluyen a proposito las tablas que Django ya sabe crear via migrate:
-- django_migrations, django_content_type, django_admin_log, django_session,
-- auth_group, auth_group_permissions, auth_permission, auth_user,
-- auth_user_groups, auth_user_user_permissions, token_blacklist_*,
-- marcas, categorias, garantias, reclamaciones_garantia.
--
-- marcas/categorias se agregaron a esta lista de exclusion en R03: sus
-- tablas NO existian fisicamente (bug en vivo, /api/marcas/ y
-- /api/categorias/ devolvian 500) pese a que el estado de Django ya las
-- daba por creadas desde 0001_initial. La migracion 0011 las crea de
-- verdad ahora; el snapshot ya no necesita incluirlas.
--
-- Orden de bootstrap correcto (ver .github/workflows/backend-ci.yml):
--   1) psql -f 000_base_schema_snapshot.sql   (crea las tablas hibridas reales)
--   2) manage.py migrate inventory 0004 --fake (0001-0004 crean un esquema
--      viejo/ficticio que ya no existe; se marcan aplicadas sin ejecutar)
--   3) manage.py migrate                       (crea auth/admin/sessions/
--      token_blacklist y aplica 0005-0012, que si son reales o son
--      SeparateDatabaseAndState de solo-estado -- ver cada migracion)
--
-- Incluye tablas huerfanas sin modelo Django (estado, empleados, ingresos,
-- servicio_moto singular) y una funcion de trigger no adjunta actualmente a
-- ninguna tabla (auditar_y_ajustar_precio), detectadas al mitigar R03. Se
-- dejan tal cual para reflejar fielmente la BD real; limpiarlas es un
-- problema aparte, pendiente.
-- ============================================================================

--
-- PostgreSQL database dump
--

\restrict OaXwuuHDnHKzEvyp4aNgQiQLvj6Shjf0VTs45fTxI3IB2vaOgen30i5FPb4cudI

-- Dumped from database version 15.18 (Debian 15.18-1.pgdg13+1)
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: auditar_y_ajustar_precio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auditar_y_ajustar_precio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- NEW = los datos nuevos que se están guardando
    -- OLD = los datos anteriores antes del cambio
    
    -- Si el precio está entre 100 y 500, aumentar 15%
    IF NEW.precio_final >= 100 AND NEW.precio_final <= 500 THEN
        NEW.precio_final = NEW.precio_final * 1.15;
        
        -- Guardar en auditoría que fue ajuste automático
        INSERT INTO auditoria_precios (id_producto, nombre_producto, precio_anterior, precio_nuevo, fue_ajuste_automatico)
        VALUES (NEW.id_producto, NEW.nombre, OLD.precio_final, NEW.precio_final, TRUE);
    ELSE
        -- Guardar cambio normal (sin ajuste)
        INSERT INTO auditoria_precios (id_producto, nombre_producto, precio_anterior, precio_nuevo, fue_ajuste_automatico)
        VALUES (NEW.id_producto, NEW.nombre, OLD.precio_final, NEW.precio_final, FALSE);
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: fn_auditoria_productos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_auditoria_productos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_datos_anteriores JSONB;
    v_datos_nuevos JSONB;
BEGIN
    -- Construir JSON de datos anteriores
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
    
    -- Construir JSON de datos nuevos
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
    
    -- Insertar registro de auditoría según el tipo de operación
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria_productos (
            id_producto, sku_producto, nombre_producto,
            operacion,
            cantidad_nueva, precio_compra_nuevo, precio_final_nuevo,
            datos_nuevos
        ) VALUES (
            NEW.id_producto, NEW.sku_producto, NEW.nombre,
            'INSERT',
            NEW.cantidad_actual, NEW.precio_compra_unitario, NEW.precio_final,
            v_datos_nuevos
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Solo auditar si hubo cambios reales
        IF OLD.cantidad_actual <> NEW.cantidad_actual 
           OR OLD.precio_compra_unitario <> NEW.precio_compra_unitario 
           OR OLD.precio_final <> NEW.precio_final
           OR OLD.nombre <> NEW.nombre
           OR OLD.sku_producto <> NEW.sku_producto THEN
            
            INSERT INTO auditoria_productos (
                id_producto, sku_producto, nombre_producto,
                operacion,
                cantidad_anterior, precio_compra_anterior, precio_final_anterior,
                cantidad_nueva, precio_compra_nuevo, precio_final_nuevo,
                diferencia_cantidad, diferencia_precio_compra, diferencia_precio_final,
                datos_anteriores, datos_nuevos
            ) VALUES (
                NEW.id_producto, NEW.sku_producto, NEW.nombre,
                'UPDATE',
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
            id_producto, sku_producto, nombre_producto,
            operacion,
            cantidad_anterior, precio_compra_anterior, precio_final_anterior,
            datos_anteriores
        ) VALUES (
            OLD.id_producto, OLD.sku_producto, OLD.nombre,
            'DELETE',
            OLD.cantidad_actual, OLD.precio_compra_unitario, OLD.precio_final,
            v_datos_anteriores
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;


--
-- Name: FUNCTION fn_auditoria_productos(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fn_auditoria_productos() IS 'Función de trigger que registra automáticamente todos los cambios en productos:
- INSERT: Registra creación de nuevos productos
- UPDATE: Registra modificaciones (solo si hay cambios reales)
- DELETE: Registra eliminaciones
Incluye snapshots completos en JSON para trazabilidad total';


--
-- Name: fn_estadisticas_auditoria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_estadisticas_auditoria() RETURNS TABLE(total_registros bigint, total_inserts bigint, total_updates bigint, total_deletes bigint, productos_modificados bigint, fecha_primer_registro timestamp without time zone, fecha_ultimo_registro timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_registros,
        COUNT(CASE WHEN operacion = 'INSERT' THEN 1 END)::BIGINT AS total_inserts,
        COUNT(CASE WHEN operacion = 'UPDATE' THEN 1 END)::BIGINT AS total_updates,
        COUNT(CASE WHEN operacion = 'DELETE' THEN 1 END)::BIGINT AS total_deletes,
        COUNT(DISTINCT id_producto)::BIGINT AS productos_modificados,
        MIN(fecha_cambio) AS fecha_primer_registro,
        MAX(fecha_cambio) AS fecha_ultimo_registro
    FROM auditoria_productos;
END;
$$;


--
-- Name: fn_historial_producto(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_historial_producto(p_id_producto integer) RETURNS TABLE(id_auditoria integer, operacion character varying, cantidad_anterior integer, cantidad_nueva integer, precio_anterior numeric, precio_nuevo numeric, fecha_cambio timestamp without time zone, usuario character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id_auditoria,
        a.operacion,
        a.cantidad_anterior,
        a.cantidad_nueva,
        a.precio_final_anterior,
        a.precio_final_nuevo,
        a.fecha_cambio,
        a.usuario
    FROM auditoria_productos a
    WHERE a.id_producto = p_id_producto
    ORDER BY a.fecha_cambio DESC;
END;
$$;


--
-- Name: sp_medir_rendimiento_northwind(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_medir_rendimiento_northwind() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_db_name   TEXT;
    v_db_size   TEXT;
    v_now       TEXT;
BEGIN
    v_db_name := current_database();
    v_db_size  := pg_size_pretty(pg_database_size(v_db_name));
    v_now      := to_char(now(), 'YYYY-MM-DD HH24:MI:SS');

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'REPORTE DE RENDIMIENTO - BASE DE DATOS %', v_db_name;
    RAISE NOTICE 'Fecha y hora: %', v_now;
    RAISE NOTICE '===========================================';

    -- 1. Estado general de la base de datos
    RAISE NOTICE '--- Estado general de la base de datos ---';
    RAISE NOTICE '%', (
        SELECT format('Base: %s | Codificación: %s | Collation: %s | Tamaño: %s',
            datname,
            pg_encoding_to_char(encoding),
            datcollate,
            pg_size_pretty(pg_database_size(datname)))
        FROM pg_database
        WHERE datname = v_db_name
    );

    -- 2. Espacio utilizado por tabla
    RAISE NOTICE '--- Uso de espacio por tabla (top 10) ---';
    RAISE NOTICE '%', (
        SELECT string_agg(
            format('%-30s | Total: %-10s | Tabla: %-10s | Índices: %s',
                relname,
                pg_size_pretty(pg_total_relation_size(oid)),
                pg_size_pretty(pg_relation_size(oid)),
                pg_size_pretty(pg_indexes_size(oid))), 
            E'\n')
        FROM (
            SELECT oid, relname
            FROM pg_class
            WHERE relkind = 'r'
            AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            ORDER BY pg_total_relation_size(oid) DESC
            LIMIT 10
        ) t
    );

    -- 3. Sesiones/consultas activas
    RAISE NOTICE '--- Procesos activos ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('PID: %-6s | Estado: %-10s | Duración: %-15s | Espera: %-20s | Query: %s',
                    pid,
                    state,
                    age(now(), query_start)::TEXT,
                    COALESCE(wait_event_type || '/' || wait_event, 'ninguno'),
                    left(query, 60)), 
                E'\n'),
            'Sin procesos activos')
        FROM pg_stat_activity
        WHERE datname = v_db_name
        AND pid <> pg_backend_pid()
        AND state IS NOT NULL
    );

    -- 4. Bloqueos detectados
    RAISE NOTICE '--- Bloqueos ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('PID bloqueado: %-6s | PID bloqueador: %-6s | Relación: %-25s | Modo: %s',
                    blocked.pid,
                    blocker.pid,
                    left(COALESCE(blocked_rel.relname, 'N/A'), 25),
                    blocked_locks.mode), 
                E'\n'),
            'Sin bloqueos detectados')
        FROM pg_locks AS blocked_locks
        JOIN pg_stat_activity AS blocked
            ON blocked.pid = blocked_locks.pid
        JOIN pg_locks AS blocker_locks
            ON  blocker_locks.locktype  = blocked_locks.locktype
            AND blocker_locks.database  IS NOT DISTINCT FROM blocked_locks.database
            AND blocker_locks.relation  IS NOT DISTINCT FROM blocked_locks.relation
            AND blocker_locks.page      IS NOT DISTINCT FROM blocked_locks.page
            AND blocker_locks.tuple     IS NOT DISTINCT FROM blocked_locks.tuple
            AND blocker_locks.pid      <> blocked_locks.pid
        JOIN pg_stat_activity AS blocker
            ON blocker.pid = blocker_locks.pid
        LEFT JOIN pg_class AS blocked_rel
            ON blocked_rel.oid = blocked_locks.relation
        WHERE NOT blocked_locks.granted
        AND blocker_locks.granted
    );

    -- 5. Estadísticas de uso por índices
    RAISE NOTICE '--- Rendimiento de índices ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('Tabla: %-25s | Índice: %-30s | Búsquedas: %-8s | Escaneos: %-8s | Lecturas: %-8s | Escrituras: %s',
                    t.relname,
                    t.indexrelname,
                    t.idx_scan,
                    t.idx_tup_read,
                    t.idx_tup_fetch,
                    t.escrituras), 
                E'\n'),
            'Sin estadísticas de índices')
        FROM (
            SELECT
                ui.relname,
                ui.indexrelname,
                ui.idx_scan,
                ui.idx_tup_read,
                ui.idx_tup_fetch,
                ut.n_tup_ins + ut.n_tup_upd + ut.n_tup_del AS escrituras
            FROM pg_stat_user_indexes ui
            JOIN pg_stat_user_tables ut ON ui.relid = ut.relid
            ORDER BY ui.idx_scan DESC
            LIMIT 20
        ) t
    );

    -- 6. Consultas más costosas
    RAISE NOTICE '--- Consultas más costosas (top 5) ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('Avg tiempo: %-12s | Ejecuciones: %-8s | Query: %s',
                    round(mean_exec_time::NUMERIC, 2) || ' ms',
                    calls,
                    left(query, 80)), 
                E'\n'),
            'pg_stat_statements no disponible o sin datos')
        FROM (
            SELECT 
                mean_exec_time,
                calls,
                query
            FROM pg_stat_statements
            ORDER BY mean_exec_time DESC
            LIMIT 5
        ) t
    );

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Fin del reporte';
    RAISE NOTICE '===========================================';
END;
$$;


--
-- Name: update_producto_proveedor_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_producto_proveedor_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: auditoria_precios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_precios (
    id integer NOT NULL,
    id_producto integer,
    nombre_producto character varying(255),
    precio_anterior numeric(10,2),
    precio_nuevo numeric(10,2),
    fue_ajuste_automatico boolean,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: auditoria_precios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_precios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_precios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_precios_id_seq OWNED BY public.auditoria_precios.id;


--
-- Name: auditoria_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_productos (
    id_auditoria integer NOT NULL,
    id_producto integer NOT NULL,
    sku_producto character varying(100),
    nombre_producto character varying(255),
    operacion character varying(10) NOT NULL,
    cantidad_anterior integer,
    precio_compra_anterior integer,
    precio_final_anterior numeric(10,2),
    cantidad_nueva integer,
    precio_compra_nuevo integer,
    precio_final_nuevo numeric(10,2),
    diferencia_cantidad integer,
    diferencia_precio_compra integer,
    diferencia_precio_final numeric(10,2),
    fecha_cambio timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usuario character varying(255) DEFAULT CURRENT_USER,
    ip_address character varying(50),
    datos_anteriores jsonb,
    datos_nuevos jsonb
);


--
-- Name: TABLE auditoria_productos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.auditoria_productos IS 'Auditoría completa de cambios en productos';


--
-- Name: COLUMN auditoria_productos.operacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auditoria_productos.operacion IS 'Tipo de operación: INSERT, UPDATE, DELETE';


--
-- Name: COLUMN auditoria_productos.datos_anteriores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auditoria_productos.datos_anteriores IS 'Snapshot completo del registro antes del cambio';


--
-- Name: COLUMN auditoria_productos.datos_nuevos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auditoria_productos.datos_nuevos IS 'Snapshot completo del registro después del cambio';


--
-- Name: auditoria_productos_id_auditoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_productos_id_auditoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_productos_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_productos_id_auditoria_seq OWNED BY public.auditoria_productos.id_auditoria;


--
-- Name: auth_group_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_group_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_user_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_user_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_user_user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_user_user_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bitacora_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bitacora_servicio (
    id_bitacora integer NOT NULL,
    id_servicio integer NOT NULL,
    id_moto integer NOT NULL,
    modulo character varying(50) NOT NULL,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notas text,
    nivel_gasolina character varying(50),
    rayones_previos text,
    fallas_encontradas text,
    trabajo_realizado text,
    tecnico_responsable character varying(255),
    checklist_salida text,
    firma_cliente character varying(255),
    imagenes jsonb DEFAULT '[]'::jsonb,
    creado_por character varying(255),
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bitacora_servicio_modulo_check CHECK (((modulo)::text = ANY ((ARRAY['recepcion'::character varying, 'diagnostico'::character varying, 'reparacion'::character varying, 'entrega'::character varying])::text[])))
);


--
-- Name: TABLE bitacora_servicio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bitacora_servicio IS 'Bitácora detallada de servicios de motos con imágenes en R2';


--
-- Name: COLUMN bitacora_servicio.modulo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bitacora_servicio.modulo IS 'Módulo: recepcion, diagnostico, reparacion, entrega';


--
-- Name: COLUMN bitacora_servicio.imagenes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bitacora_servicio.imagenes IS 'Array JSON con URLs de imágenes en Cloudflare R2';


--
-- Name: bitacora_servicio_id_bitacora_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bitacora_servicio_id_bitacora_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bitacora_servicio_id_bitacora_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bitacora_servicio_id_bitacora_seq OWNED BY public.bitacora_servicio.id_bitacora;


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_id_cliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente (
    id_cliente integer DEFAULT nextval('public.cliente_id_cliente_seq'::regclass) NOT NULL,
    nombre character varying(255) NOT NULL,
    email text,
    telefono text
);


--
-- Name: cotizaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cotizaciones (
    id_cotizacion integer NOT NULL,
    id_cliente integer NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    validez_dias integer DEFAULT 15 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    id_venta integer,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cotizaciones_id_cotizacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cotizaciones_id_cotizacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cotizaciones_id_cotizacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cotizaciones_id_cotizacion_seq OWNED BY public.cotizaciones.id_cotizacion;


--
-- Name: devoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devoluciones (
    id_devolucion integer NOT NULL,
    id_venta integer,
    id_cliente integer,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    motivo text,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'procesada'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: devoluciones_id_devolucion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devoluciones_id_devolucion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devoluciones_id_devolucion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devoluciones_id_devolucion_seq OWNED BY public.devoluciones.id_devolucion;


--
-- Name: django_admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.django_admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: django_content_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.django_content_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: django_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.django_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empleados_id_empleado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empleados_id_empleado_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empleados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empleados (
    id_empleado integer DEFAULT nextval('public.empleados_id_empleado_seq'::regclass) NOT NULL,
    nombre character varying(255) NOT NULL,
    apellido character varying(255) NOT NULL,
    cargo character varying(100),
    salario numeric(10,2),
    email character varying(255)
);


--
-- Name: estado_id_estado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estado_id_estado_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estado (
    id_estado integer DEFAULT nextval('public.estado_id_estado_seq'::regclass) NOT NULL,
    cancelado character varying(50),
    pendiente character varying(50)
);


--
-- Name: ingresos_id_ingreso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingresos_id_ingreso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingresos (
    id_ingreso integer DEFAULT nextval('public.ingresos_id_ingreso_seq'::regclass) NOT NULL,
    fecha date NOT NULL,
    monto numeric(10,2) NOT NULL,
    tipo_ingreso character varying(100),
    descripcion text,
    id_venta integer
);


--
-- Name: motos_id_moto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.motos_id_moto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: motos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motos (
    id_moto integer DEFAULT nextval('public.motos_id_moto_seq'::regclass) NOT NULL,
    placa character varying(50) NOT NULL,
    marca character varying(100),
    modelo character varying(100),
    "aÑo" integer,
    id_cliente integer
);


--
-- Name: movimientos_inventario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_inventario (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad integer NOT NULL,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    referencia character varying(100),
    tipo_referencia character varying(20),
    notas text,
    CONSTRAINT movimientos_inventario_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ENTRADA'::character varying, 'SALIDA'::character varying, 'AJUSTE'::character varying])::text[]))),
    CONSTRAINT movimientos_inventario_tipo_referencia_check CHECK (((tipo_referencia)::text = ANY ((ARRAY['ORDEN_COMPRA'::character varying, 'ORDEN_VENTA'::character varying, 'AJUSTE_MANUAL'::character varying])::text[])))
);


--
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_inventario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_inventario_id_seq OWNED BY public.movimientos_inventario.id;


--
-- Name: orden_compra_id_orden_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orden_compra_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_compra (
    id_orden integer DEFAULT nextval('public.orden_compra_id_orden_seq'::regclass) NOT NULL,
    fecha_creacion date NOT NULL,
    id_proveedor integer,
    id_estado integer
);


--
-- Name: orden_producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_producto (
    id_orden integer NOT NULL,
    id_producto integer NOT NULL
);


--
-- Name: pagos_venta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_venta (
    id_pago integer NOT NULL,
    id_venta integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    fecha_pago date DEFAULT CURRENT_DATE NOT NULL,
    metodo_pago character varying(50) DEFAULT 'efectivo'::character varying NOT NULL,
    referencia character varying(100),
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pagos_venta_monto_check CHECK ((monto > (0)::numeric))
);


--
-- Name: pagos_venta_id_pago_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_venta_id_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_venta_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_venta_id_pago_seq OWNED BY public.pagos_venta.id_pago;


--
-- Name: producto_cotizacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_cotizacion (
    id_cotizacion integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    CONSTRAINT producto_cotizacion_cantidad_check CHECK ((cantidad > 0))
);


--
-- Name: producto_devolucion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_devolucion (
    id_devolucion integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    CONSTRAINT producto_devolucion_cantidad_check CHECK ((cantidad > 0))
);


--
-- Name: producto_proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_proveedor (
    id_producto_proveedor integer NOT NULL,
    id_producto integer NOT NULL,
    id_proveedor integer NOT NULL,
    precio_compra numeric(10,2),
    es_proveedor_principal boolean DEFAULT false,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE producto_proveedor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.producto_proveedor IS 'Relación muchos a muchos entre productos y proveedores';


--
-- Name: COLUMN producto_proveedor.precio_compra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.producto_proveedor.precio_compra IS 'Precio de compra específico de este proveedor';


--
-- Name: COLUMN producto_proveedor.es_proveedor_principal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.producto_proveedor.es_proveedor_principal IS 'Indica si este es el proveedor principal del producto';


--
-- Name: producto_proveedor_id_producto_proveedor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_proveedor_id_producto_proveedor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_proveedor_id_producto_proveedor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_proveedor_id_producto_proveedor_seq OWNED BY public.producto_proveedor.id_producto_proveedor;


--
-- Name: producto_venta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_venta (
    id_venta integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario integer NOT NULL
);


--
-- Name: productos_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_producto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id_producto integer DEFAULT nextval('public.productos_id_producto_seq'::regclass) NOT NULL,
    sku_producto character varying(100) NOT NULL,
    cantidad_actual integer DEFAULT 0,
    precio_final numeric(10,2),
    nombre character varying(255) NOT NULL,
    cantidad_total integer DEFAULT 0,
    cantidad_minima integer DEFAULT 0,
    precio_compra_unitario integer,
    id_proveedor integer,
    meses_garantia integer DEFAULT 0 NOT NULL,
    descripcion_garantia text,
    tipo_garantia character varying(50)
);


--
-- Name: COLUMN productos.id_proveedor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.productos.id_proveedor IS 'Proveedor principal del producto';


--
-- Name: proveedores_id_proveedor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedores_id_proveedor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id_proveedor integer DEFAULT nextval('public.proveedores_id_proveedor_seq'::regclass) NOT NULL,
    nombre_empresa character varying(255) NOT NULL,
    telefono text,
    persona_contacto character varying(255),
    email text,
    direccion character varying(500)
);


--
-- Name: servicio_moto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_moto (
    id_moto integer NOT NULL,
    id_servicio integer NOT NULL,
    fecha_realizacion date
);


--
-- Name: servicio_motos_id_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicio_motos_id_servicio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicio_motos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_motos (
    id_servicio integer DEFAULT nextval('public.servicio_motos_id_servicio_seq'::regclass) NOT NULL,
    id_moto integer NOT NULL,
    fecha_servicio date NOT NULL,
    tipo_servicio character varying(255) NOT NULL,
    descripcion text,
    costo numeric(10,2) NOT NULL
);


--
-- Name: servicios_id_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicios_id_servicio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicios (
    id_servicio integer DEFAULT nextval('public.servicios_id_servicio_seq'::regclass) NOT NULL,
    nombre character varying(255) NOT NULL,
    tipo character varying(100),
    precio_mano_obra numeric(10,2),
    diagnostico text,
    fecha_realizacion date,
    id_empleado integer,
    id_moto integer
);


--
-- Name: v_auditoria_por_producto; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_auditoria_por_producto AS
 SELECT p.id_producto,
    p.sku_producto,
    p.nombre,
    count(a.id_auditoria) AS total_cambios,
    count(
        CASE
            WHEN ((a.operacion)::text = 'UPDATE'::text) THEN 1
            ELSE NULL::integer
        END) AS actualizaciones,
    min(a.fecha_cambio) AS primer_cambio,
    max(a.fecha_cambio) AS ultimo_cambio
   FROM (public.productos p
     LEFT JOIN public.auditoria_productos a ON ((p.id_producto = a.id_producto)))
  GROUP BY p.id_producto, p.sku_producto, p.nombre
 HAVING (count(a.id_auditoria) > 0)
  ORDER BY (count(a.id_auditoria)) DESC;


--
-- Name: v_auditoria_precios; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_auditoria_precios AS
 SELECT a.id_auditoria,
    a.id_producto,
    a.sku_producto,
    a.nombre_producto,
    a.precio_final_anterior,
    a.precio_final_nuevo,
    a.diferencia_precio_final,
        CASE
            WHEN (a.precio_final_anterior > (0)::numeric) THEN round(((a.diferencia_precio_final / a.precio_final_anterior) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS porcentaje_cambio,
    a.fecha_cambio,
    a.usuario
   FROM public.auditoria_productos a
  WHERE (((a.operacion)::text = 'UPDATE'::text) AND (a.diferencia_precio_final IS NOT NULL) AND (a.diferencia_precio_final <> (0)::numeric))
  ORDER BY a.fecha_cambio DESC;


--
-- Name: v_auditoria_reciente; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_auditoria_reciente AS
 SELECT a.id_auditoria,
    a.id_producto,
    a.sku_producto,
    a.nombre_producto,
    a.operacion,
    a.cantidad_anterior,
    a.cantidad_nueva,
    a.diferencia_cantidad,
    a.precio_final_anterior,
    a.precio_final_nuevo,
    a.diferencia_precio_final,
    a.fecha_cambio,
    a.usuario
   FROM public.auditoria_productos a
  ORDER BY a.fecha_cambio DESC
 LIMIT 100;


--
-- Name: v_auditoria_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_auditoria_stock AS
 SELECT a.id_auditoria,
    a.id_producto,
    a.sku_producto,
    a.nombre_producto,
    a.cantidad_anterior,
    a.cantidad_nueva,
    a.diferencia_cantidad,
    a.fecha_cambio,
    a.usuario,
        CASE
            WHEN (a.diferencia_cantidad > 0) THEN 'AUMENTO'::text
            WHEN (a.diferencia_cantidad < 0) THEN 'DISMINUCION'::text
            ELSE 'SIN_CAMBIO'::text
        END AS tipo_cambio_stock
   FROM public.auditoria_productos a
  WHERE (((a.operacion)::text = 'UPDATE'::text) AND (a.diferencia_cantidad IS NOT NULL) AND (a.diferencia_cantidad <> 0))
  ORDER BY a.fecha_cambio DESC;


--
-- Name: ventas_id_venta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ventas_id_venta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventas (
    id_venta integer DEFAULT nextval('public.ventas_id_venta_seq'::regclass) NOT NULL,
    fecha date NOT NULL,
    total numeric(10,2) NOT NULL,
    id_cliente integer,
    id_servicio integer,
    id_empleado integer,
    monto_pagado numeric(10,2) DEFAULT 0 NOT NULL,
    saldo_pendiente numeric(10,2),
    estado_pago character varying(20) DEFAULT 'pendiente'::character varying NOT NULL
);


--
-- Name: auditoria_precios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_precios ALTER COLUMN id SET DEFAULT nextval('public.auditoria_precios_id_seq'::regclass);


--
-- Name: auditoria_productos id_auditoria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_productos ALTER COLUMN id_auditoria SET DEFAULT nextval('public.auditoria_productos_id_auditoria_seq'::regclass);


--
-- Name: bitacora_servicio id_bitacora; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora_servicio ALTER COLUMN id_bitacora SET DEFAULT nextval('public.bitacora_servicio_id_bitacora_seq'::regclass);


--
-- Name: cotizaciones id_cotizacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones ALTER COLUMN id_cotizacion SET DEFAULT nextval('public.cotizaciones_id_cotizacion_seq'::regclass);


--
-- Name: devoluciones id_devolucion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones ALTER COLUMN id_devolucion SET DEFAULT nextval('public.devoluciones_id_devolucion_seq'::regclass);


--
-- Name: movimientos_inventario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario ALTER COLUMN id SET DEFAULT nextval('public.movimientos_inventario_id_seq'::regclass);


--
-- Name: pagos_venta id_pago; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_venta ALTER COLUMN id_pago SET DEFAULT nextval('public.pagos_venta_id_pago_seq'::regclass);


--
-- Name: producto_proveedor id_producto_proveedor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_proveedor ALTER COLUMN id_producto_proveedor SET DEFAULT nextval('public.producto_proveedor_id_producto_proveedor_seq'::regclass);


--
-- Name: auditoria_precios auditoria_precios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_precios
    ADD CONSTRAINT auditoria_precios_pkey PRIMARY KEY (id);


--
-- Name: auditoria_productos auditoria_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_productos
    ADD CONSTRAINT auditoria_productos_pkey PRIMARY KEY (id_auditoria);


--
-- Name: bitacora_servicio bitacora_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora_servicio
    ADD CONSTRAINT bitacora_servicio_pkey PRIMARY KEY (id_bitacora);


--
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id_cliente);


--
-- Name: cotizaciones cotizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_pkey PRIMARY KEY (id_cotizacion);


--
-- Name: devoluciones devoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_pkey PRIMARY KEY (id_devolucion);


--
-- Name: empleados empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_pkey PRIMARY KEY (id_empleado);


--
-- Name: estado estado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado
    ADD CONSTRAINT estado_pkey PRIMARY KEY (id_estado);


--
-- Name: ingresos ingresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_pkey PRIMARY KEY (id_ingreso);


--
-- Name: motos motos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motos
    ADD CONSTRAINT motos_pkey PRIMARY KEY (id_moto);


--
-- Name: motos motos_placa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motos
    ADD CONSTRAINT motos_placa_key UNIQUE (placa);


--
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id);


--
-- Name: orden_compra orden_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_compra
    ADD CONSTRAINT orden_compra_pkey PRIMARY KEY (id_orden);


--
-- Name: orden_producto orden_producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_producto
    ADD CONSTRAINT orden_producto_pkey PRIMARY KEY (id_orden, id_producto);


--
-- Name: pagos_venta pagos_venta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_venta
    ADD CONSTRAINT pagos_venta_pkey PRIMARY KEY (id_pago);


--
-- Name: producto_proveedor producto_proveedor_id_producto_id_proveedor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_proveedor
    ADD CONSTRAINT producto_proveedor_id_producto_id_proveedor_key UNIQUE (id_producto, id_proveedor);


--
-- Name: producto_proveedor producto_proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_proveedor
    ADD CONSTRAINT producto_proveedor_pkey PRIMARY KEY (id_producto_proveedor);


--
-- Name: producto_venta producto_venta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_venta
    ADD CONSTRAINT producto_venta_pkey PRIMARY KEY (id_venta, id_producto);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id_producto);


--
-- Name: productos productos_sku_producto_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_sku_producto_key UNIQUE (sku_producto);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id_proveedor);


--
-- Name: servicio_moto servicio_moto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_moto
    ADD CONSTRAINT servicio_moto_pkey PRIMARY KEY (id_moto, id_servicio);


--
-- Name: servicio_motos servicio_motos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_motos
    ADD CONSTRAINT servicio_motos_pkey PRIMARY KEY (id_servicio);


--
-- Name: servicios servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id_servicio);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id_venta);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_fecha ON public.auditoria_productos USING btree (fecha_cambio);


--
-- Name: idx_auditoria_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_operacion ON public.auditoria_productos USING btree (operacion);


--
-- Name: idx_auditoria_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_producto ON public.auditoria_productos USING btree (id_producto);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_usuario ON public.auditoria_productos USING btree (usuario);


--
-- Name: idx_bitacora_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_fecha ON public.bitacora_servicio USING btree (fecha_registro);


--
-- Name: idx_bitacora_modulo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_modulo ON public.bitacora_servicio USING btree (modulo);


--
-- Name: idx_bitacora_moto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_moto ON public.bitacora_servicio USING btree (id_moto);


--
-- Name: idx_bitacora_servicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_servicio ON public.bitacora_servicio USING btree (id_servicio);


--
-- Name: idx_cotizaciones_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cotizaciones_cliente ON public.cotizaciones USING btree (id_cliente);


--
-- Name: idx_cotizaciones_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cotizaciones_estado ON public.cotizaciones USING btree (estado);


--
-- Name: idx_devoluciones_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devoluciones_cliente ON public.devoluciones USING btree (id_cliente);


--
-- Name: idx_devoluciones_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devoluciones_venta ON public.devoluciones USING btree (id_venta);


--
-- Name: idx_ingresos_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingresos_venta ON public.ingresos USING btree (id_venta);


--
-- Name: idx_motos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_motos_cliente ON public.motos USING btree (id_cliente);


--
-- Name: idx_movimientos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_fecha ON public.movimientos_inventario USING btree (fecha DESC);


--
-- Name: idx_movimientos_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_producto ON public.movimientos_inventario USING btree (producto_id);


--
-- Name: idx_movimientos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_tipo ON public.movimientos_inventario USING btree (tipo);


--
-- Name: idx_orden_compra_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_compra_estado ON public.orden_compra USING btree (id_estado);


--
-- Name: idx_orden_compra_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_compra_fecha ON public.orden_compra USING btree (fecha_creacion);


--
-- Name: idx_orden_compra_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_compra_proveedor ON public.orden_compra USING btree (id_proveedor);


--
-- Name: idx_orden_producto_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_producto_orden ON public.orden_producto USING btree (id_orden);


--
-- Name: idx_orden_producto_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_producto_producto ON public.orden_producto USING btree (id_producto);


--
-- Name: idx_pagos_venta_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_venta_fecha ON public.pagos_venta USING btree (fecha_pago);


--
-- Name: idx_pagos_venta_id_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_venta_id_venta ON public.pagos_venta USING btree (id_venta);


--
-- Name: idx_producto_cotizacion_cot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_cotizacion_cot ON public.producto_cotizacion USING btree (id_cotizacion);


--
-- Name: idx_producto_devolucion_dev; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_devolucion_dev ON public.producto_devolucion USING btree (id_devolucion);


--
-- Name: idx_producto_proveedor_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_proveedor_producto ON public.producto_proveedor USING btree (id_producto);


--
-- Name: idx_producto_proveedor_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_proveedor_proveedor ON public.producto_proveedor USING btree (id_proveedor);


--
-- Name: idx_producto_venta_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_venta_producto ON public.producto_venta USING btree (id_producto);


--
-- Name: idx_producto_venta_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_venta_venta ON public.producto_venta USING btree (id_venta);


--
-- Name: idx_productos_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_proveedor ON public.productos USING btree (id_proveedor);


--
-- Name: idx_productos_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_sku ON public.productos USING btree (sku_producto);


--
-- Name: idx_servicio_motos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_motos_fecha ON public.servicio_motos USING btree (fecha_servicio);


--
-- Name: idx_servicio_motos_moto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_motos_moto ON public.servicio_motos USING btree (id_moto);


--
-- Name: idx_servicios_empleado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicios_empleado ON public.servicios USING btree (id_empleado);


--
-- Name: idx_servicios_moto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicios_moto ON public.servicios USING btree (id_moto);


--
-- Name: idx_ventas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_cliente ON public.ventas USING btree (id_cliente);


--
-- Name: idx_ventas_empleado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_empleado ON public.ventas USING btree (id_empleado);


--
-- Name: idx_ventas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_fecha ON public.ventas USING btree (fecha);


--
-- Name: idx_ventas_servicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_servicio ON public.ventas USING btree (id_servicio);


--
-- Name: productos trg_auditoria_productos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditoria_productos AFTER INSERT OR DELETE OR UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_productos();


--
-- Name: producto_proveedor trigger_update_producto_proveedor_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_producto_proveedor_timestamp BEFORE UPDATE ON public.producto_proveedor FOR EACH ROW EXECUTE FUNCTION public.update_producto_proveedor_timestamp();


--
-- Name: bitacora_servicio bitacora_servicio_id_moto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora_servicio
    ADD CONSTRAINT bitacora_servicio_id_moto_fkey FOREIGN KEY (id_moto) REFERENCES public.motos(id_moto) ON DELETE CASCADE;


--
-- Name: bitacora_servicio bitacora_servicio_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora_servicio
    ADD CONSTRAINT bitacora_servicio_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicio_motos(id_servicio) ON DELETE CASCADE;


--
-- Name: cotizaciones cotizaciones_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente);


--
-- Name: cotizaciones cotizaciones_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta) ON DELETE SET NULL;


--
-- Name: devoluciones devoluciones_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente);


--
-- Name: devoluciones devoluciones_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta) ON DELETE SET NULL;


--
-- Name: productos fk_productos_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_productos_proveedor FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id_proveedor) ON DELETE SET NULL;


--
-- Name: ingresos ingresos_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta) ON DELETE CASCADE;


--
-- Name: motos motos_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motos
    ADD CONSTRAINT motos_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente) ON DELETE SET NULL;


--
-- Name: movimientos_inventario movimientos_inventario_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id_producto) ON DELETE RESTRICT;


--
-- Name: orden_compra orden_compra_id_estado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_compra
    ADD CONSTRAINT orden_compra_id_estado_fkey FOREIGN KEY (id_estado) REFERENCES public.estado(id_estado) ON DELETE SET NULL;


--
-- Name: orden_compra orden_compra_id_proveedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_compra
    ADD CONSTRAINT orden_compra_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id_proveedor) ON DELETE SET NULL;


--
-- Name: orden_producto orden_producto_id_orden_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_producto
    ADD CONSTRAINT orden_producto_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES public.orden_compra(id_orden) ON DELETE CASCADE;


--
-- Name: orden_producto orden_producto_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_producto
    ADD CONSTRAINT orden_producto_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE CASCADE;


--
-- Name: pagos_venta pagos_venta_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_venta
    ADD CONSTRAINT pagos_venta_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta) ON DELETE CASCADE;


--
-- Name: producto_cotizacion producto_cotizacion_id_cotizacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_cotizacion
    ADD CONSTRAINT producto_cotizacion_id_cotizacion_fkey FOREIGN KEY (id_cotizacion) REFERENCES public.cotizaciones(id_cotizacion) ON DELETE CASCADE;


--
-- Name: producto_cotizacion producto_cotizacion_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_cotizacion
    ADD CONSTRAINT producto_cotizacion_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto);


--
-- Name: producto_devolucion producto_devolucion_id_devolucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_devolucion
    ADD CONSTRAINT producto_devolucion_id_devolucion_fkey FOREIGN KEY (id_devolucion) REFERENCES public.devoluciones(id_devolucion) ON DELETE CASCADE;


--
-- Name: producto_devolucion producto_devolucion_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_devolucion
    ADD CONSTRAINT producto_devolucion_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto);


--
-- Name: producto_proveedor producto_proveedor_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_proveedor
    ADD CONSTRAINT producto_proveedor_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE CASCADE;


--
-- Name: producto_proveedor producto_proveedor_id_proveedor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_proveedor
    ADD CONSTRAINT producto_proveedor_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id_proveedor) ON DELETE CASCADE;


--
-- Name: producto_venta producto_venta_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_venta
    ADD CONSTRAINT producto_venta_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE CASCADE;


--
-- Name: producto_venta producto_venta_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_venta
    ADD CONSTRAINT producto_venta_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta) ON DELETE CASCADE;


--
-- Name: servicio_moto servicio_moto_id_moto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_moto
    ADD CONSTRAINT servicio_moto_id_moto_fkey FOREIGN KEY (id_moto) REFERENCES public.motos(id_moto) ON DELETE CASCADE;


--
-- Name: servicio_moto servicio_moto_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_moto
    ADD CONSTRAINT servicio_moto_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios(id_servicio) ON DELETE CASCADE;


--
-- Name: servicio_motos servicio_motos_id_moto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_motos
    ADD CONSTRAINT servicio_motos_id_moto_fkey FOREIGN KEY (id_moto) REFERENCES public.motos(id_moto) ON DELETE CASCADE;


--
-- Name: servicios servicios_id_empleado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_id_empleado_fkey FOREIGN KEY (id_empleado) REFERENCES public.empleados(id_empleado) ON DELETE SET NULL;


--
-- Name: servicios servicios_id_moto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_id_moto_fkey FOREIGN KEY (id_moto) REFERENCES public.motos(id_moto) ON DELETE SET NULL;


--
-- Name: ventas ventas_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.cliente(id_cliente) ON DELETE SET NULL;


--
-- Name: ventas ventas_id_empleado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_empleado_fkey FOREIGN KEY (id_empleado) REFERENCES public.empleados(id_empleado) ON DELETE SET NULL;


--
-- Name: ventas ventas_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios(id_servicio) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict OaXwuuHDnHKzEvyp4aNgQiQLvj6Shjf0VTs45fTxI3IB2vaOgen30i5FPb4cudI

