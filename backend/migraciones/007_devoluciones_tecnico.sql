-- =============================================================================
-- 007 · Devoluciones de técnicos a bodega: confirmación física, ajuste de costo y Cardex [BACK-1]
-- Extiende la tabla creada en 006_devoluciones_tecnico.sql de forma idempotente.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_codigo_devolucion START WITH 1 INCREMENT BY 1;

-- Columnas de confirmación y auditoría en la cabecera (y compatibilidad con esquemas previos)
ALTER TABLE devoluciones_tecnico
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(40) NULL,
    ADD COLUMN IF NOT EXISTS codigo_devolucion VARCHAR(40) NULL,
    ADD COLUMN IF NOT EXISTS tecnico_rut VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS tecnico_nombre VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS id_usuario_declara INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tiene_diferencia BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS observaciones_recepcion VARCHAR(250) NULL,
    ADD COLUMN IF NOT EXISTS bodeguero_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fecha_recepcion TIMESTAMPTZ NULL;

ALTER TABLE devoluciones_tecnico
    ALTER COLUMN codigo DROP NOT NULL;

-- Sincronizar codigo con codigo_devolucion
UPDATE devoluciones_tecnico
SET codigo = COALESCE(codigo, codigo_devolucion),
    codigo_devolucion = COALESCE(codigo_devolucion, codigo)
WHERE codigo IS NULL OR codigo_devolucion IS NULL;

-- Columnas de confirmación física y Cardex en las líneas
ALTER TABLE devolucion_lineas
    ADD COLUMN IF NOT EXISTS cantidad_retirada NUMERIC(12,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cantidad_utilizada NUMERIC(12,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cantidad_recibida NUMERIC(12,3) NULL,
    ADD COLUMN IF NOT EXISTS diferencia NUMERIC(12,3) NULL,
    ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2) NULL,
    ADD COLUMN IF NOT EXISTS id_movimiento_cardex INT NULL;

CREATE TABLE IF NOT EXISTS proyecto_costo_ajuste (
    id_ajuste SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    id_devolucion INT NULL REFERENCES devoluciones_tecnico(id_devolucion) ON DELETE RESTRICT,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monto BIGINT NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'devolucion_bodega',
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proyecto_costo_ajuste_proyecto ON proyecto_costo_ajuste (proyecto_id);

CREATE OR REPLACE VIEW vw_proyecto_costo_materiales AS
SELECT
    p.id_proyecto,
    COALESCE(e.costo_bruto, 0)::BIGINT AS costo_bruto_egresos,
    COALESCE(a.ajustes, 0)::BIGINT AS ajustes_devoluciones,
    (COALESCE(e.costo_bruto, 0) + COALESCE(a.ajustes, 0))::BIGINT AS costo_neto_materiales
FROM proyecto p
LEFT JOIN (
    SELECT eb.proyecto_id, SUM(ROUND(el.cantidad_egresada * el.costo_unitario_pmp)) AS costo_bruto
    FROM egresos_bodega eb
    JOIN egreso_lineas el ON el.id_egreso = eb.id_egreso
    GROUP BY eb.proyecto_id
) e ON e.proyecto_id = p.id_proyecto
LEFT JOIN (
    SELECT proyecto_id, SUM(monto) AS ajustes
    FROM proyecto_costo_ajuste
    GROUP BY proyecto_id
) a ON a.proyecto_id = p.id_proyecto;
