import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { confirmarRecepcionDevolucionEnTransaccion } from '../controllers/devolucionController';
import {
    recalcularFinanzasProyectoEnTransaccion,
    registrarHorasProyectoEnTransaccion,
} from '../controllers/motorFinancieroProyectoController';
import {
    calcularEstadoFinancieroProyecto,
    evaluarSemaforoPresupuesto,
} from '../services/motorFinancieroProyectoService';

// ---------------------------------------------------------------------------------------------
// Escenario integrado en memoria para probar el motor financiero por proyecto (H27),
// salidas de bodega a PMP, devoluciones (H36) y registro de horas (H41) con costo hora H39.
// ---------------------------------------------------------------------------------------------
const crearEscenarioMotorFinanciero = (opts: {
    presupuestoTotal?: number;
    valorVenta?: number;
    costoHoraH39?: number;
} = {}) => {
    const estado = {
        costoHoraH39: opts.costoHoraH39 ?? 15000, // $15.000 CLP/hora en H39
        proyecto: {
            id_proyecto: 25,
            nombre_proyecto: 'Climatización Hospital Sur',
            presupuesto_inicial: opts.presupuestoTotal ?? 1000000, // $1.000.000 presupuesto total
            presupuesto_materiales: null as number | null,
            presupuesto_horas: 20,
            valor_venta: opts.valorVenta ?? 1500000, // $1.500.000 valor de venta
            costo_real_acumulado: 0,
            margen_estimado: 1500000,
            porcentaje_consumo_presupuesto: 0,
            semaforo_financiero: 'verde',
        },
        egresosPmp: [] as { cantidad: number; pmp: number }[],
        ajustesDevolucion: [] as number[], // montos negativos en proyecto_costo_ajuste
        horasH41: [] as { horas: number; costo_hora: number; costo_total: number }[],
        alertasAdmin: [] as {
            tipo: string;
            severidad: string;
            titulo: string;
            descripcion: string;
            rol_destino: string;
        }[],
        // Datos para probar confirmación de recepción de devolución (H36)
        devolucionCabecera: {
            id_devolucion: 1,
            codigo: 'DEV-2026-00001',
            codigo_devolucion: 'DEV-2026-00001',
            proyecto_id: 25,
            tecnico_id: 3,
            estado: 'En tránsito',
        },
        devolucionLineas: [
            { id_devolucion_linea: 11, id_articulo: 100, cantidad_declarada: 10 },
        ],
        stockArticulo100: {
            disp: 20,
            comp: 0,
            pmp: 20000, // $20.000 PMP unitario
            precio: 20000,
            sku: 'GAS-TUB-0020',
            nombre: 'Tubo cobre tipo L 3/4"',
        },
    };

    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                return { rows: [] };
            }

            const etiqueta = /\/\* ([a-z]+:[a-z0-9-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'fin:select-costo-hora-h39':
                    return { rows: [{ valor: estado.costoHoraH39 }] };
                case 'fin:select-proyecto':
                    return { rows: [{ ...estado.proyecto }] };
                case 'fin:select-egresos-pmp': {
                    const total = estado.egresosPmp.reduce(
                        (acc, e) => acc + Math.round(e.cantidad * e.pmp),
                        0
                    );
                    return { rows: [{ total_egresos_pmp: total }] };
                }
                case 'fin:select-ajustes-devoluciones': {
                    const total = estado.ajustesDevolucion.reduce((acc, m) => acc + m, 0);
                    return { rows: [{ total_ajustes_pmp: total }] };
                }
                case 'fin:select-horas-h41': {
                    const total = estado.horasH41.reduce((acc, h) => acc + h.horas, 0);
                    return { rows: [{ total_horas: total }] };
                }
                case 'fin:update-proyecto': {
                    estado.proyecto.costo_real_acumulado = Number(p[1]);
                    estado.proyecto.margen_estimado = Number(p[2]);
                    estado.proyecto.porcentaje_consumo_presupuesto = Number(p[3]);
                    estado.proyecto.semaforo_financiero = String(p[4]);
                    return { rows: [] };
                }
                case 'fin:insert-alerta': {
                    estado.alertasAdmin.push({
                        tipo: String(p[0]),
                        severidad: String(p[1]),
                        titulo: String(p[2]),
                        descripcion: String(p[3]),
                        rol_destino: 'admin',
                    });
                    return { rows: [] };
                }
                case 'fin:insert-horas-h41': {
                    estado.horasH41.push({
                        horas: Number(p[2]),
                        costo_hora: Number(p[3]),
                        costo_total: Number(p[4]),
                    });
                    return { rows: [{ id_registro_hora: estado.horasH41.length }] };
                }
                // Etiquetas de devolución en bodega (H36)
                case 'dev:select-cabecera':
                    return { rows: [{ ...estado.devolucionCabecera }] };
                case 'dev:select-lineas':
                    return { rows: estado.devolucionLineas.map((l) => ({ ...l })) };
                case 'dev:select-stock':
                    return {
                        rows: [
                            {
                                cantidad_disponible: estado.stockArticulo100.disp,
                                cantidad_comprometida: estado.stockArticulo100.comp,
                                pmp: estado.stockArticulo100.pmp,
                                precio_unitario: estado.stockArticulo100.precio,
                                sku: estado.stockArticulo100.sku,
                                nombre_articulo: estado.stockArticulo100.nombre,
                            },
                        ],
                    };
                case 'dev:update-stock':
                    estado.stockArticulo100.disp = Number(p[1]);
                    return { rows: [] };
                case 'dev:insert-cardex':
                    return { rows: [{ id_movimiento: 501 }] };
                case 'dev:insert-cardex-simple':
                case 'dev:update-linea':
                    return { rows: [] };
                case 'dev:insert-ajuste-costo':
                    estado.ajustesDevolucion.push(Number(p[5]));
                    return { rows: [] };
                case 'dev:update-cabecera':
                    estado.devolucionCabecera.estado = 'Recibida';
                    return { rows: [] };
            }
            return { rows: [] };
        },
    } as unknown as PoolClient;

    // Helper para simular una salida de bodega (egreso a PMP) y disparar el recálculo automático
    const registrarSalidaBodegaSimulada = async (cantidad: number, pmp: number) => {
        estado.egresosPmp.push({ cantidad, pmp });
        return recalcularFinanzasProyectoEnTransaccion(
            cliente,
            estado.proyecto.id_proyecto,
            `salida de bodega (${cantidad} un. a PMP $${pmp})`
        );
    };

    return { estado, cliente, registrarSalidaBodegaSimulada };
};

