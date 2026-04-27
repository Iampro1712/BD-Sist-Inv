-- 7. Script SQL
-- Archivo .sql con:
-- Sentencias CREATE TABLE
-- Sentencias INSERT con datos de prueba

-- ==========================================
-- CREACIÓN DE TABLAS
-- ==========================================

-- Tabla: proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    nombre_empresa VARCHAR(255) NOT NULL,
    persona_contacto VARCHAR(255),
    telefono VARCHAR(50),
    email VARCHAR(255),
    direccion TEXT
);

-- Tabla: marcas
CREATE TABLE IF NOT EXISTS marcas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: categorias
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: productos
CREATE TABLE IF NOT EXISTS productos (
    id_producto SERIAL PRIMARY KEY,
    sku_producto VARCHAR(100) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    cantidad_actual INTEGER DEFAULT 0,
    cantidad_total INTEGER DEFAULT 0,
    cantidad_minima INTEGER DEFAULT 0,
    precio_compra_unitario INTEGER NOT NULL,
    precio_final DECIMAL(10, 2) NOT NULL
);

-- Tabla: cliente
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(255)
);

-- Tabla: motos
CREATE TABLE IF NOT EXISTS motos (
    id_moto SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    "aÑo" INTEGER NOT NULL,
    placa VARCHAR(20) UNIQUE NOT NULL
);

-- Tabla: servicio_motos
CREATE TABLE IF NOT EXISTS servicio_motos (
    id_servicio SERIAL PRIMARY KEY,
    id_moto INTEGER NOT NULL REFERENCES motos(id_moto) ON DELETE CASCADE,
    fecha_servicio DATE NOT NULL,
    tipo_servicio VARCHAR(255) NOT NULL,
    descripcion TEXT,
    costo DECIMAL(10, 2) NOT NULL
);

-- Tabla: servicios (Catálogo)
CREATE TABLE IF NOT EXISTS servicios (
    id_servicio SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(255) NOT NULL,
    precio_mano_obra DECIMAL(10, 2) NOT NULL,
    diagnostico TEXT,
    fecha_realizacion DATE,
    id_empleado INTEGER,
    id_moto INTEGER
);

-- Tabla: orden_compra
CREATE TABLE IF NOT EXISTS orden_compra (
    id_orden SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL, -- Referencia lógica a proveedores
    id_estado INTEGER NOT NULL,
    fecha_creacion DATE NOT NULL
);

-- Tabla: detalles_orden_compra
CREATE TABLE IF NOT EXISTS detalles_orden_compra (
    id SERIAL PRIMARY KEY,
    orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id_orden) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE PROTECT,
    cantidad INTEGER NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- Tabla: ventas (OrdenVenta)
CREATE TABLE IF NOT EXISTS ventas (
    id_venta SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL, -- Referencia lógica a cliente
    fecha DATE NOT NULL,
    total DECIMAL(10, 2) DEFAULT 0
);

-- Tabla: detalles_orden_venta
CREATE TABLE IF NOT EXISTS detalles_orden_venta (
    id SERIAL PRIMARY KEY,
    orden_venta_id INTEGER NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE PROTECT,
    cantidad INTEGER NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- Tabla: movimientos_inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE PROTECT,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad INTEGER NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    referencia VARCHAR(100),
    tipo_referencia VARCHAR(20) CHECK (tipo_referencia IN ('ORDEN_COMPRA', 'ORDEN_VENTA', 'AJUSTE_MANUAL')),
    notas TEXT
);

-- ==========================================
-- POBLACIÓN DE DATOS (SEED DATA)
-- ==========================================

-- Insertar Proveedores
INSERT INTO proveedores (nombre_empresa, persona_contacto, telefono, email, direccion) VALUES
('MotoPartes Global', 'Roberto Gomez', '555-0101', 'contacto@motopartes.com', 'Av. Principal 123'),
('Lubricantes Express', 'Ana Martinez', '555-0102', 'ventas@lubricantes.com', 'Calle Industrial 45');

-- Insertar Marcas
INSERT INTO marcas (nombre, descripcion) VALUES
('Honda', 'Fabricante japonés de motocicletas'),
('Yamaha', 'Fabricante japonés de motocicletas'),
('Suzuki', 'Fabricante japonés de motocicletas'),
('Kawasaki', 'Fabricante japonés de motocicletas'),
('Bajaj', 'Fabricante indio de motocicletas');

-- Insertar Categorías
INSERT INTO categorias (nombre, descripcion) VALUES
('Repuestos', 'Partes mecánicas y eléctricas'),
('Lubricantes', 'Aceites y grasas'),
('Accesorios', 'Cascos, guantes, etc.');

-- Insertar Productos
INSERT INTO productos (sku_producto, nombre, cantidad_actual, cantidad_total, cantidad_minima, precio_compra_unitario, precio_final) VALUES
('ACE-001', 'Aceite Sintético 10W-40', 50, 50, 10, 350, 550.00),
('FIL-001', 'Filtro de Aceite Universal', 30, 30, 5, 100, 180.00),
('PAS-001', 'Pastillas de Freno Delanteras', 20, 20, 5, 450, 750.00),
('BUJ-001', 'Bujía NGK', 100, 100, 20, 80, 150.00);

