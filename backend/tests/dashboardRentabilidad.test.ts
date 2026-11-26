import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerDashboardRentabilidadEnTransaccion } from '../controllers/dashboardRentabilidadController';
import { calcularDashboardRentabilidad, validarProyectoCerrado } from '../services/dashboardRentabilidadService';

const crearCliente = (estado: string) => {
    const proyecto = {
        id_proyecto: 5,
        nombre_proyecto: 'Climatización Hospital Sur',
        estado_proyecto: estado,
        presupuesto_inicial: 900000,
        presupuesto_materiales: 500000,
        presupuesto_horas: 20, // 20 h × $15.000 = $300.000
        presupuesto_mermas: 20000,
        valor_venta: 1200000,
    };
    const consultas: string[] = [];
    const cliente: any = {
        query: async (sql: string) => {
            consultas.push(sql);
            if (sql.includes('dash:select-proyecto')) return { rows: [proyecto] };
            if (sql.includes('dash:costo-hora')) return { rows: [{ valor: 15000 }] };
            if (sql.includes('dash:egresos-pmp')) return { rows: [{ total: 600000 }] };
            if (sql.includes('dash:ajustes')) return { rows: [{ total: -50000 }] }; // devolución H36
            if (sql.includes('dash:mermas')) return { rows: [{ total: 30000 }] };
            if (sql.includes('dash:horas')) return { rows: [{ total: 24 }] };
            return { rows: [] };
        },
    };
    return { cliente, consultas };
};

test('[BACK-1] solo los proyectos Cerrados acceden; Planificado y Activo quedan bloqueados (403)', async () => {
    assert.doesNotThrow(() => validarProyectoCerrado('Cerrado'));
    for (const estado of ['Planificado', 'Activo']) {
        const { cliente, consultas } = crearCliente(estado);
        await assert.rejects(
            () => obtenerDashboardRentabilidadEnTransaccion(cliente, 5),
            (e: any) => e.estado === 403 && /Cerrados/.test(e.message) && e.message.includes(estado)
        );
        // Bloquea antes de leer costos
        assert.equal(consultas.filter((s) => s.includes('dash:egresos-pmp')).length, 0);
    }
});

test('[BACK-1][SCRUM] cierra un proyecto con movimientos reales y valida desviación en monto y porcentaje', async () => {
    const { cliente } = crearCliente('Cerrado');
    const d = await obtenerDashboardRentabilidadEnTransaccion(cliente, 5);

    const cat = (n: string) => d.categorias.find((c) => c.categoria === n)!;

    // Materiales: planificado 500.000 · real 600.000 − 50.000 (devolución) = 550.000
    assert.equal(cat('materiales').planificado, 500000);
    assert.equal(cat('materiales').real, 550000);
    assert.equal(cat('materiales').desviacion_monto, 50000);
    assert.equal(cat('materiales').desviacion_porcentaje, 10);

    // Mermas: planificado 20.000 · real 30.000
    assert.equal(cat('mermas').desviacion_monto, 10000);
    assert.equal(cat('mermas').desviacion_porcentaje, 50);

    // Horas: planificado 20 h × 15.000 = 300.000 · real 24 h × 15.000 = 360.000
    assert.equal(cat('horas').planificado, 300000);
    assert.equal(cat('horas').real, 360000);
    assert.equal(cat('horas').desviacion_monto, 60000);
    assert.equal(cat('horas').desviacion_porcentaje, 20);

    // Totales: planificado 820.000 · real 940.000 → +120.000 (14,63 %)
    assert.equal(d.totales.planificado, 820000);
    assert.equal(d.totales.real, 940000);
    assert.equal(d.totales.desviacion_monto, 120000);
    assert.equal(d.totales.desviacion_porcentaje, 14.63);
    assert.equal(d.totales.margen_real, 260000);
    assert.equal(d.categoria_mayor_sobrecosto, 'horas');

    // La suma de categorías cuadra con los totales y la composición porcentual (torta)
    assert.equal(d.categorias.reduce((a, c) => a + c.real, 0), d.totales.real);
    assert.equal(d.categorias.reduce((a, c) => a + c.desviacion_monto, 0), d.totales.desviacion_monto);
    assert.deepEqual(d.grafico_torta.map((t) => t.porcentaje), [58.51, 3.19, 38.3]);
    assert.equal(d.grafico_barras.length, 3);
});

test('[BACK-1] sin planificado no hay porcentaje de desviación; sin costos la composición es 0', () => {
    const d = calcularDashboardRentabilidad({
        valor_venta: 0, presupuesto_inicial: 0, presupuesto_materiales: null, presupuesto_horas: 0,
        presupuesto_mermas: 0, costo_hora: 15000, egresos_netos_pmp: 0, mermas_total: 5000, horas_registradas: 0,
    });
    const mermas = d.categorias.find((c) => c.categoria === 'mermas')!;
    assert.equal(mermas.desviacion_monto, 5000);
    assert.equal(mermas.desviacion_porcentaje, null);
    assert.equal(mermas.composicion_porcentaje, 100);
    const vacio = calcularDashboardRentabilidad({
        valor_venta: 0, presupuesto_inicial: 0, presupuesto_materiales: null, presupuesto_horas: 0,
        presupuesto_mermas: 0, costo_hora: 15000, egresos_netos_pmp: 0, mermas_total: 0, horas_registradas: 0,
    });
    assert.ok(vacio.categorias.every((c) => c.composicion_porcentaje === 0 && !c.sobrecosto));
    assert.equal(vacio.categoria_mayor_sobrecosto, null);
});

test('[BACK-1] sin presupuesto de materiales explícito usa el presupuesto inicial menos las horas planificadas', () => {
    const d = calcularDashboardRentabilidad({
        valor_venta: 0, presupuesto_inicial: 800000, presupuesto_materiales: null, presupuesto_horas: 10,
        presupuesto_mermas: 0, costo_hora: 15000, egresos_netos_pmp: 0, mermas_total: 0, horas_registradas: 0,
    });
    assert.equal(d.categorias.find((c) => c.categoria === 'materiales')!.planificado, 650000);
    assert.equal(d.totales.planificado, 800000);
});