test('[BACK-1] evaluarSemaforoPresupuesto y calcularEstadoFinancieroProyecto aplican las reglas exactas de H27', () => {
    assert.equal(evaluarSemaforoPresupuesto(0), 'verde');
    assert.equal(evaluarSemaforoPresupuesto(79.99), 'verde');
    assert.equal(evaluarSemaforoPresupuesto(80), 'amarillo');
    assert.equal(evaluarSemaforoPresupuesto(95.5), 'amarillo');
    assert.equal(evaluarSemaforoPresupuesto(100), 'amarillo');
    assert.equal(evaluarSemaforoPresupuesto(100.01), 'rojo');

    // Costo Real = (600.000 egresos - 50.000 devolución) + (20 h * $15.000) = 550.000 + 300.000 = $850.000
    // Presupuesto = $1.000.000 -> 85 % (Amarillo)
    // Margen Estimado = $1.500.000 - $850.000 = $650.000
    const calc = calcularEstadoFinancieroProyecto({
        presupuesto_total: 1000000,
        valor_venta: 1500000,
        egresos_brutos_pmp: 600000,
        ajustes_devoluciones_pmp: -50000,
        horas_registradas_h41: 20,
        costo_hora_h39: 15000,
        semaforo_anterior: 'verde',
    });

    assert.equal(calc.egresos_netos_pmp, 550000);
    assert.equal(calc.costo_horas_h41, 300000);
    assert.equal(calc.costo_real, 850000);
    assert.equal(calc.margen_estimado, 650000);
    assert.equal(calc.porcentaje_consumo_presupuesto, 85);
    assert.equal(calc.semaforo_actual, 'amarillo');
    assert.equal(calc.dispara_alerta_amarillo, true);
    assert.equal(calc.dispara_alerta_rojo, false);
});

