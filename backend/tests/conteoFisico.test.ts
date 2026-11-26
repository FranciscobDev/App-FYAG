import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
    iniciarConteoFisicoEnTransaccion,
    registrarConteoFisicoEnTransaccion,
    resolverConteoPendienteAdminEnTransaccion,
    verificarInsumoNoBloqueadoPorConteo,
} from '../controllers/conteoFisicoController';
import { registrarEgresoSolicitudEnTransaccion } from '../controllers/solicitudController';
import {
    calcularDiferenciaConteo,
    normalizarCantidadContada,
} from '../services/conteoFisicoService';

// ---------------------------------------------------------------------------------------------
// Escenario en memoria que simula PostgreSQL para conteo físico + egresos de bodega + Cardex
// ---------------------------------------------------------------------------------------------
const crearEscenarioConteo = (opts: { umbralH39?: number } = {}) => {
    const estado = {
        umbralH39: opts.umbralH39 ?? 5,
        stock: new Map<
            number,
            {
                id_articulo: number;
                sku: string;
                nombre_articulo: string;
                disp: number;
                comp: number;
                pmp: number;
                precio: number;
                bloqueado_por_conteo: boolean;
                id_conteo_activo: number | null;
            }
        >([
            [
                100,
                {
                    id_articulo: 100,
                    sku: 'ELE-CBL-0012',
                    nombre_articulo: 'Cable THHN 12 AWG',
                    disp: 100,
                    comp: 10,
                    pmp: 1500,
                    precio: 1400,
                    bloqueado_por_conteo: false,
                    id_conteo_activo: null,
                },
            ],
            [
                200,
                {
                    id_articulo: 200,
                    sku: 'GAS-VAL-0020',
                    nombre_articulo: 'Válvula de bola 3/4"',
                    disp: 50,
                    comp: 8,
                    pmp: 2000,
                    precio: 1900,
                    bloqueado_por_conteo: false,
                    id_conteo_activo: null,
                },
            ],
        ]),
        conteos: new Map<
            number,
            {
                id_conteo: number;
                codigo_conteo: string;
                id_articulo: number;
                stock_sistema: number;
                stock_contado: number | null;
                diferencia_cantidad: number | null;
                diferencia_porcentaje: number | null;
                pmp_unitario: number;
                diferencia_valor: number | null;
                umbral_porcentaje: number;
                estado: string;
                bloqueo_activo: boolean;
                observaciones: string | null;
                motivo_rechazo: string | null;
                bodeguero_id: number | null;
                aprobador_id: number | null;
                id_movimiento_cardex: number | null;
            }
        >(),
        solicitudes: new Map<
            number,
            {
                id_solicitud: number;
                proyecto_id: number;
                estado: string;
                nro_comprobante: string;
                lineas: {
                    id_solicitud_linea: number;
                    id_articulo: number;
                    sku: string;
                    nombre_articulo: string;
                    cantidad_solicitada: number;
                    cantidad_entregada: number;
                    precio_unitario: number;
                }[];
            }
        >([
            [
                1,
                {
                    id_solicitud: 1,
                    proyecto_id: 10,
                    estado: 'Aprobada',
                    nro_comprobante: 'COMP-2026-00001',
                    lineas: [
                        {
                            id_solicitud_linea: 101,
                            id_articulo: 100,
                            sku: 'ELE-CBL-0012',
                            nombre_articulo: 'Cable THHN 12 AWG',
                            cantidad_solicitada: 10,
                            cantidad_entregada: 0,
                            precio_unitario: 1500,
                        },
                        {
                            id_solicitud_linea: 102,
                            id_articulo: 200,
                            sku: 'GAS-VAL-0020',
                            nombre_articulo: 'Válvula de bola 3/4"',
                            cantidad_solicitada: 8,
                            cantidad_entregada: 0,
                            precio_unitario: 2000,
                        },
                    ],
                },
            ],
        ]),
        cardex: [] as {
            id_movimiento: number;
            id_insumo: number;
            tipo_movimiento: string;
            destino_bolsa: string;
            cantidad: number;
            costo_unitario: number;
            saldo_historico: number;
            pmp_historico: number;
            valor_total_historico: number;
            referencia: string;
        }[],
        alertas: [] as { tipo: string; titulo: string; descripcion: string; id_articulo: number }[],
        auditoria: [] as any[],
        egresos: [] as any[],
    };

    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                estado.auditoria.push(p);
                return { rows: [] };
            }

            const etiqueta = /\/\* (conteo:[a-z-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'conteo:check-bloqueo': {
                    const s = estado.stock.get(Number(p[0]));
                    return {
                        rows: s
                            ? [{ bloqueado_por_conteo: s.bloqueado_por_conteo, id_conteo_activo: s.id_conteo_activo }]
                            : [],
                    };
                }
                case 'conteo:select-umbral':
                    return { rows: [{ valor: estado.umbralH39 }] };
                case 'conteo:select-stock': {
                    const s = estado.stock.get(Number(p[0]));
                    return {
                        rows: s
                            ? [
                                  {
                                      id_articulo: s.id_articulo,
                                      sku: s.sku,
                                      nombre_articulo: s.nombre_articulo,
                                      cantidad_disponible: s.disp,
                                      cantidad_comprometida: s.comp,
                                      pmp: s.pmp,
                                      precio_unitario: s.precio,
                                      bloqueado_por_conteo: s.bloqueado_por_conteo,
                                      id_conteo_activo: s.id_conteo_activo,
                                  },
                              ]
                            : [],
                    };
                }
                case 'conteo:select-stock-sku': {
                    const s = Array.from(estado.stock.values()).find(
                        (item) => item.sku.toUpperCase() === String(p[0]).trim().toUpperCase()
                    );
                    return {
                        rows: s
                            ? [
                                  {
                                      id_articulo: s.id_articulo,
                                      sku: s.sku,
                                      nombre_articulo: s.nombre_articulo,
                                      cantidad_disponible: s.disp,
                                      cantidad_comprometida: s.comp,
                                      pmp: s.pmp,
                                      precio_unitario: s.precio,
                                      bloqueado_por_conteo: s.bloqueado_por_conteo,
                                      id_conteo_activo: s.id_conteo_activo,
                                  },
                              ]
                            : [],
                    };
                }
                case 'conteo:insert-inicio': {
                    const idConteo = estado.conteos.size + 1;
                    const codigoConteo = `CNT-2026-${String(idConteo).padStart(5, '0')}`;
                    estado.conteos.set(idConteo, {
                        id_conteo: idConteo,
                        codigo_conteo: codigoConteo,
                        id_articulo: Number(p[0]),
                        stock_sistema: Number(p[1]),
                        stock_contado: null,
                        diferencia_cantidad: null,
                        diferencia_porcentaje: null,
                        pmp_unitario: Number(p[2]),
                        diferencia_valor: null,
                        umbral_porcentaje: Number(p[3]),
                        estado: String(p[4]),
                        bloqueo_activo: true,
                        observaciones: p[5] ?? null,
                        motivo_rechazo: null,
                        bodeguero_id: p[6] ?? null,
                        aprobador_id: null,
                        id_movimiento_cardex: null,
                    });
                    return { rows: [{ id_conteo: idConteo, codigo_conteo: codigoConteo }] };
                }
                case 'conteo:insert-cabecera': {
                    const idConteo = estado.conteos.size + 1;
                    const codigoConteo = `CNT-2026-${String(idConteo).padStart(5, '0')}`;
                    estado.conteos.set(idConteo, {
                        id_conteo: idConteo,
                        codigo_conteo: codigoConteo,
                        id_articulo: Number(p[0]),
                        stock_sistema: Number(p[1]),
                        stock_contado: Number(p[2]),
                        diferencia_cantidad: Number(p[3]),
                        diferencia_porcentaje: Number(p[4]),
                        pmp_unitario: Number(p[5]),
                        diferencia_valor: Number(p[6]),
                        umbral_porcentaje: Number(p[7]),
                        estado: String(p[8]),
                        bloqueo_activo: Boolean(p[9]),
                        observaciones: p[10] ?? null,
                        motivo_rechazo: null,
                        bodeguero_id: p[11] ?? null,
                        aprobador_id: null,
                        id_movimiento_cardex: null,
                    });
                    return { rows: [{ id_conteo: idConteo, codigo_conteo: codigoConteo }] };
                }
                case 'conteo:bloquear-stock': {
                    const s = estado.stock.get(Number(p[0]))!;
                    s.bloqueado_por_conteo = true;
                    s.id_conteo_activo = Number(p[1]);
                    return { rows: [] };
                }
                case 'conteo:desbloquear-stock': {
                    const s = estado.stock.get(Number(p[0]))!;
                    s.bloqueado_por_conteo = false;
                    s.id_conteo_activo = null;
                    return { rows: [] };
                }
                case 'conteo:select-cabecera':
                case 'conteo:select-cabecera-admin': {
                    const c = estado.conteos.get(Number(p[0]));
                    return { rows: c ? [{ ...c }] : [] };
                }
                case 'conteo:update-stock-directo': {
                    const s = estado.stock.get(Number(p[0]))!;
                    s.disp = Number(p[1]);
                    s.bloqueado_por_conteo = false;
                    s.id_conteo_activo = null;
                    return { rows: [] };
                }
                case 'conteo:insert-cardex': {
                    const idMov = 800 + estado.cardex.length + 1;
                    estado.cardex.push({
                        id_movimiento: idMov,
                        id_insumo: Number(p[0]),
                        tipo_movimiento: 'Ajuste',
                        destino_bolsa: 'disponible',
                        cantidad: Number(p[1]),
                        costo_unitario: Number(p[2]),
                        saldo_historico: Number(p[3]),
                        pmp_historico: Number(p[4]),
                        valor_total_historico: Number(p[5]),
                        referencia: String(p[6]),
                    });
                    return { rows: [{ id_movimiento: idMov }] };
                }
                case 'conteo:insert-cardex-simple':
                    return { rows: [] };
                case 'conteo:update-cabecera': {
                    const c = estado.conteos.get(Number(p[0]))!;
                    c.stock_sistema = Number(p[1]);
                    c.stock_contado = Number(p[2]);
                    c.diferencia_cantidad = Number(p[3]);
                    c.diferencia_porcentaje = Number(p[4]);
                    c.pmp_unitario = Number(p[5]);
                    c.diferencia_valor = Number(p[6]);
                    c.umbral_porcentaje = Number(p[7]);
                    c.estado = String(p[8]);
                    c.bloqueo_activo = c.estado === 'Pendiente aprobación';
                    if (c.estado === 'Ajustado directo') {
                        c.id_movimiento_cardex = p[9] ?? null;
                    }
                    return { rows: [] };
                }
                case 'conteo:resolver-cabecera': {
                    const c = estado.conteos.get(Number(p[0]))!;
                    c.estado = String(p[1]);
                    c.bloqueo_activo = false;
                    c.aprobador_id = p[2] ?? null;
                    if (c.estado === 'Aprobado') {
                        c.id_movimiento_cardex = p[3] ?? null;
                    } else {
                        c.motivo_rechazo = p[3] ?? null;
                    }
                    return { rows: [] };
                }
                case 'conteo:insert-alerta': {
                    estado.alertas.push({
                        tipo: 'conteo_pendiente_aprobacion',
                        titulo: String(p[0]),
                        descripcion: String(p[1]),
                        id_articulo: Number(p[2]),
                    });
                    return { rows: [] };
                }
            }

            // Consultas de registrarEgresoSolicitudEnTransaccion para probar el bloqueo de salidas
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.includes('FROM solicitudes_insumos') && q.includes('id_solicitud = $1')) {
                const sol = estado.solicitudes.get(Number(p[0]));
                return {
                    rows: sol
                        ? [
                              {
                                  id_solicitud: sol.id_solicitud,
                                  proyecto_id: sol.proyecto_id,
                                  nombre_proyecto: 'Proyecto Faena Norte',
                                  estado_proyecto: 'Activo',
                                  bodeguero_id: 2,
                                  estado: sol.estado,
                                  nro_comprobante: sol.nro_comprobante,
                              },
                          ]
                        : [],
                };
            }
            if (q.includes('FROM solicitud_lineas sl') && q.includes('WHERE sl.id_solicitud = $1')) {
                const sol = estado.solicitudes.get(Number(p[0]));
                return { rows: sol ? sol.lineas.map((l) => ({ ...l })) : [] };
            }
            if (q.startsWith('SELECT COALESCE(cantidad_disponible, 0)::float8 AS cantidad_disponible')) {
                const s = estado.stock.get(Number(p[0]));
                return {
                    rows: s
                        ? [
                              {
                                  cantidad_disponible: s.disp,
                                  cantidad_comprometida: s.comp,
                                  pmp: s.pmp,
                                  bloqueado_por_conteo: s.bloqueado_por_conteo,
                              },
                          ]
                        : [],
                };
            }
            if (q.startsWith('INSERT INTO egresos_bodega')) {
                const idEgreso = estado.egresos.length + 1;
                estado.egresos.push({ id_egreso: idEgreso });
                return { rows: [{ id_egreso: idEgreso }] };
            }
            if (q.startsWith('UPDATE articulos_stock SET cantidad_comprometida')) {
                const s = estado.stock.get(Number(p[1]))!;
                s.comp = Number(p[0]);
                return { rows: [] };
            }
            if (q.startsWith('UPDATE solicitud_lineas SET cantidad_entregada')) {
                const sol = estado.solicitudes.get(1)!;
                const lin = sol.lineas.find((l) => l.id_solicitud_linea === Number(p[1]));
                if (lin) lin.cantidad_entregada = Number(p[0]);
                return { rows: [] };
            }
            if (q.startsWith('INSERT INTO movimientos_inventario')) {
                const idMov = 900 + estado.cardex.length + 1;
                estado.cardex.push({
                    id_movimiento: idMov,
                    id_insumo: Number(p[0]),
                    tipo_movimiento: 'Salida',
                    destino_bolsa: 'comprometido',
                    cantidad: Number(p[1]),
                    costo_unitario: Number(p[2]),
                    saldo_historico: Number(p[3]),
                    pmp_historico: Number(p[4]),
                    valor_total_historico: Number(p[5]),
                    referencia: String(p[6]),
                });
                return { rows: [{ id_movimiento: idMov }] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    return { estado, cliente };
};

test('[BACK-1] calcularDiferenciaConteo calcula diferencia en cantidad, % y valor a PMP y separa <= umbral de > umbral', () => {
    // 2 % de diferencia sobre 100 un. a PMP $1.500 (umbral 5 %) -> Ajuste directo
    const calc2Pct = calcularDiferenciaConteo({
        stockSistema: 100,
        stockContado: 98,
        pmpUnitario: 1500,
        umbralPorcentaje: 5,
    });
    assert.equal(calc2Pct.diferencia_cantidad, -2);
    assert.equal(calc2Pct.diferencia_porcentaje, -2);
    assert.equal(calc2Pct.diferencia_porcentaje_abs, 2);
    assert.equal(calc2Pct.diferencia_valor, -3000);
    assert.equal(calc2Pct.requiere_aprobacion_admin, false);
    assert.equal(calc2Pct.estado_resultante, 'Ajustado directo');

    // Exactamente 5 % (en el límite del umbral H39) -> Ajuste directo
    const calc5Pct = calcularDiferenciaConteo({
        stockSistema: 100,
        stockContado: 105,
        pmpUnitario: 1500,
        umbralPorcentaje: 5,
    });
    assert.equal(calc5Pct.diferencia_cantidad, 5);
    assert.equal(calc5Pct.diferencia_porcentaje, 5);
    assert.equal(calc5Pct.diferencia_valor, 7500);
    assert.equal(calc5Pct.requiere_aprobacion_admin, false);
    assert.equal(calc5Pct.estado_resultante, 'Ajustado directo');

    // 10 % de diferencia sobre 50 un. a PMP $2.000 (umbral 5 %) -> Pendiente aprobación del Admin
    const calc10Pct = calcularDiferenciaConteo({
        stockSistema: 50,
        stockContado: 45,
        pmpUnitario: 2000,
        umbralPorcentaje: 5,
    });
    assert.equal(calc10Pct.diferencia_cantidad, -5);
    assert.equal(calc10Pct.diferencia_porcentaje, -10);
    assert.equal(calc10Pct.diferencia_porcentaje_abs, 10);
    assert.equal(calc10Pct.diferencia_valor, -10000);
    assert.equal(calc10Pct.requiere_aprobacion_admin, true);
    assert.equal(calc10Pct.estado_resultante, 'Pendiente aprobación');

    // Validación de cantidad contada inválida
    assert.throws(() => normalizarCantidadContada(-1), (e: any) => e.estado === 400);
    assert.throws(() => normalizarCantidadContada(1.1234), (e: any) => e.estado === 400);
});

test('[BACK-1][SCRUM] Prueba un conteo con 2 % de diferencia (ajuste directo) y otro con 10 % (pasa a aprobación del Admin) intentando hacer una salida mientras está bloqueado', async () => {
    const { estado, cliente } = crearEscenarioConteo({ umbralH39: 5 });

    // =========================================================================
    // 1. Iniciar conteo físico del Insumo #100 (stock sistema = 100, PMP = $1.500)
    // =========================================================================
    const inicio100 = await iniciarConteoFisicoEnTransaccion(
        cliente,
        { id_articulo: 100, observaciones: 'Conteo cíclico pasillo eléctrico' },
        2
    );
    assert.equal(inicio100.estado, 'En conteo');
    assert.equal(inicio100.bloqueo_activo, true);
    assert.equal(estado.stock.get(100)!.bloqueado_por_conteo, true);

    // =========================================================================
    // 2. [SCRUM] Intentar hacer una salida/egreso de bodega mientras está bloqueado en conteo
    // =========================================================================
    await assert.rejects(
        () =>
            registrarEgresoSolicitudEnTransaccion(cliente, 1, {
                bodeguero_id: 2,
                tecnico_retira_id: 7,
                tecnico_retira_rut: '16.543.210-9',
                tecnico_retira_nombre: 'Sebastián Mora',
                items: [{ id_articulo: 100, cantidad_egreso: 4 }],
            }),
        (err: any) => {
            assert.equal(err.estado, 409);
            assert.match(err.message, /Movimiento bloqueado.*en proceso de conteo físico/i);
            return true;
        },
        'debe bloquear cualquier salida del insumo mientras se está contando'
    );
    assert.equal(estado.egresos.length, 0, 'no debe registrarse ningún egreso');
    assert.equal(estado.cardex.length, 0, 'no debe tocarse el Cardex durante el bloqueo');

    // =========================================================================
    // 3. [SCRUM] Registrar conteo con 2 % de diferencia (98 contadas vs 100 sistema -> -2 % <= 5 %)
    //    -> Ajusta stock y Cardex directamente y desbloquea el insumo
    // =========================================================================
    const conteo2Pct = await registrarConteoFisicoEnTransaccion(
        cliente,
        { id_conteo: inicio100.id_conteo, stock_contado: 98 },
        2
    );
    assert.equal(conteo2Pct.estado, 'Ajustado directo');
    assert.equal(conteo2Pct.requiere_aprobacion_admin, false);
    assert.equal(conteo2Pct.bloqueo_activo, false);
    assert.equal(conteo2Pct.diferencia_cantidad, -2);
    assert.equal(conteo2Pct.diferencia_porcentaje, -2);
    assert.equal(conteo2Pct.diferencia_valor, -3000); // -2 * $1.500 PMP
    assert.equal(estado.stock.get(100)!.disp, 98, 'el stock disponible se ajusta directamente a 98');
    assert.equal(estado.stock.get(100)!.bloqueado_por_conteo, false, 'el insumo queda desbloqueado tras el ajuste directo');
    assert.equal(estado.cardex.length, 1, 'se genera 1 movimiento de ajuste en el Cardex');
    assert.equal(estado.cardex[0].tipo_movimiento, 'Ajuste');
    assert.equal(estado.cardex[0].cantidad, 2);
    assert.equal(estado.cardex[0].saldo_historico, 108); // 98 disponible + 10 comprometido
    assert.equal(estado.alertas.length, 0, 'no requiere alerta de aprobación para <= 5%');

    // =========================================================================
    // 4. [SCRUM] Conteo con 10 % de diferencia sobre Insumo #200 (45 contadas vs 50 sistema -> -10 % > 5 %)
    //    -> Queda Pendiente de aprobación del Admin, NO ajusta stock ni Cardex aún y MANTIENE bloqueado el insumo
    // =========================================================================
    const conteo10Pct = await registrarConteoFisicoEnTransaccion(
        cliente,
        { id_articulo: 200, stock_contado: 45, observaciones: 'Faltante detectado en estantería B' },
        2
    );
    assert.equal(conteo10Pct.estado, 'Pendiente aprobación');
    assert.equal(conteo10Pct.requiere_aprobacion_admin, true);
    assert.equal(conteo10Pct.bloqueo_activo, true);
    assert.equal(conteo10Pct.diferencia_cantidad, -5);
    assert.equal(conteo10Pct.diferencia_porcentaje, -10);
    assert.equal(conteo10Pct.diferencia_valor, -10000); // -5 * $2.000 PMP
    assert.equal(estado.stock.get(200)!.disp, 50, 'el stock NO se modifica hasta que firme el Administrador');
    assert.equal(estado.stock.get(200)!.bloqueado_por_conteo, true, 'el insumo permanece bloqueado mientras espera firma del Admin');
    assert.equal(estado.cardex.length, 1, 'no se genera movimiento en Cardex mientras está pendiente de aprobación');
    assert.equal(estado.alertas.length, 1, 'se notifica al Administrador del conteo retenido (> 5%)');

    // Intentar hacer una salida del Insumo #200 mientras está retenido esperando aprobación del Admin -> Bloqueado (409)
    await assert.rejects(
        () =>
            registrarEgresoSolicitudEnTransaccion(cliente, 1, {
                bodeguero_id: 2,
                tecnico_retira_id: 7,
                tecnico_retira_rut: '16.543.210-9',
                tecnico_retira_nombre: 'Sebastián Mora',
                items: [{ id_articulo: 200, cantidad_egreso: 2 }],
            }),
        (err: any) => {
            assert.equal(err.estado, 409);
            assert.match(err.message, /Movimiento bloqueado.*en proceso de conteo físico/i);
            return true;
        },
        'debe bloquear salidas mientras el conteo > 5% está pendiente de firma del Admin'
    );

    // =========================================================================
    // 5. El Administrador aprueba el conteo del 10 % -> Se ajusta stock a 45, se registra en Cardex y se desbloquea
    // =========================================================================
    const aprobadoAdmin = await resolverConteoPendienteAdminEnTransaccion(
        cliente,
        conteo10Pct.id_conteo,
        { accion: 'aprobar' },
        1
    );
    assert.equal(aprobadoAdmin.estado, 'Aprobado');
    assert.equal(aprobadoAdmin.bloqueo_activo, false);
    assert.equal(estado.stock.get(200)!.disp, 45, 'tras la firma del Admin el stock disponible baja a 45');
    assert.equal(estado.stock.get(200)!.bloqueado_por_conteo, false, 'el insumo queda desbloqueado');
    assert.equal(estado.cardex.length, 2, 'se registra el movimiento de ajuste en el Cardex tras la aprobación');
    assert.equal(estado.cardex[1].id_insumo, 200);
    assert.equal(estado.cardex[1].tipo_movimiento, 'Ajuste');
    assert.equal(estado.cardex[1].cantidad, 5);

    // Ahora que está desbloqueado, la salida física en bodega se ejecuta sin bloqueo
    await verificarInsumoNoBloqueadoPorConteo(cliente, 200);
});

test('[BACK-1] rechazar un conteo retenido exige motivo, restaura disponibilidad sin tocar stock ni Cardex y desbloquea', async () => {
    const { estado, cliente } = crearEscenarioConteo({ umbralH39: 5 });

    const retenido = await registrarConteoFisicoEnTransaccion(
        cliente,
        { id_articulo: 200, stock_contado: 40 }, // -20% > 5%
        2
    );
    assert.equal(retenido.estado, 'Pendiente aprobación');
    assert.equal(estado.stock.get(200)!.bloqueado_por_conteo, true);

    // Rechazar sin motivo falla con 400
    await assert.rejects(
        () => resolverConteoPendienteAdminEnTransaccion(cliente, retenido.id_conteo, { accion: 'rechazar', motivo_rechazo: '  ' }, 1),
        (err: any) => err.estado === 400
    );

    // Rechazar con motivo desbloquea sin alterar stock ni Cardex
    const rechazado = await resolverConteoPendienteAdminEnTransaccion(
        cliente,
        retenido.id_conteo,
        { accion: 'rechazar', motivo_rechazo: 'Recontar caja sellada en bodega auxiliar' },
        1
    );
    assert.equal(rechazado.estado, 'Rechazado');
    assert.equal(estado.stock.get(200)!.disp, 50, 'el stock permanece en 50');
    assert.equal(estado.stock.get(200)!.bloqueado_por_conteo, false, 'el insumo se desbloquea');
    assert.equal(estado.cardex.length, 0, 'no se genera movimiento en Cardex al rechazar');
});
