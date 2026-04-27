-- =====================================================
-- PROCEDIMIENTO ALMACENADO: Reporte de Rentabilidad
-- =====================================================
-- Descripción: Genera un análisis completo de rentabilidad por producto
-- incluyendo margen de ganancia, rotación de inventario, ingresos totales
-- y productos con bajo stock que generan más ingresos.
--
-- Parámetros:
--   @p_fecha_inicio: Fecha de inicio del período de análisis (NULL = últimos 30 días)
--   @p_fecha_fin: Fecha de fin del período de análisis (NULL = hoy)
--
-- Retorna: Tabla con análisis de rentabilidad por producto
-- =====================================================

CREATE PROCEDURE dbo.sp_reporte_rentabilidad_productos
    @p_fecha_inicio DATE = NULL,
    @p_fecha_fin DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Si no se proporcionan fechas, usar los últimos 30 días
    IF @p_fecha_inicio IS NULL
        SET @p_fecha_inicio = DATEADD(DAY, -30, GETDATE());
    
    IF @p_fecha_fin IS NULL
        SET @p_fecha_fin = CAST(GETDATE() AS DATE);

    -- CTE para calcular ventas por producto
    WITH ventas_por_producto AS (
        SELECT 
            p.id_producto,
            p.sku_producto,
            p.nombre,
            ISNULL(SUM(dov.cantidad), 0) AS total_vendido,
            ISNULL(SUM(dov.subtotal), 0) AS ingresos,
            ISNULL(SUM(dov.cantidad * p.precio_compra_unitario), 0) AS costos,
            ISNULL(AVG(dov.precio_unitario), 0) AS precio_promedio,
            p.cantidad_actual,
            p.cantidad_minima
        FROM productos p
        LEFT JOIN detalles_orden_venta dov ON p.id_producto = dov.producto_id
        LEFT JOIN ventas v ON dov.orden_venta_id = v.id_venta
        WHERE v.fecha BETWEEN @p_fecha_inicio AND @p_fecha_fin
           OR v.fecha IS NULL  -- Incluir productos sin ventas
        GROUP BY 
            p.id_producto, 
            p.sku_producto, 
            p.nombre, 
            p.cantidad_actual, 
            p.cantidad_minima
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
                    ROUND(((vpp.ingresos - vpp.costos) / vpp.ingresos * 100), 2)
                ELSE 0 
            END AS margen,
            vpp.precio_promedio,
            vpp.cantidad_actual,
            vpp.cantidad_minima,
            -- Rotación de inventario: ventas / stock promedio
            CASE 
                WHEN vpp.cantidad_actual > 0 THEN 
                    ROUND(CAST(vpp.total_vendido AS DECIMAL(18,2)) / vpp.cantidad_actual, 2)
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
        mc.id_producto,
        mc.sku_producto,
        mc.nombre AS nombre_producto,
        mc.total_vendido AS cantidad_vendida,
        ROUND(mc.ingresos, 2) AS ingresos_totales,
        ROUND(mc.costos, 2) AS costo_total,
        ROUND(mc.ganancia, 2) AS ganancia_bruta,
        mc.margen AS margen_porcentaje,
        ROUND(mc.precio_promedio, 2) AS precio_promedio_venta,
        mc.cantidad_actual AS stock_actual,
        mc.cantidad_minima AS stock_minimo,
        mc.rotacion AS rotacion_inventario,
        mc.estado AS estado_stock,
        mc.ranking AS ranking_ventas
    FROM metricas_calculadas mc
    ORDER BY mc.ingresos DESC;
END;

-- =====================================================
-- DOCUMENTACIÓN DEL PROCEDIMIENTO
-- =====================================================
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Genera un reporte completo de rentabilidad por producto incluyendo:
- Cantidad vendida en el período
- Ingresos y costos totales
- Ganancia bruta y margen de ganancia
- Rotación de inventario
- Estado del stock (SIN_STOCK, BAJO_STOCK, STOCK_CRITICO, STOCK_OK)
- Ranking de productos por ventas', 
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'PROCEDURE', @level1name = N'sp_reporte_rentabilidad_productos';

-- =====================================================
-- EJEMPLOS DE USO
-- =====================================================

-- Ejemplo 1: Reporte de los últimos 30 días (por defecto)
-- EXEC dbo.sp_reporte_rentabilidad_productos;

-- Ejemplo 2: Reporte de un período específico
-- EXEC dbo.sp_reporte_rentabilidad_productos 
--     @p_fecha_inicio = '2024-01-01', 
--     @p_fecha_fin = '2024-12-31';

-- Ejemplo 3: Top 10 productos más rentables del último mes
-- SELECT TOP 10 * 
-- FROM (
--     EXEC dbo.sp_reporte_rentabilidad_productos
-- ) AS resultado
-- WHERE ganancia_bruta > 0
-- ORDER BY margen_porcentaje DESC;

-- Ejemplo 4: Productos con bajo stock pero alta rotación (requieren reabastecimiento urgente)
-- Usando tabla temporal para filtrar resultados
/*
CREATE TABLE #temp_rentabilidad (
    id_producto INT,
    sku_producto VARCHAR(100),
    nombre_producto VARCHAR(255),
    cantidad_vendida BIGINT,
    ingresos_totales DECIMAL(18,2),
    costo_total DECIMAL(18,2),
    ganancia_bruta DECIMAL(18,2),
    margen_porcentaje DECIMAL(18,2),
    precio_promedio_venta DECIMAL(18,2),
    stock_actual INT,
    stock_minimo INT,
    rotacion_inventario DECIMAL(18,2),
    estado_stock VARCHAR(20),
    ranking_ventas BIGINT
);

INSERT INTO #temp_rentabilidad
EXEC dbo.sp_reporte_rentabilidad_productos;

SELECT * FROM #temp_rentabilidad
WHERE estado_stock IN ('BAJO_STOCK', 'STOCK_CRITICO')
  AND rotacion_inventario > 2
ORDER BY rotacion_inventario DESC;

DROP TABLE #temp_rentabilidad;
*/

-- Ejemplo 5: Productos con baja rentabilidad (revisar precios)
/*
CREATE TABLE #temp_rentabilidad2 (
    id_producto INT,
    sku_producto VARCHAR(100),
    nombre_producto VARCHAR(255),
    cantidad_vendida BIGINT,
    ingresos_totales DECIMAL(18,2),
    costo_total DECIMAL(18,2),
    ganancia_bruta DECIMAL(18,2),
    margen_porcentaje DECIMAL(18,2),
    precio_promedio_venta DECIMAL(18,2),
    stock_actual INT,
    stock_minimo INT,
    rotacion_inventario DECIMAL(18,2),
    estado_stock VARCHAR(20),
    ranking_ventas BIGINT
);

INSERT INTO #temp_rentabilidad2
EXEC dbo.sp_reporte_rentabilidad_productos;

SELECT * FROM #temp_rentabilidad2
WHERE margen_porcentaje < 20
  AND cantidad_vendida > 0
ORDER BY margen_porcentaje ASC;

DROP TABLE #temp_rentabilidad2;
*/

-- =====================================================
-- ALTERNATIVA: Función con valores de tabla (TVF)
-- Para facilitar consultas con WHERE y JOIN
-- =====================================================

IF OBJECT_ID('dbo.fn_reporte_rentabilidad_productos', 'IF') IS NOT NULL
    DROP FUNCTION dbo.fn_reporte_rentabilidad_productos;
GO

CREATE FUNCTION dbo.fn_reporte_rentabilidad_productos
(
    @p_fecha_inicio DATE,
    @p_fecha_fin DATE
)
RETURNS TABLE
AS
RETURN
(
    WITH ventas_por_producto AS (
        SELECT 
            p.id_producto,
            p.sku_producto,
            p.nombre,
            ISNULL(SUM(dov.cantidad), 0) AS total_vendido,
            ISNULL(SUM(dov.subtotal), 0) AS ingresos,
            ISNULL(SUM(dov.cantidad * p.precio_compra_unitario), 0) AS costos,
            ISNULL(AVG(dov.precio_unitario), 0) AS precio_promedio,
            p.cantidad_actual,
            p.cantidad_minima
        FROM productos p
        LEFT JOIN detalles_orden_venta dov ON p.id_producto = dov.producto_id
        LEFT JOIN ventas v ON dov.orden_venta_id = v.id_venta
        WHERE v.fecha BETWEEN @p_fecha_inicio AND @p_fecha_fin
           OR v.fecha IS NULL
        GROUP BY 
            p.id_producto, 
            p.sku_producto, 
            p.nombre, 
            p.cantidad_actual, 
            p.cantidad_minima
    ),
    metricas_calculadas AS (
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
                    ROUND(((vpp.ingresos - vpp.costos) / vpp.ingresos * 100), 2)
                ELSE 0 
            END AS margen,
            vpp.precio_promedio,
            vpp.cantidad_actual,
            vpp.cantidad_minima,
            CASE 
                WHEN vpp.cantidad_actual > 0 THEN 
                    ROUND(CAST(vpp.total_vendido AS DECIMAL(18,2)) / vpp.cantidad_actual, 2)
                ELSE 0 
            END AS rotacion,
            CASE 
                WHEN vpp.cantidad_actual = 0 THEN 'SIN_STOCK'
                WHEN vpp.cantidad_actual <= vpp.cantidad_minima THEN 'BAJO_STOCK'
                WHEN vpp.cantidad_actual <= (vpp.cantidad_minima * 1.5) THEN 'STOCK_CRITICO'
                ELSE 'STOCK_OK'
            END AS estado,
            RANK() OVER (ORDER BY vpp.total_vendido DESC) AS ranking
        FROM ventas_por_producto vpp
    )
    SELECT 
        mc.id_producto,
        mc.sku_producto,
        mc.nombre AS nombre_producto,
        mc.total_vendido AS cantidad_vendida,
        ROUND(mc.ingresos, 2) AS ingresos_totales,
        ROUND(mc.costos, 2) AS costo_total,
        ROUND(mc.ganancia, 2) AS ganancia_bruta,
        mc.margen AS margen_porcentaje,
        ROUND(mc.precio_promedio, 2) AS precio_promedio_venta,
        mc.cantidad_actual AS stock_actual,
        mc.cantidad_minima AS stock_minimo,
        mc.rotacion AS rotacion_inventario,
        mc.estado AS estado_stock,
        mc.ranking AS ranking_ventas
    FROM metricas_calculadas mc
);
GO

-- =====================================================
-- EJEMPLOS DE USO DE LA FUNCIÓN (más flexible)
-- =====================================================

-- Ejemplo 1: Consulta básica con la función
-- SELECT * FROM dbo.fn_reporte_rentabilidad_productos(
--     DATEADD(DAY, -30, GETDATE()), 
--     GETDATE()
-- );

-- Ejemplo 2: Top 10 productos más rentables (más simple con función)
-- SELECT TOP 10 * 
-- FROM dbo.fn_reporte_rentabilidad_productos(
--     DATEADD(DAY, -30, GETDATE()), 
--     GETDATE()
-- )
-- WHERE ganancia_bruta > 0
-- ORDER BY margen_porcentaje DESC;

-- Ejemplo 3: Productos con bajo stock y alta rotación
-- SELECT * 
-- FROM dbo.fn_reporte_rentabilidad_productos(
--     DATEADD(DAY, -30, GETDATE()), 
--     GETDATE()
-- )
-- WHERE estado_stock IN ('BAJO_STOCK', 'STOCK_CRITICO')
--   AND rotacion_inventario > 2
-- ORDER BY rotacion_inventario DESC;

-- Ejemplo 4: Productos con baja rentabilidad
-- SELECT * 
-- FROM dbo.fn_reporte_rentabilidad_productos(
--     '2024-01-01', 
--     '2024-12-31'
-- )
-- WHERE margen_porcentaje < 20
--   AND cantidad_vendida > 0
-- ORDER BY margen_porcentaje ASC;
