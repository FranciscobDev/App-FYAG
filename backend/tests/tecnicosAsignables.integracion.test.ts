/**
 * Pruebas de integración: la lista de técnicos de "Asignación de técnicos" debe salir de la base de datos.
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
const CLAVE_ADMIN = 'AdminPrueba1';

let servidor: Server;
let baseUrl: string;
let tokenAdmin: string;
let idTecnicoActivo: number;
let idTecnicoInactivo: number;
const rutActivo = `${10000000 + Math.floor(Math.random() * 80000000)}-K`;

const api = async (metodo: string, ruta: string, token?: string): Promise<{ status: number; json: any }> => {
    const res = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};

before(async () => {
    await aplicarMigraciones();
    await pool.query(`INSERT INTO roles (nombre_rol, descripcion) VALUES
        ('Administrador', 'Acceso total'), ('Bodeguero', 'Bodega'), ('Tecnico', 'Técnico')
        ON CONFLICT (nombre_rol) DO NOTHING`);

    const hash = await bcrypt.hash(CLAVE_ADMIN, 10);
    await pool.query(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, id_rol, contrasena_hash, activo)
         VALUES ('Admin', 'Tec', $1, (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'), $2, TRUE)`,
        [`admin-tec-${SUFIJO}${DOMINIO}`, hash]
    );

    const activo = await pool.query<{ id_usuario: number }>(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, contrasena_hash, activo)
         VALUES ('Tecnico', 'Real', $1, $2, (SELECT id_rol FROM roles WHERE nombre_rol = 'Tecnico'), $3, TRUE)
         RETURNING id_usuario`,
        [`real-tec-${SUFIJO}${DOMINIO}`, rutActivo, hash]
    );
    idTecnicoActivo = activo.rows[0].id_usuario;

    const inactivo = await pool.query<{ id_usuario: number }>(
        `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, contrasena_hash, activo)
         VALUES ('Tecnico', 'Inactivo', $1, $2, (SELECT id_rol FROM roles WHERE nombre_rol = 'Tecnico'), $3, FALSE)
         RETURNING id_usuario`,
        [`inactivo-tec-${SUFIJO}${DOMINIO}`, `${20000000 + Math.floor(Math.random() * 70000000)}-K`, hash]
    );
    idTecnicoInactivo = inactivo.rows[0].id_usuario;

    await new Promise<void>((resolve) => {
        servidor = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

    const sesion = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo_usuario: `admin-tec-${SUFIJO}${DOMINIO}`, contrasena: CLAVE_ADMIN }),
    });
    tokenAdmin = (await sesion.json()).token;
    assert.ok(tokenAdmin, 'el administrador de prueba debe iniciar sesión');
});

after(async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await pool.end();
});

test('GET /proyectos/tecnicos devuelve técnicos reales activos con su RUT', async () => {
    const res = await api('GET', '/proyectos/tecnicos', tokenAdmin);
    assert.equal(res.status, 200);
    const real = res.json.find((t: any) => t.id_usuario === idTecnicoActivo);
    assert.ok(real, 'el técnico activo registrado en la base debe aparecer');
    assert.equal(real.nombre, 'Tecnico Real');
    assert.equal(real.rut, rutActivo, 'la lista debe incluir el RUT para identificar al técnico');
});

test('GET /proyectos/tecnicos excluye usuarios deshabilitados', async () => {
    const res = await api('GET', '/proyectos/tecnicos', tokenAdmin);
    assert.equal(res.json.some((t: any) => t.id_usuario === idTecnicoInactivo), false);
});
