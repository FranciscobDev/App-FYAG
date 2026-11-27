import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
    consultarAlertasUsuarioEnTransaccion,
    crearAlertaConDespachoOpcionalEnTransaccion,
    marcarAlertaLeidaEnTransaccion,
    marcarTodasAlertasLeidasEnTransaccion,
} from '../controllers/alertaController';
import { CorreoSaliente, fijarEnviadorCorreo } from '../services/correo';

interface AlertaMemoria {
    id_alerta: number;
    tipo: string;
    severidad: string;
    titulo: string;
    descripcion: string;
    id_articulo: number | null;
    id_orden_compra: number | null;
    rol_destino: string | null;
    id_usuario_destino: number | null;
    leida: boolean;
    fecha_creacion: string;
    fecha_lectura: string | null;
    correo_enviado: boolean;
    destinatario_correo: string | null;
}

const crearEscenarioAlertas = () => {
    const ahora = Date.now();
    const hace10Dias = new Date(ahora - 10 * 24 * 60 * 60 * 1000).toISOString();
    const hace120Dias = new Date(ahora - 120 * 24 * 60 * 60 * 1000).toISOString(); // Fuera de la ventana de 90 días

    const estado = {
        diasRetencion: 90,
        configCorreo: new Map<string, { enviar_correo: boolean; correo_destino_defecto: string | null }>([
            ['discrepancia_factura_recepcion', { enviar_correo: true, correo_destino_defecto: 'adminfyag@gmail.com' }],
            ['merma_inventario', { enviar_correo: true, correo_destino_defecto: 'adminfyag@gmail.com' }],
            ['devolucion_en_transito', { enviar_correo: false, correo_destino_defecto: 'bodegafyag@gmail.com' }],
        ]),
        alertas: [
            // H3: Stock mínimo con OC borrador -> Admin
            {
                id_alerta: 1,
                tipo: 'stock_minimo_oc',
                severidad: 'amarillo',
                titulo: 'Stock bajo mínimo: ELE-CBL-0012',
                descripcion: 'Disponible (4) <= Mínimo (10). Borrador OC generado.',
                id_articulo: 100,
                id_orden_compra: 11,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: true,
                destinatario_correo: 'admin@fyag.cl',
            },
            // H17: Merma de inventario -> Admin
            {
                id_alerta: 2,
                tipo: 'merma_inventario',
                severidad: 'amarillo',
                titulo: 'Merma registrada (Daño): GAS-TUB-0020 (-3 un. / $37500)',
                descripcion: 'Tubos aplastados en descarga.',
                id_articulo: 400,
                id_orden_compra: null,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: true,
                destinatario_correo: 'admin@fyag.cl',
            },
            // H19: Conteo físico retenido (> 5%) -> Admin
            {
                id_alerta: 3,
                tipo: 'conteo_pendiente_aprobacion',
                severidad: 'amarillo',
                titulo: 'Conteo físico retenido (-10% > 5%): GAS-VAL-0020',
                descripcion: 'Requiere firma del Administrador.',
                id_articulo: 200,
                id_orden_compra: null,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: true,
                destinatario_correo: 'admin@fyag.cl',
            },
            // H21: Devolución en tránsito declarada por técnico -> Bodeguero
            {
                id_alerta: 4,
                tipo: 'devolucion_en_transito',
                severidad: 'amarillo',
                titulo: 'Devolución DEV-2026-00001 en tránsito hacia Bodega',
                descripcion: 'Carlos Técnico declaró devolver 4 x ELE-CBL-0012.',
                id_articulo: 100,
                id_orden_compra: null,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: false,
                destinatario_correo: null,
            },
            // H22: Diferencia en devolución de técnico -> Admin
            {
                id_alerta: 5,
                tipo: 'diferencia_devolucion',
                severidad: 'amarillo',
                titulo: 'Diferencia en devolución DEV-2026-00001',
                descripcion: 'Declaradas 10, recibidas 8.',
                id_articulo: 100,
                id_orden_compra: null,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: true,
                destinatario_correo: 'admin@fyag.cl',
            },
            // H24: Egreso de cuarentena a proveedor -> Admin
            {
                id_alerta: 6,
                tipo: 'devolucion_proveedor_cuarentena',
                severidad: 'amarillo',
                titulo: 'Egreso de cuarentena DEV-PROV-2026-00001 (Guía GD-842)',
                descripcion: 'Pendiente Nota de crédito o Reposición.',
                id_articulo: 300,
                id_orden_compra: null,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: true,
                destinatario_correo: 'admin@fyag.cl',
            },
            // H25: Discrepancia de OC / Factura vs Recepción -> Admin
            {
                id_alerta: 7,
                tipo: 'discrepancia_factura_recepcion',
                severidad: 'rojo',
                titulo: 'Discrepancia Factura FAC-9901 vs Recepción OC-2026-0012',
                descripcion: 'Facturadas 12 un., recibidas conformes 10 un.',
                id_articulo: 300,
                id_orden_compra: 12,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: true,
                destinatario_correo: 'admin@fyag.cl',
            },
            // H33: Discrepancia en recepción de OC -> Admin y Bodeguero
            {
                id_alerta: 8,
                tipo: 'recepcion_discrepancia',
                severidad: 'amarillo',
                titulo: 'Recepción OC-2026-0012 con 2 defectuosos en cuarentena',
                descripcion: '10 conformes a disponible y 2 defectuosos a cuarentena.',
                id_articulo: 300,
                id_orden_compra: 12,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: false,
                destinatario_correo: null,
            },
            // Alerta propia de Técnico (asignación a faena)
            {
                id_alerta: 9,
                tipo: 'asignacion_proyecto_tecnico',
                severidad: 'info',
                titulo: 'Asignación a Proyecto Faena Norte',
                descripcion: 'Fuiste asignado como técnico responsable en terreno.',
                id_articulo: null,
                id_orden_compra: null,
                rol_destino: 'technician',
                id_usuario_destino: 3,
                leida: false,
                fecha_creacion: hace10Dias,
                fecha_lectura: null,
                correo_enviado: false,
                destinatario_correo: null,
            },
            // Alerta antigua de hace 120 días (> 90 días de retención) -> No debe aparecer
            {
                id_alerta: 10,
                tipo: 'merma_inventario',
                severidad: 'amarillo',
                titulo: 'Merma histórica (> 90 días)',
                descripcion: 'No debe mostrarse por superar los 90 días de conservación.',
                id_articulo: 100,
                id_orden_compra: null,
                rol_destino: null,
                id_usuario_destino: null,
                leida: false,
                fecha_creacion: hace120Dias,
                fecha_lectura: null,
                correo_enviado: false,
                destinatario_correo: null,
            },
        ] as AlertaMemoria[],
    };

    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            const etiqueta = /\/\* (alerta:[a-z-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'alerta:select-retencion':
                    return { rows: [{ valor: estado.diasRetencion }] };
                case 'alerta:select-todas': {
                    const dias = Number(p[0]) || 90;
                    const corteMs = Date.now() - dias * 24 * 60 * 60 * 1000;
                    return {
                        rows: estado.alertas
                            .filter((a) => new Date(a.fecha_creacion).getTime() >= corteMs)
                            .map((a) => ({ ...a })),
                    };
                }
                case 'alerta:select-por-id': {
                    const item = estado.alertas.find((a) => a.id_alerta === Number(p[0]));
                    return { rows: item ? [{ ...item }] : [] };
                }
                case 'alerta:marcar-leida': {
                    const item = estado.alertas.find((a) => a.id_alerta === Number(p[0]));
                    if (item) {
                        item.leida = true;
                        item.fecha_lectura = item.fecha_lectura ?? new Date().toISOString();
                    }
                    return { rows: [] };
                }
                case 'alerta:marcar-lote-leidas': {
                    const ids: number[] = Array.isArray(p[0]) ? p[0].map(Number) : [];
                    for (const a of estado.alertas) {
                        if (ids.includes(a.id_alerta)) {
                            a.leida = true;
                            a.fecha_lectura = a.fecha_lectura ?? new Date().toISOString();
                        }
                    }
                    return { rows: [] };
                }
                case 'alerta:select-config-correo': {
                    const cfg = estado.configCorreo.get(String(p[0]));
                    return { rows: cfg ? [cfg] : [] };
                }
                case 'alerta:insert': {
                    const idNuevo = estado.alertas.length + 1;
                    const fecha = new Date().toISOString();
                    estado.alertas.push({
                        id_alerta: idNuevo,
                        tipo: String(p[0]),
                        severidad: String(p[1]),
                        titulo: String(p[2]),
                        descripcion: String(p[3]),
                        id_articulo: p[4] ?? null,
                        id_orden_compra: p[5] ?? null,
                        rol_destino: p[6] ?? null,
                        id_usuario_destino: p[7] ?? null,
                        leida: false,
                        fecha_creacion: fecha,
                        fecha_lectura: null,
                        correo_enviado: Boolean(p[8]),
                        destinatario_correo: p[9] ?? null,
                    });
                    return { rows: [{ id_alerta: idNuevo, fecha_creacion: fecha }] };
                }
            }
            return { rows: [] };
        },
    } as unknown as PoolClient;

    return { estado, cliente };
};

