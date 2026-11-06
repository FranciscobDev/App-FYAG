import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { DatabaseError } from 'pg';
import pool from '../config/db';

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

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

const normalizarTexto = (valor?: string | null): string =>
    (valor ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

// Asegura que existan los 3 roles base en la tabla `roles`
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

const asegurarRolesBase = async (): Promise<Rol[]> => {
    const actuales = await pool.query<Rol>(
        'SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY id_rol ASC'
    );
    const filas = [...actuales.rows];

    for (const base of ROLES_BASE) {
        const existe = filas.some((r) => {
            const norm = normalizarTexto(r.nombre_rol);
            return base.claves.some((c) => norm.includes(c));
        });

        if (!existe) {
            try {
                const insertado = await pool.query<Rol>(
                    'INSERT INTO roles (nombre_rol, descripcion) VALUES ($1, $2) RETURNING id_rol, nombre_rol, descripcion',
                    [base.nombre_rol, base.descripcion]
                );
                if (insertado.rows[0]) {
                    filas.push(insertado.rows[0]);
                }
            } catch {
                // Ignorar si otra petición concurrente lo insertó
            }
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

const contarAdminsActivosExcluyendo = async (idUsuarioExcluir: number | string): Promise<number> => {
    const res = await pool.query<{ total: string }>(
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

// Consulta base: incluye el nombre del rol y nunca devuelve el hash
const SELECT_USUARIO = `
    SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
           u.rut, u.id_rol, r.nombre_rol::text AS nombre_rol, u.especializacion, u.activo, u.ultimo_acceso
    FROM usuario u
    LEFT JOIN roles r ON r.id_rol = u.id_rol
`;

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

// Crear usuario
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

        const insert = await pool.query<{ id_usuario: number }>(
            `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, rut,
                                  id_rol, especializacion, contrasena_hash, activo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id_usuario`,
            [
                nombre_usuario.trim(),
                apellido_usuario.trim(),
                correo_usuario.trim().toLowerCase(),
                rut?.trim() || null,
                idRolFinal,
                especializacion?.trim() || null,
                hash,
                activo !== false
            ]
        );

        const result = await pool.query<Usuario>(
            `${SELECT_USUARIO} WHERE u.id_usuario = $1`,
            [insert.rows[0].id_usuario]
        );

        res.status(201).json({
            mensaje: 'Usuario creado exitosamente',
            usuario: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados en el sistema' });
            return;
        }
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({ mensaje: 'El rol especificado no existe' });
            return;
        }
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error interno al crear el usuario' });
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
        const actual = await pool.query<Usuario>(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);
        if (actual.rows.length === 0) {
            res.status(404).json({ mensaje: 'Usuario no encontrado para actualizar' });
            return;
        }

        const usuarioActual = actual.rows[0];
        const eraAdminActivo =
            usuarioActual.activo && normalizarTexto(usuarioActual.nombre_rol).includes('admin');

        const idRolResuelto =
            id_rol !== undefined || rol_codigo !== undefined
                ? await resolverIdRol(id_rol, rol_codigo)
                : null;

        // Proteger que no se desactive al último Administrador activo
        if (eraAdminActivo && activo === false) {
            const otrosAdmins = await contarAdminsActivosExcluyendo(id);
            if (otrosAdmins === 0) {
                res.status(400).json({
                    mensaje: 'No se puede deshabilitar al único Administrador activo del sistema'
                });
                return;
            }
        }

        // Solo se cifra si se envió una nueva contraseña
        const hash = contrasena ? await bcrypt.hash(String(contrasena), 10) : null;

        await pool.query<{ id_usuario: number }>(
            `UPDATE usuario
             SET nombre_usuario   = COALESCE($1, nombre_usuario),
                 apellido_usuario = COALESCE($2, apellido_usuario),
                 correo_usuario   = COALESCE($3, correo_usuario),
                 rut              = COALESCE($4, rut),
                 id_rol           = COALESCE($5, id_rol),
                 especializacion  = COALESCE($6, especializacion),
                 contrasena_hash  = COALESCE($7, contrasena_hash),
                 activo           = COALESCE($8, activo)
             WHERE id_usuario = $9
             RETURNING id_usuario`,
            [
                nombre_usuario ? nombre_usuario.trim() : null,
                apellido_usuario ? apellido_usuario.trim() : null,
                correo_usuario ? correo_usuario.trim().toLowerCase() : null,
                rut ?? null,
                idRolResuelto ?? null,
                especializacion ?? null,
                hash,
                typeof activo === 'boolean' ? activo : null,
                id
            ]
        );

        const result = await pool.query<Usuario>(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);

        res.status(200).json({
            mensaje: 'Usuario actualizado exitosamente',
            usuario: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados por otro usuario' });
            return;
        }
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({ mensaje: 'El rol especificado no existe' });
            return;
        }
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error interno al actualizar el usuario' });
    }
};

// Eliminar usuario
export const eliminarUsuario = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const actual = await pool.query<Usuario>(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);
        if (actual.rows.length === 0) {
            res.status(404).json({ mensaje: 'Usuario no encontrado para eliminar' });
            return;
        }

        const usuarioActual = actual.rows[0];
        if (usuarioActual.activo && normalizarTexto(usuarioActual.nombre_rol).includes('admin')) {
            const otrosAdmins = await contarAdminsActivosExcluyendo(id);
            if (otrosAdmins === 0) {
                res.status(400).json({
                    mensaje: 'No se puede eliminar al único Administrador activo del sistema'
                });
                return;
            }
        }

        await pool.query(
            'DELETE FROM usuario WHERE id_usuario = $1 RETURNING id_usuario',
            [id]
        );

        res.status(200).json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el usuario porque está asociado a registros de proyectos u otras tablas'
            });
            return;
        }
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};
