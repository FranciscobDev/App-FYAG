-- =============================================================================
-- 007 · Cardex filtrable por proyecto: columna id_proyecto en movimientos_inventario
-- Idempotente. Rellena los egresos históricos desde el texto "Proyecto #N" de su referencia.
-- =============================================================================
ALTER TABLE movimientos_inventario
    ADD COLUMN IF NOT EXISTS id_proyecto INT REFERENCES proyecto(id_proyecto);

UPDATE movimientos_inventario m
SET id_proyecto = p.id_proyecto
FROM proyecto p
WHERE m.id_proyecto IS NULL
  AND m.referencia ~ 'Proyecto #[0-9]+'
  AND p.id_proyecto = (substring(m.referencia FROM 'Proyecto #([0-9]+)'))::int;

CREATE INDEX IF NOT EXISTS idx_movimientos_inv_proyecto_fecha
    ON movimientos_inventario (id_proyecto, fecha_movimiento);
