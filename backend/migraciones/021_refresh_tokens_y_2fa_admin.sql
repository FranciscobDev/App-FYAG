-- Migración 021: Refresh tokens rotativos en sesion_usuario y autenticación de dos factores (2FA) para Administradores

ALTER TABLE sesion_usuario
    ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS refresh_expira_en TIMESTAMPTZ;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS requiere_2fa BOOLEAN NOT NULL DEFAULT FALSE;

-- Activar 2FA por defecto para las cuentas con rol Administrador (id_rol = 1)
UPDATE usuario
SET requiere_2fa = TRUE
WHERE id_rol = 1;

CREATE TABLE IF NOT EXISTS desafio_2fa_admin (
    id_desafio UUID PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    codigo_hash TEXT NOT NULL,
    intentos INT NOT NULL DEFAULT 0,
    expira_en TIMESTAMPTZ NOT NULL,
    consumido_en TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_desafio_2fa_usuario
    ON desafio_2fa_admin (id_usuario, expira_en);
