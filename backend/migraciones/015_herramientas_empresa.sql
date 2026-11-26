-- Migración 015: Gestión de Herramientas de la Empresa (CRUD, Estados Operativos, QR y Deshabilitación Lógica)
-- Permite registrar código único, nombre, valor, estado operativo, próximo mantenimiento, QR opcional y deshabilitación lógica.

CREATE TABLE IF NOT EXISTS herramientas (
    id_herramienta SERIAL PRIMARY KEY,
    codigo_herramienta VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(80) NULL,
    valor BIGINT NOT NULL DEFAULT 0 CHECK (valor >= 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignada', 'en mantención', 'dada de baja')),
    fecha_proximo_mantenimiento DATE NULL,
    codigo_qr VARCHAR(100) NULL UNIQUE,
    ubicacion VARCHAR(120) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_herramientas_estado ON herramientas (estado);
CREATE INDEX IF NOT EXISTS idx_herramientas_activo ON herramientas (activo);
CREATE INDEX IF NOT EXISTS idx_herramientas_codigo_qr ON herramientas (codigo_qr);
CREATE INDEX IF NOT EXISTS idx_herramientas_proximo_mantenimiento ON herramientas (fecha_proximo_mantenimiento);

COMMENT ON TABLE herramientas IS 'Catálogo e inventario de herramientas operativas de la empresa';
COMMENT ON COLUMN herramientas.codigo_herramienta IS 'Código único identificador de la herramienta';
COMMENT ON COLUMN herramientas.estado IS 'Estado operativo: disponible, asignada, en mantención, dada de baja';
COMMENT ON COLUMN herramientas.activo IS 'Control de borrado lógico: se deshabilita en lugar de eliminar físicamente';
COMMENT ON COLUMN herramientas.codigo_qr IS 'Código QR opcional vinculado o autogenerado para escaneo rápido';