test('[BACK-1][SCRUM] Registra salidas y horas hasta superar el 80 % y luego el 100 % del presupuesto, comprobando el cálculo exacto y las dos alertas enviadas al Admin', async () => {
    // Presupuesto total = $1.000.000 | Valor de venta = $1.500.000 | Costo hora H39 = $15.000/h
    const { estado, cliente, registrarSalidaBodegaSimulada } = crearEscenarioMotorFinanciero({
        presupuestoTotal: 1000000,
        valorVenta: 1500000,
        costoHoraH39: 15000,
    });

    // =========================================================================
    // 1. Salida inicial de bodega: 25 unidades a PMP $20.000 = $500.000 (50 % del presupuesto)
    //    -> Semáforo VERDE (< 80 %), sin alertas
    // =========================================================================
    const paso1 = (await registrarSalidaBodegaSimulada(25, 20000))!;
    assert.equal(paso1.egresos_netos_pmp, 500000);
    assert.equal(paso1.costo_horas_h41, 0);
    assert.equal(paso1.costo_real, 500000);
    assert.equal(paso1.margen_estimado, 1000000); // $1.500.000 - $500.000
    assert.equal(paso1.porcentaje_consumo_presupuesto, 50);
    assert.equal(paso1.semaforo_actual, 'verde');
    assert.equal(estado.alertasAdmin.length, 0, 'en semáforo Verde (< 80%) no se envía alerta');

    // =========================================================================
    // 2. [SCRUM] Registrar 22 horas en H41 (22 h * $15.000 = $330.000)
    //    -> Costo Real = $500.000 + $330.000 = $830.000 (83 % del presupuesto -> entre 80 % y 100 %)
    //    -> Semáforo pasa a AMARILLO y envía la 1ª alerta al Administrador
    // =========================================================================
    const regHoras1 = await registrarHorasProyectoEnTransaccion(
        cliente,
        25,
        { horas: 22, descripcion: 'Montaje de ductos y unidades manejadoras' },
        3
    );
    const paso2 = regHoras1.finanzas;
    assert.equal(paso2.egresos_netos_pmp, 500000);
    assert.equal(paso2.horas_registradas_h41, 22);
    assert.equal(paso2.costo_horas_h41, 330000);
    assert.equal(paso2.costo_real, 830000);
    assert.equal(paso2.margen_estimado, 670000); // $1.500.000 - $830.000
    assert.equal(paso2.porcentaje_consumo_presupuesto, 83);
    assert.equal(paso2.semaforo_actual, 'amarillo');
    assert.equal(estado.alertasAdmin.length, 1, 'debe disparar la 1ª alerta al Administrador al pasar a Amarillo (>= 80%)');
    assert.equal(estado.alertasAdmin[0].tipo, 'presupuesto_proyecto_amarillo');
    assert.equal(estado.alertasAdmin[0].severidad, 'amarillo');
    assert.match(estado.alertasAdmin[0].titulo, /83%/);

    // =========================================================================
    // 3. [SCRUM] Nueva salida de bodega: 10 unidades a PMP $20.000 = +$200.000
    //    -> Egresos netos = $700.000 + Horas = $330.000 => Costo Real = $1.030.000 (103 % > 100 %)
    //    -> Semáforo pasa a ROJO y envía la 2ª alerta al Administrador
    // =========================================================================
    const paso3 = (await registrarSalidaBodegaSimulada(10, 20000))!;
    assert.equal(paso3.egresos_netos_pmp, 700000);
    assert.equal(paso3.costo_horas_h41, 330000);
    assert.equal(paso3.costo_real, 1030000);
    assert.equal(paso3.margen_estimado, 470000); // $1.500.000 - $1.030.000
    assert.equal(paso3.porcentaje_consumo_presupuesto, 103);
    assert.equal(paso3.semaforo_actual, 'rojo');
    assert.equal(estado.alertasAdmin.length, 2, 'debe disparar la 2ª alerta al Administrador al superar el 100% (Rojo)');
    assert.equal(estado.alertasAdmin[1].tipo, 'presupuesto_proyecto_rojo');
    assert.equal(estado.alertasAdmin[1].severidad, 'rojo');
    assert.match(estado.alertasAdmin[1].titulo, /103%/);
    assert.match(estado.alertasAdmin[1].descripcion, /Margen Estimado.*\$470000/);

    // =========================================================================
    // 4. Confirmar recepción de devolución en bodega (H36): 5 unidades devueltas a PMP $20.000 (-$100.000)
    //    -> Recalcula automáticamente: Costo Real baja de $1.030.000 a $930.000 (93 %) y Margen sube a $570.000
    // =========================================================================
    await confirmarRecepcionDevolucionEnTransaccion(
        cliente,
        1,
        [{ id_articulo: 100, cantidad_recibida: 10 }], // 10 * $20.000 = -$200.000 de ajuste al proyecto
        'Devolución conforme',
        2
    );
    assert.equal(estado.proyecto.costo_real_acumulado, 830000, '$1.030.000 - $200.000 devueltos = $830.000');
    assert.equal(estado.proyecto.margen_estimado, 670000, 'el margen estimado sube automáticamente a $670.000');
    assert.equal(estado.proyecto.semaforo_financiero, 'amarillo');
});