-- Insertar Clientes (Datos de populate_clientes_motos.py)
INSERT INTO cliente (nombre, telefono, email) VALUES
('Juan Pérez', '809-555-0101', 'juan.perez@email.com'),       -- ID 1
('María González', '809-555-0102', 'maria.gonzalez@email.com'), -- ID 2
('Carlos Rodríguez', '809-555-0103', 'carlos.rodriguez@email.com'), -- ID 3
('Ana Martínez', '809-555-0104', 'ana.martinez@email.com'),     -- ID 4
('Luis Fernández', '809-555-0105', 'luis.fernandez@email.com'), -- ID 5
('Patricia Sánchez', '809-555-0106', 'patricia.sanchez@email.com'), -- ID 6
('Roberto Díaz', '809-555-0107', 'roberto.diaz@email.com');     -- ID 7

-- Insertar Motos (Datos de populate_clientes_motos.py)
INSERT INTO motos (id_cliente, marca, modelo, "aÑo", placa) VALUES
(1, 'Honda', 'CB190R', 2022, 'A123456'),       -- ID 1 (Juan)
(2, 'Yamaha', 'FZ-16', 2021, 'B234567'),       -- ID 2 (Maria)
(2, 'Yamaha', 'NMAX 155', 2023, 'B234568'),    -- ID 3 (Maria)
(3, 'Suzuki', 'GN125', 2020, 'C345678'),       -- ID 4 (Carlos)
(4, 'Honda', 'PCX 150', 2023, 'D456789'),      -- ID 5 (Ana)
(5, 'Kawasaki', 'Ninja 400', 2022, 'E567890'), -- ID 6 (Luis)
(5, 'Kawasaki', 'Z125 Pro', 2021, 'E567891'),  -- ID 7 (Luis)
(6, 'Bajaj', 'Pulsar NS200', 2021, 'F678901'), -- ID 8 (Patricia)
(7, 'Honda', 'Wave 110', 2019, 'G789012');     -- ID 9 (Roberto)

-- Insertar Servicios a Motos (Datos de populate_clientes_motos.py)
INSERT INTO servicio_motos (id_moto, fecha_servicio, tipo_servicio, descripcion, costo) VALUES
-- Juan Perez (Moto 1)
(1, CURRENT_DATE - 30, 'Cambio de aceite', 'Cambio de aceite y filtro, revisión general', 550.00),
(1, CURRENT_DATE - 90, 'Mantenimiento preventivo', 'Ajuste de cadena, revisión de frenos', 920.00),

-- Maria Gonzalez (Moto 2, 3)
(2, CURRENT_DATE - 15, 'Reparación de frenos', 'Cambio de pastillas de freno delanteras', 1180.00),
(3, CURRENT_DATE - 45, 'Cambio de aceite', 'Cambio de aceite sintético y filtro', 660.00),

-- Carlos Rodriguez (Moto 4)
(4, CURRENT_DATE - 60, 'Mantenimiento general', 'Cambio de aceite, ajuste de carburador, limpieza de filtro', 1030.00),
(4, CURRENT_DATE - 120, 'Cambio de neumáticos', 'Cambio de neumático trasero', 1650.00),

-- Ana Martinez (Moto 5)
(5, CURRENT_DATE - 20, 'Cambio de aceite', 'Primer servicio - cambio de aceite y revisión', 590.00),

-- Luis Fernandez (Moto 6, 7)
(6, CURRENT_DATE - 10, 'Reparación eléctrica', 'Cambio de batería y revisión del sistema eléctrico', 1290.00),
(6, CURRENT_DATE - 75, 'Cambio de aceite', 'Cambio de aceite sintético y filtro', 735.00),
(7, CURRENT_DATE - 40, 'Mantenimiento preventivo', 'Revisión general y ajustes', 810.00),

-- Patricia Sanchez (Moto 8)
(8, CURRENT_DATE - 25, 'Cambio de cadena', 'Cambio de kit de arrastre completo', 2025.00),

-- Roberto Diaz (Moto 9)
(9, CURRENT_DATE - 50, 'Cambio de aceite', 'Cambio de aceite mineral y limpieza', 440.00),
(9, CURRENT_DATE - 100, 'Reparación de motor', 'Ajuste de válvulas y limpieza de carburador', 1470.00),
(9, CURRENT_DATE - 150, 'Cambio de neumáticos', 'Cambio de ambos neumáticos', 2210.00);

-- Insertar Servicios (Catálogo)
INSERT INTO servicios (nombre, tipo, precio_mano_obra, diagnostico) VALUES
('Cambio de Aceite Básico', 'Mantenimiento', 200.00, 'Revisión de nivel de aceite'),
('Afinación Completa', 'Mantenimiento', 800.00, 'Limpieza de carburador, ajuste de válvulas');

-- Insertar Orden de Compra
INSERT INTO orden_compra (id_proveedor, id_estado, fecha_creacion) VALUES
(1, 1, CURRENT_DATE - 10);

-- Insertar Detalles Orden Compra
INSERT INTO detalles_orden_compra (orden_compra_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 10, 350.00, 3500.00),
(1, 2, 5, 100.00, 500.00);

-- Insertar Ventas
INSERT INTO ventas (id_cliente, fecha, total) VALUES
(1, CURRENT_DATE - 5, 730.00);

-- Insertar Detalles Venta
INSERT INTO detalles_orden_venta (orden_venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 550.00, 550.00),
(1, 2, 1, 180.00, 180.00);

-- Insertar Movimientos de Inventario
INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, referencia, tipo_referencia, notas) VALUES
(1, 'ENTRADA', 10, '1', 'ORDEN_COMPRA', 'Recepción de pedido'),
(1, 'SALIDA', 1, '1', 'ORDEN_VENTA', 'Venta mostrador');
