import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
    registrarEgresoCuarentenaEnTransaccion,
    resolverDevolucionProveedorEnTransaccion,
} from '../controllers/devolucionProveedorController';
import {
    ESTADO_DEV_PROVEEDOR_PENDIENTE,
    ESTADO_DEV_PROVEEDOR_RESUELTA,
    validarDatosEgresoCuarentena,
} from '../services/devolucionProveedorService';

// ---------------------------------------------------------------------------------------------
// Escenario en memoria que parte del estado dejado en el Sprint 6 tras la recepción mixta:
// 10 unidades conformes en disponible (20 + 10 = 30) y 2 unidades defectuosas en cuarentena (2).
// ---------------------------------------------------------------------------------------------
const crearEscenarioCuarentenaSprint6 = () => {
    const estado = {
        stock: new Map<
            number,
            {
                id_articulo: number;
                sku: string;
                nombre_articulo: string;
                disp: number;
                comp: number;
                cuar: number;
                pmp: number;
                precio: number;
                id_proveedor_principal: number;
                bloqueado_por_conteo: boolean;
                id_conteo_activo: number | null;
            }
        >([
            [
                300,
                {
                    id_articulo: 300,
                    sku: 'CLI-CMP-0010',
                    nombre_articulo: 'Compresor Scroll 3 TR',
                    disp: 30, // Stock disponible sano tras recepción mixta de Sprint 6
                    comp: 0,
                    cuar: 2, // 2 ítems defectuosos dejados en cuarentena en el Sprint 6
                    pmp: 4200,
                    precio: 4500,
                    id_proveedor_principal: 15,
                    bloqueado_por_conteo: false,
                    id_conteo_activo: null,
                },
            ],
        ]),
        proveedores: new Map<number, string>([[15, 'ClimaIndustrial SpA']]),
        devolucionesProv: new Map<
            number,
            {
                id_devolucion_proveedor: number;
                codigo_devolucion: string;
                id_articulo: number;
                id_proveedor: number | null;
                id_orden_compra: number | null;
                cantidad: number;
                motivo: string;
                numero_guia_despacho: string;
                estado: string;
                tipo_resolucion: string | null;
                referencia_resolucion: string | null;
                notas_resolucion: string | null;
                id_movimiento_cardex: number | null;
                id_movimiento_reposicion_cardex: number | null;
            }
        >(),
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
        alertas: [] as { tipo: string; severidad: string; titulo: string; descripcion: string; id_articulo: number }[],
        auditoria: [] as any[],
    };

    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                estado.auditoria.push(p);
                return { rows: [] };
            }

            const etiqueta = /\/\* ([a-z]+:[a-z-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'conteo:check-bloqueo': {
                    const s = estado.stock.get(Number(p[0]));
                    return {
                        rows: s
                            ? [{ bloqueado_por_conteo: s.bloqueado_por_conteo, id_conteo_activo: s.id_conteo_activo }]
                            : [],
                    };
                }
                case 'cuar:select-stock': {
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
                                      cantidad_cuarentena: s.cuar,
                                      pmp: s.pmp,
                                      precio_unitario: s.precio,
                                      id_proveedor_principal: s.id_proveedor_principal,
                                  },
                              ]
                            : [],
                    };
                }
                case 'cuar:select-stock-sku': {
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
                                      cantidad_cuarentena: s.cuar,
                                      pmp: s.pmp,
                                      precio_unitario: s.precio,
                                      id_proveedor_principal: s.id_proveedor_principal,
                                  },
                              ]
                            : [],
                    };
                }
                case 'cuar:select-proveedor': {
                    const nombre = estado.proveedores.get(Number(p[0]));
                    return { rows: nombre ? [{ nombre_proveedor: nombre }] : [] };
                }
                case 'cuar:update-stock-cuarentena': {
                    const s = estado.stock.get(Number(p[0]))!;
                    s.cuar = Number(p[1]);
                    return { rows: [] };
                }
                case 'cuar:update-stock-reposicion': {
                    const s = estado.stock.get(Number(p[0]))!;
                    s.disp = Number(p[1]);
                    return { rows: [] };
                }
                case 'cuar:insert-cabecera': {
                    const idDev = estado.devolucionesProv.size + 1;
                    const codigo = `DEV-PROV-2026-${String(idDev).padStart(5, '0')}`;
                    estado.devolucionesProv.set(idDev, {
                        id_devolucion_proveedor: idDev,
                        codigo_devolucion: codigo,
                        id_articulo: Number(p[0]),
                        id_proveedor: p[1] ?? null,
                        id_orden_compra: p[2] ?? null,
                        cantidad: Number(p[3]),
                        motivo: String(p[4]),
                        numero_guia_despacho: String(p[5]),
                        estado: String(p[6]),
                        tipo_resolucion: null,
                        referencia_resolucion: null,
                        notas_resolucion: null,
                        id_movimiento_cardex: null,
                        id_movimiento_reposicion_cardex: null,
                    });
                    return { rows: [{ id_devolucion_proveedor: idDev, codigo_devolucion: codigo }] };
                }
                case 'cuar:insert-cardex': {
                    const idMov = 700 + estado.cardex.length + 1;
                    estado.cardex.push({
                        id_movimiento: idMov,
                        id_insumo: Number(p[0]),
                        tipo_movimiento: 'Salida',
                        destino_bolsa: 'cuarentena',
                        cantidad: Number(p[1]),
                        costo_unitario: Number(p[2]),
                        saldo_historico: Number(p[3]),
                        pmp_historico: Number(p[4]),
                        valor_total_historico: Number(p[5]),
                        referencia: String(p[7]),
                    });
                    return { rows: [{ id_movimiento: idMov }] };
                }
                case 'cuar:insert-cardex-reposicion': {
                    const idMov = 700 + estado.cardex.length + 1;
                    estado.cardex.push({
                        id_movimiento: idMov,
                        id_insumo: Number(p[0]),
                        tipo_movimiento: 'Entrada',
                        destino_bolsa: 'disponible',
                        cantidad: Number(p[1]),
                        costo_unitario: Number(p[2]),
                        saldo_historico: Number(p[3]),
                        pmp_historico: Number(p[4]),
                        valor_total_historico: Number(p[5]),
                        referencia: String(p[7]),
                    });
                    return { rows: [{ id_movimiento: idMov }] };
                }
                case 'cuar:insert-cardex-simple':
                    return { rows: [] };
                case 'cuar:update-movimiento-cabecera': {
                    const d = estado.devolucionesProv.get(Number(p[0]))!;
                    d.id_movimiento_cardex = Number(p[1]);
                    return { rows: [] };
                }
                case 'cuar:insert-alerta': {
                    estado.alertas.push({
                        tipo: 'devolucion_proveedor_cuarentena',
                        severidad: 'amarillo',
                        titulo: String(p[0]),
                        descripcion: String(p[1]),
                        id_articulo: Number(p[2]),
                    });
                    return { rows: [] };
                }
                case 'cuar:select-cabecera': {
                    const d = estado.devolucionesProv.get(Number(p[0]));
                    return { rows: d ? [{ ...d }] : [] };
                }
                case 'cuar:resolver-cabecera': {
                    const d = estado.devolucionesProv.get(Number(p[0]))!;
                    d.estado = String(p[1]);
                    d.tipo_resolucion = p[2] ?? null;
                    d.referencia_resolucion = p[3] ?? null;
                    d.notas_resolucion = p[4] ?? null;
                    d.id_movimiento_reposicion_cardex = p[5] ?? null;
                    return { rows: [] };
                }
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    return { estado, cliente };
};

