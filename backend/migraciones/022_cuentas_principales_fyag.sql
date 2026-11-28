-- =============================================================================
-- 022 · Configuración de las 3 cuentas principales del proyecto (Gmail + Fyag2026.)
--   • adminfyag@gmail.com   (Administrador, id_rol = 1)
--   • bodegafyag@gmail.com  (Bodeguero,     id_rol = 2)
--   • tecnicofyag@gmail.com (Técnico,       id_rol = 3)
-- Contraseña común: Fyag2026. (hash bcrypt costo 10)
-- =============================================================================

INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES
    (1, 'Administrador', 'Acceso total al sistema, auditoría, reportes y configuración'),
    (2, 'Bodeguero',     'Control de stock, recepciones de compras, inventario y mermas'),
    (3, 'Tecnico',       'Registro de avance de proyectos, solicitud de insumos y rendición')
ON CONFLICT (id_rol) DO NOTHING;

-- Si las cuentas 1, 2 y 3 existen (incluso si el técnico 3 había sido anonimizado en datos_iniciales antiguos),
-- las restaura y actualiza con los correos principales y la contraseña "Fyag2026.".
INSERT INTO usuario (
    id_usuario, nombre_usuario, apellido_usuario, correo_usuario, rut,
    id_rol, especializacion, contrasena_hash, activo, intentos_fallidos, bloqueado_hasta
) VALUES
    (1, 'Javier',    'Muñoz Contreras', 'adminfyag@gmail.com',   '12.456.789-5', 1, 'Administración General y Operaciones', '$2b$10$KHkwmVHST2uvEo2HM8VrjOgOWD2xpE2yQCiWRBubHlyP09l3DwG3S', TRUE, 0, NULL),
    (2, 'Camila',    'Vera Soto',       'bodegafyag@gmail.com',  '15.321.654-2', 2, 'Logística, Bodega y Abastecimiento',   '$2b$10$KHkwmVHST2uvEo2HM8VrjOgOWD2xpE2yQCiWRBubHlyP09l3DwG3S', TRUE, 0, NULL),
    (3, 'Alejandro', 'Rojas Pino',      'tecnicofyag@gmail.com', '17.894.562-8', 3, 'Electricidad SEC clase A',            '$2b$10$KHkwmVHST2uvEo2HM8VrjOgOWD2xpE2yQCiWRBubHlyP09l3DwG3S', TRUE, 0, NULL)
ON CONFLICT (id_usuario) DO UPDATE SET
    nombre_usuario   = EXCLUDED.nombre_usuario,
    apellido_usuario = EXCLUDED.apellido_usuario,
    correo_usuario   = EXCLUDED.correo_usuario,
    rut              = EXCLUDED.rut,
    id_rol           = EXCLUDED.id_rol,
    especializacion  = EXCLUDED.especializacion,
    contrasena_hash  = EXCLUDED.contrasena_hash,
    activo           = TRUE,
    intentos_fallidos = 0,
    bloqueado_hasta  = NULL;

SELECT setval('usuario_id_usuario_seq', GREATEST((SELECT COALESCE(MAX(id_usuario), 1) FROM usuario), 3));

-- Actualizar destinatarios de correo por defecto en configuracion_correo_alertas
UPDATE configuracion_correo_alertas
SET correo_destino_defecto = 'bodegafyag@gmail.com'
WHERE tipo_alerta = 'devolucion_en_transito' AND correo_destino_defecto IS NULL;

UPDATE configuracion_correo_alertas
SET correo_destino_defecto = 'adminfyag@gmail.com'
WHERE tipo_alerta <> 'devolucion_en_transito' AND correo_destino_defecto IS NULL;
