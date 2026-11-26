-- 017 · Alertas anticipadas de mantenimiento de herramientas (H40) y registro de mantenimientos [BACK-1]
-- Idempotente.

INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES
    ('dias_aviso_mantenimiento_previo', 'Primer aviso de mantenimiento de herramienta: días antes del vencimiento', 7, 2, 60, 'días'),
    ('dias_aviso_mantenimiento_final', 'Segundo aviso de mantenimiento de herramienta: días antes del vencimiento', 1, 0, 30, 'días')
ON CONFLICT (clave) DO NOTHING;

-- Fecha de mantenimiento para la cual ya se envió cada aviso (evita duplicados y se re-arma sola al cambiar la fecha)
ALTER TABLE herramientas
    ADD COLUMN IF NOT EXISTS aviso_mant_previo_para DATE NULL,
    ADD COLUMN IF NOT EXISTS aviso_mant_final_para DATE NULL;

CREATE TABLE IF NOT EXISTS mantenimientos_herramienta (
    id_mantenimiento SERIAL PRIMARY KEY,
    id_herramienta INT NOT NULL REFERENCES herramientas(id_herramienta),
    fecha_realizada DATE NOT NULL,
    fecha_programada_anterior DATE NULL,
    fecha_siguiente DATE NOT NULL,
    observacion TEXT NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (fecha_siguiente > fecha_realizada)
);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_herramienta
    ON mantenimientos_herramienta (id_herramienta, fecha_realizada DESC);

INSERT INTO configuracion_correo_alertas (tipo_alerta, codigo_historia, descripcion, enviar_correo)
VALUES ('mantenimiento_herramienta_proximo', 'H40', 'Mantenimiento de herramienta próximo a vencer', TRUE)
ON CONFLICT (tipo_alerta) DO NOTHING;
