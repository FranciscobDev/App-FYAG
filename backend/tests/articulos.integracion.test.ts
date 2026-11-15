/**
 * Pruebas de integración del catálogo de artículos/insumos con stock.
 * Incluye los casos [SCRUM] de la tarea de insumos:
 *   - Creación, edición y deshabilitación lógica
 *   - Auditoría granular de campos críticos (stock_minimo, id_unidad, id_proveedor)
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
const SKU2 = `INS-${SUFIJO}`.toUpperCase();

let servidor: Server;
let baseUrl: string;
const tokens: Record<string, string> = {};
let idArticulo: number;
let idInsumo: number;

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

    // Asegurar unidades de medida de prueba
    await pool.query(`INSERT INTO unidad_de_medida (tipo_unidad, descripcion) VALUES
        ('Metro', 'Metro lineal'), ('Unidad', 'Unidad individual')
        ON CONFLICT DO NOTHING`);

    // Asegurar proveedor de prueba
    await pool.query(`INSERT INTO proveedor (nombre_proveedor, rut_proveedor, activo) VALUES
        ('Proveedor Test A', '11111111-1', TRUE), ('Proveedor Test B', '22222222-2', TRUE)
        ON CONFLICT (rut_proveedor) DO NOTHING`);

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
    await pool.query(`DELETE FROM articulo WHERE sku IN ($1, $2)`, [SKU, SKU2]);
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
         WHERE entidad = 'insumo' AND id_registro_afectado = $1 AND accion = 'deshabilitar'
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

// ---------------------------------------------------------------------------
// [SCRUM] Insumos — Creación, edición con auditoría de campos críticos, deshabilitación lógica
// ---------------------------------------------------------------------------

test('[SCRUM] crear un insumo con unidad de medida y proveedor predeterminado', async () => {
    const unidades = await pool.query<{ id_unidad: number }>("SELECT id_unidad FROM unidad_de_medida WHERE tipo_unidad = 'Metro' LIMIT 1");
    const proveedores = await pool.query<{ id_proveedor: number }>("SELECT id_proveedor FROM proveedor WHERE rut_proveedor = '11111111-1' LIMIT 1");

    const creado = await api('POST', '/articulos', {
        nombre_articulo: 'Tubo PVC 110mm',
        sku: SKU2,
        precio_unitario: 5000,
        categoria: 'Materiales',
        id_unidad: unidades.rows[0].id_unidad,
        id_proveedor: proveedores.rows[0].id_proveedor,
        stock: 100,
        stock_minimo: 10,
        ubicacion: 'Pasillo C3',
    }, tokens.bodega);
    assert.equal(creado.status, 201);
    idInsumo = creado.json.articulo.id_articulo;
    assert.equal(creado.json.articulo.id_unidad, unidades.rows[0].id_unidad);
    assert.equal(creado.json.articulo.id_proveedor, proveedores.rows[0].id_proveedor);
    assert.equal(creado.json.articulo.stock_minimo, 10);

    // Verificar que la creación quedó auditada
    const audit = await pool.query(
        `SELECT accion, valor_nuevo FROM bitacora_auditoria
         WHERE entidad = 'insumo' AND id_registro_afectado = $1 AND accion = 'crear'
         ORDER BY id_bitacora DESC LIMIT 1`,
        [idInsumo]
    );
    assert.equal(audit.rows.length, 1);
    const estadoNuevo = JSON.parse(audit.rows[0].valor_nuevo);
    assert.equal(estadoNuevo.nombre_articulo, 'Tubo PVC 110mm');
});

test('[SCRUM] edita el stock mínimo de un insumo y verifica la fila en auditoría', async () => {
    // Cambiar stock_minimo de 10 a 25
    const edicion = await api('PUT', `/articulos/${idInsumo}`, { stock_minimo: 25 }, tokens.bodega);
    assert.equal(edicion.status, 200);
    assert.equal(edicion.json.articulo.stock_minimo, 25);

    // Buscar el registro de auditoría granular (campo crítico)
    const registro = await pool.query(
        `SELECT accion, valor_anterior, valor_nuevo, descripcion FROM bitacora_auditoria
         WHERE entidad = 'insumo' AND id_registro_afectado = $1 AND accion = 'editar_campo_critico'
         ORDER BY id_bitacora DESC LIMIT 1`,
        [idInsumo]
    );
    assert.equal(registro.rows.length, 1, 'debe existir un registro de auditoría para el campo crítico stock_minimo');
    assert.equal(registro.rows[0].accion, 'editar_campo_critico');

    const anterior = JSON.parse(registro.rows[0].valor_anterior);
    const nuevo = JSON.parse(registro.rows[0].valor_nuevo);
    assert.equal(anterior.stock_minimo, 10, 'el valor anterior debe ser 10');
    assert.equal(nuevo.stock_minimo, 25, 'el valor nuevo debe ser 25');
    assert.ok(registro.rows[0].descripcion.includes('stock mínimo'), 'la descripción debe mencionar el campo');
});

test('[SCRUM] cambiar la unidad de medida genera auditoría de campo crítico', async () => {
    const nuevaUnidad = await pool.query<{ id_unidad: number }>("SELECT id_unidad FROM unidad_de_medida WHERE tipo_unidad = 'Unidad' LIMIT 1");
    const idNuevaUnidad = nuevaUnidad.rows[0].id_unidad;

    const edicion = await api('PUT', `/articulos/${idInsumo}`, { id_unidad: idNuevaUnidad }, tokens.bodega);
    assert.equal(edicion.status, 200);
    assert.equal(edicion.json.articulo.id_unidad, idNuevaUnidad);

    const registro = await pool.query(
        `SELECT valor_anterior, valor_nuevo, descripcion FROM bitacora_auditoria
         WHERE entidad = 'insumo' AND id_registro_afectado = $1 AND accion = 'editar_campo_critico'
           AND valor_nuevo LIKE '%id_unidad%'
         ORDER BY id_bitacora DESC LIMIT 1`,
        [idInsumo]
    );
    assert.equal(registro.rows.length, 1, 'debe haber auditoría del cambio de unidad de medida');
    assert.ok(registro.rows[0].descripcion.includes('unidad de medida'));
});

test('[SCRUM] cambiar el proveedor predeterminado genera auditoría de campo crítico', async () => {
    const nuevoProveedor = await pool.query<{ id_proveedor: number }>("SELECT id_proveedor FROM proveedor WHERE rut_proveedor = '22222222-2' LIMIT 1");
    const idNuevoProveedor = nuevoProveedor.rows[0].id_proveedor;

    const edicion = await api('PUT', `/articulos/${idInsumo}`, { id_proveedor: idNuevoProveedor }, tokens.bodega);
    assert.equal(edicion.status, 200);
    assert.equal(edicion.json.articulo.id_proveedor, idNuevoProveedor);

    const registro = await pool.query(
        `SELECT valor_anterior, valor_nuevo, descripcion FROM bitacora_auditoria
         WHERE entidad = 'insumo' AND id_registro_afectado = $1 AND accion = 'editar_campo_critico'
           AND valor_nuevo LIKE '%id_proveedor%'
         ORDER BY id_bitacora DESC LIMIT 1`,
        [idInsumo]
    );
    assert.equal(registro.rows.length, 1, 'debe haber auditoría del cambio de proveedor');
    assert.ok(registro.rows[0].descripcion.includes('proveedor predeterminado'));
});

test('[SCRUM] deshabilitar un insumo con PATCH /:id/deshabilitar y verificar auditoría', async () => {
    const r = await api('PATCH', `/articulos/${idInsumo}/deshabilitar`, undefined, tokens.admin);
    assert.equal(r.status, 200);
    assert.equal(r.json.articulo.activo, false, 'el insumo debe quedar inactivo');

    // El artículo sigue existiendo en la base de datos (solo deshabilitado)
    const existe = await pool.query('SELECT activo FROM articulo WHERE id_articulo = $1', [idInsumo]);
    assert.equal(existe.rows.length, 1, 'el artículo NO debe borrarse');
    assert.equal(existe.rows[0].activo, false);

    // Su stock también debe seguir intacto
    const stock = await pool.query('SELECT COUNT(*)::int AS n FROM articulos_stock WHERE id_articulo = $1', [idInsumo]);
    assert.equal(stock.rows[0].n, 1, 'el stock no debe eliminarse al deshabilitar');

    const registro = await pool.query(
        `SELECT accion, valor_anterior, valor_nuevo, descripcion FROM bitacora_auditoria
         WHERE entidad = 'insumo' AND id_registro_afectado = $1 AND accion = 'deshabilitar'
         ORDER BY id_bitacora DESC LIMIT 1`,
        [idInsumo]
    );
    assert.equal(registro.rows.length, 1);
    assert.equal(JSON.parse(registro.rows[0].valor_anterior).activo, true);
    assert.equal(JSON.parse(registro.rows[0].valor_nuevo).activo, false);
    assert.ok(registro.rows[0].descripcion.includes('deshabilitado'));
});

test('[SCRUM] deshabilitar un insumo ya deshabilitado devuelve error 400', async () => {
    const r = await api('PATCH', `/articulos/${idInsumo}/deshabilitar`, undefined, tokens.admin);
    assert.equal(r.status, 400, 'no se puede deshabilitar dos veces');
});
