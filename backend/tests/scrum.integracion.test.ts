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
    await pool.query(`DELETE FROM ordenes_compra WHERE proveedor_id IN (SELECT id_proveedor FROM proveedor WHERE correo_contacto LIKE '%${DOMINIO}')`).catch(() => undefined);
    await pool.query(`DELETE FROM articulo WHERE sku LIKE '%${SUFIJO.toUpperCase()}%'`).catch(() => undefined);
    await pool.query(`DELETE FROM proveedor WHERE correo_contacto LIKE '%${DOMINIO}'`).catch(() => undefined);
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

// =========================================================================
// [BACK-1] Endpoint móvil de proyectos asignados ordenados por fecha límite ascendente
// =========================================================================
test('[BACK-1][SCRUM] endpoint móvil retorna exclusivamente los proyectos asignados al técnico ordenados por fecha límite ascendente y bloquea proyectos ajenos', async () => {
    const correoT1 = `tec1-${SUFIJO}${DOMINIO}`;
    const correoT2 = `tec2-${SUFIJO}${DOMINIO}`;

    await api('POST', '/usuarios', {
        nombre_usuario: 'Tecnico', apellido_usuario: 'Uno', correo_usuario: correoT1,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    await api('POST', '/usuarios', {
        nombre_usuario: 'Tecnico', apellido_usuario: 'Dos', correo_usuario: correoT2,
        rol_codigo: 'technician', contrasena: CLAVE_INICIAL,
    }, tokenAdmin);

    const loginT1 = await api('POST', '/auth/login', { correo_usuario: correoT1, contrasena: CLAVE_INICIAL });
    const loginT2 = await api('POST', '/auth/login', { correo_usuario: correoT2, contrasena: CLAVE_INICIAL });

    const idT1 = loginT1.json.usuario.id_usuario;
    const idT2 = loginT2.json.usuario.id_usuario;
    const tokenT1 = loginT1.json.token;
    const tokenT2 = loginT2.json.token;

    // Crear proyectos con distintas fechas límite
    const insP1 = await pool.query(
        `INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto)
         VALUES ($1, 'Instalacion', '2026-12-20', 1000000, 50, 1500000, 0, 'En Proceso')
         RETURNING id_proyecto`,
        [`P1-T1-${SUFIJO}`]
    );
    const idP1 = insP1.rows[0].id_proyecto;

    const insP2 = await pool.query(
        `INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto)
         VALUES ($1, 'Instalacion', '2026-11-20', 1000000, 50, 1500000, 0, 'En Proceso')
         RETURNING id_proyecto`,
        [`P2-T1-${SUFIJO}`]
    );
    const idP2 = insP2.rows[0].id_proyecto;

    const insP3 = await pool.query(
        `INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto)
         VALUES ($1, 'Mantencion', '2026-12-10', 1000000, 50, 1500000, 0, 'En Proceso')
         RETURNING id_proyecto`,
        [`P3-T2-${SUFIJO}`]
    );
    const idP3 = insP3.rows[0].id_proyecto;

    const insP4 = await pool.query(
        `INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto)
         VALUES ($1, 'Mantencion', '2026-11-10', 1000000, 50, 1500000, 0, 'Planificado')
         RETURNING id_proyecto`,
        [`P4-T2-${SUFIJO}`]
    );
    const idP4 = insP4.rows[0].id_proyecto;

    await pool.query('INSERT INTO proyecto_tecnico (id_proyecto, id_usuario) VALUES ($1, $2), ($3, $4)', [idP1, idT1, idP2, idT1]);
    await pool.query('INSERT INTO proyecto_tecnico (id_proyecto, id_usuario) VALUES ($1, $2), ($3, $4)', [idP3, idT2, idP4, idT2]);

    // Consultar con Token de Técnico 1
    const resT1 = await api('GET', '/proyectos', undefined, tokenT1);
    assert.equal(resT1.status, 200);
    const projsT1 = resT1.json;
    assert.equal(projsT1.length, 2, 'Técnico 1 debe recibir exactamente 2 proyectos');
    assert.equal(projsT1[0].id_proyecto, idP2, 'El primer proyecto debe ser P2 (fecha 2026-11-20 más próxima)');
    assert.equal(projsT1[1].id_proyecto, idP1, 'El segundo proyecto debe ser P1 (fecha 2026-12-20 más lejana)');

    // Consultar con Token de Técnico 2
    const resT2 = await api('GET', '/proyectos', undefined, tokenT2);
    assert.equal(resT2.status, 200);
    const projsT2 = resT2.json;
    assert.equal(projsT2.length, 2, 'Técnico 2 debe recibir exactamente 2 proyectos');
    assert.equal(projsT2[0].id_proyecto, idP4, 'El primer proyecto debe ser P4 (fecha 2026-11-10 más próxima)');
    assert.equal(projsT2[1].id_proyecto, idP3, 'El segundo proyecto debe ser P3 (fecha 2026-12-10 más lejana)');

    // Verificar aislamiento cruzado (ningún técnico puede consultar proyectos ajenos)
    const intentoAjenoT1 = await api('GET', `/proyectos/${idP4}`, undefined, tokenT1);
    assert.equal(intentoAjenoT1.status, 404, 'Técnico 1 no puede ver proyecto asignado a Técnico 2');

    const intentoAjenoT2 = await api('GET', `/proyectos/${idP1}`, undefined, tokenT2);
    assert.equal(intentoAjenoT2.status, 404, 'Técnico 2 no puede ver proyecto asignado a Técnico 1');

    // Verificar endpoint móvil alias /proyectos/movil
    const resMovilT1 = await api('GET', '/proyectos/movil', undefined, tokenT1);
    assert.equal(resMovilT1.status, 200);
    assert.equal(resMovilT1.json.length, 2);
    assert.equal(resMovilT1.json[0].id_proyecto, idP2);
});

// =========================================================================
// [BACK-1] Órdenes de Compra: PDF corporativo con numeración correlativa y
// envío automático por correo al proveedor al aprobar (Borrador -> Enviada)
// [SCRUM] Aprueba una OC en borrador y verifica el PDF recibido en el correo de prueba
// =========================================================================
test('[BACK-1][SCRUM] crea OC en borrador con numeración correlativa, permite editarla mientras es borrador, y al aprobarla genera el PDF corporativo y lo envía por correo al proveedor cambiando el estado a Enviada', async () => {
    const correoProveedor = `proveedor-oc-${SUFIJO}${DOMINIO}`;
    const rutProveedor = `76.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-K`;

    const provRes = await pool.query<{ id_proveedor: number }>(
        `INSERT INTO proveedor (nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion, activo)
         VALUES ($1, $2, $3, '+56 2 2555 0100', 'Av. Industrial 1500, Santiago', TRUE)
         RETURNING id_proveedor`,
        [`Proveedor OC ${SUFIJO}`, rutProveedor, correoProveedor]
    );
    const idProveedor = provRes.rows[0].id_proveedor;

    const artCreate = await api('POST', '/articulos', {
        nombre_articulo: `Insumo OC ${SUFIJO}`,
        sku: `SKU-OC-${SUFIJO}`.toUpperCase(),
        precio_unitario: 4500,
        categoria: 'Materiales',
        stock: 20,
        stock_minimo: 5,
    }, tokenAdmin);
    assert.equal(artCreate.status, 201);
    const idArticulo = artCreate.json.articulo.id_articulo;
    const skuArticulo = artCreate.json.articulo.sku;

    // 1. Crear primera OC en Borrador
    const oc1Res = await api('POST', '/ordenes-compra', {
        proveedor_id: idProveedor,
        origen: 'Manual',
        fecha_estimada_oc: '2026-12-01',
        observaciones: 'Borrador inicial de prueba',
        lineas: [{ id_articulo: idArticulo, cantidad_orden: 10, precio_unitario: 4500 }],
    }, tokenAdmin);
    assert.equal(oc1Res.status, 201, 'debe crear la primera OC en estado Borrador');
    const oc1 = oc1Res.json.orden_compra;
    assert.equal(oc1.estado, 'Borrador');
    assert.match(oc1.numero_oc, /^OC-\d{4}-\d{5}$/, 'debe asignar número correlativo con formato OC-YYYY-NNNNN');

    // 2. Crear segunda OC para comprobar numeración correlativa secuencial
    const oc2Res = await api('POST', '/ordenes-compra', {
        proveedor_id: idProveedor,
        origen: 'Stock Critico',
        fecha_estimada_oc: '2026-12-05',
        lineas: [{ sku: skuArticulo, cantidad_orden: 5, precio_unitario: 4500 }],
    }, tokenAdmin);
    assert.equal(oc2Res.status, 201);
    const oc2 = oc2Res.json.orden_compra;
    const corr1 = Number(oc1.numero_oc.split('-')[2]);
    const corr2 = Number(oc2.numero_oc.split('-')[2]);
    assert.equal(corr2, corr1 + 1, 'la numeración de las OC debe ser estrictamente correlativa');

    // 3. Editar la primera OC mientras está en estado Borrador
    const editRes = await api('PUT', `/ordenes-compra/${oc1.id_orden_compra}`, {
        observaciones: 'Entrega urgente en Bodega Central portón 2',
        lineas: [{ id_articulo: idArticulo, cantidad_orden: 20, precio_unitario: 5000 }],
    }, tokenAdmin);
    assert.equal(editRes.status, 200, 'debe permitir editar la OC mientras sea Borrador');
    assert.equal(editRes.json.orden_compra.subtotal_neto, 100000);
    assert.equal(editRes.json.orden_compra.iva, 19000);
    assert.equal(editRes.json.orden_compra.total, 119000);

    // 4. [SCRUM] Aprobar la OC en borrador -> pasa a Enviada, genera PDF y envía correo al proveedor
    correosEnviados.length = 0;
    const aprobarRes = await api('POST', `/ordenes-compra/${oc1.id_orden_compra}/aprobar`, {}, tokenAdmin);
    assert.equal(aprobarRes.status, 200, 'el Administrador debe poder aprobar la OC en borrador');
    assert.equal(aprobarRes.json.orden_compra.estado, 'Enviada', 'el estado debe cambiar de Borrador a Enviada');
    assert.equal(aprobarRes.json.correo_enviado.para, correoProveedor);
    assert.equal(aprobarRes.json.correo_enviado.nombre_adjunto, `${oc1.numero_oc}.pdf`);

    // 5. Verificar el correo recibido en la bandeja de prueba y el PDF corporativo adjunto
    const correoRecibido = await esperarCorreoPara(correoProveedor);
    assert.ok(correoRecibido.asunto.includes(oc1.numero_oc), 'el asunto del correo debe incluir el número correlativo de la OC');
    assert.ok(Array.isArray(correoRecibido.adjuntos) && correoRecibido.adjuntos.length === 1, 'el correo debe contener el PDF adjunto');

    const pdfAdjunto = correoRecibido.adjuntos![0];
    assert.equal(pdfAdjunto.filename, `${oc1.numero_oc}.pdf`);
    assert.equal(pdfAdjunto.contentType, 'application/pdf');

    const textoPdf = pdfAdjunto.content.toString('latin1');
    assert.ok(textoPdf.startsWith('%PDF-1.4'), 'el adjunto debe ser un documento PDF válido (%PDF-1.4)');
    assert.ok(textoPdf.trimEnd().endsWith('%%EOF'), 'el PDF debe cerrar con %%EOF');
    assert.ok(textoPdf.includes('FYAG MULTISYSTEM SpA'), 'el PDF debe contener el membrete corporativo');
    assert.ok(textoPdf.includes(oc1.numero_oc), 'el PDF debe mostrar el número correlativo de la OC');
    assert.ok(textoPdf.includes(rutProveedor), 'el PDF debe incluir el RUT del proveedor');
    assert.ok(textoPdf.includes(skuArticulo), 'el PDF debe listar el SKU del insumo aprobado');
    assert.ok(textoPdf.includes('$100.000'), 'el PDF debe reflejar el subtotal neto actualizado');
    assert.ok(textoPdf.includes('$19.000'), 'el PDF debe reflejar el IVA (19%)');
    assert.ok(textoPdf.includes('$119.000'), 'el PDF debe reflejar el total con IVA');

    // 6. [BACK-2][SCRUM] Intenta modificar cantidades de una OC en estado Enviada -> debe bloquearse con 400 y conservar cantidades
    const intentoModificarCantidadesEnviada = await api('PUT', `/ordenes-compra/${oc1.id_orden_compra}`, {
        observaciones: 'Intento de alterar cantidades tras envío',
        lineas: [{ id_articulo: idArticulo, cantidad_orden: 999, precio_unitario: 5000 }],
    }, tokenAdmin);
    assert.equal(
        intentoModificarCantidadesEnviada.status,
        400,
        '[SCRUM] intentar modificar cantidades de una OC en estado Enviada debe responder 400'
    );
    assert.ok(
        String(intentoModificarCantidadesEnviada.json.mensaje).includes('Enviada'),
        'el mensaje debe indicar que la OC está en estado Enviada'
    );

    // También bloquea por PATCH /:id/lineas
    const intentoPatchLineasEnviada = await api('PATCH', `/ordenes-compra/${oc1.id_orden_compra}/lineas`, {
        lineas: [{ id_articulo: idArticulo, cantidad_orden: 500, precio_unitario: 5000 }],
    }, tokenAdmin);
    assert.equal(intentoPatchLineasEnviada.status, 400);

    // Verificar en BD que la cantidad original aprobada (20) permaneció intacta
    const oc1Verificada = await api('GET', `/ordenes-compra/${oc1.id_orden_compra}`, undefined, tokenAdmin);
    assert.equal(oc1Verificada.status, 200);
    assert.equal(oc1Verificada.json.lineas[0].cantidad_orden, 20, 'la cantidad aprobada (20) no debe haberse modificado');
    assert.equal(oc1Verificada.json.total, 119000, 'el total aprobado no debe haberse alterado');

    // 7. [BACK-2] Transiciones de estado válidas e inválidas, y bloqueo sobre órdenes anuladas
    const transicionInvalidaEnviadaABorrador = await api('PATCH', `/ordenes-compra/${oc1.id_orden_compra}/estado`, {
        estado: 'Borrador',
    }, tokenAdmin);
    assert.equal(transicionInvalidaEnviadaABorrador.status, 400, 'no debe permitir retroceder de Enviada a Borrador');

    // Anular la segunda OC (Borrador -> Anulada es una transición válida)
    const anularOc2 = await api('PATCH', `/ordenes-compra/${oc2.id_orden_compra}/estado`, {
        estado: 'Anulada',
    }, tokenAdmin);
    assert.equal(anularOc2.status, 200);
    assert.equal(anularOc2.json.orden_compra.estado, 'Anulada');

    // Intentar editar o cambiar estado de una OC Anulada -> bloqueado con 400
    const editarAnulada = await api('PUT', `/ordenes-compra/${oc2.id_orden_compra}`, {
        lineas: [{ sku: skuArticulo, cantidad_orden: 50, precio_unitario: 4500 }],
    }, tokenAdmin);
    assert.equal(editarAnulada.status, 400, 'no debe permitir modificar cantidades de una OC Anulada');

    const reenviarAnulada = await api('PATCH', `/ordenes-compra/${oc2.id_orden_compra}/estado`, {
        estado: 'Enviada',
    }, tokenAdmin);
    assert.equal(reenviarAnulada.status, 400, 'no debe permitir cambiar estado de una OC Anulada');

    const reAprobarBloqueado = await api('POST', `/ordenes-compra/${oc1.id_orden_compra}/aprobar`, {}, tokenAdmin);
    assert.equal(reAprobarBloqueado.status, 400, 'no debe permitir aprobar dos veces la misma OC');

    // 8. Verificar que la aprobación quedó auditada en bitacora_auditoria
    const auditAprobacion = await ultimaBitacora('orden_compra', oc1.id_orden_compra, 'aprobar_enviar');
    assert.ok(auditAprobacion, 'la aprobación y envío de la OC debe quedar registrada en auditoría');
    assert.equal(JSON.parse(auditAprobacion.valor_anterior).estado, 'Borrador');
    assert.equal(JSON.parse(auditAprobacion.valor_nuevo).estado, 'Enviada');
});

// =========================================================================
// [BACK-1] Motor automático de OC por stock mínimo (H35 / H40 / H43)
// [SCRUM] Dispara la condición de stock mínimo dos veces seguidas y verifica que no duplique la OC
// =========================================================================
test('[BACK-1][SCRUM] dispara la condición de stock mínimo dos veces seguidas y verifica que cree un único borrador automático con proveedor y cantidad de reposición del catálogo (H35), genere alerta H40, no duplique la OC y no la envíe hasta aprobación del Administrador (H43)', async () => {
    const correoProvAuto = `prov-auto-${SUFIJO}${DOMINIO}`;
    const rutProvAuto = `77.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-5`;

    const provRes = await pool.query<{ id_proveedor: number }>(
        `INSERT INTO proveedor (nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion, activo)
         VALUES ($1, $2, $3, '+56 2 2444 9900', 'Av. Reposicion 900, Santiago', TRUE)
         RETURNING id_proveedor`,
        [`Proveedor Auto H35 ${SUFIJO}`, rutProvAuto, correoProvAuto]
    );
    const idProveedorPredeterminado = provRes.rows[0].id_proveedor;

    // Crear insumo con stock inicial 50 (sobre el mínimo de 15) y cantidad de reposición 80 (H35)
    const skuAuto = `SKU-AUTO-${SUFIJO}`.toUpperCase();
    const insumoRes = await api('POST', '/articulos', {
        nombre_articulo: `Insumo Reposicion Auto ${SUFIJO}`,
        sku: skuAuto,
        precio_unitario: 3200,
        categoria: 'Materiales',
        id_proveedor: idProveedorPredeterminado,
        stock: 50,
        stock_minimo: 15,
        cant_reposicion: 80,
    }, tokenAdmin);
    assert.equal(insumoRes.status, 201);
    const idInsumoAuto = insumoRes.json.articulo.id_articulo;
    assert.equal(insumoRes.json.oc_automatica, undefined, 'con stock 50 > 15 no debe crear OC automática');

    correosEnviados.length = 0;

    // 1. PRIMER DISPARO DE STOCK MÍNIMO: el stock cae a 15 (disponible <= mínimo)
    const caida1 = await api('PUT', `/articulos/${idInsumoAuto}`, { stock: 15 }, tokenAdmin);
    assert.equal(caida1.status, 200);
    assert.ok(caida1.json.reposicion_stock_minimo, 'debe devolver el resultado del motor de reposición');
    assert.equal(caida1.json.reposicion_stock_minimo.creada, true, 'el primer disparo debe crear el borrador automático');

    const ocAuto = caida1.json.reposicion_stock_minimo.orden_compra;
    assert.ok(ocAuto, 'debe incluir la OC automática creada');
    assert.equal(ocAuto.estado, 'Borrador', 'la OC automática debe crearse en estado Borrador (H43)');
    assert.equal(ocAuto.origen, 'Stock Critico');
    assert.equal(ocAuto.proveedor_id, idProveedorPredeterminado, 'debe usar el proveedor predeterminado del maestro (H35)');
    assert.equal(ocAuto.lineas.length, 1);
    assert.equal(ocAuto.lineas[0].id_articulo, idInsumoAuto);
    assert.equal(ocAuto.lineas[0].cantidad_orden, 80, 'debe usar la cantidad de reposición del catálogo (80) (H35)');
    assert.match(ocAuto.numero_oc, /^OC-\d{4}-\d{5}$/, 'debe tener numeración correlativa');

    // Verificar que NO se envió correo al proveedor al crearse el borrador automático (H43)
    assert.equal(
        correosEnviados.filter((c) => c.para === correoProvAuto).length,
        0,
        'no debe enviarse correo al proveedor hasta que el Administrador apruebe el borrador (H43)'
    );

    // Verificar que se generó la alerta para H40
    const alertaH40 = caida1.json.reposicion_stock_minimo.alerta_h40;
    assert.ok(alertaH40, 'debe generar alerta para el panel H40');
    assert.equal(alertaH40.id_orden_compra, ocAuto.id_orden_compra);
    assert.equal(alertaH40.id_articulo, idInsumoAuto);

    const listaAlertas = await api('GET', '/ordenes-compra/alertas', undefined, tokenAdmin);
    assert.equal(listaAlertas.status, 200);
    assert.ok(
        listaAlertas.json.some((a: { id_orden_compra: number }) => a.id_orden_compra === ocAuto.id_orden_compra),
        'la alerta H40 debe aparecer en el listado de alertas del sistema'
    );

    // 2. [SCRUM] SEGUNDO DISPARO SEGUIDO DE STOCK MÍNIMO: el stock cae aún más (de 15 a 6)
    const caida2 = await api('PUT', `/articulos/${idInsumoAuto}`, { stock: 6 }, tokenAdmin);
    assert.equal(caida2.status, 200);
    assert.equal(
        caida2.json.reposicion_stock_minimo.creada,
        false,
        '[SCRUM] el segundo disparo consecutivo NO debe crear otra OC porque ya existe una OC abierta'
    );
    assert.equal(
        caida2.json.reposicion_stock_minimo.orden_compra.id_orden_compra,
        ocAuto.id_orden_compra,
        'debe referenciar la misma OC abierta original'
    );

    // También invocando explícitamente el endpoint del motor por segunda vez
    const motorExplicito = await api('POST', '/ordenes-compra/motor-stock-minimo', { id_articulo: idInsumoAuto }, tokenAdmin);
    assert.equal(motorExplicito.status, 200);
    assert.equal(motorExplicito.json.creadas, 0, 'el motor no debe duplicar la OC en ejecuciones sucesivas');

    // Comprobar en la base de datos que existe exactamente 1 OC para este insumo y exactamente 1 alerta H40
    const conteoOcBd = await pool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM oc_lineas WHERE id_articulo = $1',
        [idInsumoAuto]
    );
    assert.equal(conteoOcBd.rows[0].total, 1, 'en base de datos debe existir únicamente 1 OC para este insumo');

    const conteoAlertasBd = await pool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM alertas_sistema WHERE id_articulo = $1',
        [idInsumoAuto]
    );
    assert.equal(conteoAlertasBd.rows[0].total, 1, 'en base de datos debe existir únicamente 1 alerta H40 para este insumo');

    // 3. El Administrador aprueba el borrador automático -> recién ahora se envía el PDF por correo al proveedor (H43)
    const aprobacionAuto = await api('POST', `/ordenes-compra/${ocAuto.id_orden_compra}/aprobar`, {}, tokenAdmin);
    assert.equal(aprobacionAuto.status, 200);
    assert.equal(aprobacionAuto.json.orden_compra.estado, 'Enviada');
    const correoAutoRecibido = await esperarCorreoPara(correoProvAuto);
    assert.ok(correoAutoRecibido.asunto.includes(ocAuto.numero_oc));
    assert.equal(correoAutoRecibido.adjuntos?.[0]?.filename, `${ocAuto.numero_oc}.pdf`);
});

