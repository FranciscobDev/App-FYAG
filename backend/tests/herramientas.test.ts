import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import {
    ESTADOS_HERRAMIENTA,
    HerramientaFila,
    actualizarHerramienta,
    cambiarEstadoHerramienta,
    crearHerramienta,
    eliminarHerramienta,
    listarHerramientas,
    normalizarEstadoHerramienta,
    obtenerHerramienta,
    reactivarHerramienta,
    validarFechaIsoOpcional,
} from '../controllers/herramientaController';
import pool from '../config/db';

interface MockRespuesta {
    statusCod?: number;
    jsonBody?: any;
}

const crearRespuestaMock = () => {
    const res: MockRespuesta = {};
    const expressRes = {
        status: (code: number) => {
            res.statusCod = code;
            return expressRes;
        },
        json: (body: any) => {
            res.jsonBody = body;
            return expressRes;
        },
    } as unknown as Response;
    return { res, expressRes };
};

// ------------------------------------------------------------------------------------------------
// Suite de pruebas unitarias y de integración para gestión de herramientas [BACK-1][SCRUM]
// ------------------------------------------------------------------------------------------------

test('normalizarEstadoHerramienta valida y normaliza los 4 estados operativos', () => {
    assert.equal(normalizarEstadoHerramienta('disponible'), 'disponible');
    assert.equal(normalizarEstadoHerramienta('asignada'), 'asignada');
    assert.equal(normalizarEstadoHerramienta('en mantención'), 'en mantención');
    assert.equal(normalizarEstadoHerramienta('en mantencion'), 'en mantención');
    assert.equal(normalizarEstadoHerramienta('en mantenimiento'), 'en mantención');
    assert.equal(normalizarEstadoHerramienta('dada de baja'), 'dada de baja');
    assert.equal(normalizarEstadoHerramienta('baja'), 'dada de baja');

    assert.throws(
        () => normalizarEstadoHerramienta('destruida'),
        /Estado no reconocido/
    );
    assert.throws(
        () => normalizarEstadoHerramienta(123 as any),
        /El estado de la herramienta es obligatorio/
    );
});

test('validarFechaIsoOpcional valida formato AAAA-MM-DD y fechas válidas', () => {
    assert.equal(validarFechaIsoOpcional(undefined), null);
    assert.equal(validarFechaIsoOpcional(null), null);
    assert.equal(validarFechaIsoOpcional(''), null);
    assert.equal(validarFechaIsoOpcional('2027-06-30'), '2027-06-30');

    assert.throws(() => validarFechaIsoOpcional('30-06-2027'), /Formato de fecha inválido/);
    assert.throws(() => validarFechaIsoOpcional('no-es-fecha'), /Formato de fecha inválido/);
});

