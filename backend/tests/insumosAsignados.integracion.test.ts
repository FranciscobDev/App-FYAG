/**
 * Pruebas de integración: el técnico debe ver TODOS los insumos planificados de sus proyectos,
 * aunque todavía no existan solicitudes ni despachos.
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
const CLAVE = 'ClaveInsumos2026';

let servidor: Server;
let baseUrl: string;
let tokenAdmin: string;
let tokenAsignado: string;
let tokenNoAsignado: string;
let idProyecto: number;
let idProyectoAjeno: number;
let idArticulo: number;
let idArticuloOtroProyecto: number;

const api = async (metodo: string, ruta: string, token?: string) => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};

const login = async (correo: string): Promise<string> => {
    const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo_usuario: correo, contrasena: CLAVE }),
    });
    const json = await res.json();
    assert.ok(json.token, `debe iniciar sesión ${correo}`);
    return json.token;
};

before(async () => {
    await aplicarMigraciones();
    await pool.query(`INSERT INTO roles (nombre_rol, descripcion) VALUES
        ('Administrador', 'Acceso total'), ('Bodeguero', 'Bodega'), ('Tecnico', 'Técnico')
        ON CONFLICT (nombre_rol) DO NOTHING`);

    const hash = await bcrypt.hash(CLAVE, 10);
    const crearUsuario = async (nombre: string, rol: string): Promise<number> => {
        const r = await pool.query<{ id_usuario: number }>(
            `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
             VALUES ($1, 'Insumos', $2, (SELECT id_rol FROM roles WHERE nombre_rol = $3), $4, TRUE)
             RETURNING id_usuario`,
            [nombre, `${nombre.toLowerCase()}-ins-${SUFIJO}${DOMINIO}`, rol, hash]
        );
        return r.rows[0].id_usuario;
    };
    await crearUsuario('Admin', 'Administrador');
    const idAsignado = await crearUsuario('Asignado', 'Tecnico');
    await crearUsuario('NoAsignado', 'Tecnico');

    const proy = async (nombre: string) =>
        (await pool.query<{ id_proyecto: number }>(
            `INSERT INTO proyecto (codigo_proyecto, nombre_proyecto, estado_proyecto)
             VALUES ($1, $2, 'En Proceso') RETURNING id_proyecto`,
            [`INS-${nombre}-${SUFIJO}`, `${nombre} ${SUFIJO}`]
        )).rows[0].id_proyecto;
    idProyecto = await proy('Propio');
    idProyectoAjeno = await proy('Ajeno');

    const art = async (nombre: string) =>
        (await pool.query<{ id_insumo: number }>(
            `INSERT INTO insumos (sku, nombre) VALUES ($1, $2) RETURNING id_insumo`,
            [`INS-${nombre}-${SUFIJO}`.toUpperCase(), `${nombre} ${SUFIJO}`]
        )).rows[0].id_insumo;
    idArticulo = await art('Cable');
    idArticuloOtroProyecto = await art('Tubo');

    // Insumos planificados: sin solicitudes ni despachos
    await pool.query(
        `INSERT INTO articulo_en_proyecto (id_proyecto, id_articulo, cantidad) VALUES ($1, $2, 25)`,
        [idProyecto, idArticulo]
    );
    await pool.query(
        `INSERT INTO articulo_en_proyecto (id_proyecto, id_articulo, cantidad) VALUES ($1, $2, 4)`,
        [idProyectoAjeno, idArticuloOtroProyecto]
    );

    await pool.query(
        `INSERT INTO asignaciones_proyecto (proyecto_id, tecnico_id, activo) VALUES ($1, $2, TRUE)`,
        [idProyecto, idAsignado]
    );

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    tokenAdmin = await login(`admin-ins-${SUFIJO}${DOMINIO}`);
});

after(async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

test('el técnico asignado ve los insumos planificados de su proyecto sin necesidad de solicitudes', async () => {
    tokenAsignado = await login(`asignado-ins-${SUFIJO}${DOMINIO}`);
    const res = await api('GET', '/proyectos/insumos-asignados', tokenAsignado);
    assert.equal(res.status, 200);
    const fila = res.json.find((r: any) => r.id_articulo === idArticulo && r.id_proyecto === idProyecto);
    assert.ok(fila, 'el insumo planificado debe aparecer aunque no tenga solicitudes');
    assert.equal(fila.cantidad_asignada, 25);
    assert.equal(fila.sku, `INS-CABLE-${SUFIJO}`.toUpperCase());
    assert.equal(res.json.some((r: any) => r.id_proyecto === idProyectoAjeno), false, 'no debe ver proyectos ajenos');
});

test('un técnico sin asignaciones no recibe insumos de proyectos ajenos', async () => {
    tokenNoAsignado = await login(`noasignado-ins-${SUFIJO}${DOMINIO}`);
    const res = await api('GET', '/proyectos/insumos-asignados', tokenNoAsignado);
    assert.equal(res.status, 200);
    assert.equal(res.json.some((r: any) => r.id_proyecto === idProyecto), false);
});

test('el administrador ve los insumos de todos los proyectos', async () => {
    const res = await api('GET', '/proyectos/insumos-asignados', tokenAdmin);
    assert.equal(res.status, 200);
    assert.ok(res.json.some((r: any) => r.id_proyecto === idProyecto));
    assert.ok(res.json.some((r: any) => r.id_proyecto === idProyectoAjeno));
});
