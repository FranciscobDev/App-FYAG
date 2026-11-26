-- =============================================================================
-- 011 · Registro transaccional de mermas de inventario valorizadas a PMP [BACK-2]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_codigo_merma START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS mermas_bodega (
    id_merma SERIAL PRIMARY KEY,
    codigo_merma VARCHAR(40) NOT NULL UNIQUE,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(80) NOT NULL,
    observacion VARCHAR(250) NOT NULL,
    pmp_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    perdida_total BIGINT NOT NULL DEFAULT 0,
    disponible_anterior NUMERIC(12,3) NOT NULL,
    disponible_nuevo NUMERIC(12,3) NOT NULL CHECK (disponible_nuevo >= 0),
    id_movimiento_cardex INT NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mermas_bodega_articulo
    ON mermas_bodega (id_articulo, fecha_registro DESC);
