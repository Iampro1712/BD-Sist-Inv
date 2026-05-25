-- Tabla para la bitácora de servicios de motos
CREATE TABLE IF NOT EXISTS bitacora_servicio (
    id_bitacora SERIAL PRIMARY KEY,
    id_servicio INTEGER NOT NULL REFERENCES servicio_motos(id_servicio) ON DELETE CASCADE,
    id_moto INTEGER NOT NULL REFERENCES motos(id_moto) ON DELETE CASCADE,
    
    -- Módulo de la bitácora
    modulo VARCHAR(50) NOT NULL CHECK (modulo IN ('recepcion', 'diagnostico', 'reparacion', 'entrega')),
    
    -- Información del registro
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT,
    
    -- Campos específicos por módulo
    -- Recepción
    nivel_gasolina VARCHAR(50),
    rayones_previos TEXT,
    
    -- Diagnóstico
    fallas_encontradas TEXT,
    
    -- Reparación
    trabajo_realizado TEXT,
    tecnico_responsable VARCHAR(255),
    
    -- Entrega
    checklist_salida TEXT,
    firma_cliente VARCHAR(255),
    
    -- Imágenes almacenadas en R2
    imagenes JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    creado_por VARCHAR(255),
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_bitacora_servicio ON bitacora_servicio(id_servicio);
CREATE INDEX IF NOT EXISTS idx_bitacora_moto ON bitacora_servicio(id_moto);
CREATE INDEX IF NOT EXISTS idx_bitacora_modulo ON bitacora_servicio(modulo);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_servicio(fecha_registro);

-- Comentarios
COMMENT ON TABLE bitacora_servicio IS 'Bitácora detallada de servicios de motos con imágenes en R2';
COMMENT ON COLUMN bitacora_servicio.modulo IS 'Módulo: recepcion, diagnostico, reparacion, entrega';
COMMENT ON COLUMN bitacora_servicio.imagenes IS 'Array JSON con URLs de imágenes en Cloudflare R2';
