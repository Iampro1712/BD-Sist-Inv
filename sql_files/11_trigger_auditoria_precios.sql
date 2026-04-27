-- Integrantes
-- Maria Esther Espinoza lopez
-- Maria Natasha Gutierrez Espinoza
-- Eduard Antonio Bejarano Carrion

-- Trigger que te lleve la auditoria de cambio de precios a aquellos productos que están en el rango de precio de 100 a 500, aumentar el precio un 15%

-- Tabla para guardar los cambios
CREATE TABLE auditoria_precios (
    id SERIAL PRIMARY KEY,                    
    id_producto INTEGER,                      -- ID del producto que cambió
    nombre_producto VARCHAR(255),             
    precio_anterior DECIMAL(10, 2),           -- Precio antes del cambio (OLD)
    precio_nuevo DECIMAL(10, 2),              -- Precio después del cambio (NEW)
    fue_ajuste_automatico BOOLEAN,            -- TRUE = trigger aumentó 15%, FALSE = cambio manual
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

-- Función que se ejecuta cuando cambia un producto
CREATE OR REPLACE FUNCTION auditar_y_ajustar_precio()
RETURNS TRIGGER AS $$
BEGIN
    -- NEW = los datos nuevos que se están guardando
    -- OLD = los datos anteriores antes del cambio
    
    -- Si el precio está entre 100 y 500, aumentar 15%
    IF NEW.precio_final >= 100 AND NEW.precio_final <= 500 THEN
        NEW.precio_final = NEW.precio_final * 1.15;
        
        -- Guardamos en auditoría que fue ajuste automático
        INSERT INTO auditoria_precios (id_producto, nombre_producto, precio_anterior, precio_nuevo, fue_ajuste_automatico)
        VALUES (NEW.id_producto, NEW.nombre, OLD.precio_final, NEW.precio_final, TRUE);
    ELSE
        -- Guardamos cambio normal, sin ajuste
        INSERT INTO auditoria_precios (id_producto, nombre_producto, precio_anterior, precio_nuevo, fue_ajuste_automatico)
        VALUES (NEW.id_producto, NEW.nombre, OLD.precio_final, NEW.precio_final, FALSE);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creamos el trigger
DROP TRIGGER IF EXISTS trigger_precio ON productos;
CREATE TRIGGER trigger_precio
    BEFORE UPDATE ON productos  -- Ejecutamos esto antes de actualizar
    FOR EACH ROW                -- Ejecutamos por cada fila que cambie
    EXECUTE FUNCTION auditar_y_ajustar_precio();

-- Ejemplos de Uso:

-- 1: Actualizar un producto con precio en rango C$100-500
-- UPDATE productos SET precio_final = 200 WHERE id_producto = 1;
-- Resultado: precio_final será 230 (200 * 1.15)

-- 2: Actualizar un producto fuera del rango
-- El trigger NO aumentará el precio
-- UPDATE productos SET precio_final = 50 WHERE id_producto = 2;
-- Resultado: precio_final será 50 (sin cambio)

-- 3: Ver solo los ajustes automáticos
-- SELECT * FROM auditoria_precios WHERE fue_ajuste_automatico = TRUE;

-- 4: Ver historial de un producto específico
-- SELECT * FROM auditoria_precios WHERE id_producto = 1 ORDER BY fecha DESC;