test('[BACK-2] validarDatosEgresoCuarentena exige motivo, número de guía y bloquea cantidades mayores a cuarentena', () => {
    // Sin motivo -> 400
    assert.throws(
        () =>
            validarDatosEgresoCuarentena({
                cantidad: 1,
                cuarentenaDisponible: 2,
                motivo: '   ',
                numeroGuiaDespacho: 'GD-100',
            }),
        (err: any) => err.estado === 400 && /motivo.*obligatorio/i.test(err.message)
    );

    // Sin número de guía de despacho -> 400
    assert.throws(
        () =>
            validarDatosEgresoCuarentena({
                cantidad: 1,
                cuarentenaDisponible: 2,
                motivo: 'Bobina dañada de fábrica',
                numeroGuiaDespacho: '',
            }),
        (err: any) => err.estado === 400 && /guía de despacho es obligatorio/i.test(err.message)
    );

    // Cantidad mayor al stock en cuarentena -> 400
    assert.throws(
        () =>
            validarDatosEgresoCuarentena({
                cantidad: 3,
                cuarentenaDisponible: 2,
                motivo: 'Bobina dañada de fábrica',
                numeroGuiaDespacho: 'GD-101',
            }),
        (err: any) => err.estado === 400 && /supera el saldo disponible en cuarentena/i.test(err.message)
    );
});

