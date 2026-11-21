-- =============================================================================
-- 005 · Órdenes de Compra (OC), numeración correlativa, aprobación PDF y recepción (H33)
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.
-- Se aplica automáticamente al iniciar el backend (services/migraciones.ts).
-- =============================================================================

-- 1. Asegurar tipo enumerado de estados de Orden de Compra
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_oc_enum') THEN
        CREATE TYPE estado_oc_enum AS ENUM (
            'Borrador',
            'Enviada',
            'Recibida parcial',
            'Recibida',
            'Cerrada',
            'Anulada'
        );
    END IF;
END $$;

-- 2. Secuencia para numeración correlativa de Órdenes de Compra
CREATE SEQUENCE IF NOT EXISTS seq_numero_oc START WITH 1 INCREMENT BY 1;

-- 3. Tabla principal de Órdenes de Compra
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id_orden_compra SERIAL PRIMARY KEY,
    numero_oc VARCHAR(50) NOT NULL UNIQUE DEFAULT ('OC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('seq_numero_oc')::TEXT, 5, '0')),
    proveedor_id INT NOT NULL REFERENCES proveedor(id_proveedor),
    estado estado_oc_enum NOT NULL DEFAULT 'Borrador',
    origen VARCHAR(50) NOT NULL DEFAULT 'Manual',
    fecha_estimada_oc DATE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    observaciones VARCHAR(250),
    fecha_aprobacion TIMESTAMPTZ NULL,
    id_usuario_aprobador INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    correo_enviado_a VARCHAR(150) NULL,
    fecha_envio_correo TIMESTAMPTZ NULL
);

ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS origen VARCHAR(50) NOT NULL DEFAULT 'Manual';
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_estimada_oc DATE;
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS observaciones VARCHAR(250);
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMPTZ NULL;
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS id_usuario_aprobador INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL;
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS correo_enviado_a VARCHAR(150) NULL;
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_envio_correo TIMESTAMPTZ NULL;

-- Sincronizar secuencia seq_numero_oc con el máximo correlativo existente
DO $$
DECLARE
    max_corr INT;
BEGIN
    SELECT COALESCE(MAX(
        NULLIF(REGEXP_REPLACE(numero_oc, '^OC-\d{4}-(\d+)$', '\1'), numero_oc)::INT
    ), 0)
    INTO max_corr
    FROM ordenes_compra
    WHERE numero_oc ~ '^OC-\d{4}-\d+$';

    IF max_corr > 0 THEN
        PERFORM setval('seq_numero_oc', GREATEST(max_corr, (SELECT last_value FROM seq_numero_oc)), true);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 4. Tabla de líneas de detalle de la Orden de Compra
CREATE TABLE IF NOT EXISTS oc_lineas (
    id_oc_linea SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE,
    id_articulo INT NOT NULL,
    cantidad_orden NUMERIC(12,3) NOT NULL CHECK (cantidad_orden > 0),
    precio_unitario INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_oc_lineas_orden ON oc_lineas (id_orden_compra);

-- 5. Tablas de Recepción de Artículos basadas en la OC (H33)
CREATE TABLE IF NOT EXISTS registro_recepcion_articulo (
    id_registro_recepcion_articulo SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE,
    estado estado_oc_enum NOT NULL DEFAULT 'Borrador'
);

CREATE TABLE IF NOT EXISTS registro_recepcion_articulo_detalle (
    id_recepcion_detalle SERIAL PRIMARY KEY,
    id_registro_recepcion_articulo INT NOT NULL REFERENCES registro_recepcion_articulo(id_registro_recepcion_articulo) ON DELETE CASCADE,
    id_oc_linea INT NOT NULL REFERENCES oc_lineas(id_oc_linea) ON DELETE CASCADE,
    fecha_recepcion DATE DEFAULT CURRENT_DATE,
    cantidad_recibida NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    cantidad_defectuosa NUMERIC(12,3) DEFAULT 0.000
);

-- 6. Asegurar columnas cant_reposicion (H35), cantidad_cuarentena, cantidad_comprometida y pmp en articulos_stock
ALTER TABLE articulos_stock ADD COLUMN IF NOT EXISTS cant_reposicion NUMERIC(12,3) NOT NULL DEFAULT 0.000;
ALTER TABLE articulos_stock ADD COLUMN IF NOT EXISTS cantidad_cuarentena NUMERIC(12,3) NOT NULL DEFAULT 0.000;
ALTER TABLE articulos_stock ADD COLUMN IF NOT EXISTS cantidad_comprometida NUMERIC(12,3) NOT NULL DEFAULT 0.000;
ALTER TABLE articulos_stock ADD COLUMN IF NOT EXISTS pmp NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- 6.1 Tablas recepciones, recepcion_lineas (Conforme, Defectuoso, Faltante) y movimientos_inventario (Cardex con saldo y PMP histórico) [DB]
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimiento_enum') THEN
        CREATE TYPE tipo_movimiento_enum AS ENUM ('Entrada', 'Salida', 'Ajuste', 'Transferencia');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_linea_recepcion_enum') THEN
        CREATE TYPE estado_linea_recepcion_enum AS ENUM ('Conforme', 'Defectuoso', 'Faltante');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS recepciones (
    id_recepcion SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE RESTRICT,
    id_usuario_bodeguero INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    numero_factura VARCHAR(50) NULL,
    estado_resultante_oc estado_oc_enum NOT NULL DEFAULT 'Recibida parcial',
    observaciones VARCHAR(250) NULL,
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recepciones_oc ON recepciones (id_orden_compra);

CREATE TABLE IF NOT EXISTS recepcion_lineas (
    id_recepcion_linea SERIAL PRIMARY KEY,
    id_recepcion INT NOT NULL REFERENCES recepciones(id_recepcion) ON DELETE CASCADE,
    id_oc_linea INT NOT NULL REFERENCES oc_lineas(id_oc_linea) ON DELETE RESTRICT,
    id_articulo INT NOT NULL,
    estado_linea estado_linea_recepcion_enum NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario_ingreso INT NOT NULL DEFAULT 0,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recepcion_lineas_recepcion ON recepcion_lineas (id_recepcion);
CREATE INDEX IF NOT EXISTS idx_recepcion_lineas_oc_linea ON recepcion_lineas (id_oc_linea);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id_movimiento SERIAL PRIMARY KEY,
    id_insumo INT NOT NULL,
    id_orden_compra INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    id_recepcion INT NULL REFERENCES recepciones(id_recepcion) ON DELETE CASCADE,
    id_recepcion_linea INT NULL REFERENCES recepcion_lineas(id_recepcion_linea) ON DELETE CASCADE,
    tipo_movimiento tipo_movimiento_enum NOT NULL DEFAULT 'Entrada',
    destino_bolsa VARCHAR(30) NOT NULL DEFAULT 'disponible',
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    saldo_historico NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    pmp_historico NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    valor_total_historico BIGINT NOT NULL DEFAULT 0,
    referencia VARCHAR(250) NULL,
    id_usuario INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movimientos_inv_insumo_fecha ON movimientos_inventario (id_insumo, fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_inv_recepcion_linea ON movimientos_inventario (id_recepcion_linea);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id_movimiento SERIAL PRIMARY KEY,
    id_insumo INT NOT NULL,
    tipo_movimiento tipo_movimiento_enum NOT NULL DEFAULT 'Entrada',
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    fecha_movimiento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT NULL,
    id_orden_compra INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    id_recepcion INT NULL REFERENCES recepciones(id_recepcion) ON DELETE CASCADE,
    id_recepcion_linea INT NULL REFERENCES recepcion_lineas(id_recepcion_linea) ON DELETE CASCADE,
    destino_bolsa VARCHAR(30) NOT NULL DEFAULT 'disponible',
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    saldo_historico NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    pmp_historico NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    referencia VARCHAR(250) NULL
);

ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS id_orden_compra INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL;
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS id_recepcion INT NULL REFERENCES recepciones(id_recepcion) ON DELETE CASCADE;
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS id_recepcion_linea INT NULL REFERENCES recepcion_lineas(id_recepcion_linea) ON DELETE CASCADE;
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS destino_bolsa VARCHAR(30) NOT NULL DEFAULT 'disponible';
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS saldo_historico NUMERIC(12,3) NOT NULL DEFAULT 0.000;
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS pmp_historico NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS referencia VARCHAR(250) NULL;

-- 7. Tabla de Alertas del Sistema para el Panel de Control (H40)
CREATE TABLE IF NOT EXISTS alertas_sistema (
    id_alerta SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL DEFAULT 'stock_minimo_oc',
    severidad VARCHAR(20) NOT NULL DEFAULT 'amarillo',
    titulo VARCHAR(200) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    id_articulo INT NULL,
    id_orden_compra INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertas_sistema_articulo_oc ON alertas_sistema (id_articulo, id_orden_compra);

-- 8. Índices parciales y compuestos para la consulta optimizada [DB] de insumos bajo mínimo sin OC abierta
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado_abierta
    ON ordenes_compra (id_orden_compra, estado)
    WHERE estado IN ('Borrador', 'Enviada', 'Recibida parcial');

CREATE INDEX IF NOT EXISTS idx_oc_lineas_articulo_orden
    ON oc_lineas (id_articulo, id_orden_compra);

CREATE INDEX IF NOT EXISTS idx_articulos_stock_bajo_minimo
    ON articulos_stock (id_articulo, cantidad_disponible, stock_minimo)
    WHERE stock_minimo > 0 AND cantidad_disponible <= stock_minimo;

-- 9. Vista optimizada [DB]: Insumos activos con disponible <= stock_minimo que no tienen ninguna OC abierta
CREATE OR REPLACE VIEW vw_insumos_bajo_minimo_sin_oc_abierta AS
SELECT
    a.id_articulo,
    a.sku,
    a.nombre_articulo,
    a.categoria,
    a.id_proveedor,
    a.id_unidad,
    a.precio_unitario,
    COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
    COALESCE(s.stock_minimo, 0)::float8 AS stock_minimo,
    CASE
        WHEN COALESCE(s.cant_reposicion, 0) > 0 THEN COALESCE(s.cant_reposicion, 0)::float8
        ELSE GREATEST(COALESCE(s.stock_minimo, 0) * 2, 1)::float8
    END AS cant_reposicion
FROM articulo a
JOIN articulos_stock s ON s.id_articulo = a.id_articulo
WHERE a.activo = TRUE
  AND COALESCE(s.stock_minimo, 0) > 0
  AND COALESCE(s.cantidad_disponible, 0) <= COALESCE(s.stock_minimo, 0)
    AND NOT EXISTS (
        SELECT 1
        FROM oc_lineas l
        JOIN ordenes_compra oc ON oc.id_orden_compra = l.id_orden_compra
        WHERE l.id_articulo = a.id_articulo
          AND oc.estado IN ('Borrador', 'Enviada', 'Recibida parcial')
    );

-- 10. Tablas de Facturación con 3 descuentos en cascada, Neto e IVA (19%) [DB / FRONT-2 / H34]
CREATE TABLE IF NOT EXISTS facturas_compra (
    id_factura SERIAL PRIMARY KEY,
    proveedor_id INT NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    numero_factura VARCHAR(50) NOT NULL,
    oc_id INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    subtotal_bruto INT NOT NULL DEFAULT 0,
    total_descuentos INT NOT NULL DEFAULT 0,
    subtotal_neto INT NOT NULL DEFAULT 0,
    monto_iva INT NOT NULL DEFAULT 0,
    total_factura INT NOT NULL DEFAULT 0,
    tiene_discrepancia_recepcion BOOLEAN NOT NULL DEFAULT FALSE,
    detalle_discrepancia TEXT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uk_facturas_compra_proveedor_numero UNIQUE (proveedor_id, numero_factura)
);

CREATE INDEX IF NOT EXISTS idx_facturas_compra_oc_id ON facturas_compra (oc_id);

CREATE TABLE IF NOT EXISTS factura_lineas (
    id_factura_linea SERIAL PRIMARY KEY,
    id_factura INT NOT NULL REFERENCES facturas_compra(id_factura) ON DELETE CASCADE,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    precio_bruto INT NOT NULL DEFAULT 0,
    descuento_1_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (descuento_1_pct >= 0 AND descuento_1_pct <= 100),
    descuento_2_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (descuento_2_pct >= 0 AND descuento_2_pct <= 100),
    descuento_3_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (descuento_3_pct >= 0 AND descuento_3_pct <= 100),
    precio_unitario_neto INT NOT NULL DEFAULT 0,
    subtotal_neto INT GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario_neto)) STORED
);

CREATE INDEX IF NOT EXISTS idx_factura_lineas_id_factura ON factura_lineas (id_factura);

CREATE TABLE IF NOT EXISTS factura (
    id_factura SERIAL PRIMARY KEY,
    numero_factura VARCHAR(50) NOT NULL,
    id_proveedor INT NOT NULL,
    id_orden_compra INT NULL REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    subtotal_bruto INT NOT NULL DEFAULT 0,
    total_descuentos INT NOT NULL DEFAULT 0,
    subtotal_neto INT NOT NULL DEFAULT 0,
    monto_iva INT NOT NULL DEFAULT 0,
    total_factura INT NOT NULL DEFAULT 0,
    tiene_discrepancia_recepcion BOOLEAN NOT NULL DEFAULT FALSE,
    detalle_discrepancia TEXT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uk_factura_proveedor_numero UNIQUE (id_proveedor, numero_factura)
);

ALTER TABLE factura ADD COLUMN IF NOT EXISTS subtotal_bruto INT NOT NULL DEFAULT 0;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS total_descuentos INT NOT NULL DEFAULT 0;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS tiene_discrepancia_recepcion BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS detalle_discrepancia TEXT NULL;

CREATE TABLE IF NOT EXISTS factura_detalle (
    id_factura_detalle SERIAL PRIMARY KEY,
    id_factura INT NOT NULL REFERENCES factura(id_factura) ON DELETE CASCADE,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    precio_bruto INT NOT NULL DEFAULT 0,
    descuento_1_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    descuento_2_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    descuento_3_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    precio_unitario INT NOT NULL DEFAULT 0,
    subtotal_linea INT GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario)) STORED
);

