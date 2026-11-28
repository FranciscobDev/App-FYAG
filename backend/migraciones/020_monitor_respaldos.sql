-- 020 · Monitor del respaldo diario en la nube y pruebas de restauración [BACK-2]
-- Idempotente.

INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES
    ('dias_retencion_respaldos', 'Días de conservación de los respaldos en la nube', 30, 7, 365, 'días'),
    ('horas_max_perdida_datos', 'Objetivo de punto de recuperación (RPO): horas máximas de datos que se pueden perder', 24, 1, 168, 'horas'),
    ('horas_max_recuperacion', 'Objetivo de tiempo de recuperación (RTO): horas máximas para restaurar', 4, 1, 72, 'horas'),
    ('dias_prueba_restauracion', 'Frecuencia mínima de la prueba de restauración (trimestral = 90 días)', 90, 30, 365, 'días')
ON CONFLICT (clave) DO NOTHING;

CREATE TABLE IF NOT EXISTS respaldos_ejecucion (
    id_respaldo SERIAL PRIMARY KEY,
    origen VARCHAR(12) NOT NULL DEFAULT 'automatico' CHECK (origen IN ('automatico', 'manual')),
    estado VARCHAR(8) NOT NULL CHECK (estado IN ('exito', 'fallo')),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    duracion_ms INT NOT NULL DEFAULT 0,
    tamano_bytes BIGINT NULL,
    ubicacion_nube VARCHAR(300) NULL,
    cifrado BOOLEAN NOT NULL DEFAULT FALSE,
    codigo_error VARCHAR(40) NULL,
    mensaje_error VARCHAR(500) NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_respaldos_ejecucion_fecha ON respaldos_ejecucion (fecha_inicio DESC);

CREATE TABLE IF NOT EXISTS pruebas_restauracion (
    id_prueba SERIAL PRIMARY KEY,
    fecha_prueba DATE NOT NULL,
    id_respaldo INT NULL REFERENCES respaldos_ejecucion(id_respaldo) ON DELETE SET NULL,
    resultado VARCHAR(10) NOT NULL CHECK (resultado IN ('exitosa', 'fallida')),
    tiempo_recuperacion_min INT NOT NULL CHECK (tiempo_recuperacion_min >= 0),
    cumple_rto BOOLEAN NOT NULL,
    observaciones VARCHAR(500) NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pruebas_restauracion_fecha ON pruebas_restauracion (fecha_prueba DESC);

INSERT INTO configuracion_correo_alertas (tipo_alerta, codigo_historia, descripcion, enviar_correo)
VALUES
    ('respaldo_fallido', 'SIS', 'Falló el respaldo diario de la base de datos en la nube', TRUE),
    ('respaldo_desactualizado', 'SIS', 'Sin respaldo exitoso dentro del objetivo de 24 horas (RPO)', TRUE),
    ('prueba_restauracion_pendiente', 'SIS', 'Prueba trimestral de restauración vencida', TRUE)
ON CONFLICT (tipo_alerta) DO NOTHING;
