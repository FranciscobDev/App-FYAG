-- 018 · Calificación de proveedores por OC (tiempo, calidad, precio) y ranking [BACK-2]
-- Idempotente.

ALTER TABLE proveedor
    ADD COLUMN IF NOT EXISTS calificacion_promedio NUMERIC(3,2) NULL,
    ADD COLUMN IF NOT EXISTS calificacion_tiempo NUMERIC(3,2) NULL,
    ADD COLUMN IF NOT EXISTS calificacion_calidad NUMERIC(3,2) NULL,
    ADD COLUMN IF NOT EXISTS calificacion_precio NUMERIC(3,2) NULL,
    ADD COLUMN IF NOT EXISTS total_calificaciones INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS calificaciones_proveedor (
    id_calificacion SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL UNIQUE REFERENCES ordenes_compra(id_orden_compra), -- una calificación por OC
    id_proveedor INT NOT NULL REFERENCES proveedor(id_proveedor),
    tiempo SMALLINT NOT NULL CHECK (tiempo BETWEEN 1 AND 5),
    calidad SMALLINT NOT NULL CHECK (calidad BETWEEN 1 AND 5),
    precio SMALLINT NOT NULL CHECK (precio BETWEEN 1 AND 5),
    promedio NUMERIC(3,2) NOT NULL,
    comentario VARCHAR(300) NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_calificacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_calificaciones_proveedor ON calificaciones_proveedor (id_proveedor, fecha_calificacion DESC);
CREATE INDEX IF NOT EXISTS idx_proveedor_calificacion ON proveedor (calificacion_promedio DESC NULLS LAST);
