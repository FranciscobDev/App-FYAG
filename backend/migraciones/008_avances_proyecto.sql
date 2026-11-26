-- =============================================================================
-- 008 · Registro de avances y consumo de materiales en terreno (H-Técnico)
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

CREATE TABLE IF NOT EXISTS avances_proyecto (
    id_avance SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    tecnico_nombre VARCHAR(150) NOT NULL,
    porcentaje_avance NUMERIC(5,2) NOT NULL CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100),
    comentarios TEXT NOT NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avances_proyecto_proyecto
    ON avances_proyecto (proyecto_id, fecha_registro DESC);

-- Columna de vinculación en uso_insumos_proyecto para asociar el insumo al avance
ALTER TABLE uso_insumos_proyecto
    ADD COLUMN IF NOT EXISTS id_avance INT NULL REFERENCES avances_proyecto(id_avance) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uso_insumos_avance
    ON uso_insumos_proyecto (id_avance);
