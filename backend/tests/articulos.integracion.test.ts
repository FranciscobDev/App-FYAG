/**
 * Pruebas de integración del catálogo de artículos con stock (Fase 1 de inventario).
 * Requieren PostgreSQL con las credenciales de backend/.env. Limpian sus datos al terminar.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { app } from '../app';
import { aplicarMigraciones } from '../services/migraciones';

const SUFIJO = Date.now().toString(36);
const DOMINIO = '@fyag.test';
const CLAVE = 'ClaveArticulos1';
const SKU = `ART-${SUFIJO}`.toUpperCase();

let servidor: Server;
let baseUrl: string;
const tokens: Record<string, string> = {};
let idArticulo: number;

const api = async (metodo: string, ruta: string, cuerpo?: unknown, token?: string) => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) as any };
};

before(async () => {
    await aplicarMigraciones();
    await pool.query(`INSERT INTO roles (nombre_rol, descripcion) VALUES
        ('Administrador','Admin'),('Bodeguero','Bodega'),('Tecnico','Técnico')
        ON CONFLICT (nombre_rol) DO NOTHING`);

    const hash = await bcrypt.hash(CLAVE, 10);
    for (const [clave, rol] of [['admin', 'Administrador'], ['bodega', 'Bodeguero'], ['tecnico', 'Tecnico']] as const) {
        await pool.query(
            `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
             VALUES ('Art', $1, $2, (SELECT id_rol FROM roles WHERE nombre_rol = $3), $4, TRUE)`,
            [clave, `${clave}-art-${SUFIJO}${DOMINIO}`, rol, hash]
        );
    }

    await new Promise<void>((resolve) => { servidor = app.listen(0, '127.0.0.1', () => resolve()); });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    for (const clave of ['admin', 'bodega', 'tecnico']) {
        const login = await api('POST', '/auth/login', { correo_usuario: `${clave}-art-${SUFIJO}${DOMINIO}`, contrasena: CLAVE });
        assert.equal(login.status, 200, `login de ${clave}`);
        tokens[clave] = login.json.token;
    }
});

after(async () => {
    await pool.query(`DELETE FROM articulo WHERE sku = $1`, [SKU]);
    await pool.query(`DELETE FROM usuario WHERE correo_usuario LIKE '%-art-${SUFIJO}${DOMINIO}'`);
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

test('[INV-1] el técnico puede leer el catálogo pero no modificarlo', async () => {
    const lectura = await api('GET', '/articulos', undefined, tokens.tecnico);
    assert.equal(lectura.status, 200);
    const escritura = await api('POST', '/articulos', { nombre_articulo: 'X', categoria: 'Equipos' }, tokens.tecnico);
    assert.equal(escritura.status, 403);
});

test('[INV-1] crear un artículo guarda su stock inicial, ubicación y categoría fija', async () => {
    const creado = await api('POST', '/articulos', {
        nombre_articulo: 'Cable THHN 12 AWG', sku: SKU, precio_unitario: 1200, categoria: 'Materiales',
        stock: 150, stock_minimo: 20, ubicacion: 'Estante B2',
    }, tokens.bodega);
    assert.equal(creado.status, 201);
    idArticulo = creado.json.articulo.id_articulo;
    assert.equal(creado.json.articulo.cantidad_disponible, 150);

    const lista = await api('GET', '/articulos', undefined, tokens.admin);
    const fila = lista.json.find((a: { sku: string }) => a.sku === SKU);
    assert.ok(fila, 'el artículo debe aparecer en el listado');
    assert.equal(typeof fila.cantidad_disponible, 'number', 'el stock llega como número, no como texto');
    assert.equal(fila.stock_minimo, 20);
    assert.equal(fila.ubicacion, 'Estante B2');
});

test('[INV-1] rechaza categorías fuera de las 5 fijas y stock negativo', async () => {
    const catInvalida = await api('POST', '/articulos', { nombre_articulo: 'Y', categoria: 'Eléctrica' }, tokens.admin);
    assert.equal(catInvalida.status, 400);
    const stockNeg = await api('PUT', `/articulos/${idArticulo}`, { stock: -5 }, tokens.admin);
    assert.equal(stockNeg.status, 400);
});

test('[INV-1] editar solo el nombre conserva el SKU, el stock y la ubicación', async () => {
    const r = await api('PUT', `/articulos/${idArticulo}`, { nombre_articulo: 'Cable THHN 12 AWG rojo' }, tokens.bodega);
    assert.equal(r.status, 200);
    assert.equal(r.json.articulo.sku, SKU, 'el SKU no debe borrarse');
    assert.equal(r.json.articulo.cantidad_disponible, 150, 'el stock no debe borrarse');
    assert.equal(r.json.articulo.ubicacion, 'Estante B2');
});

test('[INV-1] actualizar el stock y deshabilitar el artículo quedan auditados', async () => {
    const stock = await api('PUT', `/articulos/${idArticulo}`, { stock: 140 }, tokens.bodega);
    assert.equal(stock.json.articulo.cantidad_disponible, 140);

    const deshabilitar = await api('PUT', `/articulos/${idArticulo}`, { activo: false }, tokens.admin);
    assert.equal(deshabilitar.json.articulo.activo, false);

    const registro = await pool.query(
        `SELECT accion, valor_anterior, valor_nuevo FROM bitacora_auditoria
         WHERE entidad = 'articulo' AND id_registro_afectado = $1 AND accion = 'deshabilitar'
         ORDER BY id_bitacora DESC LIMIT 1`,
        [idArticulo]
    );
    assert.equal(registro.rows.length, 1);
    assert.equal(JSON.parse(registro.rows[0].valor_anterior).activo, true);
    assert.equal(JSON.parse(registro.rows[0].valor_nuevo).activo, false);
});

test('[INV-1] eliminar un artículo borra también su stock y queda auditado', async () => {
    const r = await api('DELETE', `/articulos/${idArticulo}`, undefined, tokens.admin);
    assert.equal(r.status, 200);
    const stock = await pool.query('SELECT COUNT(*)::int AS n FROM articulos_stock WHERE id_articulo = $1', [idArticulo]);
    assert.equal(stock.rows[0].n, 0);
    const audit = await pool.query(
        `SELECT COUNT(*)::int AS n FROM bitacora_auditoria WHERE entidad = 'articulo' AND accion = 'eliminar' AND id_registro_afectado = $1`,
        [idArticulo]
    );
    assert.equal(audit.rows[0].n, 1);
});
