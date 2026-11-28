import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    devolverHerramientaEnTransaccion,
    entregarHerramientaEnTransaccion,
    procesarAlertasPrestamosEnTransaccion,
} from '../controllers/prestamoHerramientaController';
import {
    estadoHerramientaTrasDevolucion,
    motivoAlertaPrestamo,
    normalizarEstadoDevolucion,
} from '../services/prestamoHerramientaService';

const MS_DIA = 24 * 60 * 60 * 1000;

const crearEscenario = (estadoInicial = 'disponible') => {
    const s = {
        herramienta: {
            id_herramienta: 1,
            codigo_herramienta: 'HERR-001',
            nombre: 'Termofusora',
            estado: estadoInicial,
            activo: true,
        } as any,
        prestamos: [] as any[],
        alertas: [] as any[],
        auditoria: [] as any[],
        diasMax: 7,
        proyectoCerrado: false,
    };
    const cliente: any = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                s.auditoria.push(p);
                return { rows: [] };
            }
            if (sql.includes('SELECT * FROM herramientas')) return { rows: [s.herramienta] };
            if (sql.includes('INSERT INTO prestamos_herramienta')) {
                const pr = {
                    id_prestamo: s.prestamos.length + 1,
                    id_herramienta: p[0],
                    id_tecnico: p[1],
                    id_proyecto: p[2],
                    fecha_entrega: new Date().toISOString(),
                    fecha_devolucion: null,
                    estado_devolucion: null,
                    alerta_atraso_enviada: false,
                };
                s.prestamos.push(pr);
                return { rows: [pr] };
            }
            if (sql.includes('UPDATE herramientas SET estado = \'asignada\'')) {
                s.herramienta.estado = 'asignada';
                return { rows: [s.herramienta] };
            }
            if (sql.includes('UPDATE herramientas SET estado = $1')) {
                s.herramienta.estado = p[0];
                return { rows: [s.herramienta] };
            }
            if (sql.includes('SELECT * FROM prestamos_herramienta')) {
                return { rows: [s.prestamos.find((x) => x.id_prestamo === p[0])] };
            }
            if (sql.includes('UPDATE prestamos_herramienta SET fecha_devolucion')) {
                const pr = s.prestamos.find((x) => x.id_prestamo === p[2]);
                pr.fecha_devolucion = new Date().toISOString();
                pr.estado_devolucion = p[0];
                return { rows: [pr] };
            }
            if (sql.includes('dias_max_prestamo_herramienta')) return { rows: [{ valor: s.diasMax }] };
            if (sql.includes('prestamos:abiertos')) {
                return {
                    rows: s.prestamos
                        .filter((x) => !x.fecha_devolucion && !x.alerta_atraso_enviada)
                        .map((x) => ({ ...x, codigo_herramienta: 'HERR-001', nombre: 'Termofusora', proyecto_cerrado: s.proyectoCerrado })),
                };
            }
            if (sql.includes('prestamos:insert-alerta')) {
                s.alertas.push({ tipo: 'herramienta_no_devuelta', titulo: p[0] });
                return { rows: [] };
            }
            if (sql.includes('UPDATE prestamos_herramienta SET alerta_atraso_enviada')) {
                s.prestamos.find((x) => x.id_prestamo === p[0]).alerta_atraso_enviada = true;
                return { rows: [] };
            }
            return { rows: [] };
        },
    };
    return { s, cliente };
};

test('[BACK-2] normaliza estado de devolución y mapea Bueno→disponible, Dañado→en mantención', () => {
    assert.equal(normalizarEstadoDevolucion('Bueno'), 'bueno');
    assert.equal(normalizarEstadoDevolucion('Dañado'), 'dañado');
    assert.equal(normalizarEstadoDevolucion('danado'), 'dañado');
    assert.throws(() => normalizarEstadoDevolucion('roto'), /Bueno/);
    assert.equal(estadoHerramientaTrasDevolucion('bueno'), 'disponible');
    assert.equal(estadoHerramientaTrasDevolucion('dañado'), 'en mantención');
});

test('[BACK-2] bloquea prestar una herramienta En mantención o ya Asignada', async () => {
    for (const estado of ['en mantención', 'asignada']) {
        const { s, cliente } = crearEscenario(estado);
        await assert.rejects(
            () => entregarHerramientaEnTransaccion(cliente, { id_herramienta: 1, id_tecnico: 5 }, 9),
            (e: any) => e.estado === 409
        );
        assert.equal(s.prestamos.length, 0);
    }
});

test('[BACK-2][SCRUM] entrega, devuelve Dañada → En mantención, y simula préstamo de 8 días con alerta de atraso', async () => {
    // 1. Entrega: pasa a Asignada
    const { s, cliente } = crearEscenario();
    await entregarHerramientaEnTransaccion(cliente, { id_herramienta: 1, id_tecnico: 5, id_proyecto: 3 }, 9);
    assert.equal(s.herramienta.estado, 'asignada');

    // 2. Devolución Dañada: pasa a En mantención y conserva historial
    const dev = await devolverHerramientaEnTransaccion(cliente, 1, { estado_devolucion: 'Dañado' }, 9);
    assert.equal(dev.estado_herramienta, 'en mantención');
    assert.equal(s.herramienta.estado, 'en mantención');
    assert.equal(s.prestamos[0].estado_devolucion, 'dañado');
    assert.equal(s.auditoria.length, 2);
    await assert.rejects(() => devolverHerramientaEnTransaccion(cliente, 1, { estado_devolucion: 'bueno' }, 9), /ya fue devuelto/);

    // 3. Devolución Buena → Disponible
    const b = crearEscenario();
    await entregarHerramientaEnTransaccion(b.cliente, { id_herramienta: 1, id_tecnico: 5 }, 9);
    await devolverHerramientaEnTransaccion(b.cliente, 1, { estado_devolucion: 'Bueno' }, 9);
    assert.equal(b.s.herramienta.estado, 'disponible');

    // 4. Préstamo de 8 días → alerta; de 3 días → no; sin duplicar
    const c = crearEscenario();
    await entregarHerramientaEnTransaccion(c.cliente, { id_herramienta: 1, id_tecnico: 5 }, 9);
    const ahora = Date.now();
    const r3 = await procesarAlertasPrestamosEnTransaccion(c.cliente, ahora + 3 * MS_DIA);
    assert.equal(r3.alertas_generadas, 0);
    const r8 = await procesarAlertasPrestamosEnTransaccion(c.cliente, ahora + 8 * MS_DIA);
    assert.equal(r8.alertas_generadas, 1);
    assert.equal(r8.alertas[0].motivo, 'atraso');
    assert.equal(c.s.alertas[0].tipo, 'herramienta_no_devuelta');
    const repetido = await procesarAlertasPrestamosEnTransaccion(c.cliente, ahora + 9 * MS_DIA);
    assert.equal(repetido.alertas_generadas, 0);
});

test('[BACK-2] alerta al cerrar el proyecto aunque no pasen 7 días', async () => {
    const { s, cliente } = crearEscenario();
    await entregarHerramientaEnTransaccion(cliente, { id_herramienta: 1, id_tecnico: 5, id_proyecto: 3 }, 9);
    s.proyectoCerrado = true;
    const r = await procesarAlertasPrestamosEnTransaccion(cliente);
    assert.equal(r.alertas[0].motivo, 'cierre_proyecto');
    assert.equal(motivoAlertaPrestamo({ id_prestamo: 1, fecha_entrega: new Date() }, 7, Date.now()), null);
});
