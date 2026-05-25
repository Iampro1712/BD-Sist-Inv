CREATE OR REPLACE FUNCTION sp_medir_rendimiento_northwind()
RETURNS VOID
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
        SELECT format(
            'Base: %s | Codificación: %s | Collation: %s | Tamaño: %s',
            datname,
            pg_encoding_to_char(encoding),
            datcollate,
            pg_size_pretty(pg_database_size(datname))
        )
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
                pg_size_pretty(pg_indexes_size(oid))
            ), E'\n'
        )
        FROM (
            SELECT oid, relname
            FROM pg_class
            WHERE relkind = 'r'
              AND relnamespace = (
                  SELECT oid FROM pg_namespace WHERE nspname = 'public'
              )
            ORDER BY pg_total_relation_size(oid) DESC
            LIMIT 10
        ) t
    );

    -- 3. Sesiones/consultas activas
    --    CORRECCIÓN: left(query, 60) reemplaza %.60s (no soportado en format() de PostgreSQL)
    RAISE NOTICE '--- Procesos activos ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('PID: %-6s | Estado: %-10s | Duración: %-15s | Espera: %-20s | Query: %s',
                    pid,
                    state,
                    age(now(), query_start)::TEXT,
                    COALESCE(wait_event_type || '/' || wait_event, 'ninguno'),
                    left(query, 60)
                ), E'\n'
            ),
            'Sin procesos activos'
        )
        FROM pg_stat_activity
        WHERE datname = v_db_name
          AND pid <> pg_backend_pid()
          AND state IS NOT NULL
    );

    -- 4. Bloqueos detectados
    --    CORRECCIÓN: left(relname, 25) reemplaza %-25s con truncado implícito
    RAISE NOTICE '--- Bloqueos ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('PID bloqueado: %-6s | PID bloqueador: %-6s | Relación: %-25s | Modo: %s',
                    blocked.pid,
                    blocker.pid,
                    left(COALESCE(blocked_rel.relname, 'N/A'), 25),
                    blocked_locks.mode
                ), E'\n'
            ),
            'Sin bloqueos detectados'
        )
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
    --    CORRECCIÓN: ORDER BY / LIMIT movidos a subconsulta para evitar
    --    conflicto entre string_agg (agregación) y columnas no agrupadas
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
                    t.escrituras
                ), E'\n'
            ),
            'Sin estadísticas de índices'
        )
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
    --    CORRECCIÓN: left(query, 80) reemplaza %.80s (no soportado en format() de PostgreSQL)
    RAISE NOTICE '--- Consultas más costosas (top 5) ---';
    RAISE NOTICE '%', (
        SELECT COALESCE(
            string_agg(
                format('Avg tiempo: %-12s | Ejecuciones: %-8s | Query: %s',
                    round(mean_exec_time::NUMERIC, 2) || ' ms',
                    calls,
                    left(query, 80)
                ), E'\n'
            ),
            'pg_stat_statements no disponible o sin datos'
        )
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT 5
    );

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Fin del reporte';
    RAISE NOTICE '===========================================';
END;
$$;
