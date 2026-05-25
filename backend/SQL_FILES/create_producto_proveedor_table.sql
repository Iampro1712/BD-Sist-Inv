-- Crear tabla de relación producto-proveedor
CREATE TABLE IF NOT EXISTS producto_proveedor (
    id_producto_proveedor SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE CASCADE,
    precio_compra DECIMAL(10, 2),
    es_proveedor_principal BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_producto, id_proveedor)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_producto_proveedor_producto ON producto_proveedor(id_producto);
CREATE INDEX IF NOT EXISTS idx_producto_proveedor_proveedor ON producto_proveedor(id_proveedor);

-- Trigger para actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION update_producto_proveedor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_producto_proveedor_timestamp
    BEFORE UPDATE ON producto_proveedor
    FOR EACH ROW
    EXECUTE FUNCTION update_producto_proveedor_timestamp();

-- Comentarios
COMMENT ON TABLE producto_proveedor IS 'Relación muchos a muchos entre productos y proveedores';
COMMENT ON COLUMN producto_proveedor.precio_compra IS 'Precio de compra específico de este proveedor';
COMMENT ON COLUMN producto_proveedor.es_proveedor_principal IS 'Indica si este es el proveedor principal del producto';
