import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Request, Response } from 'express';
import pool from '../config/db';
import {
    anonimizarUsuario,
    construirCsvDatosPersonales,
    DatosPersonalesUsuario,
    exportarDatosPersonalesUsuario,
} from '../controllers/usuarioController';

const consultaOriginal = pool.query;
const conexionOriginal = pool.connect;

afterEach(() => {
    pool.query = consultaOriginal;
    pool.connect = conexionOriginal;
});

const crearCapturaRespuesta = () => {
    let statusCode = 0;
    let cuerpo: unknown;
    const headers = new Map<string, string>();
    const respuesta = {
        status: (codigo: number) => { statusCode = codigo; return respuesta; },
        json: (contenido: unknown) => { cuerpo = contenido; return respuesta; },
        send: (contenido: unknown) => { cuerpo = contenido; return respuesta; },
        setHeader: (clave: string, valor: string) => { headers.set(clave, valor); return respuesta; },
    } as unknown as Response;

    return {
        respuesta,
        estado: () => statusCode,
        cuerpo: () => cuerpo,
        header: (clave: string) => headers.get(clave),
    };
};

const datosUsuario: DatosPersonalesUsuario = {
    id_usuario: 77,
    nombre_usuario: 'Ana',
    apellido_usuario: 'Pérez',
    correo_usuario: 'ana.perez@fyag.cl',
    rut: '12.345.678-5',
    id_rol: 3,
    nombre_rol: 'Tecnico',
    especializacion: 'Electricidad',
    activo: true,
    ultimo_acceso: null,
    fecha_creacion: '2026-01-10',
};

test('[SCRUM] exporta los datos personales en JSON y CSV', async () => {
    pool.query = (async (sql: string) => {
        if (sql.includes('FROM usuario u')) return { rows: [datosUsuario] };
        if (sql.includes('INSERT INTO bitacora_auditoria')) return { rows: [] };
        return { rows: [] };
    }) as unknown as typeof pool.query;

    const json = crearCapturaRespuesta();
    await exportarDatosPersonalesUsuario(
        { params: { id: '77', formato: 'json' }, query: {}, usuario: { id: 1, rol: 'Administrador' } } as unknown as Request<{ id: string; formato?: string }, unknown, unknown>,
        json.respuesta
    );
    assert.equal(json.estado(), 200);
    assert.equal(JSON.parse(String(json.cuerpo())).rut, '12.345.678-5');
    assert.match(json.header('Content-Disposition') ?? '', /usuario-77-datos\.json/);

    const csv = crearCapturaRespuesta();
    await exportarDatosPersonalesUsuario(
        { params: { id: '77', formato: 'csv' }, query: {}, usuario: { id: 1, rol: 'Administrador' } } as unknown as Request<{ id: string; formato?: string }, unknown, unknown>,
        csv.respuesta
    );
    assert.equal(csv.estado(), 200);
    assert.match(String(csv.cuerpo()), /id_usuario,nombre_usuario,apellido_usuario/);
    assert.match(String(csv.cuerpo()), /Ana,Pérez,ana\.perez@fyag\.cl/);
    assert.match(csv.header('Content-Disposition') ?? '', /usuario-77-datos\.csv/);
});

test('[SCRUM] anonimiza, deshabilita, revoca sesiones y registra solicitud y ejecución', async () => {
    const auditoria: unknown[][] = [];
    const actualizaciones: unknown[][] = [];

    pool.connect = (async () => ({
        query: async (sql: string, params: unknown[] = []) => {
            const limpia = sql.replace(/\s+/g, ' ').trim();
            if (limpia === 'BEGIN' || limpia === 'COMMIT' || limpia === 'ROLLBACK') return { rows: [], rowCount: 0 };
            if (limpia.includes('CONSULTA_DATOS_PERSONALES') || limpia.includes('FROM usuario u')) {
                return { rows: [datosUsuario] };
            }
            if (limpia.startsWith('UPDATE usuario')) {
                actualizaciones.push(params);
                return { rows: [], rowCount: 1 };
            }
            if (limpia.startsWith('UPDATE sesion_usuario')) return { rows: [], rowCount: 2 };
            if (limpia.includes('INSERT INTO bitacora_auditoria')) {
                auditoria.push(params);
                return { rows: [] };
            }
            return { rows: [], rowCount: 0 };
        },
        release: () => undefined,
    })) as unknown as typeof pool.connect;

    const captura = crearCapturaRespuesta();
    await anonimizarUsuario(
        { params: { id: '77' }, usuario: { id: 1, rol: 'Administrador' } } as unknown as Request<{ id: string }>,
        captura.respuesta
    );

    assert.equal(captura.estado(), 200);
    assert.equal(actualizaciones.length, 1);
    assert.equal(auditoria.length, 2);
    assert.equal(auditoria[0][2], 'solicitar_anonimizacion');
    assert.equal(auditoria[1][2], 'ejecutar_anonimizacion');
    assert.equal((captura.cuerpo() as { anonimizacion: { activo: boolean } }).anonimizacion.activo, false);
});

test('[BACK-1] CSV escapa comas y comillas', () => {
    const csv = construirCsvDatosPersonales({
        ...datosUsuario,
        nombre_usuario: 'Ana, María',
        especializacion: 'Diseño "industrial"',
    });
    assert.match(csv, /"Ana, María"/);
    assert.match(csv, /"Diseño ""industrial"""/);
});