// =========================================================================
// [DB] Consulta optimizada de insumos activos con disponible <= stock_minimo sin OC abierta
// [SCRUM] Prueba la consulta con insumos con y sin OC abierta
// =========================================================================
test('[DB][SCRUM] la consulta optimizada devuelve solo insumos activos con disponible <= stock_minimo que no tienen OC abierta (Borrador, Enviada o Recibida parcial)', async () => {
    const provRes = await pool.query<{ id_proveedor: number }>(
        `INSERT INTO proveedor (nombre_proveedor, rut_proveedor, correo_contacto, activo)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id_proveedor`,
        [`Proveedor DB Query ${SUFIJO}`, `78.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-1`, `dbquery-${SUFIJO}${DOMINIO}`]
    );
    const idProv = provRes.rows[0].id_proveedor;

    // Insumo A: Activo, bajo mínimo (4 <= 10), SIN OC abierta -> DEBE APARECER en la consulta
    const insSinOc = await pool.query<{ id_articulo: number }>(
        `INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor, activo)
         VALUES ($1, $2, 2500, 'Materiales', $3, TRUE) RETURNING id_articulo`,
        [`Insumo Sin OC ${SUFIJO}`, `DB-SIN-OC-${SUFIJO}`.toUpperCase(), idProv]
    );
    const idSinOc = insSinOc.rows[0].id_articulo;
    await pool.query(
        `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, stock_minimo, cant_reposicion)
         VALUES ($1, 4, 10, 30)`,
        [idSinOc]
    );

    // Insumo B: Activo, bajo mínimo (3 <= 10), CON OC en estado 'Borrador' -> NO DEBE APARECER
    const insConBorrador = await pool.query<{ id_articulo: number }>(
        `INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor, activo)
         VALUES ($1, $2, 2500, 'Materiales', $3, TRUE) RETURNING id_articulo`,
        [`Insumo Con Borrador ${SUFIJO}`, `DB-BORR-${SUFIJO}`.toUpperCase(), idProv]
    );
    const idConBorrador = insConBorrador.rows[0].id_articulo;
    await pool.query(
        `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, stock_minimo, cant_reposicion)
         VALUES ($1, 3, 10, 30)`,
        [idConBorrador]
    );
    const ocBorr = await pool.query<{ id_orden_compra: number }>(
        `INSERT INTO ordenes_compra (numero_oc, proveedor_id, estado, origen)
         VALUES ($1, $2, 'Borrador', 'Stock Critico') RETURNING id_orden_compra`,
        [`OC-DB-B-${SUFIJO}`, idProv]
    );
    await pool.query(
        `INSERT INTO oc_lineas (id_orden_compra, id_articulo, cantidad_orden, precio_unitario)
         VALUES ($1, $2, 30, 2500)`,
        [ocBorr.rows[0].id_orden_compra, idConBorrador]
    );

    // Insumo C: Activo, bajo mínimo (2 <= 10), CON OC en estado 'Enviada' -> NO DEBE APARECER
    const insConEnviada = await pool.query<{ id_articulo: number }>(
        `INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor, activo)
         VALUES ($1, $2, 2500, 'Materiales', $3, TRUE) RETURNING id_articulo`,
        [`Insumo Con Enviada ${SUFIJO}`, `DB-ENV-${SUFIJO}`.toUpperCase(), idProv]
    );
    const idConEnviada = insConEnviada.rows[0].id_articulo;
    await pool.query(
        `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, stock_minimo, cant_reposicion)
         VALUES ($1, 2, 10, 30)`,
        [idConEnviada]
    );
    const ocEnv = await pool.query<{ id_orden_compra: number }>(
        `INSERT INTO ordenes_compra (numero_oc, proveedor_id, estado, origen)
         VALUES ($1, $2, 'Enviada', 'Manual') RETURNING id_orden_compra`,
        [`OC-DB-E-${SUFIJO}`, idProv]
    );
    await pool.query(
        `INSERT INTO oc_lineas (id_orden_compra, id_articulo, cantidad_orden, precio_unitario)
         VALUES ($1, $2, 30, 2500)`,
        [ocEnv.rows[0].id_orden_compra, idConEnviada]
    );

    // Insumo D: Activo, bajo mínimo (1 <= 10), CON OC en estado 'Anulada' (no abierta) -> SÍ DEBE APARECER
    const insConAnulada = await pool.query<{ id_articulo: number }>(
        `INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor, activo)
         VALUES ($1, $2, 2500, 'Materiales', $3, TRUE) RETURNING id_articulo`,
        [`Insumo Con Anulada ${SUFIJO}`, `DB-ANU-${SUFIJO}`.toUpperCase(), idProv]
    );
    const idConAnulada = insConAnulada.rows[0].id_articulo;
    await pool.query(
        `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, stock_minimo, cant_reposicion)
         VALUES ($1, 1, 10, 30)`,
        [idConAnulada]
    );
    const ocAnu = await pool.query<{ id_orden_compra: number }>(
        `INSERT INTO ordenes_compra (numero_oc, proveedor_id, estado, origen)
         VALUES ($1, $2, 'Anulada', 'Manual') RETURNING id_orden_compra`,
        [`OC-DB-A-${SUFIJO}`, idProv]
    );
    await pool.query(
        `INSERT INTO oc_lineas (id_orden_compra, id_articulo, cantidad_orden, precio_unitario)
         VALUES ($1, $2, 30, 2500)`,
        [ocAnu.rows[0].id_orden_compra, idConAnulada]
    );

    // Ejecutar consulta optimizada vía endpoint GET /api/ordenes-compra/pendientes-reposicion
    const pendientesRes = await api('GET', '/ordenes-compra/pendientes-reposicion', undefined, tokenAdmin);
    assert.equal(pendientesRes.status, 200);
    const idsDetectados = new Set((pendientesRes.json as { id_articulo: number }[]).map((x) => x.id_articulo));

    assert.equal(idsDetectados.has(idSinOc), true, 'debe incluir insumo bajo mínimo sin ninguna OC');
    assert.equal(idsDetectados.has(idConAnulada), true, 'debe incluir insumo cuya única OC está Anulada (no abierta)');
    assert.equal(idsDetectados.has(idConBorrador), false, 'debe excluir insumo que ya tiene OC en Borrador');
    assert.equal(idsDetectados.has(idConEnviada), false, 'debe excluir insumo que ya tiene OC en Enviada');
});

