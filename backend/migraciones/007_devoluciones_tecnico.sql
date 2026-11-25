-- =============================================================================
-- 007 · Devoluciones de técnicos a bodega: declaración, recepción real, costo y Cardex [BACK-1]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
--
--   devoluciones_tecnico   -> cabecera; nace 'En tránsito' (declarada por el técnico, H21).
--   devolucion_lineas      -> cantidad_declarada (técnico) vs cantidad_recibida (bodeguero) + diferencia.
--   proyecto_costo_ajuste  -> libro de ajustes de costo del proyecto (montos NEGATIVOS por devolución).
--   vw_proyecto_costo_materiales -> costo bruto de egresos, ajustes y costo neto por proyecto.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_codigo_devolucion START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS devoluciones_tecnico (
    id_devolucion SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE
        DEFAULT ('DEV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('seq_codigo_devolucion')::TEXT, 5, '0')),
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'En tránsito'
        CHECK (estado IN ('En tránsito', 'Recibida')),
    tiene_diferencia BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones_recepcion VARCHAR(250) NULL,
    bodeguero_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_declaracion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_recepcion TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_tecnico_estado ON devoluciones_tecnico (estado, fecha_declaracion DESC);
CREATE INDEX IF NOT EXISTS idx_devoluciones_tecnico_proyecto ON devoluciones_tecnico (proyecto_id);

CREATE TABLE IF NOT EXISTS devolucion_lineas (
    id_devolucion_linea SERIAL PRIMARY KEY,
    id_devolucion INT NOT NULL REFERENCES devoluciones_tecnico(id_devolucion) ON DELETE CASCADE,
    id_articulo INT NOT NULL,
    cantidad_declarada NUMERIC(12,3) NOT NULL CHECK (cantidad_declarada > 0),
    cantidad_recibida NUMERIC(12,3) NULL CHECK (cantidad_recibida IS NULL OR cantidad_recibida >= 0),
    diferencia NUMERIC(12,3) GENERATED ALWAYS AS (cantidad_recibida - cantidad_declarada) STORED,
    costo_unitario NUMERIC(12,2) NULL,
    id_movimiento_cardex INT NULL,
    CONSTRAINT uk_devolucion_linea_articulo UNIQUE (id_devolucion, id_articulo)
);

CREATE INDEX IF NOT EXISTS idx_devolucion_lineas_devolucion ON devolucion_lineas (id_devolucion);

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