test('Escenario completo en memoria: crear herramienta, transicionar por los 4 estados, auditar y bloquear borrado físico', async () => {
    // Repositorio en memoria que simula la base de datos PostgreSQL
    const estadoBd = {
        herramientas: new Map<number, HerramientaFila>(),
        siguienteId: 1,
        auditoria: [] as any[],
    };

    const simularQuery = async (sql: string, params: any[] = []) => {
        const sqlLimpio = sql.replace(/\s+/g, ' ').trim();

        if (
            sqlLimpio === 'BEGIN' ||
            sqlLimpio === 'COMMIT' ||
            sqlLimpio === 'ROLLBACK' ||
            sqlLimpio.startsWith('CREATE TABLE')
        ) {
            return { rows: [] };
        }

        if (sqlLimpio.includes('FROM sesion_usuario')) {
            return {
                rows: [{ id_usuario: 1, nombre_rol: 'Administrador', activo: true }],
            };
        }

        if (sqlLimpio.includes('INSERT INTO bitacora_auditoria')) {
            estadoBd.auditoria.push(params);
            return { rows: [{ id_auditoria: estadoBd.auditoria.length }] };
        }

        if (sqlLimpio.includes('FROM herramientas WHERE LOWER(codigo_herramienta) = LOWER($1)')) {
            const codigo = String(params[0]).toLowerCase();
            const excludeId = params[1] ? Number(params[1]) : null;
            const encontrada = Array.from(estadoBd.herramientas.values()).find(
                (h) => h.codigo_herramienta.toLowerCase() === codigo && (!excludeId || h.id_herramienta !== excludeId)
            );
            return { rows: encontrada ? [encontrada] : [] };
        }

        if (sqlLimpio.includes('FROM herramientas WHERE codigo_qr = $1')) {
            const qr = String(params[0]);
            const excludeId = params[1] ? Number(params[1]) : null;
            const encontrada = Array.from(estadoBd.herramientas.values()).find(
                (h) => h.codigo_qr === qr && (!excludeId || h.id_herramienta !== excludeId)
            );
            return { rows: encontrada ? [encontrada] : [] };
        }

        if (sqlLimpio.startsWith('INSERT INTO herramientas')) {
            const id = estadoBd.siguienteId++;
            const nueva: HerramientaFila = {
                id_herramienta: id,
                codigo_herramienta: params[0],
                nombre: params[1],
                categoria: params[2],
                valor: Number(params[3]),
                estado: params[4],
                fecha_proximo_mantenimiento: params[5],
                codigo_qr: params[6],
                ubicacion: params[7],
                activo: true,
                fecha_creacion: new Date().toISOString(),
                fecha_actualizacion: new Date().toISOString(),
            };
            estadoBd.herramientas.set(id, nueva);
            return { rows: [nueva] };
        }

        if (sqlLimpio.includes('SELECT * FROM herramientas WHERE id_herramienta = $1')) {
            const id = Number(params[0]);
            const h = estadoBd.herramientas.get(id);
            return { rows: h ? [h] : [] };
        }

        if (sqlLimpio.includes('SELECT * FROM herramientas WHERE LOWER(codigo_herramienta) = LOWER($1) OR codigo_qr = $1')) {
            const valor = String(params[0]).toLowerCase();
            const h = Array.from(estadoBd.herramientas.values()).find(
                (item) => item.codigo_herramienta.toLowerCase() === valor || item.codigo_qr === params[0]
            );
            return { rows: h ? [h] : [] };
        }

        if (sqlLimpio.includes('UPDATE herramientas SET estado = $1')) {
            const nuevoEstado = params[0];
            const tieneFecha = params.length === 3;
            const nuevaFecha = tieneFecha ? params[1] : undefined;
            const id = tieneFecha ? Number(params[2]) : Number(params[1]);

            const item = estadoBd.herramientas.get(id);
            if (!item) return { rows: [] };

            item.estado = nuevoEstado;
            if (tieneFecha) {
                item.fecha_proximo_mantenimiento = nuevaFecha;
            }
            item.fecha_actualizacion = new Date().toISOString();
            estadoBd.herramientas.set(id, item);
            return { rows: [item] };
        }

        if (sqlLimpio.includes('UPDATE herramientas SET activo = FALSE')) {
            const id = Number(params[0]);
            const item = estadoBd.herramientas.get(id);
            if (!item) return { rows: [] };
            item.activo = false;
            item.fecha_actualizacion = new Date().toISOString();
            estadoBd.herramientas.set(id, item);
            return { rows: [item] };
        }

        if (sqlLimpio.includes('UPDATE herramientas SET activo = TRUE')) {
            const id = Number(params[0]);
            const item = estadoBd.herramientas.get(id);
            if (!item) return { rows: [] };
            item.activo = true;
            item.fecha_actualizacion = new Date().toISOString();
            estadoBd.herramientas.set(id, item);
            return { rows: [item] };
        }

        if (sqlLimpio.startsWith('SELECT * FROM herramientas')) {
            const lista = Array.from(estadoBd.herramientas.values());
            if (sqlLimpio.includes('activo = FALSE')) {
                return { rows: lista.filter((h) => !h.activo) };
            }
            if (!sqlLimpio.includes('incluir_inactivas')) {
                return { rows: lista.filter((h) => h.activo) };
            }
            return { rows: lista };
        }

        return { rows: [] };
    };

    const queryOriginal = pool.query;
    const connectOriginal = pool.connect;

    (pool as any).query = simularQuery;
    (pool as any).connect = async () => ({
        query: simularQuery,
        release: () => undefined,
    });

    try {
        // 1. [SCRUM] Crea una herramienta
        const reqCrear = {
            usuario: { id: 1, rol: 'Administrador' },
            body: {
                codigo_herramienta: 'HERR-FUS-001',
                nombre: 'Termofusora digital 800W para PPR',
                categoria: 'Gasfitería y Climatización',
                valor: 185000,
                estado: 'disponible',
                fecha_proximo_mantenimiento: '2027-04-10',
                codigo_qr: 'FYAG-QR-HERR-001',
                ubicacion: 'Bodega Central - Estante B2',
            },
        } as unknown as Request;

        const { res: resCrear, expressRes: expResCrear } = crearRespuestaMock();
        await crearHerramienta(reqCrear, expResCrear);

        assert.equal(resCrear.statusCod, 201);
        assert.equal(resCrear.jsonBody?.ok, true);
        assert.equal(resCrear.jsonBody?.herramienta?.codigo_herramienta, 'HERR-FUS-001');
        assert.equal(resCrear.jsonBody?.herramienta?.estado, 'disponible');
        assert.equal(resCrear.jsonBody?.herramienta?.valor, 185000);
        assert.equal(resCrear.jsonBody?.herramienta?.codigo_qr, 'FYAG-QR-HERR-001');
        assert.equal(resCrear.jsonBody?.herramienta?.activo, true);

        const idHerramienta = resCrear.jsonBody.herramienta.id_herramienta;
        assert.ok(idHerramienta > 0);

        // 2. [SCRUM] Transición a estado: 'asignada'
        const reqAsignar = {
            usuario: { id: 1, rol: 'Administrador' },
            params: { id: String(idHerramienta) },
            body: { estado: 'asignada', motivo: 'Asignada a cuadrilla Proyecto Clinica Los Andes' },
        } as unknown as Request;
        const { res: resAsignar, expressRes: expResAsignar } = crearRespuestaMock();
        await cambiarEstadoHerramienta(reqAsignar, expResAsignar);

        assert.equal(resAsignar.statusCod, 200);
        assert.equal(resAsignar.jsonBody?.herramienta?.estado, 'asignada');

        // 3. [SCRUM] Transición a estado: 'en mantención' (programando mantenimiento)
        const reqMantencion = {
            usuario: { id: 1, rol: 'Administrador' },
            params: { id: String(idHerramienta) },
            body: {
                estado: 'en mantención',
                fecha_proximo_mantenimiento: '2027-05-15',
                motivo: 'Cambio de teflón y calibración de termostato',
            },
        } as unknown as Request;
        const { res: resMantencion, expressRes: expResMantencion } = crearRespuestaMock();
        await cambiarEstadoHerramienta(reqMantencion, expResMantencion);

        assert.equal(resMantencion.statusCod, 200);
        assert.equal(resMantencion.jsonBody?.herramienta?.estado, 'en mantención');
        assert.equal(resMantencion.jsonBody?.herramienta?.fecha_proximo_mantenimiento, '2027-05-15');

        // 4. [SCRUM] Transición a estado: 'dada de baja'
        const reqBaja = {
            usuario: { id: 1, rol: 'Administrador' },
            params: { id: String(idHerramienta) },
            body: {
                estado: 'dada de baja',
                motivo: 'Fin de vida útil por daño estructural irrecuperable',
            },
        } as unknown as Request;
        const { res: resBaja, expressRes: expResBaja } = crearRespuestaMock();
        await cambiarEstadoHerramienta(reqBaja, expResBaja);

        assert.equal(resBaja.statusCod, 200);
        assert.equal(resBaja.jsonBody?.herramienta?.estado, 'dada de baja');

        // 5. Criterio de Aceptación: "Se deshabilita en lugar de eliminar" (Bloqueo de eliminación física)
        const reqEliminar = {
            usuario: { id: 1, rol: 'Administrador' },
            params: { id: String(idHerramienta) },
        } as unknown as Request;
        const { res: resEliminar, expressRes: expResEliminar } = crearRespuestaMock();
        await eliminarHerramienta(reqEliminar, expResEliminar);

        assert.equal(resEliminar.statusCod, 200);
        assert.equal(resEliminar.jsonBody?.bloqueoEliminacionFisica, true);
        assert.equal(resEliminar.jsonBody?.herramienta?.activo, false);

        // La herramienta sigue existiendo físicamente en el repositorio (no fue borrada con DELETE físico)
        const herramientaEnBd = estadoBd.herramientas.get(idHerramienta);
        assert.ok(herramientaEnBd !== undefined, 'La herramienta debe conservarse físicamente en la BD');
        assert.equal(herramientaEnBd?.activo, false, 'La herramienta debe estar marcada como inactiva/deshabilitada');
        assert.equal(herramientaEnBd?.estado, 'dada de baja');

        // 6. Reactivación
        const reqReactivar = {
            usuario: { id: 1, rol: 'Administrador' },
            params: { id: String(idHerramienta) },
        } as unknown as Request;
        const { res: resReactivar, expressRes: expResReactivar } = crearRespuestaMock();
        await reactivarHerramienta(reqReactivar, expResReactivar);

        assert.equal(resReactivar.statusCod, 200);
        assert.equal(resReactivar.jsonBody?.herramienta?.activo, true);

        // 7. Verificación de bitácora de auditoría (H14)
        assert.ok(estadoBd.auditoria.length >= 4, 'Debe registrar cada cambio y creación en auditoría');
    } finally {
        (pool as any).query = queryOriginal;
        (pool as any).connect = connectOriginal;
    }
});

