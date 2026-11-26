-- 019 · Dashboard de rentabilidad de proyectos cerrados: mermas por proyecto y presupuesto de mermas [BACK-1]
-- Idempotente.

ALTER TABLE mermas_bodega
    ADD COLUMN IF NOT EXISTS id_proyecto INT NULL REFERENCES proyecto(id_proyecto) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_mermas_bodega_proyecto ON mermas_bodega (id_proyecto) WHERE id_proyecto IS NOT NULL;

ALTER TABLE proyecto
    ADD COLUMN IF NOT EXISTS presupuesto_mermas NUMERIC(14,2) NOT NULL DEFAULT 0;
