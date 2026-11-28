-- =============================================================================
-- 003 · Asignaciones de proyecto con historial y unicidad activa
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
-- =============================================================================

-- 1. Crear tabla asignaciones_proyecto si no existe
CREATE TABLE IF NOT EXISTS asignaciones_proyecto (
    id_asignacion SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMPTZ,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Migrar registros de la tabla previa proyecto_tecnico si existe físicamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'proyecto_tecnico' 
          AND table_type = 'BASE TABLE'
    ) THEN
        INSERT INTO asignaciones_proyecto (proyecto_id, tecnico_id, fecha_asignacion, activo)
        SELECT pt.id_proyecto, pt.id_usuario, COALESCE(pt.fecha_asignacion, CURRENT_TIMESTAMP), TRUE
        FROM proyecto_tecnico pt
        ON CONFLICT DO NOTHING;

        -- Renombrar tabla legacy para respaldar
        ALTER TABLE proyecto_tecnico RENAME TO proyecto_tecnico_legacy;
    END IF;
END $$;

-- 3. Índice único parcial: Impide duplicar una asignación activa (proyecto_id, tecnico_id)
CREATE UNIQUE INDEX IF NOT EXISTS uk_asignacion_activa_proyecto_tecnico
ON asignaciones_proyecto (proyecto_id, tecnico_id)
WHERE activo = TRUE;

-- 4. Vista de compatibilidad proyecto_tecnico (apunta solo a los activos)
CREATE OR REPLACE VIEW proyecto_tecnico AS
SELECT 
    proyecto_id AS id_proyecto,
    tecnico_id AS id_usuario,
    fecha_asignacion
FROM asignaciones_proyecto
WHERE activo = TRUE;

