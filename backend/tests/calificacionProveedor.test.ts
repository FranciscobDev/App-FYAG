import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registrarCalificacionEnTransaccion } from '../controllers/calificacionProveedorController';
import {
    construirOrdenProveedores,
    promedioCalificacion,
    validarEstrellas,
} from '../services/calificacionProveedorService';

const crearEscenario = (estadoOc = 'Recibida') => {
    const s = {
        ocs: new Map<number, any>([
            [1, { id_orden_compra: 1, numero_oc: 'OC-2026-00001', proveedor_id: 9, estado: estadoOc }],
            [2, { id_orden_compra: 2, numero_oc: 'OC-2026-00002', proveedor_id: 9, estado: 'Cerrada' }],
            [3, { id_orden_compra: 3, numero_oc: 'OC-2026-00003', proveedor_id: 9, estado: 'Enviada' }],
        ]),
        califs: [] as any[],
        proveedor: { id_proveedor: 9, calificacion_promedio: null as number | null, total_calificaciones: 0 } as any,
        auditoria: [] as any[],
    };
    const prom = (k: string) => s.califs.reduce((a, c) => a + c[k], 0) / s.califs.length;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const cliente: any = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) { s.auditoria.push(p); return { rows: [] }; }
            if (sql.includes('cal:select-oc')) return { rows: s.ocs.has(p[0]) ? [s.ocs.get(p[0])] : [] };
            if (sql.includes('cal:select-previa')) return { rows: s.califs.filter((c) => c.id_orden_compra === p[0]).map(() => ({ id_calificacion: 1 })) };
            if (sql.includes('cal:insert')) {
                const c = { id_orden_compra: p[0], id_proveedor: p[1], tiempo: p[2], calidad: p[3], precio: p[4], promedio: p[5] };
                s.califs.push(c);
                return { rows: [c] };
            }
            if (sql.includes('cal:recalcular')) {
                s.proveedor.calificacion_promedio = r2(prom('promedio'));
                s.proveedor.calificacion_tiempo = r2(prom('tiempo'));
                s.proveedor.calificacion_calidad = r2(prom('calidad'));
                s.proveedor.calificacion_precio = r2(prom('precio'));
                s.proveedor.total_calificaciones = s.califs.length;
                return { rows: [s.proveedor] };
            }
            return { rows: [] };
        },
    };
    return { s, cliente };
};

test('[BACK-2] valida estrellas de 1 a 5 enteras y calcula el promedio con 2 decimales', () => {
    assert.equal(validarEstrellas(5, 'tiempo'), 5);
    assert.equal(validarEstrellas('3', 'tiempo'), 3);
    for (const malo of [0, 6, 2.5, 'x', null, undefined]) {
        assert.throws(() => validarEstrellas(malo, 'calidad'), /1 a 5 estrellas/);
    }
    assert.equal(promedioCalificacion(5, 4, 4), 4.33);
    assert.equal(promedioCalificacion(3, 3, 3), 3);
});

test('[BACK-2] ordenamiento del listado de proveedores por calificación (lista blanca)', () => {
    assert.equal(construirOrdenProveedores({}), 'id_proveedor ASC');
    assert.equal(construirOrdenProveedores({ ordenar_por: 'calificacion' }), 'calificacion_promedio DESC NULLS LAST, id_proveedor ASC');
    assert.equal(construirOrdenProveedores({ ordenar_por: 'calificacion', orden: 'asc' }), 'calificacion_promedio ASC NULLS LAST, id_proveedor ASC');
    assert.throws(() => construirOrdenProveedores({ ordenar_por: 'id; DROP TABLE proveedor' }), /inválido/);
    assert.throws(() => construirOrdenProveedores({ ordenar_por: 'nombre', orden: 'x' }), /asc o desc/);
});

test('[BACK-2][SCRUM] califica dos OC de un proveedor y comprueba el promedio resultante (H15)', async () => {
    const { s, cliente } = crearEscenario();

    // OC 1: tiempo 5, calidad 4, precio 3 → 4.00
    const r1 = await registrarCalificacionEnTransaccion(cliente, 1, { tiempo: 5, calidad: 4, precio: 3 }, 1);
    assert.equal(r1.calificacion.promedio, 4);
    assert.equal(r1.proveedor.calificacion_promedio, 4);
    assert.equal(r1.proveedor.total_calificaciones, 1);

    // OC 2: tiempo 3, calidad 3, precio 2 → 2.67; ranking recalculado al instante: (4 + 2.67) / 2 = 3.33
    const r2 = await registrarCalificacionEnTransaccion(cliente, 2, { tiempo: 3, calidad: 3, precio: 2 }, 1);
    assert.equal(r2.calificacion.promedio, 2.67);
    assert.equal(s.proveedor.total_calificaciones, 2);
    assert.equal(s.proveedor.calificacion_promedio, 3.34); // AVG(4.00, 2.67) = 3.335 → 3.34
    assert.equal(s.proveedor.calificacion_tiempo, 4);
    assert.equal(s.proveedor.calificacion_calidad, 3.5);
    assert.equal(s.proveedor.calificacion_precio, 2.5);
    assert.equal(s.auditoria.length, 2);
});

test('[BACK-2] una sola calificación por OC y solo OC recibidas o cerradas', async () => {
    const { s, cliente } = crearEscenario();
    await registrarCalificacionEnTransaccion(cliente, 1, { tiempo: 5, calidad: 5, precio: 5 }, 1);
    await assert.rejects(
        () => registrarCalificacionEnTransaccion(cliente, 1, { tiempo: 1, calidad: 1, precio: 1 }, 1),
        (e: any) => e.estado === 409
    );
    await assert.rejects(
        () => registrarCalificacionEnTransaccion(cliente, 3, { tiempo: 5, calidad: 5, precio: 5 }, 1),
        (e: any) => e.estado === 409 && /Recibida o Cerrada/.test(e.message)
    );
    await assert.rejects(
        () => registrarCalificacionEnTransaccion(cliente, 99, { tiempo: 5, calidad: 5, precio: 5 }, 1),
        (e: any) => e.estado === 404
    );
    // Una calificación inválida no toca nada
    await assert.rejects(() => registrarCalificacionEnTransaccion(cliente, 2, { tiempo: 6, calidad: 5, precio: 5 }, 1), /1 a 5/);
    assert.equal(s.califs.length, 1);
    assert.equal(s.proveedor.calificacion_promedio, 5);
});
