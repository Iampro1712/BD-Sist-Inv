-- =====================================================
-- SISTEMA DE AUDITORÍA DE PRODUCTOS
-- =====================================================
-- Registra automáticamente todos los cambios en productos
-- incluyendo: INSERT, UPDATE, DELETE
-- =====================================================

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria_productos (
    id_auditoria SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL,
    sku_producto VARCHAR(100),
    nombre_producto VARCHAR(255),
    
    -- Operación realizada
    operacion VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    
    -- Datos anteriores (para UPDATE y DELETE)
    cantidad_anterior INTEGER,
    precio_compra_anterior INTEGER,
    precio_final_anterior DECIMAL(10, 2),
    
    -- Datos nuevos (para INSERT y UPDATE)
    cantidad_nueva INTEGER,
    precio_compra_nuevo INTEGER,
    precio_final_nuevo DECIMAL(10, 2),
    
    -- Cambios calculados
    diferencia_cantidad INTEGER,
    diferencia_precio_compra INTEGER,
    diferencia_precio_final DECIMAL(10, 2),
    
    -- Metadata
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(255) DEFAULT CURRENT_USER,
    ip_address VARCHAR(50),
    
    -- Datos completos en JSON para referencia
    datos_anteriores JSONB,
    datos_nuevos JSONB
);

-- Índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_auditoria_producto ON auditoria_productos(id_producto);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_productos(fecha_cambio);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON auditoria_productos(operacion);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_productos(usuario);

-- Comentarios
COMMENT ON TABLE auditoria_productos IS 'Auditoría completa de cambios en productos';
COMMENT ON COLUMN auditoria_productos.operacion IS 'Tipo de operación: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN auditoria_productos.datos_anteriores IS 'Snapshot completo del registro antes del cambio';
COMMENT ON COLUMN auditoria_productos.datos_nuevos IS 'Snapshot completo del registro después del cambio';

-- =====================================================
-- FUNCIÓN DEL TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION fn_auditoria_productos()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREAR EL TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trg_auditoria_productos ON productos;

CREATE TRIGGER trg_auditoria_productos
    AFTER INSERT OR UPDATE OR DELETE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION fn_auditoria_productos();

COMMENT ON FUNCTION fn_auditoria_productos() IS 
'Función de trigger que registra automáticamente todos los cambios en productos:
- INSERT: Registra creación de nuevos productos
- UPDATE: Registra modificaciones (solo si hay cambios reales)
- DELETE: Registra eliminaciones
Incluye snapshots completos en JSON para trazabilidad total';

-- =====================================================
-- VISTAS ÚTILES PARA CONSULTAR LA AUDITORÍA
-- =====================================================

-- Vista: Últimos cambios
CREATE OR REPLACE VIEW v_auditoria_reciente AS
SELECT 
    a.id_auditoria,
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
FROM auditoria_productos a
ORDER BY a.fecha_cambio DESC
LIMIT 100;

-- Vista: Cambios por producto
CREATE OR REPLACE VIEW v_auditoria_por_producto AS
SELECT 
    p.id_producto,
    p.sku_producto,
    p.nombre,
    COUNT(a.id_auditoria) AS total_cambios,
    COUNT(CASE WHEN a.operacion = 'UPDATE' THEN 1 END) AS actualizaciones,
    MIN(a.fecha_cambio) AS primer_cambio,
    MAX(a.fecha_cambio) AS ultimo_cambio
FROM productos p
LEFT JOIN auditoria_productos a ON p.id_producto = a.id_producto
GROUP BY p.id_producto, p.sku_producto, p.nombre
HAVING COUNT(a.id_auditoria) > 0
ORDER BY total_cambios DESC;

-- Vista: Cambios de stock
CREATE OR REPLACE VIEW v_auditoria_stock AS
SELECT 
    a.id_auditoria,
    a.id_producto,
    a.sku_producto,
    a.nombre_producto,
    a.cantidad_anterior,
    a.cantidad_nueva,
    a.diferencia_cantidad,
    a.fecha_cambio,
    a.usuario,
    CASE 
        WHEN a.diferencia_cantidad > 0 THEN 'AUMENTO'
        WHEN a.diferencia_cantidad < 0 THEN 'DISMINUCION'
        ELSE 'SIN_CAMBIO'
    END AS tipo_cambio_stock
FROM auditoria_productos a
WHERE a.operacion = 'UPDATE' 
  AND a.diferencia_cantidad IS NOT NULL
  AND a.diferencia_cantidad <> 0
ORDER BY a.fecha_cambio DESC;

-- Vista: Cambios de precios
CREATE OR REPLACE VIEW v_auditoria_precios AS
SELECT 
    a.id_auditoria,
    a.id_producto,
    a.sku_producto,
    a.nombre_producto,
    a.precio_final_anterior,
    a.precio_final_nuevo,
    a.diferencia_precio_final,
    CASE 
        WHEN a.precio_final_anterior > 0 THEN 
            ROUND((a.diferencia_precio_final / a.precio_final_anterior * 100)::NUMERIC, 2)
        ELSE NULL
    END AS porcentaje_cambio,
    a.fecha_cambio,
    a.usuario
FROM auditoria_productos a
WHERE a.operacion = 'UPDATE' 
  AND a.diferencia_precio_final IS NOT NULL
  AND a.diferencia_precio_final <> 0
ORDER BY a.fecha_cambio DESC;

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

-- Función: Obtener historial de un producto
CREATE OR REPLACE FUNCTION fn_historial_producto(p_id_producto INTEGER)
RETURNS TABLE (
    id_auditoria INTEGER,
    operacion VARCHAR(10),
    cantidad_anterior INTEGER,
    cantidad_nueva INTEGER,
    precio_anterior DECIMAL(10, 2),
    precio_nuevo DECIMAL(10, 2),
    fecha_cambio TIMESTAMP,
    usuario VARCHAR(255)
) AS $$
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
$$ LANGUAGE plpgsql;

-- Función: Estadísticas de auditoría
CREATE OR REPLACE FUNCTION fn_estadisticas_auditoria()
RETURNS TABLE (
    total_registros BIGINT,
    total_inserts BIGINT,
    total_updates BIGINT,
    total_deletes BIGINT,
    productos_modificados BIGINT,
    fecha_primer_registro TIMESTAMP,
    fecha_ultimo_registro TIMESTAMP
) AS $$
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- EJEMPLOS DE CONSULTAS
-- =====================================================

-- Ver últimos cambios
-- SELECT * FROM v_auditoria_reciente;

-- Ver historial de un producto específico
-- SELECT * FROM fn_historial_producto(1);

-- Ver productos con más cambios
-- SELECT * FROM v_auditoria_por_producto LIMIT 10;

-- Ver cambios de stock recientes
-- SELECT * FROM v_auditoria_stock LIMIT 20;

-- Ver cambios de precios
-- SELECT * FROM v_auditoria_precios LIMIT 20;

-- Estadísticas generales
-- SELECT * FROM fn_estadisticas_auditoria();

-- Buscar cambios en un rango de fechas
-- SELECT * FROM auditoria_productos 
-- WHERE fecha_cambio BETWEEN '2024-01-01' AND '2024-12-31'
-- ORDER BY fecha_cambio DESC;

-- Buscar cambios por usuario
-- SELECT * FROM auditoria_productos 
-- WHERE usuario = 'postgres'
-- ORDER BY fecha_cambio DESC;
