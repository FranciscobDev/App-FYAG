-- =============================================================================
-- 012 · Generación y exportación en lote de códigos QR (H35, H18, H39 y H14) [BACK-1 / BACK-2]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

-- 1. Parámetro configurable en H39 para el tamaño de impresión de etiquetas QR (en milímetros)
INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES (
    'tamano_impresion_qr_mm',
    'Tamaño de impresión de etiquetas de código QR (ancho/alto en milímetros, H39)',
    50,
    25,
    150,
    'mm'
)
ON CONFLICT (clave) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS seq_codigo_qr_insumo START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS codigos_qr_insumos (
    id_codigo_qr SERIAL PRIMARY KEY,
    codigo_qr VARCHAR(100) NOT NULL UNIQUE,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    sku VARCHAR(60) NOT NULL,
    nombre_articulo VARCHAR(150) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL,
    categoria VARCHAR(60) NULL,
    ubicacion VARCHAR(120) NULL,
    lote VARCHAR(80) NULL,
    payload_qr TEXT NOT NULL UNIQUE,
    estado_asignacion VARCHAR(40) NOT NULL DEFAULT 'Pendiente de impresión'
        CHECK (estado_asignacion IN ('Pendiente de impresión', 'Impreso', 'Asignado a objeto físico')),
    asignado_objeto_fisico BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_asignacion TIMESTAMPTZ NULL,
    fecha_ultima_exportacion TIMESTAMPTZ NULL,
    id_usuario_creador INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE codigos_qr_insumos
    ADD COLUMN IF NOT EXISTS estado_asignacion VARCHAR(40) NOT NULL DEFAULT 'Pendiente de impresión',
    ADD COLUMN IF NOT EXISTS asignado_objeto_fisico BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_asignacion TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS fecha_ultima_exportacion TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_codigos_qr_insumos_articulo
    ON codigos_qr_insumos (id_articulo, fecha_creacion DESC);

-- [BACK-1] Índices funcionales B-Tree para búsqueda instantánea (< 200 ms) por código QR, SKU o código de barras (H18)
CREATE INDEX IF NOT EXISTS idx_codigos_qr_codigo_upper
    ON codigos_qr_insumos (UPPER(TRIM(codigo_qr)));

CREATE INDEX IF NOT EXISTS idx_codigos_qr_sku_upper
    ON codigos_qr_insumos (UPPER(TRIM(sku)));

ALTER TABLE insumos
    ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(80) NULL;

CREATE INDEX IF NOT EXISTS idx_insumos_sku_upper
    ON insumos (UPPER(TRIM(sku)));

CREATE INDEX IF NOT EXISTS idx_insumos_codigo_barras_upper
    ON insumos (UPPER(TRIM(codigo_barras)))
    WHERE codigo_barras IS NOT NULL;
