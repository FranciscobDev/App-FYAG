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
CREATE TYPE estado_solicitud_enum AS ENUM ('Pendiente', 'Aprobada', 'Rechazada', 'Anulada', 'En Proceso', 'Completada');
CREATE TYPE estado_solicitud_insumos_enum AS ENUM ('Pendiente', 'Aprobada', 'Rechazada', 'Anulada');
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

-- Tabla: Horas_trabajadas [DB]
CREATE TABLE horas_trabajadas (
    id_registro_horas SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL,
    tecnico_id INT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    horas NUMERIC(4,1) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_horas_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_horas_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_horas_bloques_media_hora CHECK (horas > 0 AND MOD(horas, 0.5) = 0 AND horas <= 24.0)
);

CREATE INDEX idx_horas_trabajadas_tecnico_fecha ON horas_trabajadas (tecnico_id, fecha);
CREATE INDEX idx_horas_trabajadas_proyecto ON horas_trabajadas (proyecto_id);

-- Trigger: Impide superar un total acumulado de 24 horas diarias por técnico entre todos sus proyectos [DB]
CREATE OR REPLACE FUNCTION fn_validar_maximo_horas_diarias()
RETURNS TRIGGER AS $$
DECLARE
    total_horas NUMERIC(5,1);
BEGIN
    SELECT COALESCE(SUM(horas), 0)
    INTO total_horas
    FROM horas_trabajadas
    WHERE tecnico_id = NEW.tecnico_id
      AND fecha = NEW.fecha
      AND id_registro_horas <> COALESCE(NEW.id_registro_horas, 0);

    IF (total_horas + NEW.horas) > 24.0 THEN
        RAISE EXCEPTION 'Límite diario excedido: El técnico no puede registrar más de 24 horas totales en un mismo día (fecha: %, horas registradas: %, intento: %).',
            NEW.fecha, total_horas, NEW.horas;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_maximo_horas_diarias
BEFORE INSERT OR UPDATE ON horas_trabajadas
FOR EACH ROW EXECUTE FUNCTION fn_validar_maximo_horas_diarias();

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
    bloqueado_por_conteo BOOLEAN NOT NULL DEFAULT FALSE,
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
    activo,
    bloqueado_por_conteo
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

-- Tabla: Avances_proyecto [DB]
CREATE TABLE avances_proyecto (
    id_avance SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL,
    tecnico_id INT NOT NULL,
    porcentaje NUMERIC(5,2) NOT NULL,
    comentario TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_avance_porcentaje_rango CHECK (porcentaje >= 0.00 AND porcentaje <= 100.00),
    CONSTRAINT fk_avances_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_avances_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuario(id_usuario) ON DELETE RESTRICT
);

CREATE INDEX idx_avances_proyecto_proyecto ON avances_proyecto (proyecto_id, fecha DESC);
CREATE INDEX idx_avances_proyecto_tecnico ON avances_proyecto (tecnico_id);

-- Tabla: Avance_materiales_usados [DB]
CREATE TABLE avance_materiales_usados (
    id_avance_material SERIAL PRIMARY KEY,
    id_avance INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad_usada NUMERIC(12,3) NOT NULL CHECK (cantidad_usada > 0),
    id_unidad INT,
    CONSTRAINT fk_avance_mat_avance FOREIGN KEY (id_avance) REFERENCES avances_proyecto(id_avance) ON DELETE CASCADE,
    CONSTRAINT fk_avance_mat_insumo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    CONSTRAINT fk_avance_mat_unidad FOREIGN KEY (id_unidad) REFERENCES unidades_medida(id_unidad)
);

CREATE INDEX idx_avance_mat_avance ON avance_materiales_usados (id_avance);
CREATE INDEX idx_avance_mat_insumo ON avance_materiales_usados (id_articulo);

