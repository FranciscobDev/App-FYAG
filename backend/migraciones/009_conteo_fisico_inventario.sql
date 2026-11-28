-- =============================================================================
-- 009 · Conteo físico de inventario con bloqueo de movimientos y umbral H39 [BACK-1]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

-- 1. Parámetro de umbral de diferencia en conteo físico (H39: 5 % por defecto)
INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES (
    'umbral_diferencia_conteo',
    'Umbral porcentual máximo de diferencia en conteo físico para ajuste directo sin firma del Administrador (H39)',
    5,
    1,
    100,
    '%'
)
ON CONFLICT (clave) DO NOTHING;

-- 2. Bandera de bloqueo por conteo en articulos_stock
ALTER TABLE articulos_stock
    ADD COLUMN IF NOT EXISTS bloqueado_por_conteo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS id_conteo_activo INT NULL;

-- 3. Secuencia y tabla de conteos físicos
CREATE SEQUENCE IF NOT EXISTS seq_codigo_conteo START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS conteos_fisicos (
    id_conteo SERIAL PRIMARY KEY,
    codigo_conteo VARCHAR(40) NOT NULL UNIQUE,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    stock_sistema NUMERIC(12,3) NOT NULL CHECK (stock_sistema >= 0),
    stock_contado NUMERIC(12,3) NULL CHECK (stock_contado >= 0),
    diferencia_cantidad NUMERIC(12,3) NULL,
    diferencia_porcentaje NUMERIC(8,2) NULL,
    pmp_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    diferencia_valor BIGINT NULL,
    umbral_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    estado VARCHAR(30) NOT NULL DEFAULT 'En conteo'
        CHECK (estado IN ('En conteo', 'Ajustado directo', 'Pendiente aprobación', 'Aprobado', 'Rechazado')),
    bloqueo_activo BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones VARCHAR(250) NULL,
    motivo_rechazo VARCHAR(250) NULL,
    bodeguero_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    aprobador_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    id_movimiento_cardex INT NULL,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_conteo TIMESTAMPTZ NULL,
    fecha_resolucion TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_conteos_fisicos_articulo
    ON conteos_fisicos (id_articulo, estado);
