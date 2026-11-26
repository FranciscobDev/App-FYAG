-- 016 · Entrega y devolución de herramientas a técnicos + alerta de atraso [BACK-2]
-- Idempotente.

INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad)
VALUES (
    'dias_max_prestamo_herramienta',
    'Días de préstamo de una herramienta antes de alertar por no devolución',
    7,
    1,
    90,
    'días'
)
ON CONFLICT (clave) DO NOTHING;

CREATE TABLE IF NOT EXISTS prestamos_herramienta (
    id_prestamo SERIAL PRIMARY KEY,
    id_herramienta INT NOT NULL REFERENCES herramientas(id_herramienta),
    id_tecnico INT NOT NULL REFERENCES usuario(id_usuario),
    id_proyecto INT NULL REFERENCES proyecto(id_proyecto),
    id_bodeguero INT NULL REFERENCES usuario(id_usuario),
    fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion TIMESTAMPTZ NULL,
    estado_devolucion VARCHAR(10) NULL CHECK (estado_devolucion IN ('bueno', 'dañado')),
    observacion TEXT NULL,
    alerta_atraso_enviada BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (
        (fecha_devolucion IS NULL AND estado_devolucion IS NULL)
        OR (fecha_devolucion IS NOT NULL AND estado_devolucion IS NOT NULL)
    )
);

-- Una herramienta no puede tener dos préstamos abiertos a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestamo_herramienta_abierto
    ON prestamos_herramienta (id_herramienta) WHERE fecha_devolucion IS NULL;
CREATE INDEX IF NOT EXISTS idx_prestamos_herramienta_historial
    ON prestamos_herramienta (id_herramienta, fecha_entrega DESC);

INSERT INTO configuracion_correo_alertas (tipo_alerta, codigo_historia, descripcion, enviar_correo)
VALUES ('herramienta_no_devuelta', 'H43', 'Herramienta no devuelta tras 7 días o al cerrar el proyecto', TRUE)
ON CONFLICT (tipo_alerta) DO NOTHING;