test('[BACK-1][SCRUM] Verifica que un Técnico no reciba alertas de OC (H25) ni mermas (H17)', async () => {
    const { cliente } = crearEscenarioAlertas();

    // 1. Consultar bandeja de alertas como Técnico (id_usuario: 3, rol: 'technician')
    const bandejaTecnico = await consultarAlertasUsuarioEnTransaccion(cliente, {
        id_usuario: 3,
        rol: 'technician',
    });

    const tiposRecibidosPorTecnico = bandejaTecnico.alertas.map((a) => a.tipo);
    const historiasRecibidasPorTecnico = bandejaTecnico.alertas.map((a) => a.codigo_historia);

    // [SCRUM] Garantía estricta: El Técnico NO recibe alertas de OC (H25) ni de Mermas (H17)
    assert.equal(
        tiposRecibidosPorTecnico.includes('discrepancia_factura_recepcion'),
        false,
        'Un Técnico jamás debe recibir alertas de Órdenes de Compra / Facturas (H25)'
    );
    assert.equal(
        tiposRecibidosPorTecnico.includes('orden_compra'),
        false,
        'Un Técnico jamás debe recibir alertas de OC (H25)'
    );
    assert.equal(
        tiposRecibidosPorTecnico.includes('merma_inventario'),
        false,
        'Un Técnico jamás debe recibir alertas de Mermas (H17)'
    );
    assert.equal(historiasRecibidasPorTecnico.includes('H25'), false);
    assert.equal(historiasRecibidasPorTecnico.includes('H17'), false);

    // Tampoco recibe alertas de H3 (stock mínimo), H19 (conteo), H22 (diferencia devolución), H24 (cuarentena) ni H33
    assert.equal(bandejaTecnico.alertas.length, 1, 'Solo ve la alerta propia de su rol de Técnico');
    assert.equal(bandejaTecnico.alertas[0].tipo, 'asignacion_proyecto_tecnico');
    assert.equal(bandejaTecnico.total_no_leidas, 1);

    // 2. Si el Técnico intenta marcar como leída una alerta de OC (#7, H25) o de Merma (#2, H17), recibe 403 Forbidden
    await assert.rejects(
        () => marcarAlertaLeidaEnTransaccion(cliente, 7, { id_usuario: 3, rol: 'technician' }),
        (err: any) => err.estado === 403 && /no corresponde a tu rol/i.test(err.message)
    );
    await assert.rejects(
        () => marcarAlertaLeidaEnTransaccion(cliente, 2, { id_usuario: 3, rol: 'technician' }),
        (err: any) => err.estado === 403 && /no corresponde a tu rol/i.test(err.message)
    );
});

