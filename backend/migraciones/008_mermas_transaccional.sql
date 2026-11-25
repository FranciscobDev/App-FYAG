-- =============================================================================
-- 008 · Mermas transaccionales: pérdida valorizada con exactitud decimal y motivo
-- Idempotente.
-- =============================================================================
ALTER TABLE mermas ALTER COLUMN precio_unitario TYPE NUMERIC(12,2);
ALTER TABLE mermas ALTER COLUMN perdida_valor_total TYPE NUMERIC(14,2);
ALTER TABLE mermas ADD COLUMN IF NOT EXISTS motivo_merma VARCHAR(30) NOT NULL DEFAULT 'otro';
