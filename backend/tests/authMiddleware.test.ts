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
const conexionOriginal = pool.connect;

interface FilaSesion {
    id_usuario: number;
    nombre_rol: string;
    activo: boolean;
    id_sesion?: string | null;
    revocada?: boolean;
    inactiva?: boolean;
}

// Respuesta de la consulta de sesión de verificarToken: cuenta activa, sesión vigente
const simularUsuario = (fila: FilaSesion) => {
    pool.query = (async () => ({
        rows: [{ id_sesion: 'sid-prueba', revocada: false, inactiva: false, ...fila }],
    })) as unknown as typeof pool.query;
};

/** Simula pool.connect() para las mutaciones que corren dentro de una transacción. */
const simularTransaccion = (consulta: (sql: string, params?: unknown[]) => Promise<unknown>) => {
    pool.connect = (async () => ({
        query: consulta,
        release: () => undefined,
    })) as unknown as typeof pool.connect;
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

const tokenConSesion = (id: number, rol: string) =>
    `Bearer ${jwt.sign({ id, rol, sid: 'sid-prueba' }, JWT_SECRET_PRUEBA)}`;

afterEach(() => {
    pool.query = consultaOriginal;
    pool.connect = conexionOriginal;
    if (jwtSecretOriginal === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = jwtSecretOriginal;
    }
});

test('Bodeguero recibe 403 al usar una ruta restringida a Admin', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    simularUsuario({ id_usuario: 17, nombre_rol: 'Bodeguero', activo: true });

    const req = { headers: { authorization: tokenConSesion(17, 'Administrador') } } as Request;
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

    const req = { headers: { authorization: tokenConSesion(23, 'Tecnico') } } as Request;
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

test('una sesión por inactividad responde SESSION_EXPIRED y la revoca', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    const sentencias: string[] = [];
    pool.query = (async (sql: string) => {
        sentencias.push(sql);
        if (sql.includes('FROM usuario u')) {
            return { rows: [{ id_usuario: 30, nombre_rol: 'Tecnico', activo: true, id_sesion: 'sid-prueba', revocada: false, inactiva: true }] };
        }
        return { rows: [] };
    }) as unknown as typeof pool.query;

    const req = { headers: { authorization: tokenConSesion(30, 'Tecnico') } } as Request;
    const captura = crearCapturaRespuesta();
    let siguiente = false;

    await verificarToken(req, captura.respuesta, () => {
        siguiente = true;
    });

    assert.equal(siguiente, false);
    assert.equal(captura.obtenerStatus(), 401);
    assert.equal((captura.obtenerCuerpo() as { codigo: string }).codigo, 'SESSION_EXPIRED');
    assert.ok(sentencias.some((s) => s.includes('SET revocada = TRUE')), 'la sesión inactiva debe revocarse');
});

test('una sesión revocada (p. ej. tras cambiar la clave) responde SESSION_REVOKED', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    simularUsuario({ id_usuario: 31, nombre_rol: 'Tecnico', activo: true, revocada: true });

    const req = { headers: { authorization: tokenConSesion(31, 'Tecnico') } } as Request;
    const captura = crearCapturaRespuesta();

    await verificarToken(req, captura.respuesta, () => undefined);

    assert.equal(captura.obtenerStatus(), 401);
    assert.equal((captura.obtenerCuerpo() as { codigo: string }).codigo, 'SESSION_REVOKED');
});

test('un token sin claim sid (anterior al modelo de sesiones) es rechazado', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    const tokenSinSid = jwt.sign({ id: 5, rol: 'Administrador' }, JWT_SECRET_PRUEBA);

    const req = { headers: { authorization: `Bearer ${tokenSinSid}` } } as Request;
    const captura = crearCapturaRespuesta();

    await verificarToken(req, captura.respuesta, () => undefined);

    assert.equal(captura.obtenerStatus(), 401);
    assert.equal((captura.obtenerCuerpo() as { codigo: string }).codigo, 'SESSION_REVOKED');
});

test('[BACK-2] bloquea deshabilitar al único Administrador activo (PATCH /deshabilitar)', async () => {
    let intentoUpdateEjecutado = false;

    const consulta = async (sql: string) => {
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
                        intentos_fallidos: 0,
                        bloqueado_hasta: null,
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
    };
    simularTransaccion(consulta);
    pool.query = consulta as unknown as typeof pool.query;

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

    const consulta = async (sql: string) => {
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
                        intentos_fallidos: 0,
                        bloqueado_hasta: null,
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
    };
    simularTransaccion(consulta);
    pool.query = consulta as unknown as typeof pool.query;

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
                bloqueada: false,
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

test('[BACK-2] una cuenta bloqueada responde 423 aunque la clave sea correcta', async () => {
    const clavePlana = 'ClaveSegura123';
    const hash = await bcrypt.hash(clavePlana, 10);
    let consultasDeClaveEjecutadas = 0;

    pool.query = (async (sql: string) => {
        if (sql.includes('UPDATE usuario')) consultasDeClaveEjecutadas += 1;
        return {
            rows: [
                {
                    id_usuario: 60,
                    nombre_usuario: 'Bloqueada',
                    apellido_usuario: 'Prueba',
                    correo_usuario: 'bloqueada@fyag.cl',
                    rut: null,
                    id_rol: 3,
                    nombre_rol: 'Tecnico',
                    activo: true,
                    contrasena_hash: hash,
                    bloqueada: true,
                },
            ],
        };
    }) as unknown as typeof pool.query;

    const req = {
        body: { correo_usuario: 'bloqueada@fyag.cl', contrasena: clavePlana },
    } as unknown as Request<Record<string, string>, unknown, { correo_usuario?: string; contrasena?: string }>;
    const captura = crearCapturaRespuesta();

    await login(req, captura.respuesta);

    assert.equal(captura.obtenerStatus(), 423);
    assert.equal((captura.obtenerCuerpo() as { codigo: string }).codigo, 'CUENTA_BLOQUEADA');
    assert.equal(consultasDeClaveEjecutadas, 0, 'no debe contar ni registrar intentos sobre una cuenta bloqueada');
});
