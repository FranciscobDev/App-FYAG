-- =============================================================================
-- 001 · Seguridad, auditoría y parámetros del sistema
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
-- =============================================================================

-- 1. Campos de bloqueo de cuenta (ya existen en estructura_db.md; se asegura su presencia)
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ NULL;

-- 2. Bitácora: estado anterior/nuevo en JSON y referencia exacta al registro afectado
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS valor_anterior TEXT;
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS valor_nuevo TEXT;
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS id_registro_afectado INT NULL;
CREATE INDEX IF NOT EXISTS idx_bitacora_entidad_registro
    ON bitacora_auditoria (entidad, id_registro_afectado);

-- 3. Parámetros configurables con rango validado
CREATE TABLE IF NOT EXISTS parametro_sistema (
    clave               VARCHAR(60) PRIMARY KEY,
    descripcion         VARCHAR(250) NOT NULL,
    valor               INT NOT NULL,
    valor_minimo        INT NOT NULL,
    valor_maximo        INT NOT NULL,
    unidad              VARCHAR(20) NOT NULL DEFAULT '',
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT parametro_valor_en_rango CHECK (valor BETWEEN valor_minimo AND valor_maximo)
);

INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad) VALUES
    ('intentos_bloqueo',           'Intentos fallidos de login permitidos antes de bloquear la cuenta', 5,  1, 10,   'intentos'),
    ('minutos_bloqueo',            'Duración del bloqueo de la cuenta tras exceder los intentos',       15, 1, 1440, 'minutos'),
    ('minutos_inactividad_sesion', 'Minutos de inactividad web antes de expirar la sesión',             30, 5, 480,  'minutos'),
    ('minutos_validez_enlace_clave', 'Validez del enlace de recuperación de contraseña',                30, 5, 120,  'minutos')
ON CONFLICT (clave) DO NOTHING;

-- 4. Sesiones del servidor (necesarias para medir inactividad; el JWT por sí solo no lo permite)
CREATE TABLE IF NOT EXISTS sesion_usuario (
    id_sesion        VARCHAR(36) PRIMARY KEY,
    id_usuario       INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    fecha_inicio     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revocada         BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sesion_usuario_id_usuario ON sesion_usuario (id_usuario);

-- 5. Enlaces de recuperación de contraseña: solo se guarda el hash SHA-256 del token
CREATE TABLE IF NOT EXISTS token_recuperacion_clave (
    id_token       SERIAL PRIMARY KEY,
    id_usuario     INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    token_hash     CHAR(64) NOT NULL UNIQUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en      TIMESTAMPTZ NOT NULL,
    usado_en       TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_token_recuperacion_usuario ON token_recuperacion_clave (id_usuario);
