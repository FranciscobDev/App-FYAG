# Script de Creación de Base de Datos desde Cero (PostgreSQL)

```sql
-- ==========================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ==========================================

CREATE TYPE roles_enum AS ENUM ('Administrador', 'Bodeguero', 'Tecnico');
CREATE TYPE tipo_proyecto_enum AS ENUM ('Mantencion', 'Instalacion');

CREATE TYPE categoria_enum AS ENUM (
    'Herramientas',
    'Materiales',
    'Equipos',
    'Consumibles',
    'Seguridad'
);

CREATE TYPE estado_proyecto_enum AS ENUM ('Planificado', 'En Proceso', 'Pausado', 'Completado', 'Cancelado');
CREATE TYPE estado_solicitud_enum AS ENUM ('Pendiente', 'Aprobada', 'Rechazada', 'En Proceso', 'Completada');
CREATE TYPE estado_oc_enum AS ENUM ('Borrador', 'Enviada', 'Recibida parcial', 'Recibida', 'Cerrada', 'Anulada');

CREATE TYPE tipo_movimiento_enum AS ENUM ('Entrada', 'Salida', 'Ajuste', 'Transferencia');

-- ==========================================
-- 2. TABLAS INDEPENDIENTES / MAESTRAS
-- ==========================================

-- Tabla: Roles
CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol roles_enum NOT NULL UNIQUE,
    descripcion VARCHAR(250)
);

-- Tabla: Categorias
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(250)
);

-- Tabla: Unidades_medida (soporta unidades estándar y a granel: unidad, kg, m, l)
CREATE TABLE unidades_medida (
    id_unidad SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE, -- 'unidad', 'kg', 'm', 'l'
    nombre VARCHAR(50) NOT NULL,
    permite_decimales BOOLEAN NOT NULL DEFAULT FALSE
);

-- Vista de compatibilidad para código legacy que consulte 'unidad_de_medida'
CREATE OR REPLACE VIEW unidad_de_medida AS
SELECT 
    id_unidad,
    codigo AS tipo_unidad,
    nombre AS descripcion
FROM unidades_medida;

-- Tabla: Cliente
CREATE TABLE cliente (
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
    calificacion_promedio NUMERIC(3,2) DEFAULT 5.00 CHECK (calificacion_promedio BETWEEN 1.00 AND 5.00),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Vista de compatibilidad plural 'clientes'
CREATE OR REPLACE VIEW clientes AS
SELECT * FROM cliente;

-- Tabla: Proveedor
CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    rut_proveedor VARCHAR(20) NOT NULL UNIQUE,
    nombre_proveedor VARCHAR(150) NOT NULL,
    razon_social VARCHAR(150),
    giro VARCHAR(150),
    telefono VARCHAR(20),
    correo_contacto VARCHAR(150),
    direccion VARCHAR(250),
    nombre_fantasia VARCHAR(150),
    nombre_contacto VARCHAR(150),
    telefono_contacto VARCHAR(30),
    calificacion_promedio NUMERIC(3,2) DEFAULT 5.00 CHECK (calificacion_promedio BETWEEN 1.00 AND 5.00),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Vista de compatibilidad plural 'proveedores'
CREATE OR REPLACE VIEW proveedores AS
SELECT * FROM proveedor;

-- Tabla: Datos_bancarios_proveedor
CREATE TABLE datos_bancarios_proveedor (
    id_proveedor INT PRIMARY KEY,
    cuenta_banco VARCHAR(250) NOT NULL,
    banco_proveedor VARCHAR(250) NOT NULL,
    tipo_cuenta VARCHAR(30) DEFAULT 'corriente',
    correo_transferencia VARCHAR(150),
    CONSTRAINT fk_datos_bancarios_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor) ON DELETE CASCADE
);

-- Triggers para garantizar que NO se permita el borrado físico (Soft Delete obligatorio)
CREATE OR REPLACE FUNCTION fn_impedir_borrado_fisico()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'El borrado físico no está permitido para esta tabla. Deshabilite el registro actualizando el campo activo a FALSE.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_impedir_borrado_cliente
BEFORE DELETE ON cliente
FOR EACH ROW EXECUTE FUNCTION fn_impedir_borrado_fisico();

CREATE TRIGGER trg_impedir_borrado_proveedor
BEFORE DELETE ON proveedor
FOR EACH ROW EXECUTE FUNCTION fn_impedir_borrado_fisico();

-- Tabla: Herramienta
CREATE TABLE herramienta (
    id_herramienta SERIAL PRIMARY KEY,
    numero_serie_herramienta VARCHAR(50) UNIQUE,
    nombre_herramienta VARCHAR(100) NOT NULL,
    categoria categoria_enum NOT NULL,
    marca_herramienta VARCHAR(250),
    modelo_herramienta VARCHAR(250),
    frecuencia_mantencion INT
);

-- ==========================================
-- 3. USUARIOS, AUDITORÍA, ACCESOS Y PROYECTOS
-- ==========================================

-- Tabla: Usuario
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(50) NOT NULL,
    apellido_usuario VARCHAR(50) NOT NULL,
    correo_usuario VARCHAR(250) UNIQUE NOT NULL,
    rut VARCHAR(20) UNIQUE,
    id_rol INT NOT NULL,
    especializacion VARCHAR(250),
    contrasena_hash VARCHAR(250) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ NULL,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- Vista de compatibilidad plural 'usuarios'
CREATE OR REPLACE VIEW usuarios AS
SELECT 
    id_usuario,
    nombre_usuario,
    apellido_usuario,
    correo_usuario,
    rut,
    id_rol,
    especializacion,
    contrasena_hash,
    activo,
    ultimo_acceso,
    fecha_creacion,
    intentos_fallidos,
    bloqueado_hasta
FROM usuario;

-- Tabla: Tokens_recuperacion (Vigencia 30 minutos, con índice de expiración)
CREATE TABLE tokens_recuperacion (
    id_token SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    usado_en TIMESTAMPTZ NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tokens_recuperacion_expira_en ON tokens_recuperacion (expira_en);
CREATE INDEX idx_tokens_recuperacion_usuario ON tokens_recuperacion (usuario_id);

-- Vista actualizable de compatibilidad 'token_recuperacion_clave' (usada por recuperacionController)
CREATE OR REPLACE VIEW token_recuperacion_clave AS
SELECT
    id_token,
    usuario_id AS id_usuario,
    token_hash,
    fecha_creacion,
    expira_en,
    usado_en
FROM tokens_recuperacion;

-- Tabla: Sesion_usuario (Control de sesiones activas e inactividad en el backend)
CREATE TABLE sesion_usuario (
    id_sesion VARCHAR(36) PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revocada BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sesion_usuario_id_usuario ON sesion_usuario (id_usuario);

-- Tabla: Log_accesos (Registra cada intento, IP y timestamp)
CREATE TABLE log_accesos (
    id_log SERIAL PRIMARY KEY,
    usuario VARCHAR(255) NOT NULL, -- Correo o identificador ingresado
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    ip VARCHAR(45) NOT NULL,
    exito BOOLEAN NOT NULL DEFAULT FALSE,
    resultado VARCHAR(40) NOT NULL, -- exito | clave_incorrecta | bloqueado | cuenta_inexistente | cuenta_desactivada
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_accesos_usuario ON log_accesos (usuario);
CREATE INDEX idx_log_accesos_fecha ON log_accesos (fecha);

-- Tabla: Auditoria (Inmutable: prohíbe terminantemente UPDATE y DELETE)
CREATE TABLE auditoria (
    id_auditoria SERIAL PRIMARY KEY,
    usuario VARCHAR(150),
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    entidad VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    campo_modificado VARCHAR(150),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    id_registro_afectado INT,
    descripcion TEXT,
    fecha_evento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_entidad_registro ON auditoria (entidad, id_registro_afectado);

-- Vista actualizable de compatibilidad 'bitacora_auditoria' (usada por auditoriaService)
CREATE OR REPLACE VIEW bitacora_auditoria AS
SELECT 
    id_auditoria AS id_bitacora,
    fecha_evento,
    id_usuario,
    entidad,
    accion,
    campo_modificado,
    valor_anterior,
    valor_nuevo,
    id_registro_afectado,
    descripcion
FROM auditoria;

-- Revocación de permisos de edición y borrado para todos los usuarios de base de datos
REVOKE UPDATE, DELETE ON auditoria FROM PUBLIC;

-- Trigger de seguridad estricto que aborta cualquier intento de edición o eliminación
CREATE OR REPLACE FUNCTION fn_bloquear_modificacion_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación denegada: La tabla de auditoría es inmutable y no permite UPDATE ni DELETE.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_modificacion_auditoria
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion_auditoria();

-- Tabla: Parametros (Configuración del sistema con umbrales y rangos válidos)
CREATE TABLE parametros (
    clave VARCHAR(60) PRIMARY KEY,
    valor_actual NUMERIC(12,2) NOT NULL,
    valor_defecto NUMERIC(12,2) NOT NULL,
    min NUMERIC(12,2) NOT NULL,
    max NUMERIC(12,2) NOT NULL,
    descripcion VARCHAR(250) NOT NULL,
    unidad VARCHAR(20) NOT NULL DEFAULT '',
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_parametro_rango CHECK (valor_actual BETWEEN min AND max)
);

-- Tabla: Parametro_sistema (Compatibilidad directa con services/parametros.ts del backend)
CREATE TABLE parametro_sistema (
    clave VARCHAR(60) PRIMARY KEY,
    descripcion VARCHAR(250) NOT NULL,
    valor INT NOT NULL,
    valor_minimo INT NOT NULL,
    valor_maximo INT NOT NULL,
    unidad VARCHAR(20) NOT NULL DEFAULT '',
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT parametro_valor_en_rango CHECK (valor BETWEEN valor_minimo AND valor_maximo)
);

-- Precarga de umbrales requeridos (H1, H19, H27, H22, H23, H24, H41, H47)
INSERT INTO parametros (clave, valor_actual, valor_defecto, min, max, descripcion, unidad) VALUES
    ('intentos_bloqueo', 5, 5, 1, 10, 'Intentos fallidos de login permitidos antes de bloquear la cuenta (H1)', 'intentos'),
    ('minutos_bloqueo', 15, 15, 1, 1440, 'Duración del bloqueo de la cuenta tras exceder los intentos (H1)', 'minutos'),
    ('discrepancia_inventario_pct', 5.0, 5.0, 1.0, 50.0, 'Umbral de discrepancia máxima permitida en auditoría física (H19)', '%'),
    ('costo_hora_tecnico', 18500.0, 18500.0, 5000.0, 100000.0, 'Costo por hora estándar de mano de obra técnica (H27)', 'CLP'),
    ('semaforo_presupuesto_alerta', 80.0, 80.0, 50.0, 95.0, 'Porcentaje de presupuesto consumido para alerta amarilla (H27)', '%'),
    ('semaforo_presupuesto_critico', 100.0, 100.0, 90.0, 150.0, 'Porcentaje de presupuesto consumido para alerta roja (H27)', '%'),
    ('alerta_stock_critico_pct', 20.0, 20.0, 5.0, 50.0, 'Porcentaje bajo stock mínimo para disparar alerta crítica (H22)', '%'),
    ('alerta_reposicion_dias', 7, 7, 1, 60, 'Días de anticipación para alerta de sugerencia de compra (H23)', 'días'),
    ('alerta_cuarentena_horas', 24, 24, 1, 168, 'Tiempo máximo sin resolver ítem en cuarentena (H24)', 'horas'),
    ('edicion_limite_horas', 48, 48, 1, 720, 'Plazo máximo permitido para editar registros o recepciones (H41)', 'horas'),
    ('qr_tamano_pixeles', 250, 250, 100, 1000, 'Tamaño estándar de renderizado de etiquetas QR (H47)', 'px');

-- Tabla: Proyecto
CREATE TABLE proyecto (
    id_proyecto SERIAL PRIMARY KEY,
    codigo_proyecto VARCHAR(50) UNIQUE,
    nombre_proyecto VARCHAR(250) NOT NULL,
    tipo_proyecto tipo_proyecto_enum NOT NULL DEFAULT 'Instalacion',
    cliente VARCHAR(150),
    id_cliente INT,
    direccion VARCHAR(200),
    fecha_inicio DATE,
    fecha_fin DATE,
    presupuesto_inicial INT DEFAULT 0,
    presupuesto_materiales INT DEFAULT 0,
    presupuesto_horas NUMERIC(8,2) DEFAULT 0,
    tarifa_hora INT DEFAULT 18500,
    valor_venta INT DEFAULT 0,
    costo_real_actual INT DEFAULT 0,
    porcentaje_avance NUMERIC(5,2) DEFAULT 0.00,
    estado_proyecto estado_proyecto_enum NOT NULL DEFAULT 'Planificado',
    id_usuario INT,
    CONSTRAINT fk_proyecto_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    CONSTRAINT proyecto_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE SET NULL
);

-- Tabla: asignaciones_proyecto (con historial de asignaciones y restricción única activa)
CREATE TABLE asignaciones_proyecto (
    id_asignacion SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL,
    tecnico_id INT NOT NULL,
    fecha_asignacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMPTZ,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_asignacion_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_asignacion_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- Índice único parcial: Impide duplicar al mismo técnico en el mismo proyecto mientras esté activo,
-- permitiendo conservar el historial completo de asignaciones previas (activo = FALSE).
CREATE UNIQUE INDEX uk_asignacion_activa_proyecto_tecnico 
ON asignaciones_proyecto (proyecto_id, tecnico_id) 
WHERE activo = TRUE;

-- Vista de compatibilidad para consultas directas de técnicos activos por proyecto
CREATE OR REPLACE VIEW proyecto_tecnico AS
SELECT 
    proyecto_id AS id_proyecto,
    tecnico_id AS id_usuario,
    fecha_asignacion
FROM asignaciones_proyecto
WHERE activo = TRUE;

-- Tabla: Horas_trabajadas
CREATE TABLE horas_trabajadas (
    id_registro_horas SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_proyecto INT NOT NULL,
    horas_proyecto_trabajadas NUMERIC(5,2) NOT NULL,
    CONSTRAINT fk_horas_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_horas_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto)
);

-- ==========================================
-- 4. ARTÍCULOS E INVENTARIO (INSUMOS)
-- ==========================================

-- Tabla: Insumos (Artículos con SKU único, QR, stock mínimo, reposición y hasta 3 decimales para granel)
CREATE TABLE insumos (
    id_insumo SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE,
    nombre VARCHAR(250) NOT NULL,
    categoria_id INT REFERENCES categorias(id_categoria) ON DELETE SET NULL,
    categoria_enum categoria_enum NOT NULL DEFAULT 'Materiales',
    id_unidad INT REFERENCES unidades_medida(id_unidad) ON DELETE SET NULL,
    proveedor_id INT REFERENCES proveedor(id_proveedor) ON DELETE SET NULL,
    stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (stock_minimo >= 0),
    cant_reposicion NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (cant_reposicion >= 0),
    precio_unitario INT DEFAULT 0,
    codigo_qr VARCHAR(255) UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Stock_insumos (Relación 1 a 1 con insumos, inicializada en cero con precisión decimal)
CREATE TABLE stock_insumos (
    insumo_id INT PRIMARY KEY,
    disponible NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (disponible >= 0),
    comprometido NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (comprometido >= 0),
    cuarentena NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (cuarentena >= 0),
    pmp NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (pmp >= 0),
    CONSTRAINT fk_stock_insumos_insumo FOREIGN KEY (insumo_id) REFERENCES insumos(id_insumo) ON DELETE CASCADE
);

-- Trigger: Inicializa automáticamente la fila de stock_insumos en ceros al insertar cada insumo
CREATE OR REPLACE FUNCTION fn_inicializar_stock_insumo()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO stock_insumos (insumo_id, disponible, comprometido, cuarentena, pmp)
    VALUES (NEW.id_insumo, 0.000, 0.000, 0.000, 0.00)
    ON CONFLICT (insumo_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inicializar_stock_insumo
AFTER INSERT ON insumos
FOR EACH ROW EXECUTE FUNCTION fn_inicializar_stock_insumo();

-- Vista actualizable de compatibilidad 'articulo' (soporta INSERT, UPDATE, DELETE y FOR UPDATE)
CREATE OR REPLACE VIEW articulo AS
SELECT 
    id_insumo AS id_articulo,
    nombre AS nombre_articulo,
    sku,
    precio_unitario,
    categoria_enum AS categoria,
    proveedor_id AS id_proveedor,
    id_unidad,
    activo
FROM insumos;

-- Tabla: Articulo_en_proyecto
CREATE TABLE articulo_en_proyecto (
    id_articulo_proyecto SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    id_unidad INT,
    CONSTRAINT fk_art_proj_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_art_proj_insumo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo),
    CONSTRAINT fk_art_proj_unidad FOREIGN KEY (id_unidad) REFERENCES unidades_medida(id_unidad)
);

-- Tabla: Articulos_stock
CREATE TABLE articulos_stock (
    id_stock SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL,
    id_bodega INT,
    cantidad_disponible NUMERIC(12,3) DEFAULT 0.000,
    stock_minimo NUMERIC(12,3) DEFAULT 0.000,
    ubicacion VARCHAR(100),
    CONSTRAINT fk_stock_insumo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo) ON DELETE CASCADE
);

-- Tabla: Movimiento_Inventario
CREATE TABLE movimiento_inventario (
    id_movimiento SERIAL PRIMARY KEY,
    id_insumo INT NOT NULL,
    tipo_movimiento tipo_movimiento_enum NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    fecha_movimiento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT,
    CONSTRAINT fk_mov_insumo FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo),
    CONSTRAINT fk_mov_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- Tabla: Mermas
CREATE TABLE mermas (
    id_merma SERIAL PRIMARY KEY,
    id_insumo INT NOT NULL,
    precio_unitario INT DEFAULT 0,
    cantidad_baja NUMERIC(12,3) NOT NULL CHECK (cantidad_baja > 0),
    fecha_merma DATE DEFAULT CURRENT_DATE,
    id_usuario INT,
    observacion_merma VARCHAR(250),
    perdida_valor_total INT DEFAULT 0,
    CONSTRAINT fk_mermas_insumo FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo),
    CONSTRAINT fk_mermas_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- Tabla: Auditoria_stock
CREATE TABLE auditoria_stock (
    id_auditoria SERIAL PRIMARY KEY,
    id_insumo INT NOT NULL,
    disponible_articulo NUMERIC(12,3),
    disponible_actualizado NUMERIC(12,3),
    id_usuario INT,
    nota_auditoria VARCHAR(250),
    impacto_valorizado INT DEFAULT 0,
    estado_auditoria VARCHAR(250),
    CONSTRAINT fk_auditoria_insumo FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- ==========================================
-- 5. COMPRAS, RECEPCIÓN Y FACTURACIÓN
-- ==========================================

-- Secuencia para número correlativo secuencial único de Órdenes de Compra
CREATE SEQUENCE seq_numero_oc START WITH 1 INCREMENT BY 1;

-- 5.1 Orden de Compra
CREATE TABLE ordenes_compra (
    id_orden_compra SERIAL PRIMARY KEY,
    numero_oc VARCHAR(50) NOT NULL UNIQUE DEFAULT ('OC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('seq_numero_oc')::TEXT, 5, '0')),
    proveedor_id INT NOT NULL,
    estado estado_oc_enum NOT NULL DEFAULT 'Borrador',
    origen VARCHAR(50) NOT NULL DEFAULT 'Manual',
    fecha_estimada_oc DATE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    observaciones VARCHAR(250),
    CONSTRAINT fk_oc_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedor(id_proveedor)
);

CREATE TABLE oc_lineas (
    id_oc_linea SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad_orden NUMERIC(12,3) NOT NULL CHECK (cantidad_orden > 0),
    precio_unitario INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_oc_lineas_cabecera FOREIGN KEY (id_orden_compra) REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE,
    CONSTRAINT fk_oc_lineas_articulo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo)
);

-- 5.2 Recepción de Artículos
CREATE TABLE registro_recepcion_articulo (
    id_registro_recepcion_articulo SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL,
    estado estado_oc_enum NOT NULL DEFAULT 'Borrador',
    CONSTRAINT fk_recepcion_oc FOREIGN KEY (id_orden_compra) REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE
);

CREATE TABLE registro_recepcion_articulo_detalle (
    id_recepcion_detalle SERIAL PRIMARY KEY,
    id_registro_recepcion_articulo INT NOT NULL,
    id_oc_linea INT NOT NULL,
    fecha_recepcion DATE DEFAULT CURRENT_DATE,
    cantidad_recibida NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    cantidad_defectuosa NUMERIC(12,3) DEFAULT 0.000,
    CONSTRAINT fk_recepcion_detalle_cabecera FOREIGN KEY (id_registro_recepcion_articulo)
        REFERENCES registro_recepcion_articulo(id_registro_recepcion_articulo) ON DELETE CASCADE,
    CONSTRAINT fk_recepcion_detalle_oc_linea FOREIGN KEY (id_oc_linea)
        REFERENCES oc_lineas(id_oc_linea)
);

-- 5.3 Facturación
CREATE TABLE factura (
    id_factura SERIAL PRIMARY KEY,
    numero_factura VARCHAR(50) NOT NULL,
    id_proveedor INT NOT NULL,
    id_orden_compra INT,
    subtotal_neto INT DEFAULT 0,
    monto_iva INT DEFAULT 0,
    total_factura INT DEFAULT 0,
    fecha_emision DATE DEFAULT CURRENT_DATE,
    CONSTRAINT fk_factura_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor),
    CONSTRAINT fk_factura_oc FOREIGN KEY (id_orden_compra) REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    CONSTRAINT uk_factura_proveedor_numero UNIQUE (id_proveedor, numero_factura)
);

CREATE TABLE factura_detalle (
    id_factura_detalle SERIAL PRIMARY KEY,
    id_factura INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario INT NOT NULL DEFAULT 0,
    subtotal_linea INT GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario)) STORED,
    CONSTRAINT fk_factura_detalle_cabecera FOREIGN KEY (id_factura) REFERENCES factura(id_factura) ON DELETE CASCADE,
    CONSTRAINT fk_factura_detalle_articulo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo)
);

-- ==========================================
-- 6. SOLICITUDES, KITS Y HERRAMIENTAS
-- ==========================================

-- Tabla: Solicitudes
CREATE TABLE solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_proyecto INT,
    fecha_solicitud TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    estado_solicitud estado_solicitud_enum NOT NULL DEFAULT 'Pendiente',
    descripcion_solicitud VARCHAR(250),
    CONSTRAINT fk_solicitud_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_solicitud_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto)
);

-- Tabla: Detalle_Solicitudes
CREATE TABLE detalle_solicitudes (
    id_detalle_solicitud SERIAL PRIMARY KEY,
    id_solicitud INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad_solicitada NUMERIC(12,3) NOT NULL CHECK (cantidad_solicitada > 0),
    CONSTRAINT fk_det_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud) ON DELETE CASCADE,
    CONSTRAINT fk_det_articulo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo)
);

-- Tabla: Kit_Proyecto
CREATE TABLE kit_proyecto (
    id_kit_proyecto SERIAL PRIMARY KEY,
    disponible_kit INT DEFAULT 0,
    nombre_kit VARCHAR(250) NOT NULL,
    descripcion_kit VARCHAR(250),
    categoria categoria_enum
);

-- Tabla: Detalle_kit
CREATE TABLE detalle_kit (
    id_detalle_kit SERIAL PRIMARY KEY,
    id_kit_proyecto INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad_requerida_kit NUMERIC(12,3) NOT NULL CHECK (cantidad_requerida_kit > 0),
    CONSTRAINT fk_det_kit_proyecto FOREIGN KEY (id_kit_proyecto) REFERENCES kit_proyecto(id_kit_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_det_kit_articulo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo)
);

-- Tabla: Herramienta_en_proyecto
CREATE TABLE herramienta_en_proyecto (
    id_herramienta_proyecto SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_herramienta INT NOT NULL,
    id_usuario INT,
    fecha_entrega_herramienta DATE,
    fecha_devolucion_herramienta DATE,
    fecha_mantencion DATE,
    CONSTRAINT fk_herram_proj_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_herram_proj_herramienta FOREIGN KEY (id_herramienta) REFERENCES herramienta(id_herramienta),
    CONSTRAINT fk_herram_proj_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);
```

