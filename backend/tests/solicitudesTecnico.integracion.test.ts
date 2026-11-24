/**
 * Pruebas de integración: una solicitud de insumos enviada por el técnico debe quedar guardada en la base
 * (con su reserva de stock) y solo debe verla el propio técnico y la administración.
 * Requieren PostgreSQL accesible con las credenciales de backend/.env.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { app } from '../app';
import { aplicarMigraciones } from '../services/migraciones';

const SUFIJO = Date.now().toString(36);
const DOMINIO = '@fyag.test';
const CLAVE = 'ClaveSolicitud2026';

let servidor: Server;
let baseUrl: string;
let tokenTecnicoA: string;
let tokenTecnicoB: string;
let tokenAdmin: string;
let idTecnicoA: number;
let idProyecto: number;
let sku: string;
let idArticulo: number;

const api = async (metodo: string, ruta: string, cuerpo?: unknown, token?: string) => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};

const login = async (correo: string): Promise<string> => {
    const res = await api('POST', '/auth/login', { correo_usuario: correo, contrasena: CLAVE });
    assert.ok(res.json.token, `debe iniciar sesión ${correo}`);
    return res.json.token;
};

before(async () => {
    await aplicarMigraciones();
    await pool.query(`INSERT INTO roles (nombre_rol, descripcion) VALUES
        ('Administrador', 'Acceso total'), ('Bodeguero', 'Bodega'), ('Tecnico', 'Técnico')
        ON CONFLICT (nombre_rol) DO NOTHING`);

    const hash = await bcrypt.hash(CLAVE, 10);
    const crear = async (nombre: string, rol: string, rut: string | null): Promise<number> =>
        (await pool.query<{ id_usuario: number }>(
            `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, contrasena_hash, activo)
             VALUES ($1, 'Solicitud', $2, $3, (SELECT id_rol FROM roles WHERE nombre_rol = $4), $5, TRUE)
             RETURNING id_usuario`,
            [nombre, `${nombre.toLowerCase()}-sol-${SUFIJO}${DOMINIO}`, rut, rol, hash]
        )).rows[0].id_usuario;

    await crear('Admin', 'Administrador', null);
    idTecnicoA = await crear('TecnicoA', 'Tecnico', `${10000000 + Math.floor(Math.random() * 80000000)}-K`);
    await crear('TecnicoB', 'Tecnico', `${20000000 + Math.floor(Math.random() * 70000000)}-K`);

    idProyecto = (await pool.query<{ id_proyecto: number }>(
        `INSERT INTO proyecto (codigo_proyecto, nombre_proyecto, estado_proyecto)
         VALUES ($1, $2, 'En Proceso') RETURNING id_proyecto`,
        [`SOL-${SUFIJO}`, `Faena solicitud ${SUFIJO}`]
    )).rows[0].id_proyecto;

    sku = `SOL-CABLE-${SUFIJO}`.toUpperCase();
    idArticulo = (await pool.query<{ id_insumo: number }>(
        `INSERT INTO insumos (sku, nombre) VALUES ($1, $2) RETURNING id_insumo`,
        [sku, `Cable solicitud ${SUFIJO}`]
    )).rows[0].id_insumo;
    await pool.query(
        `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, cantidad_comprometida) VALUES ($1, 10, 0)`,
        [idArticulo]
    );

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    tokenAdmin = await login(`admin-sol-${SUFIJO}${DOMINIO}`);
    tokenTecnicoA = await login(`tecnicoa-sol-${SUFIJO}${DOMINIO}`);
    tokenTecnicoB = await login(`tecnicob-sol-${SUFIJO}${DOMINIO}`);
});

after(async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

test('la solicitud del técnico se guarda en la base con estado Pendiente y reserva el stock', async () => {
    const res = await api('POST', '/solicitudes', {
        id_proyecto: idProyecto,
        items: [{ sku, cantidad_solicitada: 3 }],
        descripcion_solicitud: 'Prueba de guardado',
    }, tokenTecnicoA);
    assert.equal(res.status, 201, res.json.mensaje);

    const idSolicitud = res.json.solicitud.id_solicitud;
    const fila = await pool.query<{ estado: string; proyecto_id: number }>(
        'SELECT estado::text AS estado, proyecto_id FROM solicitudes_insumos WHERE id_solicitud = $1',
        [idSolicitud]
    );
    assert.equal(fila.rows.length, 1, 'la solicitud debe existir en solicitudes_insumos');
    assert.equal(fila.rows[0].estado, 'Pendiente');
    assert.equal(Number(fila.rows[0].proyecto_id), idProyecto);

    const stock = await pool.query<{ cantidad_disponible: number; cantidad_comprometida: number }>(
        'SELECT cantidad_disponible::float8, cantidad_comprometida::float8 FROM articulos_stock WHERE id_articulo = $1',
        [idArticulo]
    );
    assert.equal(Number(stock.rows[0].cantidad_disponible), 7);
    assert.equal(Number(stock.rows[0].cantidad_comprometida), 3);
});

test('una solicitud por sobre el stock disponible se rechaza y no se guarda', async () => {
    const antes = await pool.query<{ n: number }>(
        'SELECT COUNT(*)::int AS n FROM solicitudes_insumos WHERE proyecto_id = $1', [idProyecto]
    );
    const res = await api('POST', '/solicitudes', {
        id_proyecto: idProyecto,
        items: [{ sku, cantidad_solicitada: 50 }],
    }, tokenTecnicoA);
    assert.equal(res.status, 400);
    const despues = await pool.query<{ n: number }>(
        'SELECT COUNT(*)::int AS n FROM solicitudes_insumos WHERE proyecto_id = $1', [idProyecto]
    );
    assert.equal(despues.rows[0].n, antes.rows[0].n);
});

test('el técnico ve solo sus solicitudes, con su RUT y nombre; la administración ve todas', async () => {
    const propias = await api('GET', '/solicitudes', undefined, tokenTecnicoA);
    assert.equal(propias.status, 200);
    assert.ok(propias.json.length >= 1);
    assert.ok(propias.json.every((s: any) => s.id_usuario === idTecnicoA), 'solo solicitudes propias');
    assert.ok(propias.json[0].tecnico_rut, 'la solicitud debe llevar el RUT del solicitante');
    assert.equal(propias.json[0].tecnico_nombre, 'TecnicoA Solicitud');

    const otro = await api('GET', '/solicitudes', undefined, tokenTecnicoB);
    assert.equal(otro.json.some((s: any) => s.id_usuario === idTecnicoA), false, 'otro técnico no debe ver la solicitud');

    const admin = await api('GET', '/solicitudes', undefined, tokenAdmin);
    assert.ok(admin.json.some((s: any) => s.id_usuario === idTecnicoA));
});