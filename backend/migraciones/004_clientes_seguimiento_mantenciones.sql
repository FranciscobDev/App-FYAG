-- =============================================================================
-- 004 · Clientes, asignación a proyectos y seguimiento de mantenciones periódicas
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
-- =============================================================================

-- 1. Asegurar tabla cliente y todas sus columnas
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente SERIAL PRIMARY KEY,
    rut_cliente VARCHAR(20) NOT NULL UNIQUE,
    razon_social VARCHAR(150) NOT NULL,
    giro VARCHAR(150),
    telefono VARCHAR(30),
    correo_contacto VARCHAR(150),
    direccion VARCHAR(250),
    nombre_contacto VARCHAR(150),
    banco VARCHAR(100),
    tipo_cuenta VARCHAR(50),
    numero_cuenta VARCHAR(100),
    calificacion_promedio NUMERIC(3,2) DEFAULT 5.00,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE cliente ADD COLUMN IF NOT EXISTS banco VARCHAR(100);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS tipo_cuenta VARCHAR(50);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(100);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS calificacion_promedio NUMERIC(3,2) DEFAULT 5.00;
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 2. Asegurar columna id_cliente en proyecto
ALTER TABLE proyecto ADD COLUMN IF NOT EXISTS id_cliente INT REFERENCES cliente(id_cliente) ON DELETE SET NULL;

-- 3. Tabla de Planes de Mantención y Seguimiento Periódico (cada N meses, por Kit o por Contrato)
CREATE TABLE IF NOT EXISTS plan_mantencion_cliente (
    id_plan SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_proyecto_origen INT REFERENCES proyecto(id_proyecto) ON DELETE SET NULL,
    titulo_plan VARCHAR(200) NOT NULL,
    modalidad VARCHAR(30) NOT NULL DEFAULT 'POR_KIT', -- 'POR_KIT' | 'POR_CONTRATO' | 'MIXTO'
    id_kit_proyecto INT REFERENCES kit_proyecto(id_kit_proyecto) ON DELETE SET NULL,
    codigo_contrato VARCHAR(80),
    frecuencia_meses INT NOT NULL DEFAULT 3 CHECK (frecuencia_meses BETWEEN 1 AND 60),
    fecha_ultima_mantencion DATE,
    fecha_proxima_mantencion DATE NOT NULL,
    costo_pactado INT NOT NULL DEFAULT 0,
    estado_plan VARCHAR(30) NOT NULL DEFAULT 'Activo', -- 'Activo' | 'Pausado' | 'Finalizado'
    notas_plan VARCHAR(300),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_mantencion_cliente ON plan_mantencion_cliente (id_cliente);
CREATE INDEX IF NOT EXISTS idx_plan_mantencion_proxima ON plan_mantencion_cliente (fecha_proxima_mantencion);

-- 4. Bitácora de Contacto y Seguimiento de Mantenciones
CREATE TABLE IF NOT EXISTS seguimiento_contacto_cliente (
    id_seguimiento SERIAL PRIMARY KEY,
    id_plan INT NOT NULL REFERENCES plan_mantencion_cliente(id_plan) ON DELETE CASCADE,
    fecha_contacto TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    canal_contacto VARCHAR(30) NOT NULL DEFAULT 'Teléfono', -- 'Teléfono' | 'Correo' | 'WhatsApp' | 'Visita'
    resultado_contacto VARCHAR(40) NOT NULL DEFAULT 'Cliente Contactado',
    id_proyecto_generado INT REFERENCES proyecto(id_proyecto) ON DELETE SET NULL,
    observaciones VARCHAR(300),
    id_usuario_ejecutor INT REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_seguimiento_contacto_plan ON seguimiento_contacto_cliente (id_plan);
