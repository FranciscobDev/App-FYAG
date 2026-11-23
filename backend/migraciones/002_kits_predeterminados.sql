-- =============================================================================
-- 002 · Kits predeterminados y vinculación con proyectos
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
-- =============================================================================

-- 1. Tabla de Kits Predeterminados de Proyecto
CREATE TABLE IF NOT EXISTS kit_proyecto (
    id_kit_proyecto SERIAL PRIMARY KEY,
    disponible_kit INT DEFAULT 0,
    nombre_kit VARCHAR(250) NOT NULL,
    descripcion_kit VARCHAR(250),
    categoria VARCHAR(50)
);

-- 2. Detalle de Insumos en el Kit
CREATE TABLE IF NOT EXISTS detalle_kit (
    id_detalle_kit SERIAL PRIMARY KEY,
    id_kit_proyecto INT NOT NULL REFERENCES kit_proyecto(id_kit_proyecto) ON DELETE CASCADE,
    id_articulo INT NOT NULL REFERENCES articulo(id_articulo),
    cantidad_requerida_kit NUMERIC(10,2) NOT NULL
);

-- 3. Insumos vinculados al proyecto (poblados automáticamente al asignar un kit)
CREATE TABLE IF NOT EXISTS articulo_en_proyecto (
    id_articulo_proyecto SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    id_articulo INT NOT NULL REFERENCES articulo(id_articulo),
    cantidad NUMERIC(10,2) NOT NULL,
    id_unidad INT
);

-- 4. Índices para optimizar consultas de kits y proyectos
CREATE INDEX IF NOT EXISTS idx_detalle_kit_id_kit ON detalle_kit (id_kit_proyecto);
CREATE INDEX IF NOT EXISTS idx_articulo_en_proyecto_id_proyecto ON articulo_en_proyecto (id_proyecto);

