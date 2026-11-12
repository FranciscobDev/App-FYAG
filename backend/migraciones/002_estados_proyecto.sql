-- =============================================================================
-- 002 · Control de estados de proyectos (Planificado, Activo, Cerrado)
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_proyecto_enum') THEN
        BEGIN
            ALTER TYPE estado_proyecto_enum ADD VALUE IF NOT EXISTS 'Activo';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE estado_proyecto_enum ADD VALUE IF NOT EXISTS 'Cerrado';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;