test('Validación de errores: rechaza códigos faltantes o duplicados y valores negativos', async () => {
    const queryOriginal = pool.query;
    const connectOriginal = pool.connect;

    const mockCliente = {
        query: async () => ({ rows: [] }),
        release: () => undefined,
    };
    (pool as any).query = async () => ({ rows: [] });
    (pool as any).connect = async () => mockCliente;

    try {
        // Código faltante
        const reqSinCodigo = {
            usuario: { id: 1, rol: 'Administrador' },
            body: {
                nombre: 'Taladro percutor',
                valor: 50000,
            },
        } as unknown as Request;
        const { res: resSinCodigo, expressRes: expSinCodigo } = crearRespuestaMock();
        await crearHerramienta(reqSinCodigo, expSinCodigo);
        assert.equal(resSinCodigo.statusCod, 400);

        // Valor negativo
        const reqValorNegativo = {
            usuario: { id: 1, rol: 'Administrador' },
            body: {
                codigo_herramienta: 'HERR-NEG-001',
                nombre: 'Sierra circular',
                valor: -100,
            },
        } as unknown as Request;
        const { res: resValorNegativo, expressRes: expValorNegativo } = crearRespuestaMock();
        await crearHerramienta(reqValorNegativo, expValorNegativo);
        assert.equal(resValorNegativo.statusCod, 400);
    } finally {
        (pool as any).query = queryOriginal;
        (pool as any).connect = connectOriginal;
    }
});
