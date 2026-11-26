import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { registrarMermaEnTransaccion } from '../controllers/mermaController';
import { validarYValorizarMerma } from '../services/mermaService';

const crearEscenarioMermas = (opts: { disponible?: number; pmp?: number; bloqueadoPorConteo?: boolean } = {}) => {
    const estado = {
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
                400,
                {
                    id_articulo: 400,
                    sku: 'GAS-TUB-0020',
                    nombre_articulo: 'Tubo cobre tipo L 3/4" 6 m',
                    disp: opts.disponible ?? 25,
                    comp: 5,
                    pmp: opts.pmp ?? 12500,
                    precio: 12000,
                    bloqueado_por_conteo: opts.bloqueadoPorConteo ?? false,
                    id_conteo_activo: opts.bloqueadoPorConteo ? 77 : null,
                },
            ],
        ]),
        mermas: [] as any[],
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
                case 'merma:select-stock': {
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
                                  },
                              ]
                            : [],
                    };
                }
                case 'merma:select-stock-sku': {
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
                                  },
                              ]
                            : [],
                    };
                }
                case 'merma:update-stock': {
                    const s = estado.stock.get(Number(p[0]))!;
                    s.disp = Number(p[1]);
                    return { rows: [] };
                }
                case 'merma:insert-cabecera': {
                    const idMerma = estado.mermas.length + 1;
                    const codigo = `MERMA-2026-${String(idMerma).padStart(5, '0')}`;
                    estado.mermas.push({
                        id_merma: idMerma,
                        codigo_merma: codigo,
                        id_articulo: Number(p[0]),
                        cantidad: Number(p[1]),
                        motivo: String(p[2]),
                        observacion: String(p[3]),
                        pmp_unitario: Number(p[4]),
                        perdida_total: Number(p[5]),
                        disponible_anterior: Number(p[6]),
                        disponible_nuevo: Number(p[7]),
                    });
                    return { rows: [{ id_merma: idMerma, codigo_merma: codigo }] };
                }
                case 'merma:insert-cardex': {
                    const idMov = 600 + estado.cardex.length + 1;
                    estado.cardex.push({
                        id_movimiento: idMov,
                        id_insumo: Number(p[0]),
                        tipo_movimiento: 'Salida',
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
                case 'merma:insert-cardex-simple':
                case 'merma:update-movimiento-cabecera':
                    return { rows: [] };
                case 'merma:insert-alerta': {
                    estado.alertas.push({
                        tipo: 'merma_inventario',
                        severidad: 'amarillo',
                        titulo: String(p[0]),
                        descripcion: String(p[1]),
                        id_articulo: Number(p[2]),
                    });
                    return { rows: [] };
                }
            }
            return { rows: [] };
        },
    } as unknown as PoolClient;

    return { estado, cliente };
};

test('[BACK-2] validarYValorizarMerma impide mermas mayores al stock disponible y calcula la pérdida financiera exacta a PMP', () => {
    // Merma mayor al disponible -> 400
    assert.throws(
        () =>
            validarYValorizarMerma({
                cantidad: 26,
                disponibleActual: 25,
                pmpUnitario: 12500,
                motivo: 'Daño',
                observacion: 'Aplastamiento en bodega',
            }),
        (err: any) => err.estado === 400 && /no puede superar el stock disponible \(25\)/i.test(err.message)
    );

    // Merma en 0 o negativa -> 400
    assert.throws(
        () =>
            validarYValorizarMerma({
                cantidad: 0,
                disponibleActual: 25,
                pmpUnitario: 12500,
                motivo: 'Daño',
            }),
        (err: any) => err.estado === 400
    );

    // Sin motivo -> 400
    assert.throws(
        () =>
            validarYValorizarMerma({
                cantidad: 2,
                disponibleActual: 25,
                pmpUnitario: 12500,
                motivo: '  ',
            }),
        (err: any) => err.estado === 400 && /motivo.*obligatorio/i.test(err.message)
    );

    // Cálculo exacto de pérdida financiera: 3 un. * $12.500 PMP = $37.500
    const val = validarYValorizarMerma({
        cantidad: 3,
        disponibleActual: 25,
        pmpUnitario: 12500,
        motivo: 'Daño',
        observacion: 'Tubos doblados durante descarga',
    });
    assert.equal(val.disponible_anterior, 25);
    assert.equal(val.disponible_nuevo, 22);
    assert.equal(val.perdida_total, 37500);
});

