import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
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