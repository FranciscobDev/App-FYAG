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
CREATE TYPE estado_oc_enum AS ENUM ('Pendiente', 'Parcial', 'Recibido', 'Cancelado');

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

-- Tabla: Unidad_de_medida
CREATE TABLE unidad_de_medida (
    id_unidad SERIAL PRIMARY KEY,
    tipo_unidad VARCHAR(50) NOT NULL,
    descripcion VARCHAR(250)
);

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
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Proveedor
CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    nombre_proveedor VARCHAR(150) NOT NULL,
    rut_proveedor VARCHAR(20) UNIQUE,
    correo_contacto VARCHAR(150),
    telefono VARCHAR(20),
    direccion VARCHAR(250),
    nombre_fantasia VARCHAR(150),
    giro VARCHAR(150),
    nombre_contacto VARCHAR(150),
    telefono_contacto VARCHAR(30),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla: Datos_bancarios_proveedor
CREATE TABLE datos_bancarios_proveedor (
    id_proveedor INT PRIMARY KEY,
    cuenta_banco VARCHAR(250) NOT NULL,
    banco_proveedor VARCHAR(250) NOT NULL,
    tipo_cuenta VARCHAR(30) DEFAULT 'corriente',
    correo_transferencia VARCHAR(150),
    CONSTRAINT fk_datos_bancarios_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor) ON DELETE CASCADE
);

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
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ NULL,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- Tabla: Log_accesos
CREATE TABLE log_accesos (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuario(id_usuario),
    correo_intento VARCHAR(255) NOT NULL,
    resultado VARCHAR(40) NOT NULL, -- exito | clave_incorrecta | bloqueado | cuenta_inexistente | cuenta_desactivada
    ip VARCHAR(45),
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Bitacora_auditoria
CREATE TABLE bitacora_auditoria (
    id_bitacora SERIAL PRIMARY KEY,
    fecha_evento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT,
    entidad VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    campo_modificado VARCHAR(150),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    descripcion TEXT,
    CONSTRAINT bitacora_auditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

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

-- Tabla: Proyecto_tecnico
CREATE TABLE proyecto_tecnico (
    id_proyecto INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_asignacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT proyecto_tecnico_pkey PRIMARY KEY (id_proyecto, id_usuario),
    CONSTRAINT proyecto_tecnico_id_proyecto_fkey FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT proyecto_tecnico_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

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
-- 4. ARTÍCULOS E INVENTARIO
-- ==========================================

-- Tabla: Articulo
CREATE TABLE articulo (
    id_articulo SERIAL PRIMARY KEY,
    nombre_articulo VARCHAR(250) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    precio_unitario INT DEFAULT 0,
    categoria categoria_enum NOT NULL,
    id_proveedor INT,
    id_unidad INT,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_articulo_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor) ON DELETE SET NULL,
    CONSTRAINT articulo_id_unidad_fkey FOREIGN KEY (id_unidad) REFERENCES unidad_de_medida(id_unidad) ON DELETE SET NULL
);

-- Tabla: Articulo_en_proyecto
CREATE TABLE articulo_en_proyecto (
    id_articulo_proyecto SERIAL PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    id_unidad INT,
    CONSTRAINT fk_art_proj_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_art_proj_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo),
    CONSTRAINT fk_art_proj_unidad FOREIGN KEY (id_unidad) REFERENCES unidad_de_medida(id_unidad)
);

-- Tabla: Articulos_stock
CREATE TABLE articulos_stock (
    id_stock SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL,
    id_bodega INT,
    cantidad_disponible NUMERIC(10,2) DEFAULT 0,
    stock_minimo NUMERIC(10,2) DEFAULT 0,
    ubicacion VARCHAR(100),
    CONSTRAINT fk_stock_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo) ON DELETE CASCADE
);

-- Tabla: Movimiento_Inventario
CREATE TABLE movimiento_inventario (
    id_movimiento SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL,
    tipo_movimiento tipo_movimiento_enum NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    fecha_movimiento TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT,
    CONSTRAINT fk_mov_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo),
    CONSTRAINT fk_mov_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- Tabla: Mermas
CREATE TABLE mermas (
    id_merma SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL,
    precio_unitario INT DEFAULT 0,
    cantidad_baja NUMERIC(10,2) NOT NULL,
    fecha_merma DATE DEFAULT CURRENT_DATE,
    id_usuario INT,
    observacion_merma VARCHAR(250),
    perdida_valor_total INT DEFAULT 0,
    CONSTRAINT fk_mermas_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo),
    CONSTRAINT fk_mermas_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- Tabla: Auditoria_stock