test('[BACK-2][SCRUM] Registra una merma por daño y comprueba el descuento de stock, la línea en Cardex y la notificación al Admin', async () => {
    const { estado, cliente } = crearEscenarioMermas({ disponible: 25, pmp: 12500 });

    // 1. Registrar merma por Daño de 3 unidades (stock disponible: 25 -> 22, PMP: $12.500 -> pérdida: $37.500)
    const merma = await registrarMermaEnTransaccion(
        cliente,
        {
            id_articulo: 400,
            cantidad: 3,
            motivo: 'Daño',
            observacion: 'Tubos de cobre aplastados por caída de estantería',
        },
        2
    );

    // 2. Verifica descuento de stock disponible (25 -> 22) y que el comprometido (5) no se altere
    assert.equal(merma.disponible_anterior, 25);
    assert.equal(merma.disponible_nuevo, 22);
    assert.equal(estado.stock.get(400)!.disp, 22, 'el stock disponible baja de 25 a 22');
    assert.equal(estado.stock.get(400)!.comp, 5, 'el stock comprometido permanece intacto');

    // 3. Verifica valorización exacta de la pérdida al PMP actual (3 * $12.500 = $37.500)
    assert.equal(merma.pmp_unitario, 12500);
    assert.equal(merma.perdida_total, 37500);

    // 4. Verifica la línea de salida por merma en el Cardex
    assert.equal(estado.cardex.length, 1);
    assert.equal(estado.cardex[0].id_insumo, 400);
    assert.equal(estado.cardex[0].tipo_movimiento, 'Salida');
    assert.equal(estado.cardex[0].destino_bolsa, 'disponible');
    assert.equal(estado.cardex[0].cantidad, 3);
    assert.equal(estado.cardex[0].costo_unitario, 12500);
    assert.equal(estado.cardex[0].saldo_historico, 27); // 22 disponible + 5 comprometido
    assert.match(estado.cardex[0].referencia, /Salida por merma \(Daño\)/);
    assert.match(estado.cardex[0].referencia, /\$37500/);

    // 5. Verifica la notificación enviada al Administrador
    assert.equal(estado.alertas.length, 1);
    assert.equal(estado.alertas[0].tipo, 'merma_inventario');
    assert.match(estado.alertas[0].titulo, /Merma registrada \(Daño\): GAS-TUB-0020/);
    assert.match(estado.alertas[0].descripcion, /pérdida total: \$37500/);

    // 6. Verifica auditoría inmutable
    assert.equal(estado.auditoria.length, 1);
});

test('[BACK-2] una merma mayor al stock disponible se rechaza en transacción sin tocar stock, Cardex ni alertas', async () => {
    const { estado, cliente } = crearEscenarioMermas({ disponible: 10, pmp: 12500 });

    await assert.rejects(
        () =>
            registrarMermaEnTransaccion(
                cliente,
                {
                    id_articulo: 400,
                    cantidad: 11,
                    motivo: 'Daño',
                    observacion: 'Excede disponible',
                },
                2
            ),
        (err: any) => err.estado === 400 && /no puede superar el stock disponible \(10\)/i.test(err.message)
    );

    assert.equal(estado.stock.get(400)!.disp, 10);
    assert.equal(estado.cardex.length, 0);
    assert.equal(estado.alertas.length, 0);
    assert.equal(estado.mermas.length, 0);
});