// =========================================================================
// [BACK-1] Recepción parcial o total mixta: Conforme a disponible, Defectuoso a cuarentena
// [SCRUM] Realiza una recepción mixta y verifica saldos en disponible y cuarentena
// =========================================================================
test('[BACK-1][SCRUM] realiza una recepción mixta (10 conformes y 2 defectuosos) sobre una OC Enviada y verifica saldos separados en disponible y cuarentena, movimientos registrados y transición de estado', async () => {
    const provRes = await pool.query<{ id_proveedor: number }>(
        `INSERT INTO proveedor (nombre_proveedor, rut_proveedor, correo_contacto, activo)
         VALUES ($1, $2, $3, TRUE) RETURNING id_proveedor`,
        [`Proveedor Recepcion Mixta ${SUFIJO}`, `79.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}-2`, `mixta-${SUFIJO}${DOMINIO}`]
    );
    const idProv = provRes.rows[0].id_proveedor;

    const skuMixto = `MIX-OC-${SUFIJO}`.toUpperCase();
    const artCreate = await api('POST', '/articulos', {
        nombre_articulo: `Insumo Recepcion Mixta ${SUFIJO}`,
        sku: skuMixto,
        precio_unitario: 4000,
        categoria: 'Equipos',
        id_proveedor: idProv,
        stock: 20,
        stock_minimo: 5,
    }, tokenAdmin);
    assert.equal(artCreate.status, 201);
    const idArt = artCreate.json.articulo.id_articulo;

    // Crear y aprobar OC por 12 unidades
    const ocRes = await api('POST', '/ordenes-compra', {
        proveedor_id: idProv,
        aprobar_inmediatamente: true,
        lineas: [{ id_articulo: idArt, cantidad_orden: 12, precio_unitario: 4000 }],
    }, tokenAdmin);
    assert.equal(ocRes.status, 201);
    const idOc = ocRes.json.orden_compra.id_orden_compra;
    assert.equal(ocRes.json.orden_compra.estado, 'Enviada');

    // [SCRUM] Recepción mixta: 10 conformes y 2 defectuosos en una sola transacción
    const recRes = await api('POST', `/ordenes-compra/${idOc}/recepcion`, {
        items: [{ id_articulo: idArt, cantidad_conforme: 10, cantidad_defectuosa: 2 }],
    }, tokenAdmin);
    assert.equal(recRes.status, 200);
    assert.equal(recRes.json.orden_compra.estado, 'Recibida parcial');
    assert.equal(recRes.json.saldos_actualizados[0].disponible_anterior, 20);
    assert.equal(recRes.json.saldos_actualizados[0].disponible_nuevo, 30, '10 conformes suman a stock disponible (20 -> 30)');
    assert.equal(recRes.json.saldos_actualizados[0].cuarentena_anterior, 0);
    assert.equal(recRes.json.saldos_actualizados[0].cuarentena_nuevo, 2, '2 defectuosos suman a cuarentena (0 -> 2)');
    assert.equal(recRes.json.movimientos_registrados.length, 2, 'registra un movimiento a disponible y otro a cuarentena');

    // Verificar directamente en el endpoint de artículos que las dos bolsas quedaron actualizadas por separado
    const artVerificado = await api('GET', `/articulos/${idArt}`, undefined, tokenAdmin);
    assert.equal(artVerificado.status, 200);
    assert.equal(artVerificado.json.cantidad_disponible, 30);
    assert.equal(artVerificado.json.cantidad_cuarentena, 2);

    // [DB][SCRUM] Revisar integridad referencial entre OC, recepciones, recepcion_lineas (Conforme, Defectuoso, Faltante) y movimientos_inventario (con saldo y PMP histórico)
    const trazaRes = await api('GET', `/ordenes-compra/${idOc}/trazabilidad-recepcion`, undefined, tokenAdmin);
    assert.equal(trazaRes.status, 200);
    assert.equal(trazaRes.json.recepciones.length, 1);
    const idRecepcionBd = trazaRes.json.recepciones[0].id_recepcion;
    assert.equal(trazaRes.json.recepciones[0].id_orden_compra, idOc);

    // Deben existir líneas de recepción Conforme (10) y Defectuoso (2) vinculadas a idRecepcionBd y a la línea de la OC
    const lineasTraza = trazaRes.json.recepcion_lineas as {
        id_recepcion_linea: number;
        id_recepcion: number;
        id_oc_linea: number;
        estado_linea: string;
        cantidad: number;
    }[];
    const rlConf = lineasTraza.find((l) => l.estado_linea === 'Conforme')!;
    const rlDef = lineasTraza.find((l) => l.estado_linea === 'Defectuoso')!;
    assert.ok(rlConf && rlConf.cantidad === 10 && rlConf.id_recepcion === idRecepcionBd);
    assert.ok(rlDef && rlDef.cantidad === 2 && rlDef.id_recepcion === idRecepcionBd);

    // Movimientos en Cardex (movimientos_inventario) con saldo_historico, pmp_historico y FK a recepcion_lineas
    const movsTraza = trazaRes.json.movimientos_inventario as {
        id_recepcion: number;
        id_recepcion_linea: number;
        destino_bolsa: string;
        saldo_historico: number;
        pmp_historico: number;
    }[];
    const movDisp = movsTraza.find((m) => m.destino_bolsa === 'disponible')!;
    const movCuar = movsTraza.find((m) => m.destino_bolsa === 'cuarentena')!;
    assert.equal(movDisp.id_recepcion_linea, rlConf.id_recepcion_linea);
    assert.equal(movDisp.saldo_historico, 30);
    assert.equal(movDisp.pmp_historico, 4000);
    assert.equal(movCuar.id_recepcion_linea, rlDef.id_recepcion_linea);
    assert.equal(movCuar.saldo_historico, 2);

    // Comprobar restricción de clave foránea en PostgreSQL (no permite insertar recepcion_lineas hacia una recepción u OC línea inexistente)
    await assert.rejects(
        () =>
            pool.query(
                `INSERT INTO recepcion_lineas (id_recepcion, id_oc_linea, id_articulo, estado_linea, cantidad, precio_unitario_ingreso)
                 VALUES (99999999, 99999999, $1, 'Conforme', 5, 4000)`,
                [idArt]
            ),
        (err: any) => err?.code === '23503',
        'PostgreSQL debe exigir integridad referencial (23503) entre recepcion_lineas, recepciones y oc_lineas'
    );

    // [FRONT-2][SCRUM] Ingresa una factura real de prueba vinculada a la OC recién recepcionada (10 conformes, 2 defectuosos)
    // y valida que los totales en pantalla (3 descuentos en cascada, neto, IVA y aviso de discrepancia) coincidan exactamente con el backend:
    const itemsFacturaScrum = [
        {
            sku: skuMixto,
            name: `Insumo Recepcion Mixta ${SUFIJO}`,
            unit: 'un',
            quantity: 12, // Cobra las 12 pedidas aunque solo 10 fueron recibidas conformes y 2 fueron a cuarentena
            grossPrice: 5000,
            disc1: 10, // Paso 1: $4.500
            disc2: 5,  // Paso 2: $4.275
            disc3: 2,  // Paso 3: Math.round(4189.5) = $4.190
            stockActual: 20,
            pmpActual: 4000,
        },
    ];

    const calcRes = await api('POST', '/ordenes-compra/facturas/calcular', {
        items: itemsFacturaScrum,
    }, tokenAdmin);
    assert.equal(calcRes.status, 200);
    assert.equal(calcRes.json.lineas[0].priceAfterDisc1, 4500);
    assert.equal(calcRes.json.lineas[0].priceAfterDisc2, 4275);
    assert.equal(calcRes.json.lineas[0].netUnitPrice, 4190);
    assert.equal(calcRes.json.subtotalGross, 60000);
    assert.equal(calcRes.json.totalDiscounts, 9720);
    assert.equal(calcRes.json.subtotalNet, 50280);
    assert.equal(calcRes.json.iva, 9553);
    assert.equal(calcRes.json.total, 59833);

    const numFacturaPrueba = `FAC-${SUFIJO}-001`;
    const facCreateRes = await api('POST', '/ordenes-compra/facturas', {
        numero_factura: numFacturaPrueba,
        id_proveedor: idProv,
        id_orden_compra: idOc,
        items: itemsFacturaScrum,
    }, tokenAdmin);
    assert.equal(facCreateRes.status, 201);
    assert.equal(facCreateRes.json.factura.subtotalNet, calcRes.json.subtotalNet, 'totales de pantalla coinciden exactamente con el backend');
    assert.equal(facCreateRes.json.factura.iva, calcRes.json.iva);
    assert.equal(facCreateRes.json.factura.total, calcRes.json.total);
    assert.equal(facCreateRes.json.factura.discrepancias.tieneDiscrepancia, true, 'detecta discrepancia con la recepción mixta (12 facturadas vs 10 conformes y 2 en cuarentena)');
    assert.ok(facCreateRes.json.factura.alerta_generada, '[BACK-2][SCRUM] genera alerta inmediata al Administrador cuando la factura cobra cantidad distinta a la recepción H33');
    assert.equal(facCreateRes.json.factura.alerta_generada.tipo, 'discrepancia_factura_recepcion');
    assert.equal(facCreateRes.json.factura.alerta_generada.severidad, 'rojo');

    // Verificar que la alerta de discrepancia entre factura y recepción H33 sea visible en GET /ordenes-compra/alertas
    const alertasAdminRes = await api('GET', '/ordenes-compra/alertas', undefined, tokenAdmin);
    assert.equal(alertasAdminRes.status, 200);
    assert.ok(
        (alertasAdminRes.json as { id_alerta: number; tipo: string; titulo: string }[]).some(
            (a) =>
                a.id_alerta === facCreateRes.json.factura.alerta_generada.id_alerta &&
                a.tipo === 'discrepancia_factura_recepcion' &&
                a.titulo.includes(numFacturaPrueba)
        ),
        'la alerta generada por discrepancia entre factura y recepción H33 aparece en el listado de alertas del Administrador'
    );

    // Validar que no permite repetir el número de factura para el mismo proveedor
    const facDupRes = await api('POST', '/ordenes-compra/facturas', {
        numero_factura: numFacturaPrueba,
        id_proveedor: idProv,
        id_orden_compra: idOc,
        items: itemsFacturaScrum,
    }, tokenAdmin);
    assert.equal(facDupRes.status, 409, 'debe bloquear número de factura duplicado para el mismo proveedor');

    // [BACK-1][SCRUM] Comprobar en base de datos que el PMP se actualizó automáticamente con la fórmula:
    // (valor stock actual + valor ingreso neto) / (stock actual + cantidad ingresada)
    // Stock antes de la recepción: 20 un @ PMP $4.000 = $80.000
    // Ingreso conforme: 10 un @ Costo Neto Factura $4.190 (5.000 con 10%, 5% y 2% en cascada) = $41.900
    // Nuevo PMP en BD = (80.000 + 41.900) / (20 + 10) = 121.900 / 30 = $4.063,33
    const stockPmpBd = await pool.query<{ cantidad_disponible: number; pmp: number }>(
        `SELECT cantidad_disponible::float8 AS cantidad_disponible, pmp::float8 AS pmp
         FROM articulos_stock
         WHERE id_articulo = $1`,
        [idArt]
    );
    assert.equal(stockPmpBd.rows[0].cantidad_disponible, 30);
    assert.equal(stockPmpBd.rows[0].pmp, 4063.33, 'el nuevo PMP en base de datos refleja exactamente (80.000 + 41.900) / 30 = 4063.33');

    // [DB][SCRUM] Verificar tablas `facturas_compra` (restricción única proveedor_id + numero_factura, vínculo opcional oc_id)
    // y `factura_lineas` (3 descuentos porcentuales), e intentar insertar una factura duplicada en SQL para el mismo proveedor:
    const facCompraBd = await pool.query<{
        id_factura: number;
        proveedor_id: number;
        numero_factura: string;
        oc_id: number | null;
    }>(
        `SELECT id_factura, proveedor_id, numero_factura, oc_id
         FROM facturas_compra
         WHERE proveedor_id = $1 AND numero_factura = $2`,
        [idProv, numFacturaPrueba]
    );
    assert.equal(facCompraBd.rows.length, 1);
    assert.equal(facCompraBd.rows[0].oc_id, idOc);

    const facLineasBd = await pool.query<{
        descuento_1_pct: number;
        descuento_2_pct: number;
        descuento_3_pct: number;
        precio_unitario_neto: number;
    }>(
        `SELECT descuento_1_pct::float8 AS descuento_1_pct,
                descuento_2_pct::float8 AS descuento_2_pct,
                descuento_3_pct::float8 AS descuento_3_pct,
                precio_unitario_neto
         FROM factura_lineas
         WHERE id_factura = $1`,
        [facCompraBd.rows[0].id_factura]
    );
    assert.equal(facLineasBd.rows.length, 1);
    assert.equal(facLineasBd.rows[0].descuento_1_pct, 10);
    assert.equal(facLineasBd.rows[0].descuento_2_pct, 5);
    assert.equal(facLineasBd.rows[0].descuento_3_pct, 2);
    assert.equal(facLineasBd.rows[0].precio_unitario_neto, 4190);

    // Intento directo de INSERT duplicado en PostgreSQL sobre `facturas_compra` con el mismo (proveedor_id, numero_factura) -> código 23505
    await assert.rejects(
        () =>
            pool.query(
                `INSERT INTO facturas_compra (proveedor_id, numero_factura, oc_id, subtotal_neto, monto_iva, total_factura)
                 VALUES ($1, $2, NULL, 10000, 1900, 11900)`,
                [idProv, numFacturaPrueba]
            ),
        (err: any) => err?.code === '23505',
        'PostgreSQL debe rechazar con 23505 (unique_violation) una factura duplicada para el mismo proveedor en facturas_compra'
    );
});

