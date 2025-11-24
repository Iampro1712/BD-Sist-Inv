-- Script para crear las tablas de motos y servicios

-- Tabla motos (si no existe)
CREATE TABLE IF NOT EXISTS motos (
    id_moto SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    "aÑo" INTEGER NOT NULL,
    placa VARCHAR(20) UNIQUE NOT NULL
);

-- Tabla servicio_motos
CREATE TABLE IF NOT EXISTS servicio_motos (
    id_servicio SERIAL PRIMARY KEY,
    id_moto INTEGER NOT NULL REFERENCES motos(id_moto) ON DELETE CASCADE,
    fecha_servicio DATE NOT NULL,
    tipo_servicio VARCHAR(255) NOT NULL,
    descripcion TEXT,
    costo DECIMAL(10, 2) NOT NULL
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_motos_cliente ON motos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_servicio_motos_moto ON servicio_motos(id_moto);
CREATE INDEX IF NOT EXISTS idx_servicio_motos_fecha ON servicio_motos(fecha_servicio);

-- Comentarios
COMMENT ON TABLE motos IS 'Tabla de motos de clientes';
COMMENT ON TABLE servicio_motos IS 'Tabla de servicios realizados a motos';
