-- =============================================================================
-- 013 · Bandeja centralizada de alertas filtradas por rol, lectura, correo opcional y retención 90 días [BACK-1]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

-- 1. Parámetro de retención de alertas (90 días por defecto)
INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES (
    'dias_retencion_alertas',
    'Días de conservación de alertas y notificaciones en la bandeja del sistema',
    90,
    7,
    365,
    'días'
)
ON CONFLICT (clave) DO NOTHING;

-- 2. Extender alertas_sistema con destinatario por rol/usuario, lectura y trazabilidad de correo
ALTER TABLE alertas_sistema
    ADD COLUMN IF NOT EXISTS rol_destino VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_destino INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fecha_lectura TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS correo_enviado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS destinatario_correo VARCHAR(150) NULL;

CREATE INDEX IF NOT EXISTS idx_alertas_sistema_rol_leida_fecha
    ON alertas_sistema (rol_destino, leida, fecha_creacion DESC);

-- 3. Configuración de envío opcional por correo electrónico según el tipo de alerta
CREATE TABLE IF NOT EXISTS configuracion_correo_alertas (
    tipo_alerta VARCHAR(50) PRIMARY KEY,
    codigo_historia VARCHAR(10) NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    enviar_correo BOOLEAN NOT NULL DEFAULT FALSE,
    correo_destino_defecto VARCHAR(150) NULL,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO configuracion_correo_alertas (tipo_alerta, codigo_historia, descripcion, enviar_correo)
VALUES
    ('stock_minimo_oc',                'H3',  'Stock disponible bajo el mínimo con borrador de OC automático', TRUE),
    ('merma_inventario',               'H17', 'Baja de stock disponible por merma valorizada a PMP',          TRUE),
    ('conteo_pendiente_aprobacion',    'H19', 'Conteo físico retenido por diferencia mayor al umbral H39',    TRUE),
    ('devolucion_en_transito',         'H21', 'Devolución de sobrante declarada por técnico en tránsito',     FALSE),
    ('diferencia_devolucion',          'H22', 'Diferencia entre material declarado por técnico y recibido',   TRUE),
    ('devolucion_proveedor_cuarentena','H24', 'Egreso de productos defectuosos desde cuarentena a proveedor', TRUE),
    ('discrepancia_factura_recepcion', 'H25', 'Discrepancia entre factura de compra y recepción de OC',       TRUE),
    ('recepcion_discrepancia',         'H33', 'Recepción de OC con ítems defectuosos o faltantes',            FALSE)
ON CONFLICT (tipo_alerta) DO NOTHING;