test('[BACK-1] Centraliza alertas de H3, H17, H19, H21, H22, H24, H25 y H33 según rol, conserva 90 días y actualiza contador de no leídas', async () => {
    const { cliente } = crearEscenarioAlertas();

    // 1. Administrador ve H3, H17, H19, H22, H24, H25 y H33 (7 alertas dentro de los 90 días; la #10 de hace 120 días se excluye)
    const bandejaAdmin = await consultarAlertasUsuarioEnTransaccion(cliente, {
        id_usuario: 1,
        rol: 'admin',
    });
    const historiasAdmin = bandejaAdmin.alertas.map((a) => a.codigo_historia).sort();
    assert.deepEqual(historiasAdmin, ['H17', 'H19', 'H22', 'H24', 'H25', 'H3', 'H33']);
    assert.equal(bandejaAdmin.total_no_leidas, 7);
    assert.equal(
        bandejaAdmin.alertas.some((a) => a.id_alerta === 10),
        false,
        'las alertas con más de 90 días no se muestran'
    );

    // 2. Bodeguero ve únicamente H21 (devolución en tránsito) y H33 (recepción), nunca H17 (mermas) ni H25 (discrepancia factura)
    const bandejaBodega = await consultarAlertasUsuarioEnTransaccion(cliente, {
        id_usuario: 2,
        rol: 'warehouse',
    });
    const historiasBodega = bandejaBodega.alertas.map((a) => a.codigo_historia).sort();
    assert.deepEqual(historiasBodega, ['H21', 'H33']);
    assert.equal(bandejaBodega.total_no_leidas, 2);

    // 3. Marcar 1 alerta del Administrador como leída -> el contador baja en tiempo real de 7 a 6
    const lectura1 = await marcarAlertaLeidaEnTransaccion(cliente, 2, { id_usuario: 1, rol: 'admin' });
    assert.equal(lectura1.alerta.id_alerta, 2);
    assert.equal(lectura1.alerta.leida, true);
    assert.ok(lectura1.alerta.fecha_lectura);
    assert.equal(lectura1.total_no_leidas, 6);

    // 4. Marcar todas las restantes del Administrador como leídas -> el contador queda en 0, sin afectar las de Bodega
    const lecturaTodasAdmin = await marcarTodasAlertasLeidasEnTransaccion(cliente, {
        id_usuario: 1,
        rol: 'admin',
    });
    assert.equal(lecturaTodasAdmin.marcadas, 6);
    assert.equal(lecturaTodasAdmin.total_no_leidas, 0);

    // La alerta H21 (#4) exclusiva de Bodega sigue no leída para el Bodeguero
    const bandejaBodegaDespues = await consultarAlertasUsuarioEnTransaccion(cliente, {
        id_usuario: 2,
        rol: 'warehouse',
    });
    assert.equal(bandejaBodegaDespues.total_no_leidas, 1);
});

