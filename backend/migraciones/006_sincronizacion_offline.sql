-- =============================================================================
-- 006 · Sincronización offline por lotes (Hojas de Servicio y Checklists) [BACK-1]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
--
-- Modelo:
--   sync_registro          -> versión vigente en la central (la que ve la web).
--   sync_registro_version  -> historial COMPLETO de versiones (vigente, histórica y
--                             en conflicto). Nunca se borra ni se sobrescribe.
--   sync_foto              -> fotos adjuntas a una versión (máximo 5 MB cada una).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_registro (
    id_registro SERIAL PRIMARY KEY,
    tipo_registro VARCHAR(40) NOT NULL
        CHECK (tipo_registro IN ('hoja_servicio', 'checklist')),
    id_local VARCHAR(80) NOT NULL,
    id_usuario_creador INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    datos JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    origen_ultima_modificacion VARCHAR(10) NOT NULL DEFAULT 'movil'
        CHECK (origen_ultima_modificacion IN ('movil', 'central')),
    id_usuario_ultima_modificacion INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    tiene_conflicto BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_sync_registro_tipo_local UNIQUE (tipo_registro, id_local)
);

CREATE INDEX IF NOT EXISTS idx_sync_registro_conflicto
    ON sync_registro (id_registro) WHERE tiene_conflicto = TRUE;

CREATE TABLE IF NOT EXISTS sync_registro_version (
    id_version SERIAL PRIMARY KEY,
    id_registro INT NOT NULL REFERENCES sync_registro(id_registro) ON DELETE CASCADE,
    numero_version INT NULL,
    estado VARCHAR(12) NOT NULL
        CHECK (estado IN ('vigente', 'historica', 'conflicto')),
    origen VARCHAR(10) NOT NULL CHECK (origen IN ('movil', 'central')),
    base_version INT NULL,
    id_envio VARCHAR(80) NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    datos JSONB NOT NULL,
    fecha_cliente TIMESTAMPTZ NULL,
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_version_registro ON sync_registro_version (id_registro, estado);

-- Idempotencia: reenviar el mismo envío (reintento por mala señal) no duplica versiones.
CREATE UNIQUE INDEX IF NOT EXISTS uk_sync_version_envio
    ON sync_registro_version (id_registro, id_envio) WHERE id_envio IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_foto (
    id_foto SERIAL PRIMARY KEY,
    id_registro INT NOT NULL REFERENCES sync_registro(id_registro) ON DELETE CASCADE,
    id_version INT NOT NULL REFERENCES sync_registro_version(id_version) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    mime_type VARCHAR(80) NOT NULL,
    -- Defensa en profundidad: la base también rechaza fotos mayores a 5 MB.
    tamano_bytes INT NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880),
    contenido BYTEA NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_foto_version ON sync_foto (id_version);