CREATE TABLE auditoria_stock (
    id_auditoria SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL,
    disponible_articulo NUMERIC(10,2),
    disponible_actualizado NUMERIC(10,2),
    id_usuario INT,
    nota_auditoria VARCHAR(250),
    impacto_valorizado INT DEFAULT 0,
    estado_auditoria VARCHAR(250),
    CONSTRAINT fk_auditoria_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- ==========================================
-- 5. COMPRAS, RECEPCIÓN Y FACTURACIÓN
-- ==========================================

-- 5.1 Orden de Compra
CREATE TABLE orden_de_compra (
    id_orden_de_compra SERIAL PRIMARY KEY,
    id_proveedor INT NOT NULL,
    fecha_estimada_oc DATE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    estado estado_oc_enum NOT NULL DEFAULT 'Pendiente',
    observaciones VARCHAR(250),
    CONSTRAINT fk_oc_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
);

CREATE TABLE orden_compra_detalle (
    id_orden_compra_detalle SERIAL PRIMARY KEY,
    id_orden_de_compra INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad_orden NUMERIC(10,2) NOT NULL,
    precio_unitario INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_oc_detalle_cabecera FOREIGN KEY (id_orden_de_compra) REFERENCES orden_de_compra(id_orden_de_compra) ON DELETE CASCADE,
    CONSTRAINT fk_oc_detalle_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo)
);

-- 5.2 Recepción de Artículos
CREATE TABLE registro_recepcion_articulo (
    id_registro_recepcion_articulo SERIAL PRIMARY KEY,
    id_orden_de_compra INT NOT NULL,
    estado estado_oc_enum NOT NULL DEFAULT 'Pendiente',
    CONSTRAINT fk_recepcion_oc FOREIGN KEY (id_orden_de_compra) REFERENCES orden_de_compra(id_orden_de_compra) ON DELETE CASCADE
);

CREATE TABLE registro_recepcion_articulo_detalle (
    id_recepcion_detalle SERIAL PRIMARY KEY,
    id_registro_recepcion_articulo INT NOT NULL,
    id_orden_compra_detalle INT NOT NULL,
    fecha_recepcion DATE DEFAULT CURRENT_DATE,
    cantidad_recibida NUMERIC(10,2) NOT NULL DEFAULT 0,
    cantidad_defectuosa NUMERIC(10,2) DEFAULT 0,
    CONSTRAINT fk_recepcion_detalle_cabecera FOREIGN KEY (id_registro_recepcion_articulo)
        REFERENCES registro_recepcion_articulo(id_registro_recepcion_articulo) ON DELETE CASCADE,
    CONSTRAINT fk_recepcion_detalle_oc_linea FOREIGN KEY (id_orden_compra_detalle)
        REFERENCES orden_compra_detalle(id_orden_compra_detalle)
);

-- 5.3 Facturación
CREATE TABLE factura (
    id_factura SERIAL PRIMARY KEY,
    numero_factura VARCHAR(50) NOT NULL,
    id_proveedor INT NOT NULL,
    id_orden_de_compra INT,
    subtotal_neto INT DEFAULT 0,
    monto_iva INT DEFAULT 0,
    total_factura INT DEFAULT 0,
    fecha_emision DATE DEFAULT CURRENT_DATE,
    CONSTRAINT fk_factura_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor),
    CONSTRAINT fk_factura_oc FOREIGN KEY (id_orden_de_compra) REFERENCES orden_de_compra(id_orden_de_compra) ON DELETE SET NULL,
    CONSTRAINT uk_factura_proveedor_numero UNIQUE (id_proveedor, numero_factura)
);

CREATE TABLE factura_detalle (
    id_factura_detalle SERIAL PRIMARY KEY,
    id_factura INT NOT NULL,
    id_articulo INT NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario INT NOT NULL DEFAULT 0,
    subtotal_linea INT GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario)) STORED,
    CONSTRAINT fk_factura_detalle_cabecera FOREIGN KEY (id_factura) REFERENCES factura(id_factura) ON DELETE CASCADE,
    CONSTRAINT fk_factura_detalle_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo)
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
    cantidad_solicitada NUMERIC(10,2) NOT NULL,
    CONSTRAINT fk_det_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud) ON DELETE CASCADE,
    CONSTRAINT fk_det_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo)
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
    cantidad_requerida_kit NUMERIC(10,2) NOT NULL,
    CONSTRAINT fk_det_kit_proyecto FOREIGN KEY (id_kit_proyecto) REFERENCES kit_proyecto(id_kit_proyecto) ON DELETE CASCADE,
    CONSTRAINT fk_det_kit_articulo FOREIGN KEY (id_articulo) REFERENCES articulo(id_articulo)
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

