import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { login } from '../controllers/authController';
import { actualizarUsuario, deshabilitarUsuario } from '../controllers/usuarioController';
import { verificarAdmin, verificarToken } from '../middleware/authMiddleware';

const JWT_SECRET_PRUEBA = 'auth-middleware-test-secret';
const jwtSecretOriginal = process.env.JWT_SECRET;
const consultaOriginal = pool.query;

const simularUsuario = (usuario: { id_usuario: number; nombre_rol: string; activo: boolean }) => {
    pool.query = (async () => ({ rows: [usuario] })) as unknown as typeof pool.query;
};

const crearCapturaRespuesta = () => {
    let statusCode: number | undefined;
    let cuerpo: unknown;
    const respuesta = {
        status: (codigo: number) => {
            statusCode = codigo;
            return respuesta;
        },
        json: (contenido: unknown) => {
            cuerpo = contenido;
            return respuesta;
        },
    } as unknown as Response;

    return {
        respuesta,
        obtenerStatus: () => statusCode,
        obtenerCuerpo: () => cuerpo,
    };
};

afterEach(() => {
    pool.query = consultaOriginal;
    if (jwtSecretOriginal === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = jwtSecretOriginal;
    }
});

test('Bodeguero recibe 403 al usar una ruta restringida a Admin', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    simularUsuario({ id_usuario: 17, nombre_rol: 'Bodeguero', activo: true });

    const req = {
        headers: {
            authorization: `Bearer ${jwt.sign({ id: 17, rol: 'Administrador' }, JWT_SECRET_PRUEBA)}`,
        },
    } as Request;
    const capturaToken = crearCapturaRespuesta();
    let tokenAceptado = false;

    await verificarToken(req, capturaToken.respuesta, () => {
        tokenAceptado = true;
    });

    assert.equal(tokenAceptado, true);
    assert.deepEqual(req.usuario, { id: 17, rol: 'Bodeguero' });

    const capturaRol = crearCapturaRespuesta();
    let rutaPermitida = false;
    verificarAdmin(req, capturaRol.respuesta, () => {
        rutaPermitida = true;
    });

    assert.equal(rutaPermitida, false);
    assert.equal(capturaRol.obtenerStatus(), 403);
});

test('un token de usuario deshabilitado recibe SESSION_REVOKED', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    simularUsuario({ id_usuario: 23, nombre_rol: 'Tecnico', activo: false });

    const req = {
        headers: {
            authorization: `Bearer ${jwt.sign({ id: 23, rol: 'Tecnico' }, JWT_SECRET_PRUEBA)}`,
        },
    } as Request;
    const captura = crearCapturaRespuesta();
    let siguienteMiddlewareEjecutado = false;

    await verificarToken(req, captura.respuesta, () => {
        siguienteMiddlewareEjecutado = true;
    });

    assert.equal(siguienteMiddlewareEjecutado, false);
    assert.equal(captura.obtenerStatus(), 401);
    assert.deepEqual(captura.obtenerCuerpo(), {
        codigo: 'SESSION_REVOKED',
        mensaje: 'Tu cuenta está deshabilitada o ya no existe',
    });
});

test('[BACK-2] bloquea deshabilitar al único Administrador activo (PATCH /deshabilitar)', async () => {
    let intentoUpdateEjecutado = false;

    pool.query = (async (sql: string) => {
        if (sql.includes('FROM usuario u') && sql.includes('WHERE u.id_usuario = $1')) {
            return {
                rows: [
                    {
                        id_usuario: 1,
                        nombre_usuario: 'Admin',
                        apellido_usuario: 'Principal',
                        correo_usuario: 'admin@fyag.cl',
                        rut: '11.111.111-1',
                        id_rol: 1,
                        nombre_rol: 'Administrador',
                        especializacion: null,
                        activo: true,
                    },
                ],
            };
        }
        if (sql.includes('COUNT(*)')) {
            return { rows: [{ total: '0' }] };
        }
        if (sql.includes('UPDATE usuario')) {
            intentoUpdateEjecutado = true;
        }
        return { rows: [] };
    }) as unknown as typeof pool.query;

    const req = {
        params: { id: '1' },
        usuario: { id: 1, rol: 'Administrador' },
    } as unknown as Request<{ id: string }>;
    const captura = crearCapturaRespuesta();

    await deshabilitarUsuario(req, captura.respuesta);

    assert.equal(intentoUpdateEjecutado, false);
    assert.equal(captura.obtenerStatus(), 400);
    assert.deepEqual(captura.obtenerCuerpo(), {
        mensaje: 'No se puede deshabilitar al único Administrador activo del sistema',
    });
});

test('[BACK-2] bloquea deshabilitar o bajar de rol al único Administrador activo (PUT /usuarios/:id)', async () => {
    let intentoUpdateEjecutado = false;

    pool.query = (async (sql: string) => {
        if (sql.includes('FROM usuario u') && sql.includes('WHERE u.id_usuario = $1')) {
            return {
                rows: [
                    {
                        id_usuario: 1,
                        nombre_usuario: 'Admin',
                        apellido_usuario: 'Principal',
                        correo_usuario: 'admin@fyag.cl',
                        rut: '11.111.111-1',
                        id_rol: 1,
                        nombre_rol: 'Administrador',
                        especializacion: null,
                        activo: true,
                    },
                ],
            };
        }
        if (sql.includes('COUNT(*)')) {
            return { rows: [{ total: '0' }] };
        }
        if (sql.includes('UPDATE usuario')) {
            intentoUpdateEjecutado = true;
        }
        return { rows: [] };
    }) as unknown as typeof pool.query;

    const req = {
        params: { id: '1' },
        body: { activo: false },
        usuario: { id: 1, rol: 'Administrador' },
    } as unknown as Request<{ id: string }>;
    const captura = crearCapturaRespuesta();

    await actualizarUsuario(req, captura.respuesta);

    assert.equal(intentoUpdateEjecutado, false);
    assert.equal(captura.obtenerStatus(), 400);
    assert.deepEqual(captura.obtenerCuerpo(), {
        mensaje: 'No se puede deshabilitar ni cambiar el rol del único Administrador activo del sistema',
    });
});

test('[BACK-2] bloquea el login de un usuario inactivo devolviendo 403', async () => {
    const clavePlana = 'ClaveSegura123';
    const hash = await bcrypt.hash(clavePlana, 10);

    pool.query = (async () => ({
        rows: [
            {
                id_usuario: 45,
                nombre_usuario: 'Pedro',
                apellido_usuario: 'Inactivo',
                correo_usuario: 'pedro@fyag.cl',
                rut: '18.234.567-8',
                id_rol: 2,
                nombre_rol: 'Bodeguero',
                activo: false,
                contrasena_hash: hash,
            },
        ],
    })) as unknown as typeof pool.query;

    const req = {
        body: {
            correo_usuario: 'pedro@fyag.cl',
            contrasena: clavePlana,
        },
    } as unknown as Request<Record<string, string>, unknown, { correo_usuario?: string; contrasena?: string }>;
    const captura = crearCapturaRespuesta();

    await login(req, captura.respuesta);

    assert.equal(captura.obtenerStatus(), 403);
    assert.deepEqual(captura.obtenerCuerpo(), {
        mensaje: 'Tu cuenta está desactivada',
    });
});