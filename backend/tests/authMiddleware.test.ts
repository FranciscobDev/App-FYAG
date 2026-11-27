import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { login, logout, renovarSesion, verificar2faLogin } from '../controllers/authController';
import { actualizarUsuario, deshabilitarUsuario } from '../controllers/usuarioController';
import {
    listarAvancesProyecto,
    obtenerReporteFinalProyecto,
    sanitizarProyectoParaRol,
} from '../controllers/proyectoController';
import { registrarHorasProyectoEnTransaccion } from '../controllers/motorFinancieroProyectoController';
import { emitirSolicitudInsumosEnTransaccion } from '../controllers/solicitudController';
import { verificarAdmin, verificarToken } from '../middleware/authMiddleware';
import { fijarEnviadorCorreo } from '../services/correo';
import { hashToken } from '../services/claves';

const JWT_SECRET_PRUEBA = 'auth-middleware-test-secret-with-32-characters';
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

test('JWT_SECRET ausente responde error de configuración del servidor', async () => {
    delete process.env.JWT_SECRET;
    const req = { headers: { authorization: 'Bearer token-prueba' } } as Request;
    const captura = crearCapturaRespuesta();

    await verificarToken(req, captura.respuesta, () => undefined);

    assert.equal(captura.obtenerStatus(), 500);
    assert.deepEqual(captura.obtenerCuerpo(), {
        mensaje: 'La autenticación no está configurada correctamente',
    });
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

test('un Refresh Token o token 2FA no puede usarse como Access Token en verificarToken', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    const tokenRefresh = jwt.sign({ id: 1, rol: 'Administrador', sid: 'sid-1', tipo: 'refresh' }, JWT_SECRET_PRUEBA);

    const req = { headers: { authorization: `Bearer ${tokenRefresh}` } } as Request;
    const captura = crearCapturaRespuesta();

    await verificarToken(req, captura.respuesta, () => undefined);

    assert.equal(captura.obtenerStatus(), 401);
    assert.equal((captura.obtenerCuerpo() as { codigo: string }).codigo, 'SESSION_REVOKED');
});

test('POST /auth/logout invalida la sesión activa en sesion_usuario y borra el refresh_token_hash', async () => {
    const sentencias: { sql: string; params: unknown[] }[] = [];
    pool.query = (async (sql: string, params: unknown[] = []) => {
        sentencias.push({ sql, params });
        return { rowCount: 1, rows: [] };
    }) as unknown as typeof pool.query;

    const req = {
        usuario: { id: 12, rol: 'Tecnico' },
        sid: 'sid-a-cerrar',
    } as unknown as Request;
    const captura = crearCapturaRespuesta();

    await logout(req, captura.respuesta);

    assert.equal(captura.obtenerStatus(), 200);
    assert.equal(sentencias.length, 1);
    assert.ok(sentencias[0].sql.includes('SET revocada = TRUE, refresh_token_hash = NULL'));
    assert.deepEqual(sentencias[0].params, ['sid-a-cerrar', 12]);
});

test('POST /auth/refresh rota el Refresh Token, emite nuevo Access Token de 15m y bloquea reutilización', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    const refreshInicial = jwt.sign(
        { id: 7, rol: 'Bodeguero', sid: 'sid-rotacion', jti: 'jti-1', tipo: 'refresh' },
        JWT_SECRET_PRUEBA,
        { expiresIn: '7d' }
    );
    let hashActualEnBd = hashToken(refreshInicial);
    let sesionRevocada = false;

    pool.query = (async (sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM usuario u')) {
            return {
                rows: [
                    {
                        id_usuario: 7,
                        nombre_usuario: 'Roberto',
                        apellido_usuario: 'Gómez',
                        correo_usuario: 'rgomez@fyag.cl',
                        rut: '14.555.666-7',
                        id_rol: 2,
                        nombre_rol: 'Bodeguero',
                        activo: true,
                        id_sesion: 'sid-rotacion',
                        revocada: sesionRevocada,
                        inactiva: false,
                        refresh_token_hash: hashActualEnBd,
                        refresh_vencido: false,
                    },
                ],
            };
        }
        if (sql.includes('SET refresh_token_hash = $2')) {
            hashActualEnBd = String(params[1]);
            return { rowCount: 1, rows: [] };
        }
        if (sql.includes('SET revocada = TRUE')) {
            sesionRevocada = true;
            return { rowCount: 1, rows: [] };
        }
        return { rows: [] };
    }) as unknown as typeof pool.query;

    // 1. Primera renovación exitosa
    const req1 = { body: { refresh_token: refreshInicial } } as unknown as Request;
    const cap1 = crearCapturaRespuesta();
    await renovarSesion(req1, cap1.respuesta);

    assert.equal(cap1.obtenerStatus(), 200);
    const cuerpo1 = cap1.obtenerCuerpo() as {
        token: string;
        refresh_token: string;
        expira_en_segundos: number;
    };
    assert.equal(cuerpo1.expira_en_segundos, 900); // 15 minutos
    assert.ok(cuerpo1.token && cuerpo1.refresh_token);
    assert.notEqual(cuerpo1.refresh_token, refreshInicial);

    // 2. Reutilizar el refresh token antiguo revoca la sesión por seguridad
    const reqReuso = { body: { refresh_token: refreshInicial } } as unknown as Request;
    const capReuso = crearCapturaRespuesta();
    await renovarSesion(reqReuso, capReuso.respuesta);

    assert.equal(capReuso.obtenerStatus(), 401);
    assert.equal((capReuso.obtenerCuerpo() as { codigo: string }).codigo, 'SESSION_REVOKED');
    assert.equal(sesionRevocada, true);
});

test('Login de Administrador con 2FA envía OTP de 6 dígitos por correo y verificar2faLogin entrega los tokens', async () => {
    process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
    const clavePlana = 'ClaveAdminSegura123';
    const hash = await bcrypt.hash(clavePlana, 10);
    const correos: { para: string; asunto: string; texto: string }[] = [];
    let desafioGuardado: { id_desafio: string; id_usuario: number; codigo_hash: string; intentos: number } | null = null;

    fijarEnviadorCorreo(async (c) => {
        correos.push(c);
    });

    try {
        pool.query = (async (sql: string, params: unknown[] = []) => {
            if (sql.includes('LOWER(u.correo_usuario) = LOWER($1)')) {
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
                            activo: true,
                            contrasena_hash: hash,
                            bloqueada: false,
                            requiere_2fa: true,
                        },
                    ],
                };
            }
            if (sql.includes('INSERT INTO desafio_2fa_admin')) {
                desafioGuardado = {
                    id_desafio: String(params[0]),
                    id_usuario: Number(params[1]),
                    codigo_hash: String(params[2]),
                    intentos: 0,
                };
                return { rowCount: 1, rows: [] };
            }
            if (sql.includes('FROM desafio_2fa_admin')) {
                return { rows: desafioGuardado ? [desafioGuardado] : [] };
            }
            if (sql.includes('WHERE u.id_usuario = $1 AND u.activo = TRUE')) {
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
                            activo: true,
                        },
                    ],
                };
            }
            return { rowCount: 1, rows: [] };
        }) as unknown as typeof pool.query;

        // Paso 1: Login devuelve desafío 2FA sin entregar token de acceso todavía
        const reqLogin = {
            body: { correo_usuario: 'admin@fyag.cl', contrasena: clavePlana },
        } as unknown as Request<Record<string, string>, unknown, { correo_usuario?: string; contrasena?: string }>;
        const capLogin = crearCapturaRespuesta();
        await login(reqLogin, capLogin.respuesta);

        assert.equal(capLogin.obtenerStatus(), 200);
        const resPaso1 = capLogin.obtenerCuerpo() as {
            requiere_2fa?: boolean;
            desafio_token?: string;
            token?: string;
        };
        assert.equal(resPaso1.requiere_2fa, true);
        assert.equal(resPaso1.token, undefined);
        assert.ok(resPaso1.desafio_token);
        assert.equal(correos.length, 1);

        const matchCodigo = correos[0].texto.match(/\b(\d{6})\b/);
        assert.ok(matchCodigo, 'el correo debe incluir el código OTP de 6 dígitos');
        const codigoOtp = matchCodigo[1];

        // Paso 2: Código incorrecto responde 401 CODIGO_2FA_INVALIDO
        const reqMalo = {
            body: { desafio_token: resPaso1.desafio_token, codigo: codigoOtp === '000000' ? '999999' : '000000' },
        } as unknown as Request;
        const capMalo = crearCapturaRespuesta();
        await verificar2faLogin(reqMalo, capMalo.respuesta);
        assert.equal(capMalo.obtenerStatus(), 401);
        assert.equal((capMalo.obtenerCuerpo() as { codigo: string }).codigo, 'CODIGO_2FA_INVALIDO');

        // Paso 3: Código correcto entrega Access Token (15m) y Refresh Token (7d)
        const reqOk = {
            body: { desafio_token: resPaso1.desafio_token, codigo: codigoOtp },
        } as unknown as Request;
        const capOk = crearCapturaRespuesta();
        await verificar2faLogin(reqOk, capOk.respuesta);

        assert.equal(capOk.obtenerStatus(), 200);
        const resPaso2 = capOk.obtenerCuerpo() as {
            token: string;
            refresh_token: string;
            expira_en_segundos: number;
            usuario: { id_usuario: number };
        };
        assert.ok(resPaso2.token);
        assert.ok(resPaso2.refresh_token);
        assert.equal(resPaso2.expira_en_segundos, 900);
        assert.equal(resPaso2.usuario.id_usuario, 1);
    } finally {
        fijarEnviadorCorreo(undefined);
    }
});

