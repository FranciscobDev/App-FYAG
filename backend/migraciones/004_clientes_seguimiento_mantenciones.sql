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

-- 5. Clientes semilla de muestra (idempotente)
INSERT INTO cliente (id_cliente, rut_cliente, razon_social, giro, telefono, correo_contacto, direccion, nombre_contacto, banco, tipo_cuenta, numero_cuenta, calificacion_promedio, activo)
VALUES
(1, '76.123.456-7', 'Inmobiliaria Pacífico SpA', 'Desarrollo y Construcción Inmobiliaria', '+56 2 2456 7890', 'contacto@inmobpacificospa.cl', 'Av. Providencia 2450, Providencia, Santiago', 'Rodrigo Sepúlveda', 'Banco de Chile', 'Cuenta Corriente', '00-12345678-01', 4.90, true),
(2, '77.890.123-4', 'Clínica Andes S.A.', 'Servicios de Salud e Infraestructura Médica', '+56 2 2987 6543', 'operaciones@clinicaandes.cl', 'Av. Las Condes 9100, Las Condes, Santiago', 'Marcela Gajardo', 'Banco Santander', 'Cuenta Corriente', '00-76543210-09', 4.80, true),
(3, '78.456.789-1', 'Logística & Bodegaje Renca SpA', 'Almacenamiento y Centros de Distribución', '+56 9 8765 4321', 'mantencion@logisticarenca.cl', 'Camino Lo Boza 120, Renca, Santiago', 'Gonzalo Valenzuela', 'Banco BCI', 'Cuenta Corriente', '00-98765432-05', 4.50, true),
(4, '79.234.567-8', 'Constructora Maipo Limitada', 'Obras Civiles y Estructuras', '+56 2 2345 6789', 'obras@constructoramaipo.cl', 'Av. San Bernardo 540, San Bernardo, Santiago', 'Felipe Morales', 'Banco Estado', 'Cuenta Corriente', '00-45612378-02', 4.70, true)
ON CONFLICT (rut_cliente) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cliente', 'id_cliente'), COALESCE((SELECT MAX(id_cliente) FROM cliente), 1));

-- 6. Planes de Mantención iniciales de muestra (idempotente)
INSERT INTO plan_mantencion_cliente (id_plan, id_cliente, titulo_plan, modalidad, frecuencia_meses, fecha_proxima_mantencion, costo_pactado, estado_plan, notas_plan)
VALUES
(1, 1, 'Mantención Trimestral Tableros y Alimentadores', 'POR_KIT', 3, CURRENT_DATE + INTERVAL '1 day', 680000, 'Activo', 'Revisión termográfica e insumos por Kit Eléctrico cada 3 meses'),
(2, 2, 'Mantención Semestral Climatización y Bombas', 'POR_CONTRATO', 6, CURRENT_DATE + INTERVAL '12 days', 1250000, 'Activo', 'Inspección de grupos electrógenos y chillers según contrato anual'),
(3, 3, 'Mantención 10 Meses Red Contra Incendios', 'MIXTO', 10, CURRENT_DATE - INTERVAL '6 days', 890000, 'Activo', 'Mantenimiento mayor programado cada 10 meses según norma NFPA')
ON CONFLICT (id_plan) DO NOTHING;

SELECT setval(pg_get_serial_sequence('plan_mantencion_cliente', 'id_plan'), COALESCE((SELECT MAX(id_plan) FROM plan_mantencion_cliente), 1));

