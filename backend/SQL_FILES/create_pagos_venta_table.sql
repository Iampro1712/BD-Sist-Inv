-- ============================================================================
-- Pago por adelantado / abonos a ventas (funcionalidad de anticipos)
-- ----------------------------------------------------------------------------
-- Script IDEMPOTENTE: es seguro ejecutarlo varias veces, también en produccion.
-- Las tablas del sistema se crean por SQL (modelos Django con managed=False),
-- por eso este cambio de esquema se aplica aqui y NO por migraciones de Django.
-- ============================================================================

-- 1. Columnas de estado de pago en la tabla de ventas ------------------------
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_pagado    DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS saldo_pendiente DECIMAL(10, 2);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado_pago     VARCHAR(20)    NOT NULL DEFAULT 'pendiente';

-- 2. Tabla de pagos / abonos -------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos_venta (
    id_pago     SERIAL PRIMARY KEY,
    id_venta    INTEGER NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    monto       DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
    fecha_pago  DATE NOT NULL DEFAULT CURRENT_DATE,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
    referencia  VARCHAR(100),
    notas       TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagos_venta_id_venta ON pagos_venta(id_venta);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_fecha    ON pagos_venta(fecha_pago);

-- 3. Inicializar el saldo de las ventas existentes ---------------------------
--    Trampa #1: el total real de una venta de PRODUCTOS se calcula sumando
--    producto_venta (precio_unitario * cantidad). La columna ventas.total solo
--    es fiable cuando la venta no tiene productos (p. ej. servicios), por lo que
--    se usa unicamente como respaldo.
UPDATE ventas v
SET saldo_pendiente = GREATEST(
        COALESCE(
            NULLIF(
                (SELECT SUM(pv.precio_unitario * pv.cantidad)
                 FROM producto_venta pv
                 WHERE pv.id_venta = v.id_venta),
                0
            ),
            v.total
        ) - v.monto_pagado,
        0
    )
WHERE v.saldo_pendiente IS NULL;
