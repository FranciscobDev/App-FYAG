-- =============================================================================
-- 010 · Egreso desde cuarentena (devolución a proveedor con guía y seguimiento) [BACK-2]
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_codigo_devolucion_proveedor START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS devoluciones_proveedor (
    id_devolucion_proveedor SERIAL PRIMARY KEY,
    codigo_devolucion VARCHAR(40) NOT NULL UNIQUE,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    id_proveedor INT NULL REFERENCES proveedor(id_proveedor) ON DELETE SET NULL,
    id_orden_compra INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(250) NOT NULL,
    numero_guia_despacho VARCHAR(80) NOT NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'Pendiente de resolución'
        CHECK (estado IN ('Pendiente de resolución', 'Resuelta')),
    tipo_resolucion VARCHAR(40) NULL
        CHECK (tipo_resolucion IS NULL OR tipo_resolucion IN ('Nota de crédito', 'Reposición', 'Reembolso')),
    referencia_resolucion VARCHAR(150) NULL,
    notas_resolucion VARCHAR(250) NULL,
    id_movimiento_cardex INT NULL,
    id_movimiento_reposicion_cardex INT NULL,
    bodeguero_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    admin_resuelve_id INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_despacho TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_proveedor_articulo
    ON devoluciones_proveedor (id_articulo, estado);
