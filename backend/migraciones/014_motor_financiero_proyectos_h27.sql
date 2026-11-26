-- =============================================================================
-- 014 · Motor financiero por proyecto (H27), costo hora H39 y registro de horas H41 [BACK-1]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

-- 1. Parámetro configurable en H39 para el costo por hora hombre (CLP/hora)
INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES (
    'costo_hora_hombre',
    'Costo estándar por hora-hombre de técnico para valorización financiera de proyectos (H39)',
    15000,
    1000,
    500000,
    'CLP/h'
)
ON CONFLICT (clave) DO NOTHING;

-- 2. Columnas financieras y de semáforo en la tabla proyecto (H34 / H27)
ALTER TABLE proyecto
    ADD COLUMN IF NOT EXISTS presupuesto_materiales NUMERIC(14,2) NULL,
    ADD COLUMN IF NOT EXISTS costo_real_acumulado BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS margen_estimado BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS porcentaje_consumo_presupuesto NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS semaforo_financiero VARCHAR(20) NOT NULL DEFAULT 'verde';

-- 3. Tabla de registro de horas trabajadas por proyecto (H41)
CREATE TABLE IF NOT EXISTS horas_proyecto_h41 (
    id_registro_hora SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    tecnico_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    horas NUMERIC(10,2) NOT NULL CHECK (horas > 0),
    costo_hora_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    costo_total BIGINT NOT NULL DEFAULT 0,
    descripcion VARCHAR(250) NULL,
    fecha_trabajo DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_horas_proyecto_h41_proyecto
    ON horas_proyecto_h41 (proyecto_id, fecha_registro DESC);

-- 4. Configuración de correo para alertas financieras de proyecto (H27)
INSERT INTO configuracion_correo_alertas (tipo_alerta, codigo_historia, descripcion, enviar_correo)
VALUES
    ('presupuesto_proyecto_amarillo', 'H27', 'Proyecto alcanzó entre 80 % y 100 % de su presupuesto (Semáforo Amarillo)', TRUE),
    ('presupuesto_proyecto_rojo',     'H27', 'Proyecto superó el 100 % de su presupuesto (Semáforo Rojo - Sobrecosto)',   TRUE)
ON CONFLICT (tipo_alerta) DO NOTHING;
