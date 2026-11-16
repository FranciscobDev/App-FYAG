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
INSERT INTO insumos (id_insumo, sku, nombre, categoria_id, categoria_enum, id_unidad, proveedor_id, stock_minimo, cant_reposicion, precio_unitario, codigo_qr, activo) VALUES
    (1,  'ELE-CBL-0012', 'Cable THHN 12 AWG Rojo (Carrete)',      2, 'Materiales',   3, 1, 150.000, 500.000, 635,   'QR-ELE-CBL-0012', TRUE),
    (2,  'ELE-CBL-0014', 'Cable THHN 14 AWG Verde Tierra',        2, 'Materiales',   3, 1, 100.000, 400.000, 480,   'QR-ELE-CBL-0014', TRUE),
    (3,  'ELE-DIS-0016', 'Disyuntor Termomagnético 1P 16A 6kA',   2, 'Materiales',   1, 1, 20.000,  50.000,  4520,  'QR-ELE-DIS-0016', TRUE),
    (4,  'ELE-DIF-0025', 'Interruptor Diferencial 2P 25A 30mA',   2, 'Materiales',   1, 1, 15.000,  30.000,  14600, 'QR-ELE-DIF-0025', TRUE),
    (5,  'CLI-REF-0410', 'Gas Refrigerante R410A Ecológico',      2, 'Materiales',   2, 2, 25.000,  80.000,  38500, 'QR-CLI-REF-0410', TRUE),
    (6,  'CLI-FIL-0001', 'Filtro de Aire Lavable Split 12000 BTU', 4, 'Consumibles',  1, 2, 10.000,  30.000,  5490,  'QR-CLI-FIL-0001', TRUE),
    (7,  'CLI-BOM-0050', 'Bomba de Condensado Silenciosa 220V',   3, 'Equipos',      1, 2, 5.000,   15.000,  31800, 'QR-CLI-BOM-0050', TRUE),
    (8,  'FER-PER-0008', 'Perno de Anclaje Expansivo 8mm x 80mm', 4, 'Consumibles',  5, 3, 10.000,  25.000,  18500, 'QR-FER-PER-0008', TRUE),
    (9,  'FER-SIL-0300', 'Silicona Neutra Alta Temperatura 300ml',4, 'Consumibles',  1, 3, 30.000,  60.000,  2950,  'QR-FER-SIL-0300', TRUE),
    (10, 'SEG-CAS-0001', 'Casco de Seguridad Dieléctrico Blanco', 5, 'Seguridad',    1, 4, 12.000,  24.000,  8900,  'QR-SEG-CAS-0001', TRUE),
    (11, 'GAS-TUB-0020', 'Tubería Cobre Gas 3/4 pulgada x 6m',   2, 'Materiales',   3, 3, 20.000,  50.000,  28900, 'QR-GAS-TUB-0020', TRUE),
    (12, 'GAS-VAL-0012', 'Válvula Esférica de Paso Gas 1/2 pulg', 2, 'Materiales',   1, 3, 15.000,  40.000,  6800,  'QR-GAS-VAL-0012', TRUE)
ON CONFLICT (id_insumo) DO UPDATE SET 
    sku = EXCLUDED.sku,
    nombre = EXCLUDED.nombre,
    precio_unitario = EXCLUDED.precio_unitario,
    stock_minimo = EXCLUDED.stock_minimo,
    cant_reposicion = EXCLUDED.cant_reposicion,
    codigo_qr = EXCLUDED.codigo_qr;

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

-- Registro de horas trabajadas
INSERT INTO horas_trabajadas (id_registro_horas, id_usuario, id_proyecto, horas_proyecto_trabajadas) VALUES
    (1, 3, 1, 185.00),
    (2, 6, 1, 199.00),
    (3, 4, 2, 120.00),
    (4, 3, 2, 35.00),
    (5, 5, 3, 65.00),
    (6, 6, 3, 48.00)
ON CONFLICT (id_registro_horas) DO NOTHING;

SELECT setval('horas_trabajadas_id_registro_horas_seq', (SELECT MAX(id_registro_horas) FROM horas_trabajadas));

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
-- 18. LOG DE ACCESOS Y AUDITORÍA INICIAL
-- =============================================================================
INSERT INTO log_accesos (usuario, id_usuario, fecha, hora, ip, exito, resultado, fecha_hora) VALUES
    ('javier.munoz@fyag.cl',   1, CURRENT_DATE, '08:00:15', '192.168.1.100', TRUE,  'exito',            CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    ('camila.vera@fyag.cl',    2, CURRENT_DATE, '08:15:22', '192.168.1.105', TRUE,  'exito',            CURRENT_TIMESTAMP - INTERVAL '1 hour 45 minutes'),
    ('alejandro.rojas@fyag.cl',3, CURRENT_DATE, '08:30:05', '190.161.45.12',  TRUE,  'exito',            CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes'),
    ('desconocido@fyag.cl',    NULL, CURRENT_DATE, '08:45:10', '201.214.88.5',  FALSE, 'cuenta_inexistente',CURRENT_TIMESTAMP - INTERVAL '1 hour 15 minutes');

INSERT INTO auditoria (usuario, id_usuario, fecha, hora, entidad, accion, campo_modificado, valor_anterior, valor_nuevo, id_registro_afectado, descripcion) VALUES
    ('javier.munoz@fyag.cl', 1, CURRENT_DATE, '08:05:00', 'parametros', 'UPDATE', 'costo_hora_tecnico', '18000', '18500', NULL, 'Ajuste semestral de tarifa HH técnica'),
    ('camila.vera@fyag.cl',  2, CURRENT_DATE, '09:00:00', 'insumos',    'UPDATE', 'stock_minimo',       '100',   '150',   1,    'Aumento de stock de seguridad para Cable THHN 12');

COMMIT;
```

