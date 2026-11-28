/**
 * Pruebas de integración del ticket [BACK-2] — Declarar devolución de sobrante.
 * Requieren PostgreSQL accesible con las credenciales de backend/.env.
 * Usan datos con sufijo único y dominio @fyag.test. No borran registros: egresos y
 * auditoría son inmutables por diseño (triggers), por lo que la limpieza no es posible.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { app } from '../app';
import { aplicarMigraciones } from '../services/migraciones';
import { claveBloqueoDevolucion } from '../controllers/devolucionController';

const SUFIJO = Date.now().toString(36);
const DOMINIO = '@fyag.test';
const CLAVE_ADMIN = 'AdminPrueba1';
const CLAVE_USUARIOS = 'ClaveDevol2026';

let servidor: Server;
let baseUrl: string;
let idAdmin: number;
let tokenAdmin: string;
let idBodeguero: number;
let tokenBodeguero: string;
let idTecnico: number;
let tokenTecnico: string;
let idProyecto: number;
let contadorSecuencia = 0;

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

const contarDevolucionesTecnico = async (): Promise<number> =>
    (await pool.query<{ n: number }>(
        'SELECT COUNT(*)::int AS n FROM devoluciones_tecnico WHERE tecnico_id = $1',
        [idTecnico]
    )).rows[0].n;

const contarAlertasDevolucion = async (): Promise<number> =>
    (await pool.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM alertas_sistema WHERE tipo = 'devolucion_en_transito'"
    )).rows[0].n;

/**
 * Prepara un insumo con un historial físico controlado:
 *  - `retirada`: cantidad egresada de bodega al técnico en el proyecto (egreso inmutable);
 *  - `utilizada`: cantidad usada en terreno (uso_insumos_proyecto), si aplica.
 */
const prepararInsumo = async (retirada: number, utilizada = 0) => {
    contadorSecuencia += 1;
    const sku = `DEV-${SUFIJO}-${contadorSecuencia}`.toUpperCase();
    const insumo = await pool.query<{ id_insumo: number }>(
        `INSERT INTO insumos (sku, nombre) VALUES ($1, $2) RETURNING id_insumo`,
        [sku, `Insumo prueba devolución ${contadorSecuencia}`]
    );
    const idArticulo = insumo.rows[0].id_insumo;

    if (retirada > 0) {
        const solicitud = await pool.query<{ id_solicitud: number }>(
            `INSERT INTO solicitudes_insumos (proyecto_id, bodeguero_id, estado)
             VALUES ($1, $2, 'Aprobada') RETURNING id_solicitud`,
            [idProyecto, idBodeguero]
        );
        const linea = await pool.query<{ id_solicitud_linea: number }>(
            `INSERT INTO solicitud_lineas (id_solicitud, id_articulo, cantidad_solicitada, cantidad_entregada)
             VALUES ($1, $2, $3, $3) RETURNING id_solicitud_linea`,
            [solicitud.rows[0].id_solicitud, idArticulo, retirada]
        );
        const egreso = await pool.query<{ id_egreso: number }>(
            `INSERT INTO egresos_bodega (codigo_egreso, id_solicitud, proyecto_id, tecnico_retira_id,
                                         tecnico_retira_rut, tecnico_retira_nombre, bodeguero_id)
             VALUES ($1, $2, $3, $4, '11111111-1', 'Tecnico Prueba', $5) RETURNING id_egreso`,
            [`EGR-${SUFIJO}-${contadorSecuencia}`, solicitud.rows[0].id_solicitud, idProyecto, idTecnico, idBodeguero]
        );
        await pool.query(
            `INSERT INTO egreso_lineas (id_egreso, id_solicitud_linea, id_articulo, cantidad_egresada,
                                        saldo_pendiente_resultante, costo_unitario_pmp)
             VALUES ($1, $2, $3, $4, 0, 0)`,
            [egreso.rows[0].id_egreso, linea.rows[0].id_solicitud_linea, idArticulo, retirada]
        );
    }

    if (utilizada > 0) {
        await pool.query(
            `INSERT INTO uso_insumos_proyecto (proyecto_id, tecnico_id, id_articulo, cantidad_utilizada, id_usuario_registro)
             VALUES ($1, $2, $3, $4, $5)`,
            [idProyecto, idTecnico, idArticulo, utilizada, idAdmin]
        );
    }

    return { idArticulo, sku, nombre: `Insumo prueba devolución ${contadorSecuencia}` };
};

