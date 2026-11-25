# Script de Inserción de Datos Iniciales (Seed / Inserts PostgreSQL)

```sql
-- =============================================================================
-- FYAG - POBLADO DE DATOS DE PRUEBA Y CONFIGURACIÓN INICIAL (POSTGRESQL)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ROLES DEL SISTEMA
-- =============================================================================
INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES
    (1, 'Administrador', 'Acceso total al sistema, auditoría, reportes y configuración'),
    (2, 'Bodeguero',     'Control de stock, recepciones de compras, inventario y mermas'),
    (3, 'Tecnico',       'Registro de avance de proyectos, solicitud de insumos y rendición')
ON CONFLICT (id_rol) DO UPDATE SET 
    nombre_rol = EXCLUDED.nombre_rol,
    descripcion = EXCLUDED.descripcion;

SELECT setval('roles_id_rol_seq', (SELECT MAX(id_rol) FROM roles));

-- =============================================================================
-- 2. CATEGORÍAS DE ARTÍCULOS E INSUMOS
-- =============================================================================
INSERT INTO categorias (id_categoria, nombre_categoria, descripcion) VALUES
    (1, 'Herramientas', 'Herramientas manuales, eléctricas y neumáticas'),
    (2, 'Materiales',   'Conductores, tuberías, perfiles y canalizaciones'),
    (3, 'Equipos',      'Bombas, compresores, tableros y climatizadores'),
    (4, 'Consumibles',  'Fijaciones, adhesivos, soldaduras y cintas'),
    (5, 'Seguridad',    'Elementos de protección personal (EPP) y señalética')
ON CONFLICT (id_categoria) DO UPDATE SET 
    nombre_categoria = EXCLUDED.nombre_categoria,
    descripcion = EXCLUDED.descripcion;

SELECT setval('categorias_id_categoria_seq', (SELECT MAX(id_categoria) FROM categorias));

-- =============================================================================
-- 3. UNIDADES DE MEDIDA (Estándar y a granel con decimales)
-- =============================================================================
INSERT INTO unidades_medida (id_unidad, codigo, nombre, permite_decimales) VALUES
    (1, 'unidad', 'Unidad / Pieza',           FALSE),
    (2, 'kg',     'Kilogramo (granel peso)',   TRUE),
    (3, 'm',      'Metro lineal (granel)',     TRUE),
    (4, 'l',      'Litro (granel volumen)',    TRUE),
    (5, 'caja',   'Caja / Pack empaque',       FALSE),
    (6, 'juego',  'Juego / Set compuesto',     FALSE)
ON CONFLICT (id_unidad) DO UPDATE SET 
    codigo = EXCLUDED.codigo,
    nombre = EXCLUDED.nombre,
    permite_decimales = EXCLUDED.permite_decimales;

SELECT setval('unidades_medida_id_unidad_seq', (SELECT MAX(id_unidad) FROM unidades_medida));

-- =============================================================================
-- 4. CLIENTES
-- =============================================================================
INSERT INTO cliente (id_cliente, rut_cliente, razon_social, giro, telefono, correo_contacto, direccion, nombre_contacto, banco, tipo_cuenta, numero_cuenta, calificacion_promedio, activo) VALUES
    (1, '76.123.456-7', 'Inmobiliaria Pacífico SpA', 'Desarrollo y Construcción Inmobiliaria', '+56 2 2456 7890', 'contacto@inmobpacificospa.cl', 'Av. Providencia 2450, Of. 801, Santiago', 'Rodrigo Sepúlveda', 'Banco de Chile', 'Cuenta Corriente', '00-12345678-01', 4.90, TRUE),
    (2, '77.890.123-4', 'Clínica Andes S.A.', 'Servicios de Salud e Infraestructura Médica', '+56 2 2987 6543', 'operaciones@clinicaandes.cl', 'Av. Las Condes 9100, Las Condes, Santiago', 'Marcela Gajardo', 'Banco Santander', 'Cuenta Corriente', '00-76543210-09', 4.80, TRUE),
    (3, '78.456.789-1', 'Logística & Bodegaje Renca SpA', 'Almacenamiento y Centros de Distribución', '+56 9 8765 4321', 'mantencion@logisticarenca.cl', 'Camino Lo Boza 120, Renca, Santiago', 'Gonzalo Valenzuela', 'Banco BCI', 'Cuenta Corriente', '00-98765432-05', 4.50, TRUE),
    (4, '79.234.567-8', 'Constructora Maipo Limitada', 'Obras Civiles y Estructuras', '+56 2 2345 6789', 'obras@constructoramaipo.cl', 'Av. San Bernardo 540, San Bernardo, Santiago', 'Felipe Morales', 'Banco Estado', 'Cuenta Corriente', '00-45612378-02', 4.70, TRUE)
ON CONFLICT (id_cliente) DO UPDATE SET 
    rut_cliente = EXCLUDED.rut_cliente,
    razon_social = EXCLUDED.razon_social,
    banco = EXCLUDED.banco,
    numero_cuenta = EXCLUDED.numero_cuenta,
    calificacion_promedio = EXCLUDED.calificacion_promedio;

SELECT setval('cliente_id_cliente_seq', (SELECT MAX(id_cliente) FROM cliente));

-- =============================================================================
-- 5. PROVEEDORES Y DATOS BANCARIOS
-- =============================================================================
INSERT INTO proveedor (id_proveedor, rut_proveedor, nombre_proveedor, razon_social, giro, telefono, correo_contacto, direccion, nombre_fantasia, nombre_contacto, telefono_contacto, calificacion_promedio, activo) VALUES
    (1, '96.543.210-K', 'ElectroChile S.A.', 'Comercializadora Eléctrica Chile S.A.', 'Distribución de Insumos Eléctricos', '+56 2 2678 9000', 'ventas@electrochile.cl', 'Av. Matta 1234, Santiago', 'ElectroChile', 'Carlos Medina', '+56 9 7123 4567', 4.80, TRUE),
    (2, '95.123.890-5', 'TermoClima Limitada', 'Distribuidora TermoClima Limitada', 'Equipamiento HVAC y Climatización', '+56 2 2789 0123', 'contacto@termoclima.cl', 'Av. Vicuña Mackenna 4500, Macul', 'TermoClima', 'Patricia Henríquez', '+56 9 8234 5678', 4.60, TRUE),
    (3, '94.678.901-2', 'Ferretería Industrial del Sol', 'Ferretería y Metales del Sol SpA', 'Materiales de Fijación y Metales', '+56 2 2890 1234', 'ventas@ferreteriasol.cl', 'Av. Grecia 890, Ñuñoa', 'Ferretería del Sol', 'Hernán Ruiz', '+56 9 9345 6789', 4.90, TRUE),
    (4, '93.456.789-8', 'Seguridad & Protección ProTex', 'Importadora ProTex Chile SpA', 'Elementos de Protección Personal (EPP)', '+56 2 2901 2345', 'ventas@protexchile.cl', 'Av. Santa Rosa 3200, San Miguel', 'ProTex Chile', 'Daniela Castillo', '+56 9 6456 7890', 4.70, TRUE)
ON CONFLICT (id_proveedor) DO UPDATE SET 
    rut_proveedor = EXCLUDED.rut_proveedor,
    nombre_proveedor = EXCLUDED.nombre_proveedor,
    calificacion_promedio = EXCLUDED.calificacion_promedio;

SELECT setval('proveedor_id_proveedor_seq', (SELECT MAX(id_proveedor) FROM proveedor));

-- Datos bancarios de proveedores
INSERT INTO datos_bancarios_proveedor (id_proveedor, cuenta_banco, banco_proveedor, tipo_cuenta, correo_transferencia) VALUES
    (1, '12-345-67890-1', 'Banco de Chile',     'corriente', 'pagos@electrochile.cl'),
    (2, '98-765-43210-9', 'Banco Santander',   'corriente', 'facturacion@termoclima.cl'),
    (3, '54-321-09876-5', 'Banco BCI',         'corriente', 'cobranzas@ferreteriasol.cl'),
    (4, '23-456-78901-2', 'Banco Scotiabank',  'corriente', 'finanzas@protexchile.cl')
ON CONFLICT (id_proveedor) DO UPDATE SET 
    cuenta_banco = EXCLUDED.cuenta_banco,
    banco_proveedor = EXCLUDED.banco_proveedor,
    tipo_cuenta = EXCLUDED.tipo_cuenta,
    correo_transferencia = EXCLUDED.correo_transferencia;

-- =============================================================================
-- 6. USUARIOS DEL SISTEMA (Contraseñas con hash bcrypt $2a$...)
-- Contraseña plana por defecto para desarrollo: AdminPrueba1 / Tecnico123 / Bodega123
-- =============================================================================
INSERT INTO usuario (id_usuario, nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, especializacion, contrasena_hash, activo, intentos_fallidos, bloqueado_hasta) VALUES
    (1, 'Javier',    'Muñoz Contreras', 'javier.munoz@fyag.cl',   '12.456.789-5', 1, 'Administración General y Operaciones', '$2a$10$tZ3dKz8G0h9LpQ5e1uW0wOO1Qo2h6vN3o0d5uP8s8w3R9bQ6vC9h6', TRUE, 0, NULL),
    (2, 'Camila',    'Vera Soto',       'camila.vera@fyag.cl',    '15.321.654-2', 2, 'Logística, Bodega y Abastecimiento',   '$2a$10$tZ3dKz8G0h9LpQ5e1uW0wOO1Qo2h6vN3o0d5uP8s8w3R9bQ6vC9h6', TRUE, 0, NULL),
    (3, 'Alejandro', 'Rojas Pino',      'alejandro.rojas@fyag.cl', '17.894.562-8', 3, 'Electricidad SEC clase A',            '$2a$10$tZ3dKz8G0h9LpQ5e1uW0wOO1Qo2h6vN3o0d5uP8s8w3R9bQ6vC9h6', TRUE, 0, NULL),
    (4, 'Matías',    'Fuentes Araya',   'matias.fuentes@fyag.cl',  '16.783.421-3', 3, 'Climatización y Refrigeración',       '$2a$10$tZ3dKz8G0h9LpQ5e1uW0wOO1Qo2h6vN3o0d5uP8s8w3R9bQ6vC9h6', TRUE, 0, NULL),
    (5, 'Constanza', 'Leiva Núñez',     'constanza.leiva@fyag.cl', '18.234.905-9', 3, 'Gasfitería e Instalaciones Sanitarias', '$2a$10$tZ3dKz8G0h9LpQ5e1uW0wOO1Qo2h6vN3o0d5uP8s8w3R9bQ6vC9h6', TRUE, 0, NULL),
    (6, 'Pedro',     'Aguilera Mora',   'pedro.aguilera@fyag.cl',  '14.567.832-4', 3, 'Soldadura y Estructuras Metálicas',   '$2a$10$tZ3dKz8G0h9LpQ5e1uW0wOO1Qo2h6vN3o0d5uP8s8w3R9bQ6vC9h6', TRUE, 0, NULL)
ON CONFLICT (id_usuario) DO UPDATE SET 
    correo_usuario = EXCLUDED.correo_usuario,
    rut = EXCLUDED.rut,
    id_rol = EXCLUDED.id_rol,
    contrasena_hash = EXCLUDED.contrasena_hash,
    activo = EXCLUDED.activo;

SELECT setval('usuario_id_usuario_seq', (SELECT MAX(id_usuario) FROM usuario));

-- =============================================================================
-- 7. PARÁMETROS DEL SISTEMA (H1, H19, H22-H24, H27, H41, H47)
-- =============================================================================
INSERT INTO parametros (clave, valor_actual, valor_defecto, min, max, descripcion, unidad) VALUES
    ('intentos_bloqueo',            5,      5,      1,      10,      'Intentos fallidos de login permitidos antes de bloquear la cuenta (H1)', 'intentos'),
    ('minutos_bloqueo',             15,     15,     1,      1440,    'Duración del bloqueo temporal tras exceder intentos (H1)',               'minutos'),
    ('minutos_inactividad_sesion',  30,     30,     5,      480,     'Minutos de inactividad antes de cerrar sesión web automáticamente',     'minutos'),
    ('minutos_validez_recuperacion',30,     30,     5,      120,     'Vigencia en minutos del enlace de recuperación de contraseña',           'minutos'),
    ('discrepancia_inventario_pct', 5.0,    5.0,    1.0,    50.0,    'Umbral de discrepancia máxima permitida en auditoría física (H19)',       '%'),
    ('costo_hora_tecnico',          18500.0,18500.0,5000.0, 100000.0,'Tarifa base por hora de mano de obra técnica (H27)',                     'CLP'),
    ('semaforo_presupuesto_alerta', 80.0,   80.0,   50.0,   95.0,    'Porcentaje de presupuesto consumido para alerta amarilla (H27)',         '%'),
    ('semaforo_presupuesto_critico',100.0,  100.0,  90.0,   150.0,   'Porcentaje de presupuesto consumido para alerta roja (H27)',             '%'),
    ('alerta_stock_critico_pct',    20.0,   20.0,   5.0,    50.0,    'Porcentaje bajo stock mínimo para disparar alerta crítica (H22)',        '%'),
    ('alerta_reposicion_dias',      7,      7,      1,      60,      'Días de anticipación para alerta de sugerencia de compra (H23)',         'días'),
    ('alerta_cuarentena_horas',     24,     24,     1,      168,     'Tiempo máximo sin resolver ítem en cuarentena (H24)',                    'horas'),
    ('edicion_limite_horas',        48,     48,     1,      720,     'Plazo máximo permitido para editar registros o recepciones (H41)',       'horas'),
    ('qr_tamano_pixeles',           250,    250,    100,    1000,    'Tamaño estándar de renderizado de etiquetas QR (H47)',                   'px')
ON CONFLICT (clave) DO UPDATE SET 
    valor_actual = EXCLUDED.valor_actual,
    valor_defecto = EXCLUDED.valor_defecto,
    min = EXCLUDED.min,
    max = EXCLUDED.max,
    descripcion = EXCLUDED.descripcion,
    unidad = EXCLUDED.unidad;

-- Poblar tabla parametro_sistema (usada por services/parametros.ts del backend)
INSERT INTO parametro_sistema (clave, descripcion, valor, valor_minimo, valor_maximo, unidad) VALUES
    ('intentos_bloqueo',             'Intentos fallidos de login permitidos antes de bloquear la cuenta', 5,  1, 10,   'intentos'),
    ('minutos_bloqueo',              'Duración del bloqueo de la cuenta tras exceder los intentos',       15, 1, 1440, 'minutos'),
    ('minutos_inactividad_sesion',   'Minutos de inactividad web antes de expirar la sesión',             30, 5, 480,  'minutos'),
    ('minutos_validez_enlace_clave', 'Validez del enlace de recuperación de contraseña',                30, 5, 120,  'minutos')
ON CONFLICT (clave) DO UPDATE SET
    valor = EXCLUDED.valor,
    valor_minimo = EXCLUDED.valor_minimo,
    valor_maximo = EXCLUDED.valor_maximo,
    descripcion = EXCLUDED.descripcion,
    unidad = EXCLUDED.unidad;

-- =============================================================================
-- 8. INSUMOS / ARTÍCULOS (Garantiza SKU único, código QR y precisión hasta 3 decimales)
-- Al insertar, el trigger 'trg_inicializar_stock_insumo' crea automáticamente
-- la fila en 'stock_insumos' con ceros.
-- =============================================================================
INSERT INTO insumos (id_insumo, sku, nombre, categoria_id, categoria_enum, id_unidad, proveedor_id, stock_minimo, cant_reposicion, precio_unitario, codigo_qr, activo, bloqueado_por_conteo) VALUES
    (1,  'ELE-CBL-0012', 'Cable THHN 12 AWG Rojo (Carrete)',      2, 'Materiales',   3, 1, 150.000, 500.000, 635,   'QR-ELE-CBL-0012', TRUE, FALSE),
    (2,  'ELE-CBL-0014', 'Cable THHN 14 AWG Verde Tierra',        2, 'Materiales',   3, 1, 100.000, 400.000, 480,   'QR-ELE-CBL-0014', TRUE, FALSE),
    (3,  'ELE-DIS-0016', 'Disyuntor Termomagnético 1P 16A 6kA',   2, 'Materiales',   1, 1, 20.000,  50.000,  4520,  'QR-ELE-DIS-0016', TRUE, TRUE), -- Bloqueado temporalmente por arqueo físico en curso
    (4,  'ELE-DIF-0025', 'Interruptor Diferencial 2P 25A 30mA',   2, 'Materiales',   1, 1, 15.000,  30.000,  14600, 'QR-ELE-DIF-0025', TRUE, FALSE),
    (5,  'CLI-REF-0410', 'Gas Refrigerante R410A Ecológico',      2, 'Materiales',   2, 2, 25.000,  80.000,  38500, 'QR-CLI-REF-0410', TRUE, FALSE),
    (6,  'CLI-FIL-0001', 'Filtro de Aire Lavable Split 12000 BTU', 4, 'Consumibles',  1, 2, 10.000,  30.000,  5490,  'QR-CLI-FIL-0001', TRUE, FALSE),
    (7,  'CLI-BOM-0050', 'Bomba de Condensado Silenciosa 220V',   3, 'Equipos',      1, 2, 5.000,   15.000,  31800, 'QR-CLI-BOM-0050', TRUE, FALSE),
    (8,  'FER-PER-0008', 'Perno de Anclaje Expansivo 8mm x 80mm', 4, 'Consumibles',  5, 3, 10.000,  25.000,  18500, 'QR-FER-PER-0008', TRUE, FALSE),
    (9,  'FER-SIL-0300', 'Silicona Neutra Alta Temperatura 300ml',4, 'Consumibles',  1, 3, 30.000,  60.000,  2950,  'QR-FER-SIL-0300', TRUE, FALSE),
    (10, 'SEG-CAS-0001', 'Casco de Seguridad Dieléctrico Blanco', 5, 'Seguridad',    1, 4, 12.000,  24.000,  8900,  'QR-SEG-CAS-0001', TRUE, FALSE),
    (11, 'GAS-TUB-0020', 'Tubería Cobre Gas 3/4 pulgada x 6m',   2, 'Materiales',   3, 3, 20.000,  50.000,  28900, 'QR-GAS-TUB-0020', TRUE, FALSE),
    (12, 'GAS-VAL-0012', 'Válvula Esférica de Paso Gas 1/2 pulg', 2, 'Materiales',   1, 3, 15.000,  40.000,  6800,  'QR-GAS-VAL-0012', TRUE, FALSE)
ON CONFLICT (id_insumo) DO UPDATE SET 
    sku = EXCLUDED.sku,
    nombre = EXCLUDED.nombre,
    precio_unitario = EXCLUDED.precio_unitario,
    stock_minimo = EXCLUDED.stock_minimo,
    cant_reposicion = EXCLUDED.cant_reposicion,
    codigo_qr = EXCLUDED.codigo_qr,
    bloqueado_por_conteo = EXCLUDED.bloqueado_por_conteo;

SELECT setval('insumos_id_insumo_seq', (SELECT MAX(id_insumo) FROM insumos));

-- =============================================================================
-- 9. ACTUALIZACIÓN DE STOCK Y VALORIZACIÓN PMP
-- (Puebla los saldos iniciales en 'stock_insumos' y 'articulos_stock')
-- =============================================================================
UPDATE stock_insumos SET disponible = 850.500, comprometido = 200.000, cuarentena = 0.000, pmp = 635.00  WHERE insumo_id = 1;
UPDATE stock_insumos SET disponible = 420.000, comprometido = 100.000, cuarentena = 0.000, pmp = 480.00  WHERE insumo_id = 2;
UPDATE stock_insumos SET disponible = 68.000,  comprometido = 35.000,  cuarentena = 2.000, pmp = 4520.00 WHERE insumo_id = 3;
UPDATE stock_insumos SET disponible = 28.000,  comprometido = 12.000,  cuarentena = 0.000, pmp = 14600.00 WHERE insumo_id = 4;
UPDATE stock_insumos SET disponible = 45.250,  comprometido = 15.000,  cuarentena = 0.000, pmp = 38500.00 WHERE insumo_id = 5;
UPDATE stock_insumos SET disponible = 18.000,  comprometido = 0.000,   cuarentena = 0.000, pmp = 5490.00  WHERE insumo_id = 6;
UPDATE stock_insumos SET disponible = 8.000,   comprometido = 2.000,   cuarentena = 1.000, pmp = 31800.00 WHERE insumo_id = 7;
UPDATE stock_insumos SET disponible = 35.000,  comprometido = 12.000,  cuarentena = 0.000, pmp = 18500.00 WHERE insumo_id = 8;
UPDATE stock_insumos SET disponible = 75.000,  comprometido = 20.000,  cuarentena = 0.000, pmp = 2950.00  WHERE insumo_id = 9;
UPDATE stock_insumos SET disponible = 22.000,  comprometido = 4.000,   cuarentena = 0.000, pmp = 8900.00  WHERE insumo_id = 10;
UPDATE stock_insumos SET disponible = 38.000,  comprometido = 10.000,  cuarentena = 0.000, pmp = 28900.00 WHERE insumo_id = 11;
UPDATE stock_insumos SET disponible = 44.000,  comprometido = 8.000,   cuarentena = 0.000, pmp = 6800.00  WHERE insumo_id = 12;

-- Poblar artículos stock de compatibilidad
INSERT INTO articulos_stock (id_stock, id_articulo, id_bodega, cantidad_disponible, stock_minimo, ubicacion) VALUES
    (1,  1,  1, 850.500, 150.000, 'Pasillo A - Estante 1'),
    (2,  2,  1, 420.000, 100.000, 'Pasillo A - Estante 2'),
    (3,  3,  1, 68.000,  20.000,  'Pasillo B - Gabinete 3'),
    (4,  4,  1, 28.000,  15.000,  'Pasillo B - Gabinete 3'),
    (5,  5,  1, 45.250,  25.000,  'Zona Fría / Seguridad Química'),
    (6,  6,  1, 18.000,  10.000,  'Pasillo C - Estante 2'),
    (7,  7,  1, 8.000,   5.000,   'Pasillo C - Estante 4'),
    (8,  8,  1, 35.000,  10.000,  'Pasillo D - Estante 1'),
    (9,  9,  1, 75.000,  30.000,  'Pasillo D - Estante 2'),
    (10, 10, 1, 22.000,  12.000,  'Pasillo E - Zona EPP'),
    (11, 11, 1, 38.000,  20.000,  'Patio de Tuberías - Racks'),
    (12, 12, 1, 44.000,  15.000,  'Pasillo D - Gaveta 10')
ON CONFLICT (id_stock) DO UPDATE SET
    cantidad_disponible = EXCLUDED.cantidad_disponible,
    stock_minimo = EXCLUDED.stock_minimo,
    ubicacion = EXCLUDED.ubicacion;

SELECT setval('articulos_stock_id_stock_seq', (SELECT MAX(id_stock) FROM articulos_stock));

-- =============================================================================
-- 10. HERRAMIENTAS
-- =============================================================================
INSERT INTO herramienta (id_herramienta, numero_serie_herramienta, nombre_herramienta, categoria, marca_herramienta, modelo_herramienta, frecuencia_mantencion) VALUES
    (1, 'SN-MIL-M18-001', 'Rotomartillo SDS Plus M18 FUEL', 'Herramientas', 'Milwaukee', 'M18-CHP-0X', 90),
    (2, 'SN-MAK-DHP-002', 'Taladro Percutor Inalámbrico 18V', 'Herramientas', 'Makita',    'DHP484Z',    90),
    (3, 'SN-FLU-179-003', 'Multímetro Digital True RMS',     'Equipos',      'Fluke',     '179 TrueRMS',180),
    (4, 'SN-ROTH-ROC-004','Bomba de Vacío Doble Etapa 2.5CFM', 'Equipos',   'Rothenberger','ROAIRVAC R32',60),
    (5, 'SN-DEW-DWE-005', 'Esmeril Angular 4-1/2 pulg 900W', 'Herramientas', 'DeWalt',    'DWE4020',    90)
ON CONFLICT (id_herramienta) DO UPDATE SET 
    nombre_herramienta = EXCLUDED.nombre_herramienta,
    frecuencia_mantencion = EXCLUDED.frecuencia_mantencion;

SELECT setval('herramienta_id_herramienta_seq', (SELECT MAX(id_herramienta) FROM herramienta));

-- =============================================================================
-- 11. PROYECTOS / FAENAS
-- =============================================================================
INSERT INTO proyecto (id_proyecto, codigo_proyecto, nombre_proyecto, tipo_proyecto, cliente, id_cliente, direccion, fecha_inicio, fecha_fin, presupuesto_inicial, presupuesto_materiales, presupuesto_horas, tarifa_hora, valor_venta, costo_real_actual, porcentaje_avance, estado_proyecto, id_usuario) VALUES
    (1, 'OB-2026-014', 'Edificio Los Aromos – Instalación eléctrica', 'Instalacion', 'Inmobiliaria Pacífico SpA', 1, 'Av. Providencia 2450, Providencia, Santiago', '2026-08-01', '2026-10-14', 18500000, 11000000, 400.00, 18750, 24500000, 19450000, 68.00, 'En Proceso', 1),
    (2, 'MT-2026-087', 'Mantención preventiva climatización – Clínica Andes', 'Mantencion', 'Clínica Andes S.A.', 2, 'Av. Las Condes 9100, Las Condes, Santiago', '2026-09-15', '2026-11-20', 12000000, 7500000, 240.00, 18750, 16800000, 10920000, 45.00, 'En Proceso', 1),
    (3, 'OB-2026-021', 'Nave Logística Renca – Red contra incendios', 'Instalacion', 'Logística & Bodegaje Renca SpA', 3, 'Camino Lo Boza 120, Renca, Santiago', '2026-10-01', '2026-12-15', 32000000, 21000000, 580.00, 18500, 42000000, 8500000,  22.00, 'En Proceso', 1),
    (4, 'OB-2026-009', 'Condominio San Bernardo – Canalización y tableros', 'Instalacion', 'Constructora Maipo Limitada', 4, 'Av. San Bernardo 540, San Bernardo', '2026-06-01', '2026-09-30', 14200000, 8800000, 310.00, 18500, 19500000, 14100000, 100.00, 'Completado', 1)
ON CONFLICT (id_proyecto) DO UPDATE SET 
    codigo_proyecto = EXCLUDED.codigo_proyecto,
    nombre_proyecto = EXCLUDED.nombre_proyecto,
    porcentaje_avance = EXCLUDED.porcentaje_avance,
    estado_proyecto = EXCLUDED.estado_proyecto;

SELECT setval('proyecto_id_proyecto_seq', (SELECT MAX(id_proyecto) FROM proyecto));

-- =============================================================================
-- 12. ASIGNACIONES DE PROYECTO (Con unicidad activa e historial)
-- =============================================================================
INSERT INTO asignaciones_proyecto (proyecto_id, tecnico_id, fecha_asignacion, activo) VALUES
    (1, 3, '2026-08-01 08:30:00-03', TRUE), -- Alejandro Rojas en Los Aromos
    (1, 6, '2026-08-01 08:30:00-03', TRUE), -- Pedro Aguilera en Los Aromos
    (2, 4, '2026-09-15 09:00:00-03', TRUE), -- Matías Fuentes en Clínica Andes
    (2, 3, '2026-09-20 09:00:00-03', TRUE), -- Alejandro Rojas en Clínica Andes
    (3, 5, '2026-10-01 08:00:00-03', TRUE), -- Constanza Leiva en Nave Renca
    (3, 6, '2026-10-01 08:00:00-03', TRUE)  -- Pedro Aguilera en Nave Renca
ON CONFLICT (proyecto_id, tecnico_id) WHERE activo = TRUE DO NOTHING;

-- Registro de horas trabajadas (en bloques de 0.5h y máximo 24h/día por técnico) [DB]
INSERT INTO horas_trabajadas (id_registro_horas, proyecto_id, tecnico_id, fecha, horas) VALUES
    (1, 1, 3, '2026-08-01', 8.5),
    (2, 1, 6, '2026-08-01', 8.0),
    (3, 2, 4, '2026-09-15', 7.5),
    (4, 2, 3, '2026-09-20', 4.0),
    (5, 3, 5, '2026-10-01', 6.5),
    (6, 3, 6, '2026-10-01', 5.0)
ON CONFLICT (id_registro_horas) DO NOTHING;

SELECT setval('horas_trabajadas_id_registro_horas_seq', (SELECT MAX(id_registro_horas) FROM horas_trabajadas));

-- =============================================================================
-- 12.1 AVANCES DE PROYECTO Y MATERIALES UTILIZADOS [DB]
-- Valida rango estricto de porcentaje: 0 <= porcentaje <= 100
-- =============================================================================
INSERT INTO avances_proyecto (id_avance, proyecto_id, tecnico_id, porcentaje, comentario, fecha, hora) VALUES
    (1, 1, 3, 35.00, 'Canalización principal y montaje de bandejas eléctricas concluido en pisos 1 al 3', '2026-08-20', '16:30:00'),
    (2, 1, 3, 68.00, 'Tendido de conductores THHN y alambrado de tableros generales pisos 4 y 5', '2026-09-12', '17:00:00'),
    (3, 2, 4, 45.00, 'Revisión y presurización de circuitos de refrigeración en pabellones A y B', '2026-09-30', '15:45:00')
ON CONFLICT (id_avance) DO NOTHING;

SELECT setval('avances_proyecto_id_avance_seq', (SELECT MAX(id_avance) FROM avances_proyecto));

INSERT INTO avance_materiales_usados (id_avance_material, id_avance, id_articulo, cantidad_usada, id_unidad) VALUES
    (1, 1, 1, 120.000, 3), -- 120m Cable THHN 12 en avance 1
    (2, 2, 1, 150.000, 3), -- 150m Cable THHN 12 en avance 2
    (3, 2, 3, 10.000,  1), -- 10 disyuntores 16A en avance 2
    (4, 3, 5, 4.500,   2)  -- 4.5 kg gas R410A en avance 3
ON CONFLICT (id_avance_material) DO NOTHING;

SELECT setval('avance_materiales_usados_id_avance_material_seq', (SELECT MAX(id_avance_material) FROM avance_materiales_usados));

-- =============================================================================
-- 13. KITS PREDETERMINADOS DE PROYECTO
-- =============================================================================
INSERT INTO kit_proyecto (id_kit_proyecto, disponible_kit, nombre_kit, descripcion_kit, categoria) VALUES
    (1, 4, 'Kit Básico Instalación Eléctrica Domiciliaria', 'Disyuntores, diferenciales, conductores y fijaciones estándar', 'Materiales'),
    (2, 2, 'Kit Climatización Split 12K - 18K BTU', 'Refrigerante R410A, tubería aislada, bomba y fijaciones antivibratorias', 'Equipos')
ON CONFLICT (id_kit_proyecto) DO UPDATE SET 
    nombre_kit = EXCLUDED.nombre_kit,
    disponible_kit = EXCLUDED.disponible_kit;

SELECT setval('kit_proyecto_id_kit_proyecto_seq', (SELECT MAX(id_kit_proyecto) FROM kit_proyecto));

INSERT INTO detalle_kit (id_detalle_kit, id_kit_proyecto, id_articulo, cantidad_requerida_kit) VALUES
    (1, 1, 1, 100.000), -- 100m cable THHN 12
    (2, 1, 2, 100.000), -- 100m cable THHN 14
    (3, 1, 3, 6.000),   -- 6 disyuntores 16A
    (4, 1, 4, 2.000),   -- 2 diferenciales 25A
    (5, 2, 5, 2.500),   -- 2.5kg refrigerante R410A
    (6, 2, 6, 2.000),   -- 2 filtros lavables
    (7, 2, 7, 1.000)    -- 1 bomba condensado
ON CONFLICT (id_detalle_kit) DO NOTHING;

SELECT setval('detalle_kit_id_detalle_kit_seq', (SELECT MAX(id_detalle_kit) FROM detalle_kit));

-- =============================================================================
-- 14. ÓRDENES DE COMPRA Y LÍNEAS
-- =============================================================================
INSERT INTO ordenes_compra (id_orden_compra, numero_oc, proveedor_id, estado, origen, fecha_estimada_oc, fecha_creacion, observaciones) VALUES
    (1, 'OC-2026-00001', 1, 'Recibida',        'Stock Critico',    '2026-09-05', '2026-09-01 10:00:00-03', 'Reposición programada conductores y tableros'),
    (2, 'OC-2026-00002', 2, 'Recibida parcial','Manual',           '2026-09-18', '2026-09-12 11:30:00-03', 'Adquisición refrigerante R410A y bombas'),
    (3, 'OC-2026-00003', 3, 'Enviada',         'Solicitud Insumos','2026-10-25', '2026-10-18 15:45:00-03', 'Pernos de anclaje para proyecto Nave Renca'),
    (4, 'OC-2026-00004', 4, 'Borrador',        'Manual',           '2026-11-05', '2026-10-22 09:15:00-03', 'Renovación de cascos y protección auditiva')
ON CONFLICT (id_orden_compra) DO UPDATE SET 
    numero_oc = EXCLUDED.numero_oc,
    estado = EXCLUDED.estado;

SELECT setval('ordenes_compra_id_orden_compra_seq', (SELECT MAX(id_orden_compra) FROM ordenes_compra));
SELECT setval('seq_numero_oc', (SELECT COUNT(*) FROM ordenes_compra));

-- Líneas de las órdenes de compra
INSERT INTO oc_lineas (id_oc_linea, id_orden_compra, id_articulo, cantidad_orden, precio_unitario) VALUES
    (1, 1, 1, 1000.000, 610),
    (2, 1, 3, 50.000,   4300),
    (3, 2, 5, 50.000,   37500),
    (4, 2, 7, 10.000,   30500),
    (5, 3, 8, 20.000,   17800),
    (6, 4, 10, 30.000,  8500)
ON CONFLICT (id_oc_linea) DO NOTHING;

SELECT setval('oc_lineas_id_oc_linea_seq', (SELECT MAX(id_oc_linea) FROM oc_lineas));

-- =============================================================================
-- 15. REGISTROS DE RECEPCIÓN DE ARTÍCULOS
-- =============================================================================
INSERT INTO registro_recepcion_articulo (id_registro_recepcion_articulo, id_orden_compra, estado) VALUES
    (1, 1, 'Recibida'),
    (2, 2, 'Recibida parcial')
ON CONFLICT (id_registro_recepcion_articulo) DO NOTHING;

SELECT setval('registro_recepcion_articulo_id_registro_recepcion_articulo_seq', (SELECT MAX(id_registro_recepcion_articulo) FROM registro_recepcion_articulo));

INSERT INTO registro_recepcion_articulo_detalle (id_recepcion_detalle, id_registro_recepcion_articulo, id_oc_linea, fecha_recepcion, cantidad_recibida, cantidad_defectuosa) VALUES
    (1, 1, 1, '2026-09-05', 1000.000, 0.000),
    (2, 1, 2, '2026-09-05', 50.000,   0.000),
    (3, 2, 3, '2026-09-18', 30.000,   0.000), -- 30 de 50 recibidos
    (4, 2, 4, '2026-09-18', 10.000,   1.000)  -- 1 unidad defectuosa enviada a cuarentena
ON CONFLICT (id_recepcion_detalle) DO NOTHING;

SELECT setval('registro_recepcion_articulo_detalle_id_recepcion_detalle_seq', (SELECT MAX(id_recepcion_detalle) FROM registro_recepcion_articulo_detalle));

-- =============================================================================
-- 16. FACTURAS DE PROVEEDORES Y DETALLE
-- =============================================================================
INSERT INTO factura (id_factura, numero_factura, id_proveedor, id_orden_compra, subtotal_neto, monto_iva, total_factura, fecha_emision) VALUES
    (1, 'FC-88412', 1, 1, 825000,  156750, 981750,  '2026-09-05'),
    (2, 'FC-11209', 2, 2, 1430000, 271700, 1701700, '2026-09-19')
ON CONFLICT (id_factura) DO NOTHING;

SELECT setval('factura_id_factura_seq', (SELECT MAX(id_factura) FROM factura));

INSERT INTO factura_detalle (id_factura_detalle, id_factura, id_articulo, cantidad, precio_unitario) VALUES
    (1, 1, 1, 1000.000, 610),
    (2, 1, 3, 50.000,   4300),
    (3, 2, 5, 30.000,   37500),
    (4, 2, 7, 10.000,   30500)
ON CONFLICT (id_factura_detalle) DO NOTHING;

SELECT setval('factura_detalle_id_factura_detalle_seq', (SELECT MAX(id_factura_detalle) FROM factura_detalle));

-- =============================================================================
-- 17. SOLICITUDES DE MATERIALES POR TÉCNICOS
-- =============================================================================
INSERT INTO solicitudes (id_solicitud, id_usuario, id_proyecto, fecha_solicitud, estado_solicitud, descripcion_solicitud) VALUES
    (1, 3, 1, '2026-10-10 08:30:00-03', 'Aprobada',  'Material para alambrado y tableros pisos 3 al 5'),
    (2, 4, 2, '2026-10-15 09:15:00-03', 'Pendiente', 'Recarga refrigerante piso 2 sector pabellones')
ON CONFLICT (id_solicitud) DO NOTHING;

SELECT setval('solicitudes_id_solicitud_seq', (SELECT MAX(id_solicitud) FROM solicitudes));

INSERT INTO detalle_solicitudes (id_detalle_solicitud, id_solicitud, id_articulo, cantidad_solicitada) VALUES
    (1, 1, 1, 200.000),
    (2, 1, 3, 15.000),
    (3, 2, 5, 8.500)
ON CONFLICT (id_detalle_solicitud) DO NOTHING;

SELECT setval('detalle_solicitudes_id_detalle_solicitud_seq', (SELECT MAX(id_detalle_solicitud) FROM detalle_solicitudes));

-- =============================================================================
-- 18. PLANES DE MANTENCIÓN PERIÓDICA Y SEGUIMIENTO DE CLIENTES
-- =============================================================================
INSERT INTO plan_mantencion_cliente (id_plan, id_cliente, id_proyecto_origen, titulo_plan, modalidad, id_kit_proyecto, codigo_contrato, frecuencia_meses, fecha_ultima_mantencion, fecha_proxima_mantencion, costo_pactado, estado_plan, notas_plan) VALUES
    (1, 1, 1, 'Mantención Trimestral Tableros y Alimentadores', 'POR_KIT',      1, NULL,           3,  '2026-08-15', '2026-11-15', 680000,  'Activo', 'Revisión termográfica e insumos por Kit Eléctrico cada 3 meses'),
    (2, 2, 2, 'Mantención Climatización Pabellones Clínicos',   'MIXTO',        2, 'SLA-ANDES-26', 6,  '2026-06-01', '2026-12-01', 1250000, 'Activo', 'Contrato semestral con recarga R410A y cambio de filtros por Kit'),
    (3, 3, 3, 'Inspección y Pruebas Red Contra Incendios',      'POR_CONTRATO', NULL, 'CTR-REN-10M', 10, '2026-02-10', '2026-12-10', 1890000, 'Activo', 'Mantenimiento mayor programado cada 10 meses según norma NFPA'),
    (4, 4, 4, 'Mantención Anual Empalmes Condominio Maipo',     'POR_CONTRATO', NULL, 'CTR-MAI-12M', 12, '2025-11-20', '2026-11-20', 950000,  'Activo', 'Revisión anual de empalmes y subestación por contrato')
ON CONFLICT (id_plan) DO NOTHING;

SELECT setval('plan_mantencion_cliente_id_plan_seq', (SELECT MAX(id_plan) FROM plan_mantencion_cliente));

INSERT INTO seguimiento_contacto_cliente (id_seguimiento, id_plan, canal_contacto, resultado_contacto, id_proyecto_generado, observaciones, id_usuario_ejecutor) VALUES
    (1, 1, 'Teléfono', 'Cliente Contactado', NULL, 'Se conversó con Rodrigo Sepúlveda; solicita coordinar visita técnica para esta semana.', 1),
    (2, 2, 'Correo',   'Visita Confirmada',  2,    'Marcela Gajardo confirmó ingreso de técnicos para mantención preventiva de climatización.', 1)
ON CONFLICT (id_seguimiento) DO NOTHING;

SELECT setval('seguimiento_contacto_cliente_id_seguimiento_seq', (SELECT MAX(id_seguimiento) FROM seguimiento_contacto_cliente));

-- =============================================================================
-- 19. LOG DE ACCESOS Y AUDITORÍA INICIAL
-- =============================================================================
INSERT INTO log_accesos (usuario, id_usuario, fecha, hora, ip, exito, resultado, fecha_hora) VALUES
    ('javier.munoz@fyag.cl',   1, CURRENT_DATE, '08:00:15', '192.168.1.100', TRUE,  'exito',            CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    ('camila.vera@fyag.cl',    2, CURRENT_DATE, '08:15:22', '192.168.1.105', TRUE,  'exito',            CURRENT_TIMESTAMP - INTERVAL '1 hour 45 minutes'),
    ('alejandro.rojas@fyag.cl',3, CURRENT_DATE, '08:30:05', '190.161.45.12',  TRUE,  'exito',            CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes'),
    ('desconocido@fyag.cl',    NULL, CURRENT_DATE, '08:45:10', '201.214.88.5',  FALSE, 'cuenta_inexistente',CURRENT_TIMESTAMP - INTERVAL '1 hour 15 minutes');

INSERT INTO auditoria (usuario, id_usuario, fecha, hora, entidad, accion, campo_modificado, valor_anterior, valor_nuevo, id_registro_afectado, descripcion) VALUES
    ('javier.munoz@fyag.cl', 1, CURRENT_DATE, '08:05:00', 'parametros', 'UPDATE', 'costo_hora_tecnico', '18000', '18500', NULL, 'Ajuste semestral de tarifa HH técnica'),
    ('camila.vera@fyag.cl',  2, CURRENT_DATE, '09:00:00', 'insumos',    'UPDATE', 'stock_minimo',       '100',   '150',   1,    'Aumento de stock de seguridad para Cable THHN 12');

-- =============================================================================
-- 20. CARDEX: TRAZABILIDAD HISTÓRICA, SALDO Y PMP POSTERIOR AL MOVIMIENTO [DB][SCRUM]
-- Permite verificar en 'vw_cardex_movimientos' que cada fila expone entradas,
-- salidas, saldo resultante y PMP histórico recalculado tras la operación.
-- =============================================================================
INSERT INTO movimientos_inventario (id_insumo, id_orden_compra, id_proyecto, tipo_movimiento, destino_bolsa,cantidad, costo_unitario, saldo_historico, pmp_historico, valor_total_historico,referencia, id_usuario, fecha_movimiento) VALUES
    (
        1, 1, NULL, 'Entrada', 'disponible',
        1000.000, 610.00, 1000.000, 610.00, 610000,
        'Recepción OC-2026-00001 línea 1 conforme', 2,
        '2026-09-05 10:15:00-03'
    ),
    (
        1, NULL, 1, 'Salida', 'comprometido',
        150.000, 610.00, 850.000, 610.00, 518500,
        'Egreso de bodega para Proyecto #1 (Los Aromos)', 2,
        '2026-09-10 11:30:00-03'
    ),
    (
        1, 1, NULL, 'Entrada', 'disponible',
        200.000, 650.00, 1050.000, 617.62, 648500,
        'Recepción adicional con nuevo costo de adquisición', 2,
        '2026-09-15 09:45:00-03'
    ),
    (
        1, NULL, 1, 'Salida', 'comprometido',
        100.000, 617.62, 950.000, 617.62, 586739,
        'Egreso adicional de bodega para Proyecto #1', 2,
        '2026-09-20 14:00:00-03'
    );

-- =============================================================================
-- 21. VERIFICACIÓN SCRUM: REGISTROS FRACCIONADOS (0.125 kg y 1.750 m)
-- =============================================================================
INSERT INTO movimientos_inventario (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico, pmp_historico, valor_total_historico, referencia, id_usuario) VALUES
    (
        (SELECT id_insumo FROM insumos WHERE id_unidad = 2 LIMIT 1),
        'Entrada', 'disponible', 0.125, 0.00,
        0.125, 0.00, 0, 'Verificación SCRUM 0,125 kg', 1
    ),
    (
        (SELECT id_insumo FROM insumos WHERE id_unidad = 3 LIMIT 1),
        'Entrada', 'disponible', 1.750, 0.00,
        1.750, 0.00, 0, 'Verificación SCRUM 1,750 m', 1
    );

-- =============================================================================
-- 22. HOJAS DE SERVICIO, CONTROL DE VERSIONES CONCURRENTE Y ADJUNTOS [DB][SCRUM]
-- Simula una edición concurrente en conflicto entre Móvil y Central sobre el
-- mismo documento (uuid_registro), preservando ambas versiones en conflicto.
-- =============================================================================
INSERT INTO hojas_servicio (id_hoja_servicio, uuid_registro, version, id_version_padre, origen_edicion,
estado_sincronizacion, es_version_activa, codigo_hoja, proyecto_id, tecnico_id,tipo_servicio, estado_servicio, fecha_servicio, hora_inicio, hora_fin,descripcion_trabajo, observaciones, firma_cliente_nombre, firma_cliente_rut,hash_firma_digital, modificado_por) VALUES
    -- 1. Versión 1 original base (creada desde central y sincronizada al móvil)
    (
        1, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1, NULL, 'central',
        'sincronizado', FALSE, 'HS-2026-0012', 1, 3,
        'Instalacion', 'En Proceso', '2026-10-14', '09:00:00', '13:00:00',
        'Montaje preliminar de tableros de distribución en piso 4', 'Requiere revisión de alimentador trifásico',
        NULL, NULL, NULL, 1
    ),
    -- 2. Versión 2 editada por Central (modifica descripción y observaciones desde oficina)
    (
        2, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 1, 'central',
        'conflicto', FALSE, 'HS-2026-0012', 1, 3,
        'Instalacion', 'En Proceso', '2026-10-14', '09:00:00', '15:30:00',
        'Montaje preliminar de tableros piso 4 y certificación de aislamiento por Central',
        'Edición realizada desde oficina central mientras el técnico estaba sin cobertura',
        NULL, NULL, NULL, 1
    ),
    -- 3. Versión 2 editada por Móvil en terreno (técnico finaliza trabajo y recolecta firma en terreno)
    (
        3, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 1, 'movil',
        'conflicto', TRUE, 'HS-2026-0012', 1, 3,
        'Instalacion', 'Firmada', '2026-10-14', '09:00:00', '16:15:00',
        'Montaje de tableros concluido, conexionado completo y pruebas de voltaje conformes',
        'Edición guardada offline desde la tablet en terreno; entra en conflicto al sincronizar',
        'Rodrigo Sepúlveda', '11.234.567-8', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 3
    )
ON CONFLICT (id_hoja_servicio) DO NOTHING;

SELECT setval('hojas_servicio_id_hoja_servicio_seq', (SELECT MAX(id_hoja_servicio) FROM hojas_servicio));

-- Checklists de terreno para la hoja de servicio
INSERT INTO checklists_terreno (id_checklist, id_hoja_servicio, categoria_inspeccion, item_evaluado, estado_conformidad, valor_medido, observaciones, orden) VALUES
    (1, 3, 'Seguridad Eléctrica', 'Verificación de bloqueo y etiquetado LOTO', 'Conforme', '0V comprobado', 'Protocolo de seguridad aplicado', 1),
    (2, 3, 'Parámetros Eléctricos', 'Medición de voltaje entre fases L1-L2-L3', 'Conforme', '380V / 220V', 'Tensión dentro de norma SEC', 2),
    (3, 3, 'Puesta a Tierra', 'Resistencia de malla de puesta a tierra', 'Conforme', '4.2 Ohm', 'Inferior al umbral máximo de 20 Ohm', 3),
    (4, 3, 'Aseo y Orden', 'Limpieza y retiro de despuntes en sala técnica', 'Conforme', 'N/A', 'Área de trabajo entregada impecable', 4)
ON CONFLICT (id_checklist) DO NOTHING;

SELECT setval('checklists_terreno_id_checklist_seq', (SELECT MAX(id_checklist) FROM checklists_terreno));

-- Adjuntos de servicio con metadatos completos de archivos
INSERT INTO adjuntos_servicio (id_adjunto, id_hoja_servicio, nombre_archivo, tipo_mime, tamano_bytes, hash_sha256, ruta_almacenamiento, categoria_adjunto, origen_dispositivo,metadatos_extra, version_hoja, creado_por) VALUES
    (
        1, 3, 'foto_tablero_finalizado_p4.jpg', 'image/jpeg', 2485600,
        'b4c6e9a72183c59a39fbc4123547890abcdeffedcba09876543210123456789a',
        'https://storage.fyag.cl/servicios/2026/10/HS-2026-0012/foto_tablero_p4.jpg',
        'Fotografia', 'Samsung Galaxy Tab Active4 Pro',
        '{"latitud": -33.4255, "longitud": -70.6124, "resolucion": "4032x3024", "modo_captura": "HDR", "flash": "no"}'::jsonb,
        2, 3
    ),
    (
        2, 3, 'firma_conformidad_cliente.png', 'image/png', 145200,
        '5d41402abc4b2a76b9719d911017c592b0e6e9f168f8a846f407b34e2c817208',
        'https://storage.fyag.cl/servicios/2026/10/HS-2026-0012/firma_cliente.png',
        'Firma', 'Samsung Galaxy Tab Active4 Pro - Stylus Pen',
        '{"tipo_trazo": "vectorial_suavizado", "puntos": 412, "presion_media": 0.72}'::jsonb,
        2, 3
    ),
    (
        3, 3, 'reporte_medicion_aislamiento.pdf', 'application/pdf', 812400,
        '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        'https://storage.fyag.cl/servicios/2026/10/HS-2026-0012/reporte_megger.pdf',
        'Informe_PDF', 'Web Central / Fluke Connect Export',
        '{"instrumento": "Megóhmetro Fluke 1507", "calibracion_vigente": true, "paginas": 2}'::jsonb,
        2, 1
    )
ON CONFLICT (id_adjunto) DO NOTHING;

SELECT setval('adjuntos_servicio_id_adjunto_seq', (SELECT MAX(id_adjunto) FROM adjuntos_servicio));

-- =============================================================================
-- 23. DEVOLUCIONES DE OBRA Y SOBRANTES DE TERRENO [DB][SCRUM]
-- Vincula insumos retirados con el consumo real y las devoluciones físicas a bodega.
-- Estados permitidos: 'En tránsito' (declarada por técnico) y 'Recibida' (confirmada).
-- =============================================================================

INSERT INTO uso_insumos_proyecto (id_uso, proyecto_id, tecnico_id, id_articulo, cantidad_utilizada,  fecha_registro, id_usuario_registro) VALUES
    (1, 1, 3, 1, 120.000, '2026-10-12 16:30:00-03', 3), -- Alejandro usó 120m de los 150m retirados de Cable THHN 12
    (2, 2, 4, 5, 6.000,   '2026-10-14 17:00:00-03', 4)  -- Matías usó 6.0kg de los 8.5kg retirados de Gas R410A
ON CONFLICT (id_uso) DO NOTHING;

SELECT setval('uso_insumos_proyecto_id_uso_seq', (SELECT MAX(id_uso) FROM uso_insumos_proyecto));

INSERT INTO devoluciones_obra (id_devolucion, codigo_devolucion, proyecto_id, tecnico_id, tecnico_rut, tecnico_nombre, estado, fecha, fecha_declaracion, id_usuario_declara,fecha_recepcion_bodega, id_usuario_recibe, observaciones) VALUES
    -- 1. Devolución en tránsito hacia bodega (técnico declaró 30m de Cable THHN 12 de sobrante)
    (
        1, 'DEV-2026-00001', 1, 3, '17.894.562-8',
        'Alejandro Rojas Pino', 'En tránsito', '2026-10-15', '2026-10-15 08:45:00-03', 3,
        NULL, NULL, 'Sobrante de alambrado pisos 3 al 5 retornado en rollo'
    ),
    -- 2. Devolución ya recibida y confirmada físicamente por bodeguero (2.5kg Gas R410A)
    (
        2, 'DEV-2026-00002', 2, 4, '16.783.421-3',
        'Matías Fuentes Araya', 'Recibida', '2026-10-16', '2026-10-16 09:15:00-03', 4,
        '2026-10-16 11:30:00-03', 2, 'Cilindro pesado en báscula con tara y contenido exacto'
    )
ON CONFLICT (id_devolucion) DO NOTHING;

SELECT setval('devoluciones_obra_id_devolucion_seq', (SELECT MAX(id_devolucion) FROM devoluciones_obra));

INSERT INTO devolucion_lineas (id_devolucion_linea, id_devolucion, id_articulo, cantidad_retirada,cantidad_utilizada, cantidad_declarada, cantidad_recibida) VALUES
    -- En tránsito: retirado 150.000, utilizado 120.000, declarado 30.000, recibido NULL
    (1, 1, 1, 150.000, 120.000, 30.000, NULL),
    -- Recibida: retirado 8.500, utilizado 6.000, declarado 2.500, recibido 2.500
    (2, 2, 5, 8.500,   6.000,   2.500,  2.500)
ON CONFLICT (id_devolucion_linea) DO NOTHING;

SELECT setval('devolucion_lineas_id_devolucion_linea_seq', (SELECT MAX(id_devolucion_linea) FROM devolucion_lineas));

-- =============================================================================
-- 24. CONTEOS FÍSICOS Y ARQUEOS DE INVENTARIO [DB][SCRUM]
-- Permite bloquear insumos específicos durante su arqueo e ingresar diferencias
-- con estados: 'Ajustado', 'Pendiente aprobación', 'Aprobado' y 'Rechazado'.
-- =============================================================================
INSERT INTO conteos_fisicos (id_conteo, insumo_id, stock_sistema, conteo_real, diferencia_cant, diferencia_valor_pmp, estado, fecha_conteo, id_usuario_conteo, id_usuario_aprobacion, fecha_aprobacion, observaciones) VALUES
    -- 1. Insumo 3 (Disyuntor 16A): Arqueo en curso con diferencia; insumo con bloqueado_por_conteo = TRUE
    (
        1, 3, 68.000, 65.000, -3.000, -13560.00,
        'Pendiente aprobación', CURRENT_DATE, 2, NULL, NULL,
        'Faltante de 3 disyuntores detectado en Gabinete 3; en espera de autorización'
    ),
    -- 2. Insumo 8 (Perno 8mm): Conteo aprobado por jefatura
    (
        2, 8, 35.000, 34.000, -1.000, -18500.00,
        'Aprobado', CURRENT_DATE - INTERVAL '2 days', 2, 1, CURRENT_DATE - INTERVAL '1 day',
        'Diferencia de 1 perno aprobada por desgaste de empaque'
    ),
    -- 3. Insumo 4 (Diferencial 25A): Conteo exacto cuadrado y ajustado
    (
        3, 4, 28.000, 28.000, 0.000, 0.00,
        'Ajustado', CURRENT_DATE - INTERVAL '5 days', 2, 1, CURRENT_DATE - INTERVAL '5 days',
        'Conteo conforme sin discrepancia'
    ),
    -- 4. Insumo 9 (Silicona): Conteo anómalo rechazado por inconsistencia
    (
        4, 9, 75.000, 60.000, -15.000, -44250.00,
        'Rechazado', CURRENT_DATE - INTERVAL '3 days', 2, 1, CURRENT_DATE - INTERVAL '2 days',
        'Rechazado: tubos de silicona estaban en cuarentena, no correspondía considerarlos faltantes'
    )
ON CONFLICT (id_conteo) DO NOTHING;

SELECT setval('conteos_fisicos_id_conteo_seq', (SELECT MAX(id_conteo) FROM conteos_fisicos));

-- =============================================================================
-- 25. REGISTRO DE MERMAS Y PÉRDIDAS DE INVENTARIO [DB][SCRUM]
-- Bajas de inventario con motivo obligatorio ('daño', 'caducidad', 'pérdida', 'otro')
-- y justificación descriptiva obligatoria no vacía.
-- =============================================================================
INSERT INTO mermas (id_merma, insumo_id, bodeguero_id, motivo, observacion,cantidad, costo_pmp_total, fecha) VALUES
    -- 1. Motivo 'daño': Carcasa fracturada durante descarga
    (
        1, 3, 2, 'daño',
        'Carcasa plástica de disyuntor fracturada por caída accidental durante descarga en bodega',
        2.000, 9040.00, '2026-10-05'
    ),
    -- 2. Motivo 'caducidad': Vencimiento superado en producto químico
    (
        2, 9, 2, 'caducidad',
        'Fecha de vencimiento superada en estante; silicona curada y endurecida en envase',
        5.000, 14750.00, '2026-10-08'
    ),
    -- 3. Motivo 'pérdida': Extravío en patio de acopio
    (
        3, 8, 2, 'pérdida',
        'Faltante no localizado en patio de fijaciones tras auditoría física de estantería',
        4.000, 74000.00, '2026-10-12'
    ),
    -- 4. Motivo 'otro': Despunte terminal sulfatado
    (
        4, 1, 2, 'otro',
        'Tramo final de carrete con aislación dañada por humedad y sulfatación no apto para obra',
        12.500, 7688.00, '2026-10-15'
    )
ON CONFLICT (id_merma) DO NOTHING;

SELECT setval('mermas_id_merma_seq', (SELECT MAX(id_merma) FROM mermas));

-- =============================================================================
-- 26. DEVOLUCIONES A PROVEEDOR DESDE CUARENTENA [DB][SCRUM]
-- Opera exclusivamente sobre insumos con saldo disponible en cuarentena.
-- Estados: 'Pendiente de resolución' y 'Resuelta' (con nota de crédito o reposición).
-- =============================================================================
INSERT INTO devoluciones_proveedor (id_devolucion_proveedor, proveedor_id, insumo_id, cantidad, motivo, nro_guia, estado, resolucion_nota_credito_o_reposicion, fecha, fecha_resolucion, id_usuario_registro, id_usuario_resolucion, observaciones) VALUES
    -- 1. Insumo 3 (Disyuntor 16A, Proveedor 1): En espera de resolución por falla técnica
    (
        1, 1, 3, 2.000,
        'Falla de disparo magnético detectada durante recepción técnica en bodega',
        'GD-DEV-00441', 'Pendiente de resolución', NULL, '2026-10-18',
        NULL, 2, NULL, 'Retirado por transportista del proveedor para peritaje técnico'
    ),
    -- 2. Insumo 7 (Bomba de condensado, Proveedor 2): Resuelta con emisión de Nota de Crédito
    (
        2, 2, 7, 1.000,
        'Fuga en sello mecánico de bomba identificada en control de calidad de recepción',
        'GD-DEV-00412', 'Resuelta', 'Nota de crédito', '2026-10-10',
        '2026-10-16 15:30:00-03', 2, 1, 'Nota de crédito NC-5521 recibida y aplicada por administración'
    )
ON CONFLICT (id_devolucion_proveedor) DO NOTHING;

SELECT setval('devoluciones_proveedor_id_devolucion_proveedor_seq', (SELECT MAX(id_devolucion_proveedor) FROM devoluciones_proveedor));

-- =============================================================================
-- 27. CÓDIGOS QR ÚNICOS POR UNIDAD FÍSICA DE INSUMO [DB][SCRUM]
-- Permite múltiples códigos QR únicos por cada insumo (unidades físicas en bodega)
-- garantizando unicidad absoluta mediante restricción UNIQUE en codigo_unico.
-- =============================================================================
INSERT INTO codigos_qr_insumos (
    id_qr, codigo_unico, insumo_id, sku, nombre, unidad_medida, asignado_fisicamente
) VALUES
    -- Unidades físicas de Bomba de Condensado (Insumo 7): 3 unidades con su propio QR individual
    (1, 'QR-CLI-BOM-0050-U001', 7, 'CLI-BOM-0050', 'Bomba de Condensado Silenciosa 220V', 'unidad', TRUE),
    (2, 'QR-CLI-BOM-0050-U002', 7, 'CLI-BOM-0050', 'Bomba de Condensado Silenciosa 220V', 'unidad', TRUE),
    (3, 'QR-CLI-BOM-0050-U003', 7, 'CLI-BOM-0050', 'Bomba de Condensado Silenciosa 220V', 'unidad', FALSE),
    -- Carretes de Cable THHN 12 (Insumo 1): 2 carretes rotulados independientemente
    (4, 'QR-ELE-CBL-0012-C01',  1, 'ELE-CBL-0012', 'Cable THHN 12 AWG Rojo (Carrete)', 'm',      TRUE),
    (5, 'QR-ELE-CBL-0012-C02',  1, 'ELE-CBL-0012', 'Cable THHN 12 AWG Rojo (Carrete)', 'm',      TRUE),
    -- Disyuntor Termomagnético 16A (Insumo 3): unidades en estantería
    (6, 'QR-ELE-DIS-0016-D01',  3, 'ELE-DIS-0016', 'Disyuntor Termomagnético 1P 16A 6kA', 'unidad', TRUE),
    (7, 'QR-ELE-DIS-0016-D02',  3, 'ELE-DIS-0016', 'Disyuntor Termomagnético 1P 16A 6kA', 'unidad', FALSE)
ON CONFLICT (id_qr) DO NOTHING;

SELECT setval('codigos_qr_insumos_id_qr_seq', (SELECT MAX(id_qr) FROM codigos_qr_insumos));


COMMIT;
```