test('[BACK-1] Despacho opcional por correo electrónico según el tipo de alerta', async () => {
    const { cliente } = crearEscenarioAlertas();
    const correosEnviados: CorreoSaliente[] = [];
    fijarEnviadorCorreo(async (correo) => {
        correosEnviados.push(correo);
    });

    try {
        // 1. Alerta H17 (merma_inventario) tiene enviar_correo = TRUE en su configuración -> despacha correo
        const alertaConCorreo = await crearAlertaConDespachoOpcionalEnTransaccion(cliente, {
            tipo: 'merma_inventario',
            severidad: 'amarillo',
            titulo: 'Merma por rotura: ELE-DIS-0016',
            descripcion: '2 unidades dañadas en transporte.',
            id_articulo: 500,
        });
        assert.equal(alertaConCorreo.correo_enviado, true);
        assert.equal(alertaConCorreo.destinatario_correo, 'adminfyag@gmail.com');
        assert.equal(correosEnviados.length, 1);
        assert.match(correosEnviados[0].asunto, /\[FYAG • H17\]/);

        // 2. Alerta H21 (devolucion_en_transito) tiene enviar_correo = FALSE por defecto -> NO despacha correo
        const alertaSinCorreo = await crearAlertaConDespachoOpcionalEnTransaccion(cliente, {
            tipo: 'devolucion_en_transito',
            severidad: 'amarillo',
            titulo: 'Devolución DEV-2026-00015 en tránsito',
            descripcion: 'Pendiente recepción en bodega.',
        });
        assert.equal(alertaSinCorreo.correo_enviado, false);
        assert.equal(correosEnviados.length, 1, 'no debe enviar correo cuando el tipo de alerta lo tiene desactivado');
    } finally {
        fijarEnviadorCorreo();
    }
});