before(async () => {
    await aplicarMigraciones();

    await pool.query(`INSERT INTO roles (nombre_rol, descripcion) VALUES
        ('Administrador', 'Acceso total'), ('Bodeguero', 'Bodega'), ('Tecnico', 'Técnico')
        ON CONFLICT (nombre_rol) DO NOTHING`);

    const admin = await pool.query<{ id_usuario: number }>(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
         VALUES ('Admin', 'Devol', $1, (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'), $2, TRUE)
         RETURNING id_usuario`,
        [`admin-devol-${SUFIJO}${DOMINIO}`, await bcrypt.hash(CLAVE_ADMIN, 10)]
    );
    idAdmin = admin.rows[0].id_usuario;

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    const login = await api('POST', '/auth/login', {
        correo_usuario: `admin-devol-${SUFIJO}${DOMINIO}`,
        contrasena: CLAVE_ADMIN,
    });
    assert.equal(login.status, 200, 'el administrador de prueba debe iniciar sesión');
    tokenAdmin = login.json.token;

    const crearUsuario = async (nombre: string, rol: string) => {
        const correo = `${nombre.toLowerCase()}-devol-${SUFIJO}${DOMINIO}`;
        const creado = await api('POST', '/usuarios', {
            nombre_usuario: nombre, apellido_usuario: 'Devol', correo_usuario: correo,
            rol_codigo: rol, contrasena: CLAVE_USUARIOS,
        }, tokenAdmin);
        assert.equal(creado.status, 201, `debe crearse el usuario ${nombre}`);
        const sesion = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE_USUARIOS });
        assert.equal(sesion.status, 200);
        return { id: creado.json.usuario.id_usuario as number, token: sesion.json.token as string };
    };

    const tecnico = await crearUsuario('Tecnico', 'technician');
    idTecnico = tecnico.id;
    tokenTecnico = tecnico.token;

    const bodeguero = await crearUsuario('Bodega', 'warehouse');
    idBodeguero = bodeguero.id;
    tokenBodeguero = bodeguero.token;

    const proyecto = await pool.query<{ id_proyecto: number }>(
        `INSERT INTO proyecto (codigo_proyecto, nombre_proyecto, estado_proyecto)
         VALUES ($1, $2, 'En Proceso') RETURNING id_proyecto`,
        [`DEV-PRY-${SUFIJO}`, `Faena devolución ${SUFIJO}`]
    );
    idProyecto = proyecto.rows[0].id_proyecto;
});

after(async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

// ---------------------------------------------------------------------------
// [BACK-2][SCRUM] Intenta declarar una devolución mayor al sobrante real y verifica el bloqueo
// ---------------------------------------------------------------------------

test('[BACK-2][SCRUM] bloquea una devolución mayor al sobrante real (retirado 10 − usado 6 = 4) y no deja registros', async () => {
    const insumo = await prepararInsumo(10, 6);
    const devolucionesAntes = await contarDevolucionesTecnico();
    const alertasAntes = await contarAlertasDevolucion();

    const res = await api('POST', '/devoluciones', {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 5 }],
    }, tokenTecnico);

    assert.equal(res.status, 400, 'declarar 5 con sobrante real de 4 debe bloquearse');
    assert.match(res.json.mensaje, /máximo devolvible 4/, 'el mensaje debe indicar el máximo real');
    assert.equal(await contarDevolucionesTecnico(), devolucionesAntes, 'no debe crearse ninguna devolución');
    assert.equal(await contarAlertasDevolucion(), alertasAntes, 'no debe generarse alerta a bodega');
});

test('[BACK-2] declarar exactamente el sobrante (4 de 4) queda En tránsito, alerta a bodega y audita', async () => {
    const insumo = await prepararInsumo(10, 6);
    const alertasAntes = await contarAlertasDevolucion();

    const res = await api('POST', '/devoluciones', {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 4 }],
    }, tokenTecnico);

    assert.equal(res.status, 201, res.json.mensaje);
    const dev = res.json.devolucion;
    assert.equal(dev.estado, 'En tránsito');
    assert.match(dev.codigo_devolucion, /^DEV-\d{4}-\d{5}$/);
    assert.equal(dev.tecnico_id, idTecnico, 'el técnico se toma del token');
    assert.equal(dev.lineas[0].cantidad_maxima_devolvible, 4);
    assert.equal(dev.lineas[0].cantidad_declarada, 4);

    const fila = await pool.query<{ estado: string }>(
        'SELECT estado FROM devoluciones_tecnico WHERE id_devolucion = $1',
        [dev.id_devolucion]
    );
    assert.equal(fila.rows[0].estado, 'En tránsito', 'la devolución persiste En tránsito');

    assert.equal(await contarAlertasDevolucion(), alertasAntes + 1, 'debe generarse exactamente una alerta');
    const alerta = await pool.query<{ titulo: string; severidad: string; leida: boolean }>(
        `SELECT titulo, severidad, leida FROM alertas_sistema
         WHERE tipo = 'devolucion_en_transito' AND titulo LIKE $1`,
        [`%${dev.codigo_devolucion}%`]
    );
    assert.equal(alerta.rows.length, 1, 'la alerta debe referenciar el código de la devolución');
    assert.equal(alerta.rows[0].leida, false);

    const auditoria = await pool.query<{ accion: string; id_usuario: number; valor_nuevo: string }>(
        `SELECT accion, id_usuario, valor_nuevo FROM bitacora_auditoria
         WHERE entidad = 'devolucion' AND id_registro_afectado = $1`,
        [dev.id_devolucion]
    );
    assert.equal(auditoria.rows.length, 1);
    assert.equal(auditoria.rows[0].accion, 'declarar_devolucion');
    assert.equal(Number(auditoria.rows[0].id_usuario), idTecnico);
    assert.ok(JSON.parse(auditoria.rows[0].valor_nuevo).estado === 'En tránsito');
});

test('[BACK-2] lo que ya está En tránsito descuenta del sobrante: una segunda declaración por 1 unidad se bloquea', async () => {
    const insumo = await prepararInsumo(10, 6);

    const primera = await api('POST', '/devoluciones', {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 4 }],
    }, tokenTecnico);
    assert.equal(primera.status, 201);

    const segunda = await api('POST', '/devoluciones', {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 1 }],
    }, tokenTecnico);
    assert.equal(segunda.status, 400, 'el sobrante ya fue declarado en la primera devolución');
    assert.match(segunda.json.mensaje, /máximo devolvible 0/);
    assert.match(segunda.json.mensaje, /ya declarado 4/);
});

test('[BACK-2] un insumo que el técnico nunca retiró no puede devolverse', async () => {
    const insumo = await prepararInsumo(0);

    const res = await api('POST', '/devoluciones', {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 1 }],
    }, tokenTecnico);
    assert.equal(res.status, 400);
    assert.match(res.json.mensaje, /máximo devolvible 0/);
});

test('[BACK-2] una declaración espera si otra transacción del mismo técnico y proyecto está en curso', async () => {
    const insumo = await prepararInsumo(4, 0);
    const bloqueador = await pool.connect();
    try {
        await bloqueador.query('BEGIN');
        await bloqueador.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
            claveBloqueoDevolucion(idTecnico, idProyecto),
        ]);

        let resuelta = false;
        const pendiente = api('POST', '/devoluciones', {
            id_proyecto: idProyecto,
            items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 3 }],
        }, tokenTecnico).then((r) => {
            resuelta = true;
            return r;
        });

        await new Promise((r) => setTimeout(r, 400));
        assert.equal(resuelta, false, 'la declaración debe esperar mientras la otra transacción tenga el bloqueo');

        await bloqueador.query('COMMIT');
        const res = await pendiente;
        assert.equal(res.status, 201, 'al liberarse el bloqueo la declaración se completa');
    } finally {
        bloqueador.release();
    }
});

test('[BACK-2] seis declaraciones simultáneas de 3 sobre un sobrante de 4 solo permiten una', async () => {
    const insumo = await prepararInsumo(4, 0);
    const cuerpo = {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 3 }],
    };

    const resultados = await Promise.all(
        Array.from({ length: 6 }, () => api('POST', '/devoluciones', cuerpo, tokenTecnico))
    );

    const exitosas = resultados.filter((r) => r.status === 201).length;
    assert.equal(exitosas, 1, 'solo una declaración puede ganar el sobrante');

    const total = await pool.query<{ total: number }>(
        `SELECT COALESCE(SUM(dl.cantidad_declarada), 0)::float8 AS total
         FROM devolucion_lineas dl
         WHERE dl.id_articulo = $1`,
        [insumo.idArticulo]
    );
    assert.equal(Number(total.rows[0].total), 3, 'lo declarado nunca supera el sobrante');
});

test('[BACK-2] solo el técnico puede declarar devoluciones (bodeguero recibe 403)', async () => {
    const insumo = await prepararInsumo(5, 0);
    const res = await api('POST', '/devoluciones', {
        id_proyecto: idProyecto,
        items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: 1 }],
    }, tokenBodeguero);
    assert.equal(res.status, 403);
});

test('[BACK-2] cantidades en cero o negativas se rechazan sin crear registros', async () => {
    const insumo = await prepararInsumo(5, 0);
    const antes = await contarDevolucionesTecnico();

    for (const valor of [0, -2]) {
        const res = await api('POST', '/devoluciones', {
            id_proyecto: idProyecto,
            items: [{ id_articulo: insumo.idArticulo, cantidad_declarada: valor }],
        }, tokenTecnico);
        assert.equal(res.status, 400, `la cantidad ${valor} debe rechazarse`);
    }

    assert.equal(await contarDevolucionesTecnico(), antes);
});
