/**
 * Pruebas de integración [BACK-2][SCRUM] de mermas.
 * Requieren PostgreSQL con las credenciales de backend/.env.
 * Usan usuarios @fyag.test y, para el stock, un artículo existente que se restaura al terminar.
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
const CLAVE = 'AdminPrueba1';
const MARCA = `TEST-MERMA-${SUFIJO}`;

let servidor: Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenBodeguero: string;
let tokenTecnico: string;
let idArticulo: number;
let stockOriginal: { cantidad_disponible: string; pmp: string };
let inicio: Date;

const api = async (metodo: string, ruta: string, token?: string, cuerpo?: unknown) => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
};

const stockActual = async () =>
    (await pool.query<{ d: string }>(
        'SELECT cantidad_disponible::text AS d FROM articulos_stock WHERE id_articulo = $1', [idArticulo]
    )).rows[0].d;

const crearUsuario = async (rol: string, prefijo: string): Promise<string> => {
    const correo = `${prefijo}-${SUFIJO}${DOMINIO}`;
    const hash = await bcrypt.hash(CLAVE, 10);
    if (rol === 'admin') {
        await pool.query(
            `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
             VALUES ('Admin', 'Mermas', $1, (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'), $2, TRUE)`,
            [correo, hash]
        );
    } else {
        const creado = await api('POST', '/usuarios', tokenAdmin, {
            nombre_usuario: prefijo, apellido_usuario: 'Mermas', correo_usuario: correo,
            rol_codigo: rol, contrasena: CLAVE,
        });
        assert.equal(creado.status, 201, `debe crearse el usuario ${prefijo}`);
    }
    return (await api('POST', '/auth/login', undefined, { correo_usuario: correo, contrasena: CLAVE })).json.token;
};

before(async () => {
    await aplicarMigraciones();
    inicio = new Date();

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    await pool.query(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
         VALUES ('Admin', 'Mermas', $1, (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'), $2, TRUE)
         ON CONFLICT DO NOTHING`,
        [`admin-${SUFIJO}${DOMINIO}`, await bcrypt.hash(CLAVE, 10)]
    );
    tokenAdmin = (await api('POST', '/auth/login', undefined, {
        correo_usuario: `admin-${SUFIJO}${DOMINIO}`, contrasena: CLAVE,
    })).json.token;
    tokenBodeguero = await crearUsuario('warehouse', 'bodeguero');
    tokenTecnico = await crearUsuario('technician', 'tecnico');

    idArticulo = (await pool.query<{ id_articulo: number }>(
        'SELECT id_articulo FROM articulos_stock ORDER BY id_articulo LIMIT 1'
    )).rows[0].id_articulo;
    stockOriginal = (await pool.query<{ cantidad_disponible: string; pmp: string }>(
        'SELECT cantidad_disponible::text, pmp::text FROM articulos_stock WHERE id_articulo = $1', [idArticulo]
    )).rows[0];

    // Escenario controlado: 100 unidades disponibles a PMP 610
    await pool.query(
        'UPDATE articulos_stock SET cantidad_disponible = 100.000, pmp = 610.00 WHERE id_articulo = $1', [idArticulo]
    );
});

after(async () => {
    await pool.query(
        'UPDATE articulos_stock SET cantidad_disponible = $2, pmp = $3 WHERE id_articulo = $1',
        [idArticulo, stockOriginal.cantidad_disponible, stockOriginal.pmp]
    ).catch(() => undefined);
    await pool.query(
        `DELETE FROM movimientos_inventario WHERE id_insumo = $1 AND destino_bolsa = 'merma' AND fecha_movimiento >= $2`,
        [idArticulo, inicio]
    ).catch(() => undefined);
    await pool.query(
        `DELETE FROM mermas WHERE id_insumo = $1 AND fecha_merma >= CURRENT_DATE - 1 AND id_usuario IN
           (SELECT id_usuario FROM usuario WHERE correo_usuario LIKE '%${DOMINIO}')`,
        [idArticulo]
    ).catch(() => undefined);
    await pool.query(
        `DELETE FROM alertas_sistema WHERE tipo = 'merma_registrada' AND id_articulo = $1 AND fecha_creacion >= $2`,
        [idArticulo, inicio]
    ).catch(() => undefined);
    await pool.query(`DELETE FROM usuario WHERE correo_usuario LIKE '%${DOMINIO}'`).catch(() => undefined);
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

test('[SCRUM] merma por daño: descuenta stock, registra la salida en Cardex y alerta al Administrador', async () => {
    const res = await api('POST', '/mermas', tokenBodeguero, {
        id_articulo: idArticulo, cantidad_baja: '12.350', motivo: 'dano', observacion: `${MARCA} caja aplastada`,
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));

    // Pérdida exacta: 12.350 × 610 = 7533.50
    assert.equal(res.json.perdida_valor_total, '7533.50');
    assert.equal(res.json.stock_disponible_nuevo, '87.650');
    assert.equal(await stockActual(), '87.650', 'el stock disponible se descuenta');

    const cardex = await pool.query(
        `SELECT tipo_movimiento::text AS tipo, destino_bolsa, cantidad::text AS cantidad, referencia
         FROM movimientos_inventario
         WHERE id_insumo = $1 AND destino_bolsa = 'merma' AND fecha_movimiento >= $2`,
        [idArticulo, inicio]
    );
    assert.equal(cardex.rows.length, 1, 'hay una línea de merma en el Cardex');
    assert.equal(cardex.rows[0].tipo, 'Salida');
    assert.equal(cardex.rows[0].cantidad, '12.350');
    assert.match(cardex.rows[0].referencia, /Merma #\d+ - dano/);

    const alerta = await pool.query(
        `SELECT tipo, severidad, titulo, leida FROM alertas_sistema
         WHERE tipo = 'merma_registrada' AND id_articulo = $1 AND fecha_creacion >= $2`,
        [idArticulo, inicio]
    );
    assert.equal(alerta.rows.length, 1, 'el Administrador recibe una alerta');
    assert.equal(alerta.rows[0].leida, false);
});

test('[BACK-2] impide mermas mayores al stock disponible sin cambiar nada', async () => {
    const mermasAntes = (await pool.query(
        'SELECT COUNT(*)::int AS n FROM mermas WHERE id_insumo = $1', [idArticulo]
    )).rows[0].n;
    const stockAntes = await stockActual();

    const res = await api('POST', '/mermas', tokenBodeguero, {
        id_articulo: idArticulo, cantidad_baja: '200', motivo: 'vencimiento',
    });
    assert.equal(res.status, 400);
    assert.match(res.json.mensaje, /supera el stock disponible/);

    assert.equal(await stockActual(), stockAntes, 'el stock no cambia');
    assert.equal((await pool.query(
        'SELECT COUNT(*)::int AS n FROM mermas WHERE id_insumo = $1', [idArticulo]
    )).rows[0].n, mermasAntes, 'no se registra la merma');
});

test('[BACK-2] valida cantidad y motivo', async () => {
    assert.equal((await api('POST', '/mermas', tokenBodeguero, {
        id_articulo: idArticulo, cantidad_baja: '0.0005', motivo: 'dano',
    })).status, 400);
    assert.equal((await api('POST', '/mermas', tokenBodeguero, {
        id_articulo: idArticulo, cantidad_baja: '1', motivo: 'robo_inventado',
    })).status, 400);
});

test('[BACK-2] el técnico no puede registrar mermas; el Administrador sí', async () => {
    const body = { id_articulo: idArticulo, cantidad_baja: '1.000', motivo: 'extravio' };
    assert.equal((await api('POST', '/mermas', tokenTecnico, body)).status, 403);
    assert.equal((await api('POST', '/mermas', tokenAdmin, body)).status, 201);
});