test('Principio de mínimo privilegio: sanitizarProyectoParaRol oculta montos financieros al Técnico y los conserva para Admin', () => {
    const proyectoCompleto = {
        id_proyecto: 15,
        nombre_proyecto: 'Climatización Clínica',
        estado_proyecto: 'En Proceso',
        presupuesto_inicial: 5_000_000,
        presupuesto_materiales: 3_500_000,
        valor_venta: 8_000_000,
        costo_real_acumulado: 2_100_000,
        margen_estimado: 5_900_000,
        semaforo_financiero: 'verde',
    };

    const vistaTecnico = sanitizarProyectoParaRol(proyectoCompleto, true);
    assert.equal(vistaTecnico.id_proyecto, 15);
    assert.equal(vistaTecnico.nombre_proyecto, 'Climatización Clínica');
    assert.equal('valor_venta' in vistaTecnico, false);
    assert.equal('presupuesto_inicial' in vistaTecnico, false);
    assert.equal('costo_real_acumulado' in vistaTecnico, false);
    assert.equal('margen_estimado' in vistaTecnico, false);

    const vistaAdmin = sanitizarProyectoParaRol(proyectoCompleto, false);
    assert.equal(vistaAdmin.valor_venta, 8_000_000);
    assert.equal(vistaAdmin.margen_estimado, 5_900_000);
});

test('Anti-IDOR: Técnico no asignado al proyecto #16 recibe 403 al consultar avances, reporte final, registrar horas o emitir solicitud', async () => {
    // Cliente simulado donde el proyecto 16 existe y está activo, pero el técnico #99 NO está asignado
    const clienteMock: any = {
        query: async (sql: string) => {
            if (sql.includes('idor:verificar-asignacion-proyecto')) {
                return { rows: [] }; // No asignado
            }
            if (sql.includes('FROM proyecto')) {
                return {
                    rows: [
                        {
                            id_proyecto: 16,
                            nombre_proyecto: 'Proyecto Ajeno',
                            estado_proyecto: 'En Proceso',
                        },
                    ],
                };
            }
            return { rows: [] };
        },
    };
    pool.query = clienteMock.query;

    // 1. GET /proyectos/16/avances -> 403
    const reqAvances = {
        params: { id: '16' },
        usuario: { id: 99, rol: 'Tecnico' },
    } as unknown as Request<{ id: string }>;
    const capAvances = crearCapturaRespuesta();
    await listarAvancesProyecto(reqAvances, capAvances.respuesta);
    assert.equal(capAvances.obtenerStatus(), 403);

    // 2. GET /proyectos/16/reporte-final -> 403
    const capReporte = crearCapturaRespuesta();
    await obtenerReporteFinalProyecto(reqAvances, capReporte.respuesta);
    assert.equal(capReporte.obtenerStatus(), 403);

    // 3. POST /proyectos/16/horas (proyecto no asignado) -> 403
    await assert.rejects(
        () => registrarHorasProyectoEnTransaccion(clienteMock, 16, { horas: 4 }, 99, 'Tecnico'),
        (e: any) => e.estado === 403 && /no estás asignado/.test(e.message)
    );

    // 4. POST /proyectos/16/horas intentando suplantar a otro técnico (tecnico_id: 50) -> 403
    await assert.rejects(
        () => registrarHorasProyectoEnTransaccion(clienteMock, 16, { horas: 4, tecnico_id: 50 }, 99, 'Tecnico'),
        (e: any) => e.estado === 403 && /otro técnico/.test(e.message)
    );

    // 5. POST /solicitudes sobre proyecto no asignado -> 403
    await assert.rejects(
        () =>
            emitirSolicitudInsumosEnTransaccion(clienteMock, {
                id_proyecto: 16,
                id_usuario: 99,
                rol_ejecutor: 'Tecnico',
                items: [{ id_articulo: 1, cantidad: 2 }],
            }),
        (e: any) => e.estado === 403 && /no estás asignado/.test(e.message)
    );
});