test('[BACK-2][SCRUM] Devuelve al proveedor los 2 ítems defectuosos dejados en cuarentena en el Sprint 6 y verifica el saldo cero en cuarentena', async () => {
    const { estado, cliente } = crearEscenarioCuarentenaSprint6();

    // Estado inicial heredado del Sprint 6: 30 disponibles sanos y 2 defectuosos en cuarentena
    assert.equal(estado.stock.get(300)!.disp, 30);
    assert.equal(estado.stock.get(300)!.cuar, 2);

    // 1. El Bodeguero registra el egreso desde cuarentena de los 2 ítems defectuosos indicando motivo y guía de despacho
    const egreso = await registrarEgresoCuarentenaEnTransaccion(
        cliente,
        {
            id_articulo: 300,
            id_proveedor: 15,
            cantidad: 2,
            motivo: 'Defectuosos de fábrica detectados en recepción mixta del Sprint 6',
            numero_guia_despacho: 'GD-2026-00842',
        },
        2
    );

    // 2. [SCRUM] Verifica saldo cero en cuarentena y que el stock disponible sano (30) NO se afecte
    assert.equal(egreso.cuarentena_anterior, 2);
    assert.equal(egreso.cuarentena_nuevo, 0, 'el saldo en cuarentena debe quedar exactamente en 0');
    assert.equal(estado.stock.get(300)!.cuar, 0, 'la bolsa de cuarentena en BD queda en 0');
    assert.equal(egreso.disponible_anterior, 30);
    assert.equal(egreso.disponible_nuevo, 30, 'el stock disponible sano permanece intacto en 30');
    assert.equal(estado.stock.get(300)!.disp, 30, 'la bolsa disponible en BD no sufre descuento');

    // 3. Verifica estado inicial 'Pendiente de resolución', motivo y guía de despacho
    assert.equal(egreso.estado, ESTADO_DEV_PROVEEDOR_PENDIENTE);
    assert.equal(egreso.numero_guia_despacho, 'GD-2026-00842');
    assert.match(egreso.motivo, /Sprint 6/);

    // 4. Verifica registro en el Cardex (Salida desde bolsa 'cuarentena' con referencia a la guía)
    assert.equal(estado.cardex.length, 1);
    assert.equal(estado.cardex[0].id_insumo, 300);
    assert.equal(estado.cardex[0].tipo_movimiento, 'Salida');
    assert.equal(estado.cardex[0].destino_bolsa, 'cuarentena');
    assert.equal(estado.cardex[0].cantidad, 2);
    assert.equal(estado.cardex[0].saldo_historico, 0);
    assert.match(estado.cardex[0].referencia, /GD-2026-00842/);

    // 5. Verifica notificación al Administrador para seguimiento hasta obtener Nota de crédito o Reposición
    assert.equal(estado.alertas.length, 1);
    assert.equal(estado.alertas[0].tipo, 'devolucion_proveedor_cuarentena');
    assert.match(estado.alertas[0].titulo, /GD-2026-00842/);
    assert.match(estado.alertas[0].descripcion, /Nota de crédito o Reposición/);

    // 6. Intentar egresar otra unidad cuando la cuarentena ya está en 0 debe rechazarse con 400
    await assert.rejects(
        () =>
            registrarEgresoCuarentenaEnTransaccion(
                cliente,
                {
                    id_articulo: 300,
                    cantidad: 1,
                    motivo: 'Intento sin stock en cuarentena',
                    numero_guia_despacho: 'GD-2026-00843',
                },
                2
            ),
        (err: any) => err.estado === 400 && /supera el saldo disponible en cuarentena \(0\)/i.test(err.message)
    );

    // 7. El Administrador da seguimiento y resuelve la devolución al recibir la Nota de crédito -> pasa a 'Resuelta'
    const resuelta = await resolverDevolucionProveedorEnTransaccion(
        cliente,
        egreso.id_devolucion_proveedor,
        {
            tipo_resolucion: 'Nota de crédito',
            referencia_resolucion: 'NC-2026-00915',
            notas_resolucion: 'Nota de crédito recibida y descontada en contabilidad',
        },
        1
    );
    assert.equal(resuelta.estado, ESTADO_DEV_PROVEEDOR_RESUELTA);
    assert.equal(resuelta.tipo_resolucion, 'Nota de crédito');
    assert.equal(resuelta.referencia_resolucion, 'NC-2026-00915');
    assert.equal(estado.stock.get(300)!.cuar, 0);
    assert.equal(estado.stock.get(300)!.disp, 30);
});

test('[BACK-2] resolver una devolución a proveedor por Reposición reincorpora las unidades sanas a disponible y registra en Cardex', async () => {
    const { estado, cliente } = crearEscenarioCuarentenaSprint6();

    const egreso = await registrarEgresoCuarentenaEnTransaccion(
        cliente,
        {
            id_articulo: 300,
            cantidad: 2,
            motivo: 'Compresores con fuga en válvula de servicio',
            numero_guia_despacho: 'GD-2026-00900',
        },
        2
    );
    assert.equal(estado.stock.get(300)!.cuar, 0);
    assert.equal(estado.stock.get(300)!.disp, 30);

    const resuelta = await resolverDevolucionProveedorEnTransaccion(
        cliente,
        egreso.id_devolucion_proveedor,
        {
            tipo_resolucion: 'Reposición',
            referencia_resolucion: 'GD-PROV-5540',
            notas_resolucion: 'Proveedor envió 2 unidades nuevas en garantía',
        },
        1
    );
    assert.equal(resuelta.estado, ESTADO_DEV_PROVEEDOR_RESUELTA);
    assert.equal(resuelta.tipo_resolucion, 'Reposición');
    assert.equal(estado.stock.get(300)!.disp, 32, 'las 2 unidades repuestas en garantía ingresan al stock disponible sano (30 -> 32)');
    assert.equal(estado.stock.get(300)!.cuar, 0, 'la cuarentena sigue en 0');
    assert.equal(estado.cardex.length, 2, '1 Salida de cuarentena + 1 Entrada a disponible por reposición');
    assert.equal(estado.cardex[1].tipo_movimiento, 'Entrada');
    assert.equal(estado.cardex[1].destino_bolsa, 'disponible');
    assert.equal(estado.cardex[1].cantidad, 2);
});
