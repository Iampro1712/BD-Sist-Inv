-- Agregar columna id_proveedor a la tabla productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS id_proveedor INTEGER;

-- Agregar foreign key constraint
ALTER TABLE productos
ADD CONSTRAINT fk_productos_proveedor 
FOREIGN KEY (id_proveedor) 
REFERENCES proveedores(id_proveedor) 
ON DELETE SET NULL;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(id_proveedor);

-- Comentario
COMMENT ON COLUMN productos.id_proveedor IS 'Proveedor principal del producto';
