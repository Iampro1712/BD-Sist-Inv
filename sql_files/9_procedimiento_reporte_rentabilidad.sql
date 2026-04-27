-- =====================================================
-- PROCEDIMIENTO ALMACENADO: Reporte de Rentabilidad
-- =====================================================
-- Descripción: Genera un análisis completo de rentabilidad por producto
-- incluyendo margen de ganancia, rotación de inventario, ingresos totales
-- y productos con bajo stock que generan más ingresos.
--
-- Parámetros:
--   p_fecha_inicio: Fecha de inicio del período de análisis
--   p_fecha_fin: Fecha de fin del período de análisis
--
-- Retorna: Tabla con análisis de rentabilidad por producto
-- =====================================================

CREATE OR REPLACE FUNCTION reporte_rentabilidad_productos(
    p_fecha_inicio DATE DEFAULT NULL,
    p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
    id_producto INTEGER,
    sku_producto VARCHAR(100),
    nombre_producto VARCHAR(255),
    cantidad_vendida BIGINT,
    ingresos_totales NUMERIC,
    costo_total NUMERIC,
    ganancia_bruta NUMERIC,
    margen_porcentaje NUMERIC,
    precio_promedio_venta NUMERIC,
    stock_actual INTEGER,
    stock_minimo INTEGER,
    rotacion_inventario NUMERIC,
    estado_stock VARCHAR(20),
    ranking_ventas BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Si no se proporcionan fechas, usar los últimos 30 días
    IF p_fecha_inicio IS NULL THEN
        p_fecha_inicio := CURRENT_DATE - INTERVAL '30 days';
    END IF;
    
    IF p_fecha_fin IS NULL THEN
        p_fecha_fin := CURRENT_DATE;
    END IF;

    RETURN QUERY
    WITH ventas_por_producto AS (
        -- Calcular ventas por producto en el período
        SELECT 
            p.id_producto,
            p.sku_producto,
            p.nombre,
            COALESCE(SUM(dov.cantidad), 0) AS total_vendido,
            COALESCE(SUM(dov.subtotal), 0) AS ingresos,
            COALESCE(SUM(dov.cantidad * p.precio_compra_unitario), 0) AS costos,
            COALESCE(AVG(dov.precio_unitario), 0) AS precio_promedio,
            p.cantidad_actual,
            p.cantidad_minima
        FROM productos p
        LEFT JOIN detalles_orden_venta dov ON p.id_producto = dov.producto_id
        LEFT JOIN ventas v ON dov.orden_venta_id = v.id_venta
        WHERE v.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
           OR v.fecha IS NULL  -- Incluir productos sin ventas
        GROUP BY p.id_producto, p.sku_producto, p.nombre, p.cantidad_actual, p.cantidad_minima
    ),
    metricas_calculadas AS (
        -- Calcular métricas de rentabilidad
        SELECT 
            vpp.id_producto,
            vpp.sku_producto,
            vpp.nombre,
            vpp.total_vendido,
            vpp.ingresos,
            vpp.costos,
            (vpp.ingresos - vpp.costos) AS ganancia,
            CASE 
                WHEN vpp.ingresos > 0 THEN 
                    ROUND(((vpp.ingresos - vpp.costos) / vpp.ingresos * 100)::NUMERIC, 2)
                ELSE 0 
            END AS margen,
            vpp.precio_promedio,
            vpp.cantidad_actual,
            vpp.cantidad_minima,
            -- Rotación de inventario: ventas / stock promedio
            CASE 
                WHEN vpp.cantidad_actual > 0 THEN 
                    ROUND((vpp.total_vendido::NUMERIC / vpp.cantidad_actual), 2)
                ELSE 0 
            END AS rotacion,
            -- Estado del stock
            CASE 
                WHEN vpp.cantidad_actual = 0 THEN 'SIN_STOCK'
                WHEN vpp.cantidad_actual <= vpp.cantidad_minima THEN 'BAJO_STOCK'
                WHEN vpp.cantidad_actual <= (vpp.cantidad_minima * 1.5) THEN 'STOCK_CRITICO'
                ELSE 'STOCK_OK'
            END AS estado,
            -- Ranking por ventas
            RANK() OVER (ORDER BY vpp.total_vendido DESC) AS ranking
        FROM ventas_por_producto vpp
    )
    -- Retornar resultados ordenados por ingresos
    SELECT 
        mc.id_producto::INTEGER,
        mc.sku_producto::VARCHAR(100),
        mc.nombre::VARCHAR(255),
        mc.total_vendido::BIGINT,
        ROUND(mc.ingresos::NUMERIC, 2) AS ingresos_totales,
        ROUND(mc.costos::NUMERIC, 2) AS costo_total,
        ROUND(mc.ganancia::NUMERIC, 2) AS ganancia_bruta,
        mc.margen AS margen_porcentaje,
        ROUND(mc.precio_promedio::NUMERIC, 2) AS precio_promedio_venta,
        mc.cantidad_actual::INTEGER,
        mc.cantidad_minima::INTEGER,
        mc.rotacion AS rotacion_inventario,
        mc.estado::VARCHAR(20),
        mc.ranking::BIGINT
    FROM metricas_calculadas mc
    ORDER BY mc.ingresos DESC;
END;
$$;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
COMMENT ON FUNCTION sp_reporte_rentabilidad_productos IS 
'Genera un reporte completo de rentabilidad por producto incluyendo:
- Cantidad vendida en el período
- Ingresos y costos totales
- Ganancia bruta y margen de ganancia
- Rotación de inventario
- Estado del stock (SIN_STOCK, BAJO_STOCK, STOCK_CRITICO, STOCK_OK)
- Ranking de productos por ventas';

-- =====================================================
-- EJEMPLOS DE USO
-- =====================================================

-- Ejemplo 1: Reporte de los últimos 30 días (por defecto)
-- SELECT * FROM sp_reporte_rentabilidad_productos();

-- Ejemplo 2: Reporte de un período específico
-- SELECT * FROM sp_reporte_rentabilidad_productos('2024-01-01', '2024-12-31');

-- Ejemplo 3: Top 10 productos más rentables del último mes
-- SELECT * FROM sp_reporte_rentabilidad_productos()
-- WHERE ganancia_bruta > 0
-- ORDER BY margen_porcentaje DESC
-- LIMIT 10;

-- Ejemplo 4: Productos con bajo stock pero alta rotación (requieren reabastecimiento urgente)
-- SELECT * FROM sp_reporte_rentabilidad_productos()
-- WHERE estado_stock IN ('BAJO_STOCK', 'STOCK_CRITICO')
--   AND rotacion_inventario > 2
-- ORDER BY rotacion_inventario DESC;

-- Ejemplo 5: Productos con baja rentabilidad (revisar precios)
-- SELECT * FROM sp_reporte_rentabilidad_productos()
-- WHERE margen_porcentaje < 20
--   AND cantidad_vendida > 0
-- ORDER BY margen_porcentaje ASC;
