import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import { DatabaseError } from 'pg';
import pool from '../config/db';
import { registrarAuditoria } from '../services/auditoriaService';
import { ejecutarTransaccion } from '../services/transaccion';
import { snapshotUsuario } from '../services/snapshotUsuario';
import { revocarSesionesUsuario } from '../services/sesiones';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';

export interface Usuario {
    id_usuario: number;
    nombre_usuario: string;
    apellido_usuario: string;
    correo_usuario: string;
    rut: string | null;
    id_rol: number;
    nombre_rol: string | null;
    especializacion: string | null;
    activo: boolean;
    ultimo_acceso?: string | null;
}

export interface Rol {
    id_rol: number;
    nombre_rol: string;
    descripcion: string | null;
}

interface UsuarioBody {
    nombre_usuario?: string;
    apellido_usuario?: string;
    correo_usuario?: string;
    rut?: string | null;
    id_rol?: number | null;
    rol_codigo?: 'admin' | 'warehouse' | 'technician' | string;
    especializacion?: string | null;
    contrasena?: string;
    activo?: boolean;
}

const esErrorPg = (error: unknown): error is DatabaseError =>
    typeof error === 'object' && error !== null && 'code' in error;

const normalizarTexto = (valor?: string | null): string =>
    (valor ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

// Consulta de lectura para respuestas: nunca incluye el hash de contraseña
const SELECT_USUARIO = `
    SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
           u.rut, u.id_rol, r.nombre_rol::text AS nombre_rol, u.especializacion, u.activo, u.ultimo_acceso
    FROM usuario u
    LEFT JOIN roles r ON r.id_rol = u.id_rol
`;

const leerUsuario = async (cliente: Pick<PoolClient, 'query'>, id: number | string): Promise<Usuario | null> => {
    const res = await cliente.query<Usuario>(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);
    return res.rows[0] ?? null;
};

// Roles base que el sistema garantiza en la tabla `roles`
const ROLES_BASE = [
    {
        nombre_rol: 'Administrador',
        descripcion: 'Acceso total, auditoría, configuración, proyectos y finanzas.',
        claves: ['admin', 'administrador'],
    },
    {
        nombre_rol: 'Bodeguero',
        descripcion: 'Control de insumos, recepción de compras, egresos y cardex.',
        claves: ['warehouse', 'bodeg', 'bodeguero'],
    },
    {
        nombre_rol: 'Tecnico',
        descripcion: 'Registro de avance, solicitud de materiales, horas y hojas de servicio.',
        claves: ['technician', 'tecnic', 'tecnico'],
    },
];

/** Inserta un rol base dentro de una transacción auditada (sin usuario ejecutor: lo hace el sistema). */
const sembrarRolBase = async (base: (typeof ROLES_BASE)[number]): Promise<Rol | null> => {
    try {
        return await ejecutarTransaccion(async (cliente) => {
            const insertado = await cliente.query<Rol>(
                `INSERT INTO roles (nombre_rol, descripcion) VALUES ($1, $2)
                 RETURNING id_rol, nombre_rol::text AS nombre_rol, descripcion`,
                [base.nombre_rol, base.descripcion]
            );
            const creado = insertado.rows[0];
            await registrarAuditoria({
                entidad: 'rol',
                accion: 'crear',
                idRegistro: creado.id_rol,
                idUsuarioEjecutor: null,
                estadoAnterior: null,
                estadoNuevo: creado,
                descripcion: `Rol base ${creado.nombre_rol} creado automáticamente por el sistema`,
            }, cliente);
            return creado;
        });
    } catch (error) {
        // 23505: otra petición concurrente ya lo insertó; cualquier otro error sí se propaga
        if (esErrorPg(error) && error.code === '23505') return null;
        throw error;
    }
};

// Asegura que existan los 3 roles base en la tabla `roles`
const asegurarRolesBase = async (): Promise<Rol[]> => {
    const actuales = await pool.query<Rol>(
        'SELECT id_rol, nombre_rol::text AS nombre_rol, descripcion FROM roles ORDER BY id_rol ASC'
    );
    const filas = [...actuales.rows];

    for (const base of ROLES_BASE) {
        const existe = filas.some((r) => {
            const norm = normalizarTexto(r.nombre_rol);
            return base.claves.some((c) => norm.includes(c));
        });

        if (!existe) {
            const creado = await sembrarRolBase(base);
            if (creado) filas.push(creado);
        }
    }

    return filas;
};

const resolverIdRol = async (idRol?: number | null, rolCodigo?: string): Promise<number | null> => {
    const roles = await asegurarRolesBase();
    if (idRol && roles.some((r) => Number(r.id_rol) === Number(idRol))) {
        return Number(idRol);
    }

    if (rolCodigo) {
        const codigo = normalizarTexto(rolCodigo);
        const encontrado = roles.find((r) => {
            const norm = normalizarTexto(r.nombre_rol);
            if (codigo === 'admin' || codigo.includes('admin')) return norm.includes('admin');
            if (codigo === 'warehouse' || codigo.includes('bodeg')) return norm.includes('bodeg');
            if (codigo === 'technician' || codigo.includes('tecnic')) return norm.includes('tecnic');
            return norm === codigo;
        });
        if (encontrado) return Number(encontrado.id_rol);
    }

    return idRol ? Number(idRol) : null;
};

const contarAdminsActivosExcluyendo = async (
    cliente: Pick<PoolClient, 'query'>,
    idUsuarioExcluir: number | string
): Promise<number> => {
    const res = await cliente.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM usuario u
         JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.activo = TRUE
           AND LOWER(u.id_usuario::text) <> LOWER($1::text)
           AND LOWER(r.nombre_rol::text) LIKE '%admin%'`,
        [idUsuarioExcluir]
    );
    return Number(res.rows[0]?.total ?? 0);
};

const esAdmin = (nombreRol: string | null | undefined): boolean =>
    normalizarTexto(nombreRol).includes('admin');

const traducirErrorUsuario = (res: Response, error: unknown, mensajeInterno: string): void => {
    if (esErrorPg(error) && error.code === '23505') {
        res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados por otro usuario' });
        return;
    }
    if (esErrorPg(error) && error.code === '23503') {
        res.status(400).json({ mensaje: 'El rol especificado no existe' });
        return;
    }
    enviarErrorHttp(res, error, mensajeInterno);
};

// Listar todos
export const obtenerUsuarios = async (_req: Request, res: Response): Promise<void> => {
    try {
        await asegurarRolesBase();
        const result = await pool.query<Usuario>(`${SELECT_USUARIO} ORDER BY u.id_usuario ASC`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
};

// Obtener uno por ID
export const obtenerUsuarioPorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<Usuario>(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Usuario no encontrado' });
            return;
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Listar roles (para el selector)
export const listarRoles = async (_req: Request, res: Response): Promise<void> => {
    try {
        const roles = await asegurarRolesBase();
        res.status(200).json(roles);
    } catch (error) {
        console.error('Error al listar roles:', error);
        res.status(500).json({ error: 'Error al obtener los roles' });
    }
};

// Crear usuario: mutación + auditoría en una sola transacción
export const crearUsuario = async (req: Request<Record<string, string>, unknown, UsuarioBody>, res: Response): Promise<void> => {
    const {
        nombre_usuario, apellido_usuario, correo_usuario, rut,
        id_rol, rol_codigo, especializacion, contrasena, activo
    } = req.body;

    try {
        const idRolFinal = await resolverIdRol(id_rol, rol_codigo);

        if (!nombre_usuario || !apellido_usuario || !correo_usuario || !idRolFinal || !contrasena) {
            res.status(400).json({
                mensaje: 'Los campos nombre, apellido, correo, rol y contraseña son obligatorios'
            });
            return;
        }

        const hash = await bcrypt.hash(String(contrasena), 10);
        const correoNormalizado = correo_usuario.trim().toLowerCase();

        const idCreado = await ejecutarTransaccion(async (cliente) => {
            const insert = await cliente.query<{ id_usuario: number }>(
                `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, rut,
                                      id_rol, especializacion, contrasena_hash, activo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id_usuario`,
                [
                    nombre_usuario.trim(),
                    apellido_usuario.trim(),
                    correoNormalizado,
                    rut?.trim() || null,
                    idRolFinal,
                    especializacion?.trim() || null,
                    hash,
                    activo !== false,
                ]
            );
            const id = insert.rows[0].id_usuario;
            const despues = await snapshotUsuario(cliente, id);

            await registrarAuditoria({
                entidad: 'usuario',
                accion: 'crear',
                idRegistro: id,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: null,
                estadoNuevo: despues,
                descripcion: `Usuario ${correoNormalizado} creado con rol ID ${idRolFinal}`,
            }, cliente);

            return id;
        });

        const usuario = await leerUsuario(pool, idCreado);
        res.status(201).json({
            mensaje: 'Usuario creado exitosamente',
            usuario,
        });
    } catch (error) {
        traducirErrorUsuario(res, error, 'Error interno al crear el usuario');
    }
};

// Modificar usuario (los campos no enviados conservan su valor)
export const actualizarUsuario = async (req: Request<{ id: string }, unknown, UsuarioBody>, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
        nombre_usuario, apellido_usuario, correo_usuario, rut,
        id_rol, rol_codigo, especializacion, contrasena, activo
    } = req.body;

    try {
        const idRolResuelto =
            id_rol !== undefined || rol_codigo !== undefined
                ? await resolverIdRol(id_rol, rol_codigo)
                : null;

        // Solo se cifra si se envió una nueva contraseña (el hash nunca se audita)
        const hash = contrasena ? await bcrypt.hash(String(contrasena), 10) : null;

        const huboCambios =
            nombre_usuario !== undefined || apellido_usuario !== undefined ||
            correo_usuario !== undefined || rut !== undefined || id_rol !== undefined ||
            rol_codigo !== undefined || especializacion !== undefined ||
            contrasena !== undefined || activo !== undefined;

        const resultado = await ejecutarTransaccion(async (cliente) => {
            const antes = await snapshotUsuario(cliente, id, true);
            if (!antes) {
                throw new ErrorAplicacion(404, 'Usuario no encontrado para actualizar');
            }

            const eraAdminActivo = Boolean(antes.activo) && esAdmin(antes.nombre_rol as string);

            let dejaDeSerAdmin = false;
            if (eraAdminActivo && idRolResuelto !== null) {
                const rolDestino = await cliente.query<{ nombre_rol: string }>(
                    'SELECT nombre_rol::text AS nombre_rol FROM roles WHERE id_rol = $1',
                    [idRolResuelto]
                );
                dejaDeSerAdmin = !esAdmin(rolDestino.rows[0]?.nombre_rol);
            }

            // Proteger que el sistema conserve al menos un Administrador activo
            if (eraAdminActivo && (activo === false || dejaDeSerAdmin)) {
                const otrosAdmins = await contarAdminsActivosExcluyendo(cliente, id);
                if (otrosAdmins === 0) {
                    throw new ErrorAplicacion(
                        400,
                        'No se puede deshabilitar ni cambiar el rol del único Administrador activo del sistema'
                    );
                }
            }

            if (huboCambios) {
                await cliente.query(
                    `UPDATE usuario
                     SET nombre_usuario   = COALESCE($1, nombre_usuario),
                         apellido_usuario = COALESCE($2, apellido_usuario),
                         correo_usuario   = COALESCE($3, correo_usuario),
                         rut              = COALESCE($4, rut),
                         id_rol           = COALESCE($5, id_rol),
                         especializacion  = COALESCE($6, especializacion),
                         contrasena_hash  = COALESCE($7, contrasena_hash),
                         activo           = COALESCE($8, activo)
                     WHERE id_usuario = $9`,
                    [
                        nombre_usuario ? nombre_usuario.trim() : null,
                        apellido_usuario ? apellido_usuario.trim() : null,
                        correo_usuario ? correo_usuario.trim().toLowerCase() : null,
                        rut ?? null,
                        idRolResuelto ?? null,
                        especializacion ?? null,
                        hash,
                        typeof activo === 'boolean' ? activo : null,
                        id,
                    ]
                );

                // Cambio de clave o deshabilitación: cierra todas las sesiones activas
                if (hash || activo === false) {
                    await revocarSesionesUsuario(cliente, id);
                }

                const despues = await snapshotUsuario(cliente, id);
                const cambioRol = idRolResuelto !== null && Number(antes.id_rol) !== idRolResuelto;
                const accion = activo === false ? 'deshabilitar' : cambioRol ? 'cambiar_rol' : 'editar';

                const notas = [
                    hash ? 'contraseña cambiada (sesiones cerradas)' : null,
                    cambioRol ? `rol ${antes.nombre_rol} → ${despues?.nombre_rol}` : null,
                ].filter(Boolean).join('; ');

                await registrarAuditoria({
                    entidad: 'usuario',
                    accion,
                    idRegistro: id,
                    idUsuarioEjecutor: obtenerIdEjecutor(req),
                    estadoAnterior: antes,
                    estadoNuevo: despues,
                    descripcion: `Usuario ${antes.correo_usuario} (ID ${id}) actualizado${notas ? ` — ${notas}` : ''}`,
                }, cliente);
            }

            return leerUsuario(cliente, id);
        });

        res.status(200).json({
            mensaje: 'Usuario actualizado exitosamente',
            usuario: resultado,
        });
    } catch (error) {
        traducirErrorUsuario(res, error, 'Error interno al actualizar el usuario');
    }
};

// Cambiar el rol mediante una operación específica de administración
export const cambiarRolUsuario = async (
    req: Request<{ id: string }, unknown, UsuarioBody>,
    res: Response
): Promise<void> => {
    if (req.body.id_rol === undefined && req.body.rol_codigo === undefined) {
        res.status(400).json({ mensaje: 'Debes especificar el nuevo rol del usuario' });
        return;
    }

    req.body = {
        id_rol: req.body.id_rol,
        rol_codigo: req.body.rol_codigo,
    };
    await actualizarUsuario(req, res);
};

// Deshabilitar usuario (Requerimiento [BACK-1])
export const deshabilitarUsuario = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        await ejecutarTransaccion(async (cliente) => {
            const antes = await snapshotUsuario(cliente, id, true);
            if (!antes) {
                throw new ErrorAplicacion(404, 'Usuario no encontrado para deshabilitar');
            }

            if (antes.activo && esAdmin(antes.nombre_rol as string)) {
                const otrosAdmins = await contarAdminsActivosExcluyendo(cliente, id);
                if (otrosAdmins === 0) {
                    throw new ErrorAplicacion(400, 'No se puede deshabilitar al único Administrador activo del sistema');
                }
            }

            await cliente.query('UPDATE usuario SET activo = FALSE WHERE id_usuario = $1', [id]);
            await revocarSesionesUsuario(cliente, id);
            const despues = await snapshotUsuario(cliente, id);

            await registrarAuditoria({
                entidad: 'usuario',
                accion: 'deshabilitar',
                idRegistro: id,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: antes,
                estadoNuevo: despues,
                descripcion: `Usuario ${antes.correo_usuario} (ID ${id}) deshabilitado`,
            }, cliente);
        });

        res.status(200).json({ mensaje: 'Usuario deshabilitado correctamente' });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error interno al deshabilitar el usuario');
    }
};

// Eliminar usuario
export const eliminarUsuario = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        await ejecutarTransaccion(async (cliente) => {
            const antes = await snapshotUsuario(cliente, id, true);
            if (!antes) {
                throw new ErrorAplicacion(404, 'Usuario no encontrado para eliminar');
            }

            if (antes.activo && esAdmin(antes.nombre_rol as string)) {
                const otrosAdmins = await contarAdminsActivosExcluyendo(cliente, id);
                if (otrosAdmins === 0) {
                    throw new ErrorAplicacion(400, 'No se puede eliminar al único Administrador activo del sistema');
                }
            }

            await cliente.query('DELETE FROM usuario WHERE id_usuario = $1', [id]);

            await registrarAuditoria({
                entidad: 'usuario',
                accion: 'eliminar',
                idRegistro: id,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: antes,
                estadoNuevo: null,
                descripcion: `Usuario ${antes.correo_usuario} (ID ${id}) eliminado`,
            }, cliente);
        });

        res.status(200).json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el usuario porque está asociado a registros de proyectos u otras tablas'
            });
            return;
        }
        enviarErrorHttp(res, error, 'Error al eliminar el usuario');
    }
};
