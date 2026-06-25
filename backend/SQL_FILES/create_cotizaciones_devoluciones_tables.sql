-- ============================================================================
-- Cotizaciones / Proformas  y  Devoluciones / Notas de credito
-- ----------------------------------------------------------------------------
-- Script IDEMPOTENTE (seguro de re-ejecutar, tambien en produccion).
-- Modelos Django con managed=False mapean estas tablas.
-- ============================================================================

-- ───────────────────────── COTIZACIONES / PROFORMAS ────────────────────────
CREATE TABLE IF NOT EXISTS cotizaciones (
    id_cotizacion SERIAL PRIMARY KEY,
    id_cliente    INTEGER NOT NULL REFERENCES cliente(id_cliente),
    fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
    validez_dias  INTEGER NOT NULL DEFAULT 15,
    total         DECIMAL(10, 2) NOT NULL DEFAULT 0,
    estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente',  -- pendiente|aprobada|rechazada|convertida
    id_venta      INTEGER REFERENCES ventas(id_venta) ON DELETE SET NULL,  -- venta generada al convertir
    notas         TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS producto_cotizacion (
    id_cotizacion   INTEGER NOT NULL REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE,
    id_producto     INTEGER NOT NULL REFERENCES productos(id_producto),
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON cotizaciones(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado  ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_producto_cotizacion_cot ON producto_cotizacion(id_cotizacion);

-- ──────────────────── DEVOLUCIONES / NOTAS DE CREDITO ───────────────────────
CREATE TABLE IF NOT EXISTS devoluciones (
    id_devolucion SERIAL PRIMARY KEY,
    id_venta      INTEGER REFERENCES ventas(id_venta) ON DELETE SET NULL,
    id_cliente    INTEGER REFERENCES cliente(id_cliente),
    fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo        TEXT,
    total         DECIMAL(10, 2) NOT NULL DEFAULT 0,
    estado        VARCHAR(20) NOT NULL DEFAULT 'procesada',  -- procesada|anulada
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS producto_devolucion (
    id_devolucion   INTEGER NOT NULL REFERENCES devoluciones(id_devolucion) ON DELETE CASCADE,
    id_producto     INTEGER NOT NULL REFERENCES productos(id_producto),
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_venta   ON devoluciones(id_venta);
CREATE INDEX IF NOT EXISTS idx_devoluciones_cliente ON devoluciones(id_cliente);
CREATE INDEX IF NOT EXISTS idx_producto_devolucion_dev ON producto_devolucion(id_devolucion);