-- Tabla: Articulos_stock
CREATE TABLE articulos_stock (
    id_stock SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL,
    id_bodega INT,
    cantidad_disponible NUMERIC(12,3) DEFAULT 0.000 CHECK (cantidad_disponible >= 0),
    cantidad_comprometida NUMERIC(12,3) DEFAULT 0.000 CHECK (cantidad_comprometida >= 0),
    cantidad_cuarentena NUMERIC(12,3) DEFAULT 0.000 CHECK (cantidad_cuarentena >= 0),
    pmp NUMERIC(12,2) DEFAULT 0.00 CHECK (pmp >= 0),
    stock_minimo NUMERIC(12,3) DEFAULT 0.000,
    cant_reposicion NUMERIC(12,3) DEFAULT 0.000,
    ubicacion VARCHAR(100),
    CONSTRAINT chk_articulos_stock_no_negativo CHECK (cantidad_disponible >= 0 AND cantidad_comprometida >= 0),
    CONSTRAINT fk_stock_insumo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo) ON DELETE CASCADE
);

-- Tabla: Contenedor_stock (Contenedores fraccionables como rollos o bobinas con remanente en 3 decimales)
CREATE TABLE contenedor_stock (
    id_contenedor SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo),
    capacidad_inicial NUMERIC(12,3) NOT NULL CHECK (capacidad_inicial > 0),
    cantidad_restante NUMERIC(12,3) NOT NULL CHECK (cantidad_restante >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Tabla: Codigos_qr_insumos [DB] (Trazabilidad por unidad física rotulada; múltiples QR únicos por insumo)
CREATE TABLE codigos_qr_insumos (
    id_qr SERIAL PRIMARY KEY,
    codigo_unico VARCHAR(100) NOT NULL UNIQUE,
    insumo_id INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    nombre VARCHAR(250) NOT NULL,
    unidad_medida VARCHAR(50) NOT NULL,
    asignado_fisicamente BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_codigos_qr_insumo ON codigos_qr_insumos (insumo_id);
CREATE INDEX idx_codigos_qr_asignado ON codigos_qr_insumos (asignado_fisicamente);

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

-- Tabla: Mermas [DB] (Bajas de inventario con motivo tipificado y justificación obligatoria)
CREATE TABLE mermas (
    id_merma SERIAL PRIMARY KEY,
    insumo_id INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    bodeguero_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    motivo VARCHAR(30) NOT NULL,
    observacion VARCHAR(250) NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    costo_pmp_total NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (costo_pmp_total >= 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_merma_motivo CHECK (motivo IN ('daño', 'caducidad', 'pérdida', 'otro')),
    CONSTRAINT chk_merma_observacion_no_vacia CHECK (TRIM(observacion) <> '')
);

CREATE INDEX idx_mermas_insumo ON mermas (insumo_id);
CREATE INDEX idx_mermas_bodeguero ON mermas (bodeguero_id);
CREATE INDEX idx_mermas_fecha ON mermas (fecha);

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

-- Tabla: Conteos_fisicos [DB] (Control de arqueos periódicos y diferencias valorizadas)
CREATE TABLE conteos_fisicos (
    id_conteo SERIAL PRIMARY KEY,
    insumo_id INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    stock_sistema NUMERIC(12,3) NOT NULL CHECK (stock_sistema >= 0),
    conteo_real NUMERIC(12,3) NOT NULL CHECK (conteo_real >= 0),
    diferencia_cant NUMERIC(12,3) NOT NULL,
    diferencia_valor_pmp NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente aprobación' 
        CHECK (estado IN ('Ajustado', 'Pendiente aprobación', 'Aprobado', 'Rechazado')),
    fecha_conteo DATE NOT NULL DEFAULT CURRENT_DATE,
    id_usuario_conteo INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_usuario_aprobacion INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_aprobacion TIMESTAMPTZ NULL,
    observaciones VARCHAR(250) NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conteos_fisicos_insumo ON conteos_fisicos (insumo_id);
CREATE INDEX idx_conteos_fisicos_estado ON conteos_fisicos (estado);
CREATE INDEX idx_insumos_bloqueado_conteo ON insumos (bloqueado_por_conteo) WHERE bloqueado_por_conteo = TRUE;

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

-- Índices optimizados para detección de insumos bajo mínimo sin OC abierta [DB]
CREATE INDEX idx_ordenes_compra_estado_abierta
    ON ordenes_compra (id_orden_compra, estado)
    WHERE estado IN ('Borrador', 'Enviada', 'Recibida parcial');

CREATE INDEX idx_oc_lineas_articulo_orden
    ON oc_lineas (id_articulo, id_orden_compra);

CREATE INDEX idx_articulos_stock_bajo_minimo
    ON articulos_stock (id_articulo, cantidad_disponible, stock_minimo)
    WHERE stock_minimo > 0 AND cantidad_disponible <= stock_minimo;

-- Vista optimizada [DB]: Insumos activos con disponible <= stock_minimo sin ninguna OC abierta
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

-- 5.2 Recepción de Artículos y Trazabilidad Cardex por Línea [DB]
CREATE TYPE estado_linea_recepcion_enum AS ENUM ('Conforme', 'Defectuoso', 'Faltante');

CREATE TABLE recepciones (
    id_recepcion SERIAL PRIMARY KEY,
    id_orden_compra INT NOT NULL,
    id_usuario_bodeguero INT NULL,
    numero_factura VARCHAR(50) NULL,
    estado_resultante_oc estado_oc_enum NOT NULL DEFAULT 'Recibida parcial',
    observaciones VARCHAR(250) NULL,
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recepciones_oc FOREIGN KEY (id_orden_compra) REFERENCES ordenes_compra(id_orden_compra) ON DELETE RESTRICT,
    CONSTRAINT fk_recepciones_usuario FOREIGN KEY (id_usuario_bodeguero) REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE TABLE recepcion_lineas (
    id_recepcion_linea SERIAL PRIMARY KEY,
    id_recepcion INT NOT NULL,
    id_oc_linea INT NOT NULL,
    id_articulo INT NOT NULL,
    estado_linea estado_linea_recepcion_enum NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario_ingreso INT NOT NULL DEFAULT 0,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recepcion_lineas_recepcion FOREIGN KEY (id_recepcion) REFERENCES recepciones(id_recepcion) ON DELETE CASCADE,
    CONSTRAINT fk_recepcion_lineas_oc_linea FOREIGN KEY (id_oc_linea) REFERENCES oc_lineas(id_oc_linea) ON DELETE RESTRICT
);

CREATE TABLE movimientos_inventario (
    id_movimiento SERIAL PRIMARY KEY,
    id_insumo INT NOT NULL,
    id_orden_compra INT NULL,
    id_recepcion INT NULL,
    id_recepcion_linea INT NULL,
    id_proyecto INT NULL,
    tipo_movimiento tipo_movimiento_enum NOT NULL DEFAULT 'Entrada',
    destino_bolsa VARCHAR(30) NOT NULL DEFAULT 'disponible',
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    saldo_historico NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    pmp_historico NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    valor_total_historico BIGINT NOT NULL DEFAULT 0,
    referencia VARCHAR(250) NULL,
    id_usuario INT NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mov_inv_oc FOREIGN KEY (id_orden_compra) REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    CONSTRAINT fk_mov_inv_recepcion FOREIGN KEY (id_recepcion) REFERENCES recepciones(id_recepcion) ON DELETE CASCADE,
    CONSTRAINT fk_mov_inv_recepcion_linea FOREIGN KEY (id_recepcion_linea) REFERENCES recepcion_lineas(id_recepcion_linea) ON DELETE CASCADE,
    CONSTRAINT fk_mov_inv_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto) ON DELETE SET NULL,
    CONSTRAINT fk_mov_inv_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

-- Índices compuestos para responder consultas históricas de Cardex de forma inmediata [DB]
CREATE INDEX idx_movimientos_inv_insumo_fecha 
    ON movimientos_inventario (id_insumo, fecha_movimiento DESC);

CREATE INDEX idx_movimientos_inv_proyecto_fecha 
    ON movimientos_inventario (id_proyecto, fecha_movimiento DESC);

CREATE INDEX idx_movimientos_inv_recepcion_linea 
    ON movimientos_inventario (id_recepcion_linea);

-- Vista Cardex: Expone entradas, salidas, saldo resultante y PMP histórico tras cada operación [DB][SCRUM]
CREATE OR REPLACE VIEW vw_cardex_movimientos AS
SELECT
    m.id_movimiento,
    m.id_insumo,
    i.sku,
    i.nombre AS insumo,
    m.fecha_movimiento,
    m.tipo_movimiento::text AS tipo_movimiento,
    m.destino_bolsa,
    m.id_proyecto,
    p.nombre_proyecto,
    CASE 
        WHEN m.tipo_movimiento = 'Entrada' THEN m.cantidad 
        ELSE 0.000 
    END AS cantidad_entrada,
    CASE 
        WHEN m.tipo_movimiento = 'Salida' THEN m.cantidad 
        ELSE 0.000 
    END AS cantidad_salida,
    m.costo_unitario,
    m.saldo_historico AS saldo_resultante,
    m.pmp_historico,
    m.valor_total_historico,
    m.referencia,
    m.id_usuario,
    TRIM(CONCAT(u.nombre_usuario, ' ', u.apellido_usuario)) AS usuario_responsable
FROM movimientos_inventario m
JOIN insumos i ON i.id_insumo = m.id_insumo
LEFT JOIN proyecto p ON p.id_proyecto = m.id_proyecto
LEFT JOIN usuario u ON u.id_usuario = m.id_usuario;

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

-- 5.3 Facturación [DB]
CREATE TABLE facturas_compra (
    id_factura SERIAL PRIMARY KEY,
    proveedor_id INT NOT NULL,
    numero_factura VARCHAR(50) NOT NULL,
    oc_id INT NULL,
    subtotal_bruto INT NOT NULL DEFAULT 0,
    total_descuentos INT NOT NULL DEFAULT 0,
    subtotal_neto INT NOT NULL DEFAULT 0,
    monto_iva INT NOT NULL DEFAULT 0,
    total_factura INT NOT NULL DEFAULT 0,
    tiene_discrepancia_recepcion BOOLEAN NOT NULL DEFAULT FALSE,
    detalle_discrepancia TEXT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT fk_facturas_compra_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    CONSTRAINT fk_facturas_compra_oc FOREIGN KEY (oc_id) REFERENCES ordenes_compra(id_orden_compra) ON DELETE SET NULL,
    CONSTRAINT uk_facturas_compra_proveedor_numero UNIQUE (proveedor_id, numero_factura)
);

CREATE TABLE factura_lineas (
    id_factura_linea SERIAL PRIMARY KEY,
    id_factura INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    precio_bruto INT NOT NULL DEFAULT 0,
    descuento_1_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (descuento_1_pct >= 0 AND descuento_1_pct <= 100),
    descuento_2_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (descuento_2_pct >= 0 AND descuento_2_pct <= 100),
    descuento_3_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00 CHECK (descuento_3_pct >= 0 AND descuento_3_pct <= 100),
    precio_unitario_neto INT NOT NULL DEFAULT 0,
    subtotal_neto INT GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario_neto)) STORED,
    CONSTRAINT fk_factura_lineas_cabecera FOREIGN KEY (id_factura) REFERENCES facturas_compra(id_factura) ON DELETE CASCADE,
    CONSTRAINT fk_factura_lineas_articulo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo)
);

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

-- 5.4 Devoluciones a Proveedores [DB] (Opera exclusivamente sobre saldo en cuarentena)
CREATE TABLE devoluciones_proveedor (
    id_devolucion_proveedor SERIAL PRIMARY KEY,
    proveedor_id INT NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    insumo_id INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(250) NOT NULL,
    nro_guia VARCHAR(80) NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente de resolución'
        CHECK (estado IN ('Pendiente de resolución', 'Resuelta')),
    resolucion_nota_credito_o_reposicion VARCHAR(50) NULL
        CHECK (resolucion_nota_credito_o_reposicion IS NULL OR resolucion_nota_credito_o_reposicion IN ('Nota de crédito', 'Reposición')),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_resolucion TIMESTAMPTZ NULL,
    id_usuario_registro INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_usuario_resolucion INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    observaciones VARCHAR(250) NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_resolucion_obligatoria_al_resolver
        CHECK (estado <> 'Resuelta' OR resolucion_nota_credito_o_reposicion IS NOT NULL)
);

CREATE INDEX idx_dev_prov_proveedor ON devoluciones_proveedor (proveedor_id);
CREATE INDEX idx_dev_prov_insumo ON devoluciones_proveedor (insumo_id);
CREATE INDEX idx_dev_prov_estado ON devoluciones_proveedor (estado);

CREATE OR REPLACE FUNCTION fn_validar_devolucion_proveedor_cuarentena()
RETURNS TRIGGER AS $$
DECLARE
    saldo_cuarentena NUMERIC(12,3);
BEGIN
    SELECT COALESCE(cuarentena, 0.000)
    INTO saldo_cuarentena
    FROM stock_insumos
    WHERE insumo_id = NEW.insumo_id;

    IF saldo_cuarentena < NEW.cantidad THEN
        RAISE EXCEPTION 'Operación rechazada: La devolución al proveedor solo puede realizarse sobre insumos con saldo en cuarentena. Insumo ID: %, Saldo en cuarentena: %, Cantidad a devolver: %.',
            NEW.insumo_id, saldo_cuarentena, NEW.cantidad;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_devolucion_proveedor_cuarentena
BEFORE INSERT ON devoluciones_proveedor
FOR EACH ROW EXECUTE FUNCTION fn_validar_devolucion_proveedor_cuarentena();

-- ==========================================
-- 6. SOLICITUDES, KITS Y HERRAMIENTAS
-- ==========================================

-- Tabla: solicitudes_insumos [DB] (Vincula solicitudes solo a proyectos existentes y registra estado, motivo_rechazo y nro_comprobante)
CREATE TABLE solicitudes_insumos (
    id_solicitud SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL,
    bodeguero_id INT NOT NULL,
    estado estado_solicitud_insumos_enum NOT NULL DEFAULT 'Pendiente',
    motivo_rechazo VARCHAR(250) NULL,
    nro_comprobante VARCHAR(80) NULL,
    descripcion_solicitud VARCHAR(250) NULL,
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_solicitudes_insumos_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_insumos_bodeguero FOREIGN KEY (bodeguero_id) REFERENCES usuario(id_usuario) ON DELETE RESTRICT
);

-- Tabla: solicitud_lineas [DB]
CREATE TABLE solicitud_lineas (
    id_solicitud_linea SERIAL PRIMARY KEY,
    id_solicitud INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad_solicitada NUMERIC(12,3) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_entregada NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (cantidad_entregada >= 0),
    CONSTRAINT fk_solicitud_lineas_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes_insumos(id_solicitud) ON DELETE CASCADE,
    CONSTRAINT fk_solicitud_lineas_articulo FOREIGN KEY (id_articulo) REFERENCES insumos(id_insumo)
);

-- Tablas Inmutables de Salidas Físicas de Bodega [DB / BACK-1] (`salidas_bodega` y `salida_lineas` con CHECK disponible >= 0 y comprometido >= 0 e inmutabilidad por trigger)
CREATE TABLE salidas_bodega (
    id_salida SERIAL PRIMARY KEY,
    codigo_salida VARCHAR(80) NULL UNIQUE,
    solicitud_id INT NOT NULL REFERENCES solicitudes_insumos(id_solicitud) ON DELETE RESTRICT,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_retira_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    tecnico_retira_rut VARCHAR(20) NULL,
    tecnico_retira_nombre VARCHAR(150) NULL,
    bodeguero_id INT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salida_lineas (
    id_salida_linea SERIAL PRIMARY KEY,
    id_salida INT NOT NULL REFERENCES salidas_bodega(id_salida) ON DELETE RESTRICT,
    id_solicitud_linea INT NULL REFERENCES solicitud_lineas(id_solicitud_linea) ON DELETE RESTRICT,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad_entregada NUMERIC(12,3) NOT NULL CHECK (cantidad_entregada > 0),
    disponible NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (disponible >= 0),
    comprometido NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (comprometido >= 0),
    saldo_pendiente_resultante NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (saldo_pendiente_resultante >= 0),
    costo_unitario_pmp NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT chk_salida_lineas_saldos_no_negativos CHECK (disponible >= 0 AND comprometido >= 0)
);

CREATE TABLE egresos_bodega (
    id_egreso SERIAL PRIMARY KEY,
    codigo_egreso VARCHAR(80) NOT NULL UNIQUE,
    id_solicitud INT NOT NULL REFERENCES solicitudes_insumos(id_solicitud) ON DELETE RESTRICT,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_retira_id INT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    tecnico_retira_rut VARCHAR(20) NOT NULL,
    tecnico_retira_nombre VARCHAR(150) NOT NULL,
    bodeguero_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    fecha_egreso TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE egreso_lineas (
    id_egreso_linea SERIAL PRIMARY KEY,
    id_egreso INT NOT NULL REFERENCES egresos_bodega(id_egreso) ON DELETE RESTRICT,
    id_solicitud_linea INT NOT NULL REFERENCES solicitud_lineas(id_solicitud_linea) ON DELETE RESTRICT,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad_egresada NUMERIC(12,3) NOT NULL CHECK (cantidad_egresada > 0),
    saldo_pendiente_resultante NUMERIC(12,3) NOT NULL CHECK (saldo_pendiente_resultante >= 0),
    costo_unitario_pmp NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

CREATE OR REPLACE FUNCTION fn_impedir_modificacion_egreso()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'El registro de salida/egreso de bodega es inmutable y está vinculado de forma irreversible al proyecto y al técnico que retira. Las correcciones se realizan mediante un movimiento de ajuste en Cardex, nunca editando ni borrando el registro.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inmutabilidad_salidas_bodega
BEFORE UPDATE OR DELETE ON salidas_bodega
FOR EACH ROW EXECUTE FUNCTION fn_impedir_modificacion_egreso();

CREATE TRIGGER trg_inmutabilidad_salida_lineas
BEFORE UPDATE OR DELETE ON salida_lineas
FOR EACH ROW EXECUTE FUNCTION fn_impedir_modificacion_egreso();

CREATE TRIGGER trg_inmutabilidad_egresos_bodega
BEFORE UPDATE OR DELETE ON egresos_bodega
FOR EACH ROW EXECUTE FUNCTION fn_impedir_modificacion_egreso();

CREATE TRIGGER trg_inmutabilidad_egreso_lineas
BEFORE UPDATE OR DELETE ON egreso_lineas
FOR EACH ROW EXECUTE FUNCTION fn_impedir_modificacion_egreso();

-- ==========================================
-- Tablas: Devoluciones de Obra y Sobrantes de Terreno [DB]
-- ==========================================

-- Tabla: Uso_insumos_proyecto (Consumo real en terreno; base para determinar el sobrante devuelto)
CREATE TABLE uso_insumos_proyecto (
    id_uso SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad_utilizada NUMERIC(12,3) NOT NULL CHECK (cantidad_utilizada > 0),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_registro INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE INDEX idx_uso_insumos_proyecto_tecnico ON uso_insumos_proyecto (proyecto_id, tecnico_id, id_articulo);

-- Tabla: Devoluciones_obra (Cabecera de sobrantes devueltos; estados 'En tránsito' y 'Recibida')
CREATE TABLE devoluciones_obra (
    id_devolucion SERIAL PRIMARY KEY,
    codigo_devolucion VARCHAR(40) NULL UNIQUE,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    tecnico_rut VARCHAR(20) NOT NULL DEFAULT '',
    tecnico_nombre VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'En tránsito' CHECK (estado IN ('En tránsito', 'Recibida')),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_declaracion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_declara INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_recepcion_bodega TIMESTAMPTZ NULL,
    id_usuario_recibe INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    observaciones VARCHAR(250) NULL
);

CREATE INDEX idx_devoluciones_obra_proyecto ON devoluciones_obra (proyecto_id, tecnico_id);
CREATE INDEX idx_devoluciones_obra_estado ON devoluciones_obra (estado);

-- Vista de compatibilidad para código y migraciones previas que consultan 'devoluciones_tecnico'
CREATE OR REPLACE VIEW devoluciones_tecnico AS
SELECT 
    id_devolucion,
    codigo_devolucion,
    proyecto_id,
    tecnico_id,
    tecnico_rut,
    tecnico_nombre,
    estado,
    fecha,
    fecha_declaracion,
    id_usuario_declara
FROM devoluciones_obra;

-- Tabla: Devolucion_lineas (Detalle de insumos devueltos, retirados, utilizados y validados en bodega)
CREATE TABLE devolucion_lineas (
    id_devolucion_linea SERIAL PRIMARY KEY,
    id_devolucion INT NOT NULL REFERENCES devoluciones_obra(id_devolucion) ON DELETE CASCADE,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
    cantidad_retirada NUMERIC(12,3) NOT NULL CHECK (cantidad_retirada >= 0),
    cantidad_utilizada NUMERIC(12,3) NOT NULL CHECK (cantidad_utilizada >= 0),
    cantidad_declarada NUMERIC(12,3) NOT NULL CHECK (cantidad_declarada > 0),
    cantidad_recibida NUMERIC(12,3) NULL CHECK (cantidad_recibida >= 0),
    CONSTRAINT chk_devolucion_no_excede_sobrante
        CHECK (cantidad_declarada <= (cantidad_retirada - cantidad_utilizada)),
    CONSTRAINT chk_devolucion_recibida_valida
        CHECK (cantidad_recibida IS NULL OR cantidad_recibida <= cantidad_declarada)
);

CREATE INDEX idx_devolucion_lineas_devolucion ON devolucion_lineas (id_devolucion);
CREATE INDEX idx_devolucion_lineas_articulo ON devolucion_lineas (id_articulo);

-- Tabla: Solicitudes (Compatibilidad)
CREATE TABLE solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_proyecto INT NOT NULL,
    fecha_solicitud TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    estado_solicitud estado_solicitud_enum NOT NULL DEFAULT 'Pendiente',
    motivo_rechazo VARCHAR(250) NULL,
    nro_comprobante VARCHAR(80) NULL,
    descripcion_solicitud VARCHAR(250),
    CONSTRAINT fk_solicitud_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT
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

-- ==========================================
-- 7. SEGUIMIENTO POST-VENTA Y PLANES DE MANTENCIÓN PERIÓDICA
-- ==========================================

-- Tabla: Plan_mantencion_cliente (Programación cada N meses: 3, 6, 10, 12m, por Kit o por Contrato)
CREATE TABLE plan_mantencion_cliente (
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

CREATE INDEX idx_plan_mantencion_cliente ON plan_mantencion_cliente (id_cliente);
CREATE INDEX idx_plan_mantencion_proxima ON plan_mantencion_cliente (fecha_proxima_mantencion);

-- Tabla: Seguimiento_contacto_cliente (Bitácora de contacto al cliente y generación de faenas)
CREATE TABLE seguimiento_contacto_cliente (
    id_seguimiento SERIAL PRIMARY KEY,
    id_plan INT NOT NULL REFERENCES plan_mantencion_cliente(id_plan) ON DELETE CASCADE,
    fecha_contacto TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    canal_contacto VARCHAR(30) NOT NULL DEFAULT 'Teléfono', -- 'Teléfono' | 'Correo' | 'WhatsApp' | 'Visita'
    resultado_contacto VARCHAR(40) NOT NULL DEFAULT 'Cliente Contactado',
    id_proyecto_generado INT REFERENCES proyecto(id_proyecto) ON DELETE SET NULL,
    observaciones VARCHAR(300),
    id_usuario_ejecutor INT REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE INDEX idx_seguimiento_contacto_plan ON seguimiento_contacto_cliente (id_plan);

-- ==========================================
-- 8. HOJAS DE SERVICIO, CHECKLISTS DE TERRENO Y ADJUNTOS CONCURRENTE/MÓVIL [DB]
-- ==========================================

-- Tabla: Hojas_servicio (Control de versiones para ediciones concurrentes entre móvil y central)
CREATE TABLE hojas_servicio (
    id_hoja_servicio SERIAL PRIMARY KEY,
    uuid_registro VARCHAR(36) NOT NULL, -- Identificador lógico del documento compartido entre versiones
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    id_version_padre INT NULL REFERENCES hojas_servicio(id_hoja_servicio) ON DELETE SET NULL,
    origen_edicion VARCHAR(20) NOT NULL DEFAULT 'central' CHECK (origen_edicion IN ('movil', 'central')),
    estado_sincronizacion VARCHAR(30) NOT NULL DEFAULT 'sincronizado' CHECK (estado_sincronizacion IN ('sincronizado', 'conflicto', 'borrador_local', 'resuelto')),
    es_version_activa BOOLEAN NOT NULL DEFAULT TRUE,
    codigo_hoja VARCHAR(50) NOT NULL,
    proyecto_id INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE RESTRICT,
    tecnico_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    tipo_servicio VARCHAR(50) NOT NULL DEFAULT 'Mantencion',
    estado_servicio VARCHAR(30) NOT NULL DEFAULT 'Borrador' CHECK (estado_servicio IN ('Borrador', 'En Proceso', 'Firmada', 'Cerrada', 'En Conflicto')),
    fecha_servicio DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    descripcion_trabajo TEXT NOT NULL,
    observaciones TEXT NULL,
    firma_cliente_nombre VARCHAR(150) NULL,
    firma_cliente_rut VARCHAR(20) NULL,
    hash_firma_digital CHAR(64) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_por INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    -- Clave única compuesta que permite almacenar versiones en conflicto sin sobreescribir datos
    CONSTRAINT uk_hojas_servicio_uuid_version_origen UNIQUE (uuid_registro, version, origen_edicion)
);

CREATE INDEX idx_hojas_servicio_uuid ON hojas_servicio (uuid_registro);
CREATE INDEX idx_hojas_servicio_proyecto ON hojas_servicio (proyecto_id);
CREATE INDEX idx_hojas_servicio_conflicto ON hojas_servicio (estado_sincronizacion) WHERE estado_sincronizacion = 'conflicto';

-- Tabla: Checklists_terreno (Revisiones e inspecciones técnicas vinculadas a la versión de la hoja)
CREATE TABLE checklists_terreno (
    id_checklist SERIAL PRIMARY KEY,
    id_hoja_servicio INT NOT NULL REFERENCES hojas_servicio(id_hoja_servicio) ON DELETE CASCADE,
    categoria_inspeccion VARCHAR(100) NOT NULL,
    item_evaluado VARCHAR(250) NOT NULL,
    estado_conformidad VARCHAR(20) NOT NULL DEFAULT 'Conforme' CHECK (estado_conformidad IN ('Conforme', 'No Conforme', 'No Aplica')),
    valor_medido VARCHAR(50) NULL,
    observaciones TEXT NULL,
    orden INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_checklists_hoja ON checklists_terreno (id_hoja_servicio);

-- Tabla: Adjuntos_servicio (Metadatos de archivos, fotos, evidencias y firmas con trazabilidad de versión)
CREATE TABLE adjuntos_servicio (
    id_adjunto SERIAL PRIMARY KEY,
    id_hoja_servicio INT NOT NULL REFERENCES hojas_servicio(id_hoja_servicio) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes > 0),
    hash_sha256 CHAR(64) NOT NULL,
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    categoria_adjunto VARCHAR(50) NOT NULL DEFAULT 'Fotografia' CHECK (categoria_adjunto IN ('Fotografia', 'Firma', 'Informe_PDF', 'Documento')),
    origen_dispositivo VARCHAR(80) NULL,
    metadatos_extra JSONB NULL,
    version_hoja INT NOT NULL DEFAULT 1,
    creado_por INT NULL REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_subida TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_adjuntos_hoja ON adjuntos_servicio (id_hoja_servicio);
CREATE INDEX idx_adjuntos_hash ON adjuntos_servicio (hash_sha256);
```

