/**
 * Pruebas de integración [BACK-2][SCRUM] del Cardex de solo lectura.
 * Requieren PostgreSQL accesible con las credenciales de backend/.env.
 * Usan datos con dominio @fyag.test y referencias TEST-CARDEX-* que se eliminan al terminar.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import pool from '../config/db';
import { app } from '../app';
import { aplicarMigraciones } from '../services/migraciones';

const SUFIJO = Date.now().toString(36);
const DOMINIO = '@fyag.test';
const CLAVE = 'AdminPrueba1';
const REF = `TEST-CARDEX-${SUFIJO}`;
const COLUMNAS = [
    'Fecha', 'Tipo', 'Destino', 'SKU', 'Insumo', 'Cantidad', 'Costo unitario',
    'Saldo histórico', 'PMP histórico', 'Valor total', 'Proyecto', 'Referencia',
];

let servidor: Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenTecnico: string;
let idProyecto: number;
const FECHA_DESDE = '2026-03-01';
const FECHA_HASTA = '2026-03-31';

const api = async (metodo: string, ruta: string, token?: string, cuerpo?: unknown) => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const contenido = res.headers.get('content-type') ?? '';
    const json = contenido.includes('application/json') ? await res.json() : {};
    return { status: res.status, type: contenido, json };
};

const descargarExcel = async (ruta: string, token: string) => {
    const res = await fetch(`${baseUrl}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, type: res.headers.get('content-type') ?? '', buf: Buffer.from(await res.arrayBuffer()) };
};

before(async () => {
    await aplicarMigraciones();

    idProyecto = (await pool.query<{ id_proyecto: number }>(
        'SELECT id_proyecto FROM proyecto ORDER BY id_proyecto LIMIT 1'
    )).rows[0].id_proyecto;

    const hashAdmin = await bcrypt.hash(CLAVE, 10);
    const admin = await pool.query<{ id_usuario: number }>(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
         VALUES ('Admin', 'Cardex', $1, (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'), $2, TRUE)
         RETURNING id_usuario`,
        [`admin-${SUFIJO}${DOMINIO}`, hashAdmin]
    );
    const idAdmin = admin.rows[0].id_usuario;

    // Movimientos controlados: dos con proyecto (una Salida y una Entrada) y uno sin proyecto
    const insertar = (ref: string, tipo: string, destino: string, proyecto: number | null) =>
        pool.query(
            `INSERT INTO movimientos_inventario (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario,
                 saldo_historico, pmp_historico, valor_total_historico, referencia, id_usuario, id_proyecto, fecha_movimiento)
             VALUES (1, $1, $2, 12.350, 610, 950.500, 610, 579805, $3, $4, $5, '2026-03-10T12:00:00Z')`,
            [tipo, destino, ref, idAdmin, proyecto]
        );
    await insertar(`${REF}-A`, 'Salida', 'comprometido', idProyecto);
    await insertar(`${REF}-B`, 'Entrada', 'disponible', idProyecto);
    await insertar(`${REF}-C`, 'Salida', 'comprometido', null);

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    const loginAdmin = await api('POST', '/auth/login', undefined, {
        correo_usuario: `admin-${SUFIJO}${DOMINIO}`, contrasena: CLAVE,
    });
    assert.equal(loginAdmin.status, 200, 'el administrador de prueba debe iniciar sesión');
    tokenAdmin = loginAdmin.json.token;

    const creado = await api('POST', '/usuarios', tokenAdmin, {
        nombre_usuario: 'Tecnico', apellido_usuario: 'Cardex',
        correo_usuario: `tecnico-${SUFIJO}${DOMINIO}`, rol_codigo: 'technician', contrasena: CLAVE,
    });
    assert.equal(creado.status, 201, 'debe crearse el técnico de prueba');
    const loginTecnico = await api('POST', '/auth/login', undefined, {
        correo_usuario: `tecnico-${SUFIJO}${DOMINIO}`, contrasena: CLAVE,
    });
    tokenTecnico = loginTecnico.json.token;
});

after(async () => {
    await pool.query(`DELETE FROM movimientos_inventario WHERE referencia LIKE 'TEST-CARDEX-%'`).catch(() => undefined);
    await pool.query(`DELETE FROM usuario WHERE correo_usuario LIKE '%${DOMINIO}'`).catch(() => undefined);
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

test('[BACK-2] el técnico recibe 403 al consultar el Cardex y al descargar el Excel', async () => {
    const json = await api('GET', '/cardex', tokenTecnico);
    assert.equal(json.status, 403, 'el técnico no puede leer el Cardex');

    const excel = await descargarExcel('/cardex?formato=xlsx', tokenTecnico);
    assert.equal(excel.status, 403, 'el técnico no puede descargar el Excel');
});

test('[BACK-2] filtros combinables en JSON: proyecto, tipo y rango de fechas', async () => {
    const res = await api(
        'GET',
        `/cardex?id_proyecto=${idProyecto}&tipo_movimiento=Salida&fecha_desde=${FECHA_DESDE}&fecha_hasta=${FECHA_HASTA}`,
        tokenAdmin
    );
    assert.equal(res.status, 200);
    const refs = res.json.movimientos.map((m: { referencia: string }) => m.referencia);
    assert.ok(refs.includes(`${REF}-A`), 'incluye la salida del proyecto dentro del rango');
    assert.ok(!refs.includes(`${REF}-B`), 'excluye la entrada (tipo distinto)');
    assert.ok(!refs.includes(`${REF}-C`), 'excluye la salida sin proyecto');
    for (const m of res.json.movimientos) {
        assert.equal(m.id_proyecto, idProyecto, 'todas las filas pertenecen al proyecto filtrado');
        assert.equal(m.tipo_movimiento, 'Salida', 'todas las filas son del tipo filtrado');
    }
});

test('[BACK-2] rechaza filtros inválidos con 400', async () => {
    assert.equal((await api('GET', '/cardex?fecha_desde=10-03-2026', tokenAdmin)).status, 400);
    assert.equal((await api('GET', '/cardex?tipo_movimiento=Venta', tokenAdmin)).status, 400);
    assert.equal((await api('GET', '/cardex?id_proyecto=abc', tokenAdmin)).status, 400);
});

test('[SCRUM] filtra por proyecto y fecha, descarga el Excel y comprueba las columnas', async () => {
    const excel = await descargarExcel(
        `/cardex?id_proyecto=${idProyecto}&fecha_desde=${FECHA_DESDE}&fecha_hasta=${FECHA_HASTA}&formato=xlsx`,
        tokenAdmin
    );
    assert.equal(excel.status, 200);
    assert.ok(excel.type.includes('spreadsheetml'), 'el archivo es un .xlsx');

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(excel.buf as any);
    const hoja = libro.getWorksheet('Cardex');
    assert.ok(hoja, 'la hoja se llama Cardex');

    const encabezados = (hoja.getRow(1).values as unknown[]).slice(1);
    assert.deepEqual(encabezados, COLUMNAS, 'las columnas coinciden con el formato del Cardex');

    const filas: Record<string, unknown>[] = [];
    hoja.eachRow((fila, numero) => {
        if (numero === 1) return;
        const obj: Record<string, unknown> = {};
        COLUMNAS.forEach((nombre, i) => { obj[nombre] = fila.getCell(i + 1).value; });
        filas.push(obj);
    });

    const referencias = filas.map((f) => f['Referencia']);
    assert.ok(referencias.includes(`${REF}-A`), 'el Excel incluye el movimiento del proyecto');
    assert.ok(referencias.includes(`${REF}-B`), 'el Excel incluye la entrada del proyecto');
    assert.ok(!referencias.includes(`${REF}-C`), 'el Excel excluye el movimiento sin proyecto');

    for (const f of filas) {
        assert.equal(f['Proyecto'], idProyecto, 'cada fila del Excel respeta el filtro de proyecto');
        assert.ok(f['Fecha'] instanceof Date, 'la fecha se guarda como fecha de Excel');
        const dia = (f['Fecha'] as Date).toISOString().slice(0, 10);
        assert.ok(dia >= FECHA_DESDE && dia <= FECHA_HASTA, `la fecha ${dia} está dentro del rango`);
    }
});
