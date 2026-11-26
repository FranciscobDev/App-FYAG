import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
    confirmarRecepcionDevolucionEnTransaccion,
    declararDevolucionEnTransaccion,
} from '../controllers/devolucionController';
import { verificarBloqueoCierreProyectoPorDevolucionesH34 } from '../controllers/proyectoController';
import {
    calcularMontoAjusteCosto,
    normalizarCantidadRecibida,
    planificarConfirmacionRecepcion,
} from '../services/devolucionBodegaService';

// ---------------------------------------------------------------------------------------------
// Cliente PG falso en memoria: interpreta las consultas por su etiqueta /* dev:x */
// ---------------------------------------------------------------------------------------------
const crearEscenario = (opts: { declarada?: number; disponible?: number; estado?: string; dosLineas?: boolean } = {}) => {
    const estado = {
        cabecera: { id_devolucion: 1, codigo: 'DEV-2026-00001', proyecto_id: 5, tecnico_id: 3, estado: opts.estado ?? 'En tránsito', tiene_diferencia: false, bodeguero_id: null as number | null },
        lineas: [
            { id_devolucion_linea: 11, id_articulo: 100, cantidad_declarada: opts.declarada ?? 10, cantidad_recibida: null as number | null, costo_unitario: null as number | null, id_movimiento_cardex: null as number | null },
            ...(opts.dosLineas ? [{ id_devolucion_linea: 12, id_articulo: 200, cantidad_declarada: 4, cantidad_recibida: null as number | null, costo_unitario: null as number | null, id_movimiento_cardex: null as number | null }] : []),
        ],
        stock: new Map<number, { disp: number; comp: number; pmp: number; precio: number; sku: string; nombre: string }>([
            [100, { disp: opts.disponible ?? 20, comp: 2, pmp: 1500, precio: 1400, sku: 'ELE-CBL-0012', nombre: 'Cable THHN 12 AWG' }],
            [200, { disp: 5, comp: 0, pmp: 0, precio: 800, sku: 'EPP-CAS-0001', nombre: 'Casco' }],
        ]),
        cardex: [] as any[][],
        cardexSimple: [] as any[][],
        ajustes: [] as any[][],
        alertas: [] as { titulo: string; descripcion: string }[],
        auditoria: [] as any[][],
    };

    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria') || sql.includes('/* fin:')) {
                if (sql.includes('bitacora_auditoria')) estado.auditoria.push(p);
                return { rows: [] };
            }
            const etiqueta = /\/\* (dev:[a-z-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'dev:select-cabecera':
                    return { rows: p[0] === estado.cabecera.id_devolucion ? [{ ...estado.cabecera }] : [] };
                case 'dev:select-lineas':
                    return { rows: estado.lineas.map((l) => ({ id_devolucion_linea: l.id_devolucion_linea, id_articulo: l.id_articulo, cantidad_declarada: l.cantidad_declarada })) };
                case 'dev:select-stock': {
                    const s = estado.stock.get(p[0]);
                    return { rows: s ? [{ cantidad_disponible: s.disp, cantidad_comprometida: s.comp, pmp: s.pmp, precio_unitario: s.precio, sku: s.sku, nombre_articulo: s.nombre }] : [] };
                }
                case 'dev:update-stock':
                    estado.stock.get(p[0])!.disp = p[1];
                    return { rows: [] };
                case 'dev:insert-cardex':
                    estado.cardex.push(p);
                    return { rows: [{ id_movimiento: 500 + estado.cardex.length }] };
                case 'dev:insert-cardex-simple':
                    estado.cardexSimple.push(p);
                    return { rows: [] };
                case 'dev:insert-ajuste-costo':
                    estado.ajustes.push(p);
                    return { rows: [] };
                case 'dev:update-linea': {
                    const l = estado.lineas.find((x) => x.id_devolucion_linea === p[0])!;
                    l.cantidad_recibida = p[1];
                    l.costo_unitario = p[2];
                    l.id_movimiento_cardex = p[3];
                    return { rows: [] };
                }
                case 'dev:update-cabecera':
                    estado.cabecera.estado = 'Recibida';
                    estado.cabecera.bodeguero_id = p[1];
                    estado.cabecera.tiene_diferencia = p[2];
                    return { rows: [] };
                case 'dev:insert-alerta':
                    estado.alertas.push({ titulo: p[0], descripcion: p[1] });
                    return { rows: [] };
                default:
                    throw new Error(`Consulta no soportada por el fake: ${sql.slice(0, 60)}`);
            }
        },
    } as unknown as PoolClient;

    return { estado, cliente };
};

test('normalizarCantidadRecibida acepta >= 0 con 3 decimales y rechaza negativos o texto', () => {
    assert.equal(normalizarCantidadRecibida(8), 8);
    assert.equal(normalizarCantidadRecibida('2,5'), 2.5);
    assert.equal(normalizarCantidadRecibida(0), 0);
    assert.equal(normalizarCantidadRecibida(-1), null);
    assert.equal(normalizarCantidadRecibida('abc'), null);
    assert.equal(normalizarCantidadRecibida(undefined), null);
});

test('calcularMontoAjusteCosto redondea cantidad × costo unitario', () => {
    assert.equal(calcularMontoAjusteCosto(8, 1500), 12000);
    assert.equal(calcularMontoAjusteCosto(2.5, 333), 833);
});

test('planificarConfirmacionRecepcion exige todos los ítems y no permite recibir más de lo declarado', () => {
    const lineas = [
        { id_devolucion_linea: 11, id_articulo: 100, cantidad_declarada: 10 },
        { id_devolucion_linea: 12, id_articulo: 200, cantidad_declarada: 4 },
    ];
    assert.throws(() => planificarConfirmacionRecepcion(lineas, []), /cantidad realmente recibida/);
    assert.throws(() => planificarConfirmacionRecepcion(lineas, [{ id_articulo: 100, cantidad_recibida: 8 }]), /Falta confirmar/);
    assert.throws(() => planificarConfirmacionRecepcion(lineas, [{ id_articulo: 100, cantidad_recibida: 11 }, { id_articulo: 200, cantidad_recibida: 4 }]), /más de lo declarado/);
    assert.throws(() => planificarConfirmacionRecepcion(lineas, [{ id_articulo: 100, cantidad_recibida: 8 }, { id_articulo: 100, cantidad_recibida: 1 }, { id_articulo: 200, cantidad_recibida: 4 }]), /repetido/);
    assert.throws(() => planificarConfirmacionRecepcion(lineas, [{ id_articulo: 999, cantidad_recibida: 1 }]), /no pertenece/);
    const plan = planificarConfirmacionRecepcion(lineas, [{ id_articulo: 100, cantidad_recibida: 8 }, { id_devolucion_linea: 12, cantidad_recibida: 4 }]);
    assert.deepEqual(plan.map((p) => p.diferencia), [-2, 0]);
});

test('[SCRUM] confirma 8 de 10 declaradas: stock +8, costo del proyecto ajustado, Cardex y alerta al Admin', async () => {
    const { estado, cliente } = crearEscenario({ declarada: 10, disponible: 20 });

    const r = await confirmarRecepcionDevolucionEnTransaccion(
        cliente, 1, [{ id_articulo: 100, cantidad_recibida: 8 }], 'Faltan 2 unidades, quedaron en obra', 9
    );

    // Stock: +8 (la cantidad REAL, no la declarada)
    assert.equal(estado.stock.get(100)!.disp, 28);
    assert.equal(r.lineas[0].disponible_anterior, 20);
    assert.equal(r.lineas[0].disponible_nuevo, 28);

    // Costo del proyecto: ajuste negativo = 8 × PMP 1500
    assert.equal(estado.ajustes.length, 1);
    assert.deepEqual(estado.ajustes[0].slice(0, 3), [5, 1, 100]); // proyecto, devolución, artículo
    assert.equal(estado.ajustes[0][3], 8);
    assert.equal(estado.ajustes[0][5], -12000);
    assert.equal(r.ajuste_costo_total, -12000);

    // Cardex: Entrada de 8 con saldo físico (disp 28 + comprometido 2 = 30) y referencia con declarado vs real
    assert.equal(estado.cardex.length, 1);
    assert.equal(estado.cardex[0][1], 8);
    assert.equal(estado.cardex[0][3], 30);
    assert.match(estado.cardex[0][6], /Declarado: 10, Recibido real: 8/);
    assert.equal(estado.cardexSimple.length, 1);

    // Línea y cabecera
    assert.equal(estado.lineas[0].cantidad_recibida, 8);
    assert.equal(estado.cabecera.estado, 'Recibida');
    assert.equal(estado.cabecera.tiene_diferencia, true);
    assert.equal(estado.cabecera.bodeguero_id, 9);

    // Alerta al Administrador con la diferencia
    assert.equal(r.tiene_diferencia, true);
    assert.equal(estado.alertas.length, 1);
    assert.match(estado.alertas[0].titulo, /DEV-2026-00001/);
    assert.match(estado.alertas[0].descripcion, /ELE-CBL-0012: declarado 10, recibido 8 \(-2\)/);
    assert.equal(estado.auditoria.length, 1);
});

test('recepción exacta: repone todo, ajusta costo y NO genera alerta', async () => {
    const { estado, cliente } = crearEscenario({ declarada: 10, disponible: 20 });
    const r = await confirmarRecepcionDevolucionEnTransaccion(cliente, 1, [{ id_articulo: 100, cantidad_recibida: 10 }], null, 9);

    assert.equal(estado.stock.get(100)!.disp, 30);
    assert.equal(r.ajuste_costo_total, -15000);
    assert.equal(r.tiene_diferencia, false);
    assert.equal(r.alerta_administrador, null);
    assert.equal(estado.alertas.length, 0);
});

test('recibir 0 unidades: no toca stock, costo ni Cardex, pero alerta la diferencia', async () => {
    const { estado, cliente } = crearEscenario({ declarada: 10, disponible: 20 });
    const r = await confirmarRecepcionDevolucionEnTransaccion(cliente, 1, [{ id_articulo: 100, cantidad_recibida: 0 }], null, 9);

    assert.equal(estado.stock.get(100)!.disp, 20);
    assert.equal(estado.ajustes.length, 0);
    assert.equal(estado.cardex.length, 0);
    assert.equal(r.tiene_diferencia, true);
    assert.equal(estado.alertas.length, 1);
    assert.equal(estado.cabecera.estado, 'Recibida');
});

test('sin PMP usa el precio unitario del catálogo para el costo', async () => {
    const { estado, cliente } = crearEscenario({ dosLineas: true });
    await confirmarRecepcionDevolucionEnTransaccion(
        cliente, 1, [{ id_articulo: 100, cantidad_recibida: 10 }, { id_articulo: 200, cantidad_recibida: 3 }], null, 9
    );
    const ajusteCasco = estado.ajustes.find((a) => a[2] === 200)!;
    assert.equal(ajusteCasco[4], 800);
    assert.equal(ajusteCasco[5], -2400);
});

test('no se puede confirmar dos veces la misma devolución (409) ni una inexistente (404)', async () => {
    const yaRecibida = crearEscenario({ estado: 'Recibida' });
    await assert.rejects(
        () => confirmarRecepcionDevolucionEnTransaccion(yaRecibida.cliente, 1, [{ id_articulo: 100, cantidad_recibida: 8 }], null, 9),
        (e: any) => e.estado === 409
    );
    assert.equal(yaRecibida.estado.stock.get(100)!.disp, 20);

    const { cliente } = crearEscenario();
    await assert.rejects(
        () => confirmarRecepcionDevolucionEnTransaccion(cliente, 99, [{ id_articulo: 100, cantidad_recibida: 1 }], null, 9),
        (e: any) => e.estado === 404
    );
});

test('un dato inválido se rechaza ANTES de modificar stock, costo, Cardex o alertas', async () => {
    const { estado, cliente } = crearEscenario({ dosLineas: true });
    // Primera línea válida (8) y segunda inválida (más de lo declarado): no debe aplicarse ninguna
    await assert.rejects(
        () => confirmarRecepcionDevolucionEnTransaccion(
            cliente, 1, [{ id_articulo: 100, cantidad_recibida: 8 }, { id_articulo: 200, cantidad_recibida: 99 }], null, 9
        ),
        (e: any) => e.estado === 400
    );
    assert.equal(estado.stock.get(100)!.disp, 20);
    assert.equal(estado.ajustes.length, 0);
    assert.equal(estado.cardex.length, 0);
    assert.equal(estado.alertas.length, 0);
    assert.equal(estado.cabecera.estado, 'En tránsito');
});

test('[BACK-2][SCRUM] Intenta declarar una devolución mayor al sobrante real y verifica el bloqueo', async () => {
    // Escenario: Técnico retiró 10 unidades, utilizó 4 unidades, ya devolvió 2 unidades en tránsito.
    // Sobrante real = 10 - 4 - 2 = 4 unidades.
    const clienteMock = {
        query: async (sql: string, params: any[] = []) => {
            if (sql.includes('FROM usuario')) {
                return { rows: [{ id_usuario: 3, nombre: 'Carlos', apellido: 'Técnico', rut: '18.123.456-7' }] };
            }
            if (sql.includes('FROM proyecto')) {
                return { rows: [{ id_proyecto: 5, nombre_proyecto: 'Instalación Fibra', estado_proyecto: 'En ejecución' }] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
                return { rows: [] };
            }
            if (sql.includes('FROM articulo')) {
                return { rows: [{ id_articulo: 100, sku: 'ELE-CBL-0012', nombre_articulo: 'Cable THHN 12 AWG' }] };
            }
            if (sql.includes('FROM salidas_bodega') || sql.includes('FROM egreso_lineas')) {
                return { rows: [{ id_articulo: 100, total_retirado: 10, total: 10 }] };
            }
            if (sql.includes('FROM uso_insumos_proyecto')) {
                return { rows: [{ id_articulo: 100, total_utilizado: 4, total: 4 }] };
            }
            if (sql.includes('FROM devoluciones_tecnico') || sql.includes('FROM devolucion_lineas')) {
                return { rows: [{ id_articulo: 100, total_devuelto: 2, total: 2 }] };
            }
            if (sql.includes('INSERT INTO devoluciones_tecnico')) {
                return { rows: [{ id_devolucion: 99, codigo: 'DEV-2026-00099', codigo_devolucion: 'DEV-2026-00099', fecha_declaracion: new Date() }] };
            }
            if (sql.includes('INSERT INTO devolucion_lineas')) {
                return { rows: [{ id_devolucion_linea: 1 }] };
            }
            if (sql.includes('INSERT INTO alertas_sistema')) {
                return { rows: [{ id_alerta: 1, tipo: 'devolucion_en_transito', severidad: 'info', titulo: 'Devolución', descripcion: 'Test', id_articulo: 100, leida: false, fecha_creacion: new Date().toISOString() }] };
            }
            if (sql.includes('bitacora_auditoria')) {
                return { rows: [] };
            }
            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. Intento con 5 unidades (excede el sobrante real de 4): DEBE FALLAR con 400
    await assert.rejects(
        () => declararDevolucionEnTransaccion(clienteMock, 3, {
            id_proyecto: 5,
            items: [{ id_articulo: 100, cantidad_declarada: 5 }],
        }),
        (err: any) => {
            assert.equal(err.estado, 400);
            assert.match(err.message, /se intentó devolver 5, máximo devolvible 4/);
            return true;
        }
    );

    // 2. Intento con 4 unidades (exactamente el sobrante real): DEBE PASAR y quedar En tránsito
    const exitosa = await declararDevolucionEnTransaccion(clienteMock, 3, {
        id_proyecto: 5,
        items: [{ id_articulo: 100, cantidad_declarada: 4 }],
    });
    assert.equal(exitosa.estado, 'En tránsito');
    assert.equal(exitosa.lineas[0].cantidad_declarada, 4);
    assert.equal(exitosa.lineas[0].cantidad_maxima_devolvible, 4);
});

test('[FRONT-2][SCRUM] Declara una devolución desde el celular y verifica que bloquee el cierre del proyecto en H34 mientras esté en tránsito', async () => {
    // 1. Simulación con devolución en tránsito en devoluciones_tecnico
    const clienteConDevolucion = {
        query: async (sql: string, params: any[] = []) => {
            if (sql.includes("estado = 'En tránsito'")) {
                return {
                    rows: [{ id_devolucion: 42, codigo_devolucion: 'DEV-2026-00042' }],
                };
            }
            return { rows: [] };
        },
    };

    const bloqueo = await verificarBloqueoCierreProyectoPorDevolucionesH34(clienteConDevolucion, 5);
    assert.equal(bloqueo.bloqueado, true);
    assert.equal(bloqueo.devolucionesBloqueantes.length, 1);
    assert.match(bloqueo.motivoBloqueo!, /existen 1 devolución\(es\) en tránsito pendientes de recepción en bodega/);

    // 2. Cuando el bodeguero recepciona la devolución y ya no hay en tránsito:
    const clienteRecepcionada = {
        query: async (sql: string, params: any[] = []) => {
            if (sql.includes("estado = 'En tránsito'")) {
                return { rows: [] };
            }
            return { rows: [] };
        },
    };

    const desbloqueado = await verificarBloqueoCierreProyectoPorDevolucionesH34(clienteRecepcionada, 5);
    assert.equal(desbloqueado.bloqueado, false);
    assert.equal(desbloqueado.motivoBloqueo, null);
});