// =========================================================================
// [BACK-1] Endpoint transaccional de emisión de solicitud de insumos
// [SCRUM] Intenta solicitar 1 unidad más del disponible y verifica que no se cree la solicitud
// =========================================================================
test('[BACK-1][SCRUM] endpoint POST /api/solicitudes intenta solicitar 1 unidad más del disponible y verifica que no se cree la solicitud; y al solicitar dentro del disponible descuenta de disponible, suma a comprometido y notifica al Administrador', async () => {
    // 1. Crear insumo con 25 unidades de stock disponible
    const skuSol = `SOL-INS-${SUFIJO}`.toUpperCase();
    const artRes = await api('POST', '/articulos', {
        nombre_articulo: `Insumo Solicitud Transaccional ${SUFIJO}`,
        sku: skuSol,
        precio_unitario: 6000,
        categoria: 'Materiales',
        stock: 25,
        stock_minimo: 5,
    }, tokenAdmin);
    assert.equal(artRes.status, 201);
    const idArt = artRes.json.articulo.id_articulo as number;

    // 2. Crear un proyecto ACTIVO ('En Proceso') y un proyecto INACTIVO ('Completado')
    const proyActivoRes = await api('POST', '/proyectos', {
        nombre_proyecto: `Proyecto Activo Solicitud ${SUFIJO}`,
        tipo_proyecto: 'Instalacion',
        estado_proyecto: 'En Proceso',
    }, tokenAdmin);
    assert.equal(proyActivoRes.status, 201);
    const idProyActivo = proyActivoRes.json.proyecto.id_proyecto as number;

    const proyInactivoRes = await api('POST', '/proyectos', {
        nombre_proyecto: `Proyecto Cerrado Solicitud ${SUFIJO}`,
        tipo_proyecto: 'Instalacion',
        estado_proyecto: 'Completado',
    }, tokenAdmin);
    assert.equal(proyInactivoRes.status, 201);
    const idProyInactivo = proyInactivoRes.json.proyecto.id_proyecto as number;

    // 3. [SCRUM] Intentar solicitar 26 unidades (1 unidad MÁS del disponible = 25 + 1)
    const excesoRes = await api('POST', '/solicitudes', {
        id_proyecto: idProyActivo,
        descripcion_solicitud: 'Intento con 1 unidad más del disponible',
        items: [{ id_articulo: idArt, cantidad_solicitada: 26 }],
    }, tokenAdmin);
    assert.equal(excesoRes.status, 400, 'debe rechazar con 400 cuando se pide 1 unidad más del disponible');
    assert.ok(String(excesoRes.json.mensaje).includes('insuficiente'));

    // Verificar en BD que NO se creó ninguna solicitud para este proyecto y que el stock disponible sigue siendo 25 y comprometido 0
    const solFallidaBd = await pool.query(
        'SELECT id_solicitud FROM solicitudes WHERE id_proyecto = $1',
        [idProyActivo]
    );
    assert.equal(solFallidaBd.rows.length, 0, 'no debe haberse creado la solicitud tras superar el disponible');

    const stockIntacto = await api('GET', `/articulos/${idArt}`, undefined, tokenAdmin);
    assert.equal(stockIntacto.json.cantidad_disponible, 25);
    assert.equal(stockIntacto.json.cantidad_comprometida, 0);

    // 4. Intentar solicitar para el proyecto INACTIVO ('Completado') -> debe rechazar con 400
    const inactivoRes = await api('POST', '/solicitudes', {
        id_proyecto: idProyInactivo,
        items: [{ id_articulo: idArt, cantidad_solicitada: 5 }],
    }, tokenAdmin);
    assert.equal(inactivoRes.status, 400, 'debe rechazar solicitud para proyecto inactivo');

    // 5. Emitir solicitud válida por 10 unidades sobre el proyecto activo
    const okRes = await api('POST', '/solicitudes', {
        id_proyecto: idProyActivo,
        descripcion_solicitud: 'Solicitud válida con reserva en comprometido',
        items: [{ id_articulo: idArt, cantidad_solicitada: 10 }],
    }, tokenAdmin);
    assert.equal(okRes.status, 201);
    assert.equal(okRes.json.solicitud.estado_solicitud, 'Pendiente');
    assert.equal(okRes.json.solicitud.lineas[0].disponible_anterior, 25);
    assert.equal(okRes.json.solicitud.lineas[0].disponible_nuevo, 15);
    assert.equal(okRes.json.solicitud.lineas[0].comprometido_anterior, 0);
    assert.equal(okRes.json.solicitud.lineas[0].comprometido_nuevo, 10);
    assert.ok(okRes.json.solicitud.alerta_administrador, 'notifica al Administrador con alerta');

    // Verificar en GET /api/articulos/:id (base de H6) que el stock disponible bajó a 15 y el comprometido subió a 10
    const stockReservado = await api('GET', `/articulos/${idArt}`, undefined, tokenAdmin);
    assert.equal(stockReservado.json.cantidad_disponible, 15, 'disponible descontado en BD (25 -> 15)');
    assert.equal(stockReservado.json.cantidad_comprometida, 10, 'comprometido incrementado en BD (0 -> 10)');

    // [DB][SCRUM] Revisar estructura y claves foráneas de `solicitudes_insumos` (proyecto_id, bodeguero_id,
    // estado: Pendiente/Aprobada/Rechazada/Anulada, motivo_rechazo, nro_comprobante) y `solicitud_lineas`:
    const solInsumosBd = await pool.query<{
        id_solicitud: number;
        proyecto_id: number;
        bodeguero_id: number;
        estado: string;
        motivo_rechazo: string | null;
        nro_comprobante: string | null;
    }>(
        `SELECT id_solicitud, proyecto_id, bodeguero_id, estado::text AS estado, motivo_rechazo, nro_comprobante
         FROM solicitudes_insumos
         WHERE proyecto_id = $1
         ORDER BY id_solicitud DESC LIMIT 1`,
        [idProyActivo]
    );
    assert.equal(solInsumosBd.rows.length, 1);
    assert.equal(solInsumosBd.rows[0].proyecto_id, idProyActivo);
    assert.equal(solInsumosBd.rows[0].estado, 'Pendiente');

    const solLineasBd = await pool.query<{
        id_solicitud_linea: number;
        id_solicitud: number;
        id_articulo: number;
        cantidad_solicitada: number;
    }>(
        `SELECT id_solicitud_linea, id_solicitud, id_articulo, cantidad_solicitada::float8 AS cantidad_solicitada
         FROM solicitud_lineas
         WHERE id_solicitud = $1`,
        [solInsumosBd.rows[0].id_solicitud]
    );
    assert.equal(solLineasBd.rows.length, 1);
    assert.equal(solLineasBd.rows[0].id_articulo, idArt);
    assert.equal(solLineasBd.rows[0].cantidad_solicitada, 10);

    // Comprobar en PostgreSQL la clave foránea `fk_solicitudes_insumos_proyecto`:
    // intentar insertar en `solicitudes_insumos` con un `proyecto_id` inexistente debe fallar con código 23503
    await assert.rejects(
        () =>
            pool.query(
                `INSERT INTO solicitudes_insumos (proyecto_id, bodeguero_id, estado, motivo_rechazo, nro_comprobante)
                 VALUES (99999999, $1, 'Pendiente', NULL, 'COMP-TEST-01')`,
                [solInsumosBd.rows[0].bodeguero_id]
            ),
        (err: any) => err?.code === '23503',
        'PostgreSQL debe exigir integridad referencial (23503) e impedir vincular solicitudes_insumos a un proyecto inexistente'
    );
});
