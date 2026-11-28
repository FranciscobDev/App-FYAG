/**
 * Pruebas de integración de los tickets [BACK-1] y de sus casos [SCRUM].
 * Requieren PostgreSQL accesible con las credenciales de backend/.env.
 * Usan datos con dominio @fyag.test y los eliminan al terminar.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import type { Server } from 'node:http';
import pool from '../config/db';
import { app } from '../app';
import { aplicarMigraciones } from '../services/migraciones';
import { fijarEnviadorCorreo } from '../services/correo';
import type { CorreoSaliente } from '../services/correo';

const SUFIJO = Date.now().toString(36);
const DOMINIO = '@fyag.test';
const CLAVE_ADMIN = 'AdminPrueba1';
const CLAVE_INICIAL = 'ClaveInicial1';
const CLAVE_NUEVA = 'ClaveNueva2024';
const MENSAJE_SOLICITUD = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.';

let servidor: Server;
let baseUrl: string;
let idAdmin: number;
let tokenAdmin: string;

const correosEnviados: CorreoSaliente[] = [];

const api = async (
    metodo: string,
    ruta: string,
    cuerpo?: unknown,
    token?: string
): Promise<{ status: number; json: any }> => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
};

const esperarCorreoPara = async (para: string, intentos = 100): Promise<CorreoSaliente> => {
    for (let i = 0; i < intentos; i++) {
        const encontrado = correosEnviados.filter((c) => c.para === para).pop();
        if (encontrado) return encontrado;
        await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error(`No llegó correo para ${para}`);
};

const extraerToken = (texto: string): string => {
    const m = texto.match(/token=([A-Za-z0-9_-]+)/);
    assert.ok(m, 'el correo debe contener el enlace con token');
    return decodeURIComponent(m[1]);
};

const fijarParametro = async (clave: string, valor: number) =>
    pool.query('UPDATE parametro_sistema SET valor = $2 WHERE clave = $1', [clave, valor]);

const ultimaBitacora = async (entidad: string, idRegistro: number, accion?: string) => {
    const res = await pool.query(
        `SELECT id_bitacora, accion, id_usuario, fecha_evento, valor_anterior, valor_nuevo, descripcion
         FROM bitacora_auditoria
         WHERE entidad = $1 AND id_registro_afectado = $2 ${accion ? 'AND accion = $3' : ''}
         ORDER BY id_bitacora DESC LIMIT 1`,
        accion ? [entidad, idRegistro, accion] : [entidad, idRegistro]
    );
    return res.rows[0];
};

before(async () => {
    await aplicarMigraciones();
    fijarEnviadorCorreo(async (correo) => {
        correosEnviados.push(correo);
    });

    await pool.query(`INSERT INTO roles (nombre_rol, descripcion) VALUES
        ('Administrador', 'Acceso total'), ('Bodeguero', 'Bodega'), ('Tecnico', 'Técnico')
        ON CONFLICT (nombre_rol) DO NOTHING`);

    const hashAdmin = await bcrypt.hash(CLAVE_ADMIN, 10);
    const admin = await pool.query<{ id_usuario: number }>(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
         VALUES ('Admin', 'Prueba', $1, (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'), $2, TRUE)
         RETURNING id_usuario`,
        [`admin-${SUFIJO}${DOMINIO}`, hashAdmin]
    );
    idAdmin = admin.rows[0].id_usuario;

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    const login = await api('POST', '/auth/login', { correo_usuario: `admin-${SUFIJO}${DOMINIO}`, contrasena: CLAVE_ADMIN });
    assert.equal(login.status, 200, 'el administrador de prueba debe poder iniciar sesión');
    tokenAdmin = login.json.token;
});

after(async () => {
    await pool.query(`DELETE FROM usuario WHERE correo_usuario LIKE '%${DOMINIO}'`);
    await fijarParametro('intentos_bloqueo', 5);
    await fijarParametro('minutos_inactividad_sesion', 30);
    await fijarParametro('minutos_validez_enlace_clave', 30);
    fijarEnviadorCorreo();
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

// ---------------------------------------------------------------------------
// [BACK-1] Auditoría transversal — SCRUM: modifica un rol y verifica el registro
// ---------------------------------------------------------------------------

test('[BACK-1][SCRUM] cambiar el rol de un usuario genera registro de auditoría con estado anterior y nuevo', async () => {
    const creado = await api('POST', '/usuarios', {
        nombre_usuario: 'Rol', apellido_usuario: 'Cambiable',
        correo_usuario: `rol-${SUFIJO}${DOMINIO}`, rol_codigo: 'technician',
        contrasena: CLAVE_INICIAL,
    }, tokenAdmin);
    assert.equal(creado.status, 201);
    const idUsuario = creado.json.usuario.id_usuario;

    const cambio = await api('PATCH', `/usuarios/${idUsuario}/rol`, { rol_codigo: 'warehouse' }, tokenAdmin);
    assert.equal(cambio.status, 200);
    assert.equal(cambio.json.usuario.nombre_rol, 'Bodeguero');

    const registro = await ultimaBitacora('usuario', idUsuario, 'cambiar_rol');
    assert.ok(registro, 'debe existir un registro de cambio de rol en bitacora_auditoria');
    assert.equal(registro.accion, 'cambiar_rol');
    assert.equal(Number(registro.id_usuario), idAdmin, 'el ejecutor debe ser el administrador');
    assert.ok(registro.fecha_evento instanceof Date, 'fecha exacta con zona horaria');

    const anterior = JSON.parse(registro.valor_anterior);
    const nuevo = JSON.parse(registro.valor_nuevo);
    assert.equal(anterior.nombre_rol, 'Tecnico');
    assert.equal(nuevo.nombre_rol, 'Bodeguero');
    assert.equal(anterior.id_usuario, idUsuario);
    assert.equal(nuevo.id_usuario, idUsuario);

    // Nunca debe guardarse la contraseña ni su hash
    assert.ok(!registro.valor_anterior.includes('contrasena'));
    assert.ok(!registro.valor_nuevo.includes('$2'));
});

test('[BACK-1] la creación de usuario y de roles base se audita', async () => {
    const creado = await api('POST', '/usuarios', {
        nombre_usuario: 'Audita', apellido_usuario: 'Creacion',
        correo_usuario: `crea-${SUFIJO}${DOMINIO}`, rol_codigo: 'warehouse', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);
    assert.equal(creado.status, 201);

    const registro = await ultimaBitacora('usuario', creado.json.usuario.id_usuario, 'crear');
    assert.ok(registro, 'la creación debe quedar registrada');
    assert.equal(registro.valor_anterior, null, 'una creación no tiene estado anterior');
    assert.equal(JSON.parse(registro.valor_nuevo).correo_usuario, `crea-${SUFIJO}${DOMINIO}`);
});

test('[BACK-1] una mutación fallida no deja cambios ni registros de auditoría (atomicidad)', async () => {
    const antes = await pool.query('SELECT COUNT(*)::int AS n FROM bitacora_auditoria WHERE entidad = $1', ['usuario']);
    const respuesta = await api('PATCH', '/usuarios/999999/rol', { rol_codigo: 'warehouse' }, tokenAdmin);
    assert.equal(respuesta.status, 404);
    const despues = await pool.query('SELECT COUNT(*)::int AS n FROM bitacora_auditoria WHERE entidad = $1', ['usuario']);
    assert.equal(despues.rows[0].n, antes.rows[0].n);
});

// ---------------------------------------------------------------------------
// [BACK-1] + [BACK-1] Parámetros — SCRUM: intentos de bloqueo a 4 y bloqueo al 5.º intento
// ---------------------------------------------------------------------------

test('[BACK-1] listar parámetros devuelve rango y valor vigente', async () => {
    const res = await api('GET', '/parametros', undefined, tokenAdmin);
    assert.equal(res.status, 200);
    const intentos = res.json.find((p: { clave: string }) => p.clave === 'intentos_bloqueo');
    assert.ok(intentos);
    assert.equal(intentos.valor_minimo, 1);
    assert.equal(intentos.valor_maximo, 10);
});

test('[BACK-1] valores fuera de rango se rechazan y no generan auditoría', async () => {
    const antes = await pool.query(
        "SELECT COUNT(*)::int AS n FROM bitacora_auditoria WHERE entidad = 'parametro'"
    );

    for (const valor of [0, 11, -3, 'abc', 2.5]) {
        const res = await api('PUT', '/parametros/intentos_bloqueo', { valor }, tokenAdmin);
        assert.equal(res.status, 400, `el valor ${String(valor)} debe rechazarse`);
    }

    const despues = await pool.query(
        "SELECT COUNT(*)::int AS n FROM bitacora_auditoria WHERE entidad = 'parametro'"
    );
    assert.equal(despues.rows[0].n, antes.rows[0].n, 'un valor rechazado no debe dejar auditoría');
    const vigente = await pool.query("SELECT valor FROM parametro_sistema WHERE clave = 'intentos_bloqueo'");
    assert.equal(vigente.rows[0].valor, 5, 'el valor vigente no cambia tras un rechazo');
});

test('[SCRUM] cambiar intentos de bloqueo a 4 queda auditado y el login bloquea al 5.º intento', async () => {
    const correo = `victima-${SUFIJO}${DOMINIO}`;
    const creada = await api('POST', '/usuarios', {
        nombre_usuario: 'Victima', apellido_usuario: 'Login',
        correo_usuario: correo, rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);
    assert.equal(creada.status, 201);

    const cambio = await api('PUT', '/parametros/intentos_bloqueo', { valor: 4 }, tokenAdmin);
    assert.equal(cambio.status, 200);
    assert.equal(cambio.json.parametro.valor, 4);

    // Los parámetros se identifican por clave (no por ID numérico): se busca por la clave auditada
    const registro = (await pool.query(
        `SELECT accion, valor_anterior, valor_nuevo, descripcion FROM bitacora_auditoria
         WHERE entidad = 'parametro' AND accion = 'editar' AND valor_nuevo LIKE '%"clave":"intentos_bloqueo"%'
         ORDER BY id_bitacora DESC LIMIT 1`
    )).rows[0];
    assert.ok(registro, 'el cambio de parámetro debe quedar auditado');
    assert.equal(JSON.parse(registro.valor_anterior).valor, 5);
    assert.equal(JSON.parse(registro.valor_nuevo).valor, 4);

    // 4 intentos con clave incorrecta: se mantiene el 401 genérico
    for (let i = 1; i <= 4; i++) {
        const fallo = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: 'incorrecta' });
        assert.equal(fallo.status, 401, `intento ${i} debe responder 401`);
    }

    // 5.º intento con la clave CORRECTA: bloqueado
    const quinto = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });
    assert.equal(quinto.status, 423, 'el 5.º intento debe bloquearse aunque la clave sea correcta');
    assert.equal(quinto.json.codigo, 'CUENTA_BLOQUEADA');

    await fijarParametro('intentos_bloqueo', 5);
});

test('[BACK-1] el login aplica el parámetro actualizado en vivo (sin reiniciar el servidor)', async () => {
    const correo = `vivo-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'En', apellido_usuario: 'Vivo', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    await api('PUT', '/parametros/intentos_bloqueo', { valor: 2 }, tokenAdmin);
    await api('POST', '/auth/login', { correo_usuario: correo, contrasena: 'mala' });
    const segundo = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: 'mala' });
    assert.equal(segundo.status, 401);
    const bloqueado = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });
    assert.equal(bloqueado.status, 423, 'con límite 2, el 3.er intento ya está bloqueado');

    await fijarParametro('intentos_bloqueo', 5);
});

// ---------------------------------------------------------------------------
// [BACK-1] Recuperación de contraseña — SCRUM: correo real y falso, reuso de enlace
// ---------------------------------------------------------------------------

test('[SCRUM] correo real y correo falso reciben exactamente la misma respuesta', async () => {
    const correoReal = `recup-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'Recupera', apellido_usuario: 'Real',
        correo_usuario: correoReal, rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    const real = await api('POST', '/auth/recuperar-clave', { correo_usuario: correoReal });
    const falso = await api('POST', '/auth/recuperar-clave', { correo_usuario: `noexiste-${SUFIJO}${DOMINIO}` });

    assert.equal(real.status, 200);
    assert.equal(falso.status, 200);
    assert.deepEqual(real.json, { mensaje: MENSAJE_SOLICITUD });
    assert.deepEqual(falso.json, real.json, 'la respuesta no debe revelar si el correo existe');

    await esperarCorreoPara(correoReal);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(
        correosEnviados.some((c) => c.para === `noexiste-${SUFIJO}${DOMINIO}`),
        false,
        'no debe enviarse correo a una dirección no registrada'
    );
});

test('[SCRUM] el enlace es de un solo uso, expira a los 30 min y tras usarlo la clave cambia', async () => {
    const correo = `uso-${SUFIJO}${DOMINIO}`;
    const creado = await api('POST', '/usuarios', {
        nombre_usuario: 'Uso', apellido_usuario: 'Enlace', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);
    const idUsuario = creado.json.usuario.id_usuario;

    await api('POST', '/auth/recuperar-clave', { correo_usuario: correo });
    const enlace = await esperarCorreoPara(correo);
    const token = extraerToken(enlace.texto);

    // Validez de 30 minutos según el parámetro vigente
    const validez = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (expira_en - fecha_creacion))/60 AS minutos
         FROM token_recuperacion_clave WHERE id_usuario = $1 AND usado_en IS NULL`,
        [idUsuario]
    );
    assert.equal(Math.round(Number(validez.rows[0].minutos)), 30);

    const clavePocoSegura = await api('POST', '/auth/restablecer-clave', { token, contrasena: 'corta' });
    assert.equal(clavePocoSegura.status, 400, 'la política de contraseña también aplica al restablecer');

    const primero = await api('POST', '/auth/restablecer-clave', { token, contrasena: CLAVE_NUEVA });
    assert.equal(primero.status, 200);

    const reuso = await api('POST', '/auth/restablecer-clave', { token, contrasena: 'OtraClave999' });
    assert.equal(reuso.status, 400, 'el enlace no puede reutilizarse');

    const claveVieja = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });
    assert.equal(claveVieja.status, 401, 'la clave anterior ya no sirve');
    const claveNueva = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_NUEVA });
    assert.equal(claveNueva.status, 200, 'la nueva clave sí funciona');
});

test('[SCRUM] un enlace vencido (más de 30 min) es rechazado', async () => {
    const correo = `vencido-${SUFIJO}${DOMINIO}`;
    const creado = await api('POST', '/usuarios', {
        nombre_usuario: 'Vencido', apellido_usuario: 'Enlace', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    await api('POST', '/auth/recuperar-clave', { correo_usuario: correo });
    const token = extraerToken((await esperarCorreoPara(correo)).texto);

    // Simula que pasaron 31 minutos desde la emisión
    await pool.query(
        `UPDATE token_recuperacion_clave SET expira_en = CURRENT_TIMESTAMP - INTERVAL '1 minute'
         WHERE id_usuario = $1 AND usado_en IS NULL`,
        [creado.json.usuario.id_usuario]
    );

    const res = await api('POST', '/auth/restablecer-clave', { token, contrasena: CLAVE_NUEVA });
    assert.equal(res.status, 400);
});

test('[SCRUM] solicitar un enlace nuevo invalida el anterior', async () => {
    const correo = `doble-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'Doble', apellido_usuario: 'Enlace', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    await api('POST', '/auth/recuperar-clave', { correo_usuario: correo });
    const primerToken = extraerToken((await esperarCorreoPara(correo)).texto);

    correosEnviados.length = 0;
    await api('POST', '/auth/recuperar-clave', { correo_usuario: correo });
    const segundoToken = extraerToken((await esperarCorreoPara(correo)).texto);
    assert.notEqual(primerToken, segundoToken);

    const viejo = await api('POST', '/auth/restablecer-clave', { token: primerToken, contrasena: CLAVE_NUEVA });
    assert.equal(viejo.status, 400, 'el enlace anterior ya no es válido');
    const nuevo = await api('POST', '/auth/restablecer-clave', { token: segundoToken, contrasena: CLAVE_NUEVA });
    assert.equal(nuevo.status, 200);
});

test('[SCRUM] al restablecer la clave se cierran las sesiones activas', async () => {
    const correo = `sesion-clave-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'Sesion', apellido_usuario: 'Clave', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    const sesion = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });
    const tokenActivo = sesion.json.token;
    assert.equal((await api('GET', '/auth/sesion', undefined, tokenActivo)).status, 200);

    await api('POST', '/auth/recuperar-clave', { correo_usuario: correo });
    const token = extraerToken((await esperarCorreoPara(correo)).texto);
    await api('POST', '/auth/restablecer-clave', { token, contrasena: CLAVE_NUEVA });

    const tras = await api('GET', '/auth/sesion', undefined, tokenActivo);
    assert.equal(tras.status, 401);
    assert.equal(tras.json.codigo, 'SESSION_REVOKED');
});

test('[BACK-1] cambio voluntario de clave exige la clave actual y cierra todas las sesiones', async () => {
    const correo = `cambia-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'Cambia', apellido_usuario: 'Clave', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    const sesion = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });
    const token = sesion.json.token;

    const claveActualErronea = await api('POST', '/auth/cambiar-clave', {
        contrasena_actual: 'nada', contrasena_nueva: CLAVE_NUEVA,
    }, token);
    assert.equal(claveActualErronea.status, 400);

    const ok = await api('POST', '/auth/cambiar-clave', {
        contrasena_actual: CLAVE_INICIAL, contrasena_nueva: CLAVE_NUEVA,
    }, token);
    assert.equal(ok.status, 200);

    assert.equal((await api('GET', '/auth/sesion', undefined, token)).status, 401, 'la sesión actual también se cierra');

    const registro = await ultimaBitacora('usuario', sesion.json.usuario.id_usuario, 'cambiar_clave');
    assert.ok(registro, 'el cambio de clave debe quedar auditado');
    assert.ok(!registro.valor_nuevo.includes('$2'), 'el hash nunca se guarda en la bitácora');
});

// ---------------------------------------------------------------------------
// Expiración de sesión por inactividad (30 min, parámetro en vivo)
// ---------------------------------------------------------------------------

test('[SCRUM] la sesión expira tras 30 min de inactividad web', async () => {
    const correo = `inactivo-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'Inactivo', apellido_usuario: 'Sesion', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    const login = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });
    const token = login.json.token;
    assert.equal((await api('GET', '/auth/sesion', undefined, token)).status, 200, 'sesión activa');

    // 29 minutos sin actividad: todavía válida
    await pool.query(
        `UPDATE sesion_usuario SET ultima_actividad = CURRENT_TIMESTAMP - INTERVAL '29 minutes'
         WHERE id_usuario = $1 AND revocada = FALSE`,
        [login.json.usuario.id_usuario]
    );
    assert.equal((await api('GET', '/auth/sesion', undefined, token)).status, 200, 'a 29 min aún es válida');

    // 31 minutos sin actividad: expirada
    await pool.query(
        `UPDATE sesion_usuario SET ultima_actividad = CURRENT_TIMESTAMP - INTERVAL '31 minutes'
         WHERE id_usuario = $1 AND revocada = FALSE`,
        [login.json.usuario.id_usuario]
    );
    const expirada = await api('GET', '/auth/sesion', undefined, token);
    assert.equal(expirada.status, 401);
    assert.equal(expirada.json.codigo, 'SESSION_EXPIRED');

    const fila = await pool.query(
        'SELECT revocada FROM sesion_usuario WHERE id_usuario = $1 ORDER BY fecha_inicio DESC LIMIT 1',
        [login.json.usuario.id_usuario]
    );
    assert.equal(fila.rows[0].revocada, true, 'la sesión queda revocada en base de datos');
});

test('[BACK-1] el tiempo de inactividad se toma en vivo del parámetro', async () => {
    const correo = `vivo-sesion-${SUFIJO}${DOMINIO}`;
    await api('POST', '/usuarios', {
        nombre_usuario: 'Vivo', apellido_usuario: 'Sesion', correo_usuario: correo,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);
    const login = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_INICIAL });

    await api('PUT', '/parametros/minutos_inactividad_sesion', { valor: 5 }, tokenAdmin);
    await pool.query(
        `UPDATE sesion_usuario SET ultima_actividad = CURRENT_TIMESTAMP - INTERVAL '10 minutes'
         WHERE id_usuario = $1`,
        [login.json.usuario.id_usuario]
    );
    const res = await api('GET', '/auth/sesion', undefined, login.json.token);
    assert.equal(res.status, 401, 'con 5 min de límite, 10 min de inactividad expira');
    assert.equal(res.json.codigo, 'SESSION_EXPIRED');

    await fijarParametro('minutos_inactividad_sesion', 30);
});