ALTER TABLE factura_detalle ADD COLUMN IF NOT EXISTS precio_bruto INT NOT NULL DEFAULT 0;
ALTER TABLE factura_detalle ADD COLUMN IF NOT EXISTS descuento_1_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00;
ALTER TABLE factura_detalle ADD COLUMN IF NOT EXISTS descuento_2_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00;
ALTER TABLE factura_detalle ADD COLUMN IF NOT EXISTS descuento_3_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00;

-- 11. Tablas de Solicitudes de Insumos a Proyectos con Reserva de Stock Comprometido en H6 [DB / BACK-1]
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud_enum') THEN
        CREATE TYPE estado_solicitud_enum AS ENUM ('Pendiente', 'Aprobada', 'Rechazada', 'Anulada', 'En Proceso', 'Completada');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud_insumos_enum') THEN
        CREATE TYPE estado_solicitud_insumos_enum AS ENUM ('Pendiente', 'Aprobada', 'Rechazada', 'Anulada');
    END IF;
END $$;

ALTER TYPE estado_solicitud_enum ADD VALUE IF NOT EXISTS 'Anulada';

CREATE TABLE IF NOT EXISTS solicitudes_insumos (
    id_solicitud SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    bodeguero_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    estado estado_solicitud_insumos_enum NOT NULL DEFAULT 'Pendiente',
    motivo_rechazo VARCHAR(250) NULL,
    nro_comprobante VARCHAR(80) NULL,
    descripcion_solicitud VARCHAR(250) NULL,
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_proyecto ON solicitudes_insumos (proyecto_id, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_bodeguero ON solicitudes_insumos (bodeguero_id);

CREATE TABLE IF NOT EXISTS solicitud_lineas (
    id_solicitud_linea SERIAL PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES solicitudes_insumos(id_solicitud) ON DELETE CASCADE,
    id_articulo INT NOT NULL,
    cantidad_solicitada NUMERIC(12,3) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_entregada NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (cantidad_entregada >= 0)
);

CREATE INDEX IF NOT EXISTS idx_solicitud_lineas_solicitud ON solicitud_lineas (id_solicitud);

CREATE TABLE IF NOT EXISTS solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_proyecto INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado_solicitud estado_solicitud_enum NOT NULL DEFAULT 'Pendiente',
    motivo_rechazo VARCHAR(250) NULL,
    nro_comprobante VARCHAR(80) NULL,
    descripcion_solicitud VARCHAR(250) NULL
);

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(250) NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS nro_comprobante VARCHAR(80) NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_proyecto ON solicitudes (id_proyecto, estado_solicitud);

CREATE TABLE IF NOT EXISTS detalle_solicitudes (
    id_detalle_solicitud SERIAL PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES solicitudes(id_solicitud) ON DELETE CASCADE,
    id_articulo INT NOT NULL,
    cantidad_solicitada NUMERIC(12,3) NOT NULL CHECK (cantidad_solicitada > 0)
);

CREATE INDEX IF NOT EXISTS idx_detalle_solicitudes_solicitud ON detalle_solicitudes (id_solicitud);




