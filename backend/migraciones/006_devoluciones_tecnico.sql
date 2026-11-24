-- [BACK-2] Devoluciones de sobrante declaradas por el técnico.
-- Todas las sentencias son idempotentes (IF NOT EXISTS) porque se ejecutan en cada arranque.

-- 1. Uso en terreno: cantidad de cada insumo que el técnico consumió en un proyecto.
--    Es la fuente de `cantidad_utilizada` al validar una devolución.
CREATE TABLE IF NOT EXISTS uso_insumos_proyecto (
    id_uso SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad_utilizada NUMERIC(12,3) NOT NULL CHECK (cantidad_utilizada > 0),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_registro INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_uso_insumos_proyecto_tecnico
    ON uso_insumos_proyecto (proyecto_id, tecnico_id, id_articulo);

-- 2. Cabecera de la devolución. Nace siempre en 'En tránsito' hasta la confirmación física de bodega.
CREATE TABLE IF NOT EXISTS devoluciones_tecnico (
    id_devolucion SERIAL PRIMARY KEY,
    codigo_devolucion VARCHAR(40) NULL UNIQUE,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    tecnico_rut VARCHAR(20) NOT NULL DEFAULT '',
    tecnico_nombre VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'En tránsito' CHECK (estado IN ('En tránsito', 'Recibida')),
    fecha_declaracion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_declara INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_tecnico_proyecto
    ON devoluciones_tecnico (proyecto_id, tecnico_id);

-- 3. Líneas de la devolución. Guardan una foto de retirado y utilizado al momento de declarar,
--    para que la auditoría no dependa de datos que puedan cambiar después.
CREATE TABLE IF NOT EXISTS devolucion_lineas (
    id_devolucion_linea SERIAL PRIMARY KEY,
    id_devolucion INT NOT NULL REFERENCES devoluciones_tecnico(id_devolucion) ON DELETE CASCADE,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad_retirada NUMERIC(12,3) NOT NULL CHECK (cantidad_retirada >= 0),
    cantidad_utilizada NUMERIC(12,3) NOT NULL CHECK (cantidad_utilizada >= 0),
    cantidad_declarada NUMERIC(12,3) NOT NULL,
    cantidad_recibida NUMERIC(12,3) NULL CHECK (cantidad_recibida >= 0),
    -- Barrera en base de datos: nunca puede declararse más que el sobrante (retirado - utilizado)
    CONSTRAINT chk_devolucion_no_excede_sobrante
        CHECK (cantidad_declarada > 0 AND cantidad_declarada <= cantidad_retirada - cantidad_utilizada)
);

CREATE INDEX IF NOT EXISTS idx_devolucion_lineas_devolucion
    ON devolucion_lineas (id_devolucion);
