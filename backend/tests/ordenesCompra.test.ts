import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    ESTADOS_OC,
    TRANSICIONES_VALIDAS_OC,
    calcularPmpHistorico,
    ejecutarRecepcionOrdenCompraEnTransaccion,
    insertarFacturaCompraEnTransaccion,
    validarEdicionOrdenCompra,
    validarTransicionEstadoOc,
} from '../controllers/ordenCompraController';
import {
    DatosPdfOrdenCompra,
    construirCorreoOrdenCompra,
    generarPdfOrdenCompra,
} from '../services/ocPdfService';
import type { PoolClient } from 'pg';
import {
    CONSULTA_INSUMOS_BAJO_MINIMO_SIN_OC_ABIERTA,
    detectarInsumosBajoMinimoSinOcAbierta,
    evaluarReposicionArticuloEnTransaccion,
    requiereReposicionPorStockMinimo,
    resolverCantidadReposicionCatalogo,
} from '../services/motorReposicionService';
import {
    actualizarLineaChecklistTablet,
    aplicarEntregaChecklistEnOrden,
    calcularSaldoPendienteLineaOc,
    construirChecklistInicialDesdeOc,
} from '../services/recepcionChecklistService';
import {
    calcularLineaFacturaCascada,
    calcularPmpConCostoNetoFactura,
    calcularPmpExactoSinErrorRedondeo,
    calcularTotalesFacturaCascada,
    detectarDiscrepanciasFacturaConRecepcion,
} from '../services/facturaCalculoService';
import {
    aplicarReservaComprometidoEnCatalogoH6,
    calcularRemanenteContenedorGranel,
    calcularResumenLineaSalidaFisica,
    calcularResumenSolicitudSalidaFisica,
    construirComprobanteYNotificacionAprobacion,
    construirNotificacionRechazoSolicitud,
    contrastarSaldoInsumoConUltimaLineaCardex,
    ejecutarSalidaFisicaSolicitudEnMemoria,
    esProyectoActivoParaSolicitud,
    filtrarYOrdenarCardexSoloLectura,
    formatearCantidadMovimientoBodega,
    generarContenidoExcelCardex,
    generarNumeroComprobanteSolicitud,
    liberarReservaComprometidoEnCatalogoH6,
    obtenerEstadoAccionesBodegueroSolicitud,
    sanitizarEntradaCantidadBodega,
    validarFormularioNuevaSolicitudInsumos,
} from '../services/solicitudInsumosService';
import {
    ESTADOS_SOLICITUD_INSUMOS,
    anularSolicitudInsumosEnTransaccion,
    editarSolicitudInsumosEnTransaccion,
    emitirSolicitudInsumosEnTransaccion,
    insertarSalidaBodegaDbEnTransaccion,
    insertarSolicitudInsumosDbEnTransaccion,
    intentarEliminarSalidaBodegaEnDb,
    rechazarModificacionEgresoInmutable,
    registrarEgresoSolicitudEnTransaccion,
    resolverSolicitudInsumosEnTransaccion,
    verificarBloqueoCierreProyectoPorSolicitudesH34,
} from '../controllers/solicitudController';

const datosEjemplo: DatosPdfOrdenCompra = {
    id_orden_compra: 15,
    numero_oc: 'OC-2026-00015',
    estado: 'Enviada',
    origen: 'Manual',
    fecha_emision: '2026-11-19',
    fecha_estimada_oc: '2026-11-26',
    observaciones: 'Entregar en Bodega Central antes de las 16:00 hrs.',
    proveedor: {
        id_proveedor: 1,
        nombre_proveedor: 'ElectroChile S.A.',
        razon_social: 'Comercializadora Electrica Chile S.A.',
        rut_proveedor: '96.543.210-K',
        correo_contacto: 'ventas@electrochile.cl',
        telefono: '+56 2 2678 9000',
        direccion: 'Av. Matta 1234, Santiago',
    },
    lineas: [
        {
            sku: 'EL-CAB-001',
            nombre_articulo: 'Cable THHN 12 AWG Rojo',
            unidad: 'm',
            cantidad: 200,
            precio_unitario: 650,
            subtotal_linea: 130000,
        },
        {
            sku: 'EL-DIS-003',
            nombre_articulo: 'Disyuntor Termomagnetico 1x16A',
            unidad: 'un',
            cantidad: 10,
            precio_unitario: 4500,
            subtotal_linea: 45000,
        },
    ],
    subtotal_neto: 175000,
    iva: 33250,
    total: 208250,
    aprobado_por: 'Javier Munoz Contreras',
};

test('[BACK-1] contempla los 6 estados oficiales del ciclo de vida de la OC', () => {
    assert.deepEqual(ESTADOS_OC, [
        'Borrador',
        'Enviada',
        'Recibida parcial',
        'Recibida',
        'Cerrada',
        'Anulada',
    ]);
});

test('[BACK-1] generarPdfOrdenCompra produce un binario PDF 1.4 corporativo válido con número correlativo, proveedor, ítems y totales', () => {
    const pdf = generarPdfOrdenCompra(datosEjemplo);
    assert.ok(Buffer.isBuffer(pdf), 'debe devolver un Buffer');
    assert.ok(pdf.length > 800, 'el PDF debe tener contenido estructurado');

    const contenido = pdf.toString('latin1');
    assert.ok(contenido.startsWith('%PDF-1.4\n'), 'debe iniciar con cabecera estándar %PDF-1.4');
    assert.ok(contenido.trimEnd().endsWith('%%EOF'), 'debe cerrar con marcador %%EOF');
    assert.ok(contenido.includes('FYAG MULTISYSTEM SpA'), 'debe incluir membrete corporativo FYAG');
    assert.ok(contenido.includes('ORDEN DE COMPRA'), 'debe incluir título del documento');
    assert.ok(contenido.includes('OC-2026-00015'), 'debe incluir el número correlativo de la OC');
    assert.ok(contenido.includes('96.543.210-K'), 'debe incluir el RUT del proveedor');
    assert.ok(contenido.includes('EL-CAB-001'), 'debe incluir el SKU del insumo');
    assert.ok(contenido.includes('Cable THHN 12 AWG Rojo'), 'debe incluir la descripción del insumo');
    assert.ok(contenido.includes('$175.000'), 'debe incluir el subtotal neto formateado en CLP');
    assert.ok(contenido.includes('$33.250'), 'debe incluir el IVA (19%) formateado en CLP');
    assert.ok(contenido.includes('$208.250'), 'debe incluir el total con IVA formateado en CLP');
});

test('[BACK-1][SCRUM] construirCorreoOrdenCompra adjunta el PDF corporativo con nombre correlativo y destinatario del proveedor', () => {
    const pdf = generarPdfOrdenCompra(datosEjemplo);
    const correo = construirCorreoOrdenCompra(datosEjemplo, pdf, 'ventas@electrochile.cl');

    assert.equal(correo.para, 'ventas@electrochile.cl');
    assert.ok(correo.asunto.includes('OC-2026-00015'), 'el asunto debe incluir el número correlativo');
    assert.ok(correo.texto.includes('OC-2026-00015'), 'el cuerpo de texto debe referenciar el número de OC');
    assert.ok(correo.texto.includes('$208.250'), 'el cuerpo debe indicar el monto total con IVA');
    assert.ok(Array.isArray(correo.adjuntos) && correo.adjuntos.length === 1, 'debe llevar exactamente 1 adjunto PDF');

    const adjunto = correo.adjuntos![0];
    assert.equal(adjunto.filename, 'OC-2026-00015.pdf');
    assert.equal(adjunto.contentType, 'application/pdf');
    assert.equal(adjunto.content.length, pdf.length);
    assert.ok(adjunto.content.toString('latin1').startsWith('%PDF-1.4'));
});

test('[BACK-2][SCRUM] permite editar OC solo en estado Borrador y bloquea modificaciones de cantidades en Enviada, Recibida parcial, Recibida, Cerrada y Anulada', () => {
    assert.equal(validarEdicionOrdenCompra('Borrador'), null, 'en Borrador debe permitir edición');

    for (const estadoBloqueado of ['Enviada', 'Recibida parcial', 'Recibida', 'Cerrada', 'Anulada'] as const) {
        const error = validarEdicionOrdenCompra(estadoBloqueado);
        assert.ok(error, `debe bloquear edición cuando el estado es ${estadoBloqueado}`);
        assert.ok(
            error.includes(estadoBloqueado) && error.includes('Borrador'),
            `el mensaje debe indicar el estado actual (${estadoBloqueado}) y que solo es editable en Borrador`
        );
    }
});

test('[BACK-2] gestiona transiciones de estado válidas y rechaza transiciones inválidas o desde estados terminales', () => {
    // Transiciones válidas del ciclo de vida
    assert.equal(validarTransicionEstadoOc('Borrador', 'Enviada'), null);
    assert.equal(validarTransicionEstadoOc('Borrador', 'Anulada'), null);
    assert.equal(validarTransicionEstadoOc('Enviada', 'Recibida parcial'), null);
    assert.equal(validarTransicionEstadoOc('Enviada', 'Recibida'), null);
    assert.equal(validarTransicionEstadoOc('Enviada', 'Anulada'), null);
    assert.equal(validarTransicionEstadoOc('Recibida parcial', 'Recibida'), null);
    assert.equal(validarTransicionEstadoOc('Recibida parcial', 'Cerrada'), null);
    assert.equal(validarTransicionEstadoOc('Recibida', 'Cerrada'), null);

    // Transiciones inválidas que deben rechazarse
    assert.ok(validarTransicionEstadoOc('Borrador', 'Recibida'), 'no puede saltar de Borrador a Recibida sin enviarse');
    assert.ok(validarTransicionEstadoOc('Borrador', 'Cerrada'), 'no puede saltar de Borrador a Cerrada');
    assert.ok(validarTransicionEstadoOc('Enviada', 'Borrador'), 'una OC enviada no puede volver a Borrador');
    assert.ok(validarTransicionEstadoOc('Recibida', 'Borrador'), 'una OC recibida no puede volver a Borrador');
    assert.ok(validarTransicionEstadoOc('Recibida', 'Anulada'), 'una OC ya recibida no puede anularse');
    assert.ok(validarTransicionEstadoOc('Cerrada', 'Enviada'), 'Cerrada es estado terminal');
    assert.ok(validarTransicionEstadoOc('Anulada', 'Borrador'), 'Anulada es estado terminal');
    assert.ok(validarTransicionEstadoOc('Anulada', 'Enviada'), 'una OC anulada no puede enviarse');
    assert.equal(TRANSICIONES_VALIDAS_OC.Cerrada.length, 0);
    assert.equal(TRANSICIONES_VALIDAS_OC.Anulada.length, 0);
});

test('[BACK-1] motor automático detecta condición de stock mínimo (disponible <= mínimo) y usa proveedor predeterminado y cantidad de reposición del catálogo (H35)', () => {
    // Disponible menor al mínimo -> dispara reposición
    assert.equal(requiereReposicionPorStockMinimo(true, 8, 10, 1), true);
    // Disponible exactamente igual al mínimo -> dispara reposición
    assert.equal(requiereReposicionPorStockMinimo(true, 10, 10, 1), true);
    // Disponible mayor al mínimo -> no dispara
    assert.equal(requiereReposicionPorStockMinimo(true, 11, 10, 1), false);
    // Insumo inactivo o sin proveedor predeterminado -> no dispara
    assert.equal(requiereReposicionPorStockMinimo(false, 2, 10, 1), false);
    assert.equal(requiereReposicionPorStockMinimo(true, 2, 10, null), false);

    // Cantidad de reposición del catálogo (H35)
    assert.equal(resolverCantidadReposicionCatalogo(75, 15), 75, 'debe usar cant_reposicion del catálogo');
    assert.equal(resolverCantidadReposicionCatalogo(0, 15), 30, 'si cant_reposicion es 0 usa el doble del stock mínimo');
});

test('[BACK-1][SCRUM] dispara la condición de stock mínimo dos veces seguidas en el motor automático y verifica que cree un único borrador, genere alerta H40 y no duplique la OC', async () => {
    const ordenesCreadas: {
        id_orden_compra: number;
        numero_oc: string;
        proveedor_id: number;
        estado: 'Borrador' | 'Enviada';
        origen: string;
        observaciones: string;
    }[] = [];
    const lineasCreadas: { id_oc_linea: number; id_orden_compra: number; id_articulo: number; cantidad_orden: number; precio_unitario: number }[] = [];
    const alertasH40: { id_alerta: number; tipo: string; severidad: string; titulo: string; descripcion: string; id_articulo: number; id_orden_compra: number }[] = [];
    let stockDisponibleActual = 10; // <= stock_minimo (15)
    let secuenciaOc = 40;

    const clienteSimulado = {
        query: async (sql: string, params: any[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM articulo a') && q.includes('FOR UPDATE OF a')) {
                return {
                    rows: [
                        {
                            id_articulo: 7,
                            nombre_articulo: 'Bomba de Condensado Silenciosa 220V',
                            sku: 'CLI-BOM-0050',
                            precio_unitario: 31800,
                            id_proveedor: 2,
                            activo: true,
                            cantidad_disponible: stockDisponibleActual,
                            stock_minimo: 15,
                            cant_reposicion: 45,
                        },
                    ],
                };
            }

            if (q.startsWith('SELECT id_proveedor, nombre_proveedor, activo FROM proveedor')) {
                return {
                    rows: [{ id_proveedor: 2, nombre_proveedor: 'TermoClima Limitada', activo: true }],
                };
            }

            if (q.includes("AND oc.estado IN ('Borrador', 'Enviada', 'Recibida parcial')")) {
                const abierta = ordenesCreadas.find((o) =>
                    lineasCreadas.some((l) => l.id_orden_compra === o.id_orden_compra && l.id_articulo === params[0])
                );
                return { rows: abierta ? [abierta] : [] };
            }

            if (q.startsWith('DO $$')) {
                return { rows: [] };
            }

            if (q.includes("NEXTVAL('seq_numero_oc')")) {
                secuenciaOc += 1;
                return { rows: [{ siguiente: `OC-2026-${String(secuenciaOc).padStart(5, '0')}` }] };
            }

            if (q.startsWith('SELECT 1 FROM ordenes_compra WHERE numero_oc = $1')) {
                return { rows: [] };
            }

            if (q.startsWith('INSERT INTO ordenes_compra')) {
                const nueva = {
                    id_orden_compra: ordenesCreadas.length + 1,
                    numero_oc: params[0],
                    proveedor_id: params[1],
                    estado: 'Borrador' as const,
                    origen: 'Stock Critico',
                    observaciones: params[2],
                };
                ordenesCreadas.push(nueva);
                return { rows: [{ id_orden_compra: nueva.id_orden_compra }] };
            }

            if (q.startsWith('INSERT INTO oc_lineas')) {
                lineasCreadas.push({
                    id_oc_linea: lineasCreadas.length + 1,
                    id_orden_compra: params[0],
                    id_articulo: params[1],
                    cantidad_orden: params[2],
                    precio_unitario: params[3],
                });
                return { rows: [] };
            }

            if (q.startsWith('INSERT INTO alertas_sistema')) {
                const alerta = {
                    id_alerta: alertasH40.length + 1,
                    tipo: 'stock_minimo_oc',
                    severidad: params[0],
                    titulo: params[1],
                    descripcion: params[2],
                    id_articulo: params[3],
                    id_orden_compra: params[4],
                    leida: false,
                    fecha_creacion: new Date('2026-11-19T12:00:00Z'),
                };
                alertasH40.push(alerta);
                return { rows: [alerta] };
            }

            if (q.includes('FROM ordenes_compra oc JOIN proveedor p')) {
                const oc = ordenesCreadas.find((o) => o.id_orden_compra === Number(params[0]));
                if (!oc) return { rows: [] };
                return {
                    rows: [
                        {
                            ...oc,
                            nombre_proveedor: 'TermoClima Limitada',
                            razon_social_proveedor: 'Distribuidora TermoClima Limitada',
                            rut_proveedor: '95.123.890-5',
                            correo_proveedor: 'contacto@termoclima.cl',
                            telefono_proveedor: '+56 2 2789 0123',
                            direccion_proveedor: 'Av. Vicuna Mackenna 4500, Macul',
                            fecha_estimada_oc: '2026-11-26',
                            fecha_creacion: new Date('2026-11-19T12:00:00Z'),
                            fecha_aprobacion: null,
                            id_usuario_aprobador: null,
                            correo_enviado_a: null,
                            fecha_envio_correo: null,
                        },
                    ],
                };
            }

            if (q.includes('FROM oc_lineas l')) {
                const ls = lineasCreadas.filter((l) => l.id_orden_compra === Number(params[0]));
                return {
                    rows: ls.map((l) => ({
                        ...l,
                        sku: 'CLI-BOM-0050',
                        nombre_articulo: 'Bomba de Condensado Silenciosa 220V',
                        unidad: 'un',
                        cantidad_recibida: 0,
                    })),
                };
            }

            if (q.startsWith('INSERT INTO bitacora_auditoria')) {
                return { rows: [] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. Primer disparo con stock = 10 (<= 15)
    const disparo1 = await evaluarReposicionArticuloEnTransaccion(clienteSimulado, 7, 1);
    assert.ok(disparo1);
    assert.equal(disparo1.creada, true, 'el primer disparo debe crear el borrador automático de OC');
    assert.equal(disparo1.orden_compra?.estado, 'Borrador', 'debe quedar en Borrador sin enviarse hasta aprobación');
    assert.equal(disparo1.orden_compra?.proveedor_id, 2, 'debe usar el proveedor predeterminado (H35)');
    assert.equal(disparo1.orden_compra?.lineas[0].cantidad_orden, 45, 'debe usar la cantidad de reposición del catálogo (45) (H35)');
    assert.ok(disparo1.alerta_h40, 'debe generar alerta para H40');
    assert.ok((disparo1.pdf_corporativo_bytes ?? 0) > 800, 'debe generar su PDF corporativo con numeración correlativa');
    assert.equal(ordenesCreadas.length, 1);
    assert.equal(alertasH40.length, 1);

    // 2. Segundo disparo seguido (stock baja de 10 a 4, sigue bajo el mínimo de 15)
    stockDisponibleActual = 4;
    const disparo2 = await evaluarReposicionArticuloEnTransaccion(clienteSimulado, 7, 1);
    assert.ok(disparo2);
    assert.equal(disparo2.creada, false, '[SCRUM] el segundo disparo seguido NO debe duplicar la OC');
    assert.equal(disparo2.orden_compra?.numero_oc, disparo1.orden_compra?.numero_oc, 'debe mantener la misma OC abierta');
    assert.equal(ordenesCreadas.length, 1, 'debe existir exactamente 1 OC en total');
    assert.equal(alertasH40.length, 1, 'debe existir exactamente 1 alerta H40 en total');
});

test('[DB][SCRUM] consulta optimizada detecta solo insumos activos con disponible <= stock_minimo que no tengan ninguna OC abierta (Borrador, Enviada o Recibida parcial)', async () => {
    // 1. Verificar estructura SQL de la consulta optimizada
    const sqlNorm = CONSULTA_INSUMOS_BAJO_MINIMO_SIN_OC_ABIERTA.replace(/\s+/g, ' ').trim();
    assert.ok(sqlNorm.includes('WHERE a.activo = TRUE'), 'debe filtrar solo insumos activos');
    assert.ok(
        sqlNorm.includes('COALESCE(s.cantidad_disponible, 0) <= COALESCE(s.stock_minimo, 0)'),
        'debe filtrar insumos con disponible <= stock_minimo'
    );
    assert.ok(sqlNorm.includes('AND NOT EXISTS'), 'debe usar anti-join NOT EXISTS para excluir OC abiertas');
    assert.ok(
        sqlNorm.includes("oc.estado IN ('Borrador', 'Enviada', 'Recibida parcial')"),
        'debe excluir exactamente los 3 estados de OC abierta: Borrador, Enviada y Recibida parcial'
    );

    // 2. [SCRUM] Simular catálogo con insumos con y sin OC abierta y probar detectarInsumosBajoMinimoSinOcAbierta
    const catalogoArticulos = [
        // Caso 1: Activo, bajo mínimo (5 <= 10), SIN ninguna OC -> DEBE INCLUIRSE
        { id_articulo: 101, sku: 'SIN-OC-01', nombre_articulo: 'Insumo Sin OC', categoria: 'Materiales', id_proveedor: 1, id_unidad: 1, precio_unitario: 1500, activo: true, cantidad_disponible: 5, stock_minimo: 10, cant_reposicion: 30 },
        // Caso 2: Activo, igual al mínimo (10 <= 10), con OC en 'Borrador' -> DEBE EXCLUIRSE
        { id_articulo: 102, sku: 'CON-BORR-02', nombre_articulo: 'Insumo Con OC Borrador', categoria: 'Materiales', id_proveedor: 1, id_unidad: 1, precio_unitario: 2000, activo: true, cantidad_disponible: 10, stock_minimo: 10, cant_reposicion: 25 },
        // Caso 3: Activo, bajo mínimo (2 <= 15), con OC en 'Enviada' -> DEBE EXCLUIRSE
        { id_articulo: 103, sku: 'CON-ENV-03', nombre_articulo: 'Insumo Con OC Enviada', categoria: 'Equipos', id_proveedor: 2, id_unidad: 1, precio_unitario: 8000, activo: true, cantidad_disponible: 2, stock_minimo: 15, cant_reposicion: 40 },
        // Caso 4: Activo, bajo mínimo (4 <= 12), con OC en 'Recibida parcial' -> DEBE EXCLUIRSE
        { id_articulo: 104, sku: 'CON-PARC-04', nombre_articulo: 'Insumo Con OC Parcial', categoria: 'Consumibles', id_proveedor: 2, id_unidad: 1, precio_unitario: 3500, activo: true, cantidad_disponible: 4, stock_minimo: 12, cant_reposicion: 36 },
        // Caso 5: Activo, bajo mínimo (3 <= 10), pero su única OC previa está 'Anulada' o 'Cerrada' (no abierta) -> DEBE INCLUIRSE
        { id_articulo: 105, sku: 'OC-CERR-05', nombre_articulo: 'Insumo Con OC Cerrada/Anulada', categoria: 'Seguridad', id_proveedor: 3, id_unidad: 1, precio_unitario: 5000, activo: true, cantidad_disponible: 3, stock_minimo: 10, cant_reposicion: 20 },
        // Caso 6: Activo, sobre el mínimo (25 > 10), sin OC -> DEBE EXCLUIRSE
        { id_articulo: 106, sku: 'STOCK-OK-06', nombre_articulo: 'Insumo Stock Suficiente', categoria: 'Materiales', id_proveedor: 1, id_unidad: 1, precio_unitario: 1200, activo: true, cantidad_disponible: 25, stock_minimo: 10, cant_reposicion: 30 },
        // Caso 7: Inactivo (activo = false), bajo mínimo (1 <= 10), sin OC -> DEBE EXCLUIRSE
        { id_articulo: 107, sku: 'INACT-07', nombre_articulo: 'Insumo Inactivo', categoria: 'Herramientas', id_proveedor: 1, id_unidad: 1, precio_unitario: 9000, activo: false, cantidad_disponible: 1, stock_minimo: 10, cant_reposicion: 15 },
    ];

    const ocsEnBase: { id_orden_compra: number; estado: string; id_articulo: number }[] = [
        { id_orden_compra: 1, estado: 'Borrador', id_articulo: 102 },
        { id_orden_compra: 2, estado: 'Enviada', id_articulo: 103 },
        { id_orden_compra: 3, estado: 'Recibida parcial', id_articulo: 104 },
        { id_orden_compra: 4, estado: 'Anulada', id_articulo: 105 },
        { id_orden_compra: 5, estado: 'Cerrada', id_articulo: 105 },
    ];

    const estadosAbiertos = new Set(['Borrador', 'Enviada', 'Recibida parcial']);

    const consultorSimulado: Pick<PoolClient, 'query'> = {
        query: (async (sql: string) => {
            assert.equal(sql, CONSULTA_INSUMOS_BAJO_MINIMO_SIN_OC_ABIERTA);
            const filas = catalogoArticulos.filter((a) => {
                if (!a.activo) return false;
                if (a.stock_minimo <= 0 || a.cantidad_disponible > a.stock_minimo) return false;
                const tieneOcAbierta = ocsEnBase.some(
                    (oc) => oc.id_articulo === a.id_articulo && estadosAbiertos.has(oc.estado)
                );
                return !tieneOcAbierta;
            });
            return { rows: filas };
        }) as unknown as PoolClient['query'],
    };

    const detectados = await detectarInsumosBajoMinimoSinOcAbierta(consultorSimulado);
    const idsDetectados = detectados.map((d) => d.id_articulo);

    assert.deepEqual(
        idsDetectados,
        [101, 105],
        'debe devolver únicamente los insumos activos bajo mínimo que no tienen OC en Borrador, Enviada ni Recibida parcial'
    );
    assert.equal(detectados[0].sku, 'SIN-OC-01');
    assert.equal(detectados[0].cant_reposicion, 30);
    assert.equal(detectados[1].sku, 'OC-CERR-05');
    assert.equal(detectados[1].cant_reposicion, 20);
});

test('[FRONT-1][SCRUM] checklist de recepción en vista tablet permite recibir una OC en dos entregas parciales, envía defectuosos a cuarentena, muestra saldos pendientes y alerta si no coincide con lo facturado', () => {
    const ocInicial = {
        id: '201',
        code: 'OC-2026-00201',
        supplierId: '1',
        supplier: 'ElectroChile S.A.',
        supplierRut: '96.543.210-K',
        status: 'enviada' as const,
        items: [
            {
                sku: 'EL-CAB-001',
                name: 'Cable THHN 12 AWG Rojo',
                quantity: 50,
                unitPrice: 650,
                unit: 'm',
                receivedQuantity: 0,
                defectiveQuantity: 0,
                missingQuantity: 50,
            },
            {
                sku: 'EL-DIS-003',
                name: 'Disyuntor 1x16A',
                quantity: 20,
                unitPrice: 4500,
                unit: 'un',
                receivedQuantity: 0,
                defectiveQuantity: 0,
                missingQuantity: 20,
            },
        ],
        subtotal: 122500,
        iva: 23275,
        total: 145775,
        itemsCount: 2,
        date: '2026-11-19',
        expectedDate: '2026-11-26',
    };

    // 1. Al seleccionar la OC en la vista tablet, el checklist carga las líneas con el total por recibir
    const checklistEntrega1 = construirChecklistInicialDesdeOc(ocInicial);
    assert.equal(checklistEntrega1.length, 2);
    assert.equal(checklistEntrega1[0].received, 50);
    assert.equal(checklistEntrega1[1].received, 20);

    // 2. [SCRUM] PRIMERA ENTREGA PARCIAL EN TABLET:
    //    - Línea 1 (50m pedidos): llegan 20m conformes y 2m defectuosos -> quedan 28m faltantes/pendientes en la entrega
    //    - Línea 2 (20un pedidas): llegan 10un conformes -> quedan 10un faltantes/pendientes
    let linea1Mod = actualizarLineaChecklistTablet(checklistEntrega1[0], 50, { received: 20 }, true);
    linea1Mod = actualizarLineaChecklistTablet(linea1Mod, 50, { defective: 2 }, true);
    assert.equal(linea1Mod.received, 20, '20m conformes a stock');
    assert.equal(linea1Mod.defective, 2, '2m defectuosos a cuarentena');
    assert.equal(linea1Mod.missing, 28, 'calcula automáticamente 28m faltantes en esta entrega');

    const linea2Mod = actualizarLineaChecklistTablet(checklistEntrega1[1], 20, { received: 10 }, false);
    assert.equal(linea2Mod.received, 10);
    assert.equal(linea2Mod.missing, 10);

    const resultadoEntrega1 = aplicarEntregaChecklistEnOrden(ocInicial, [linea1Mod, linea2Mod]);
    assert.equal(resultadoEntrega1.esRecepcionCompleta, false, 'la 1.ª entrega es parcial');
    assert.equal(resultadoEntrega1.nuevoEstado, 'recibida_parcial', 'la OC pasa a estado recibida_parcial');
    assert.equal(resultadoEntrega1.totalConformeHoy, 30, 'ingresan 30 unidades conformes a stock hoy');
    assert.equal(resultadoEntrega1.totalDefectuosoHoy, 2, 'pasan 2 unidades defectuosas a cuarentena hoy');
    assert.equal(resultadoEntrega1.totalSaldoPendienteOc, 40, 'quedan 40 unidades pendientes en la OC (30m + 10un)');

    const ocTrasEntrega1 = resultadoEntrega1.ordenActualizada;
    assert.equal(ocTrasEntrega1.status, 'recibida_parcial');
    assert.equal(ocTrasEntrega1.items[0].receivedQuantity, 20);
    assert.equal(ocTrasEntrega1.items[0].defectiveQuantity, 2);
    assert.equal(calcularSaldoPendienteLineaOc(ocTrasEntrega1.items[0]), 30, 'saldo pendiente de línea 1 es 30m');
    assert.equal(ocTrasEntrega1.items[1].receivedQuantity, 10);
    assert.equal(calcularSaldoPendienteLineaOc(ocTrasEntrega1.items[1]), 10, 'saldo pendiente de línea 2 es 10un');

    // 3. [SCRUM] SEGUNDA ENTREGA PARCIAL EN TABLET:
    //    Al reabrir el checklist sobre la OC en estado 'recibida_parcial', propone exactamente los saldos pendientes (30m y 10un)
    const checklistEntrega2 = construirChecklistInicialDesdeOc(ocTrasEntrega1);
    assert.equal(checklistEntrega2[0].received, 30, 'propone el saldo pendiente de 30m para la 2.ª entrega');
    assert.equal(checklistEntrega2[1].received, 10, 'propone el saldo pendiente de 10un para la 2.ª entrega');

    // Se recibe la totalidad del saldo pendiente conforme, pero vinculamos una factura con 22un en vez de 20un para verificar la alerta de discrepancia con factura
    const facturaConDiferencia = {
        id: 'inv_1',
        number: '99401',
        supplierId: '1',
        supplierName: 'ElectroChile S.A.',
        supplierRut: '96.543.210-K',
        orderCode: 'OC-2026-00201',
        date: '2026-11-20',
        items: [
            { sku: 'EL-CAB-001', name: 'Cable THHN 12 AWG Rojo', quantity: 50, grossPrice: 650, discount1Pct: 0, discount2Pct: 0, discount3Pct: 0, netUnitPrice: 650, subtotalNet: 32500, unit: 'm' },
            { sku: 'EL-DIS-003', name: 'Disyuntor 1x16A', quantity: 22, grossPrice: 4500, discount1Pct: 0, discount2Pct: 0, discount3Pct: 0, netUnitPrice: 4500, subtotalNet: 99000, unit: 'un' },
        ],
        subtotalNet: 131500,
        totalDiscounts: 0,
        iva: 24985,
        total: 156485,
        status: 'registrada' as const,
    };

    const resultadoEntrega2 = aplicarEntregaChecklistEnOrden(
        ocTrasEntrega1,
        checklistEntrega2,
        facturaConDiferencia
    );
    assert.equal(resultadoEntrega2.esRecepcionCompleta, true, 'tras la 2.ª entrega la OC queda 100% recibida');
    assert.equal(resultadoEntrega2.nuevoEstado, 'recibida', 'el estado de la OC pasa de recibida_parcial a recibida');
    assert.equal(resultadoEntrega2.totalSaldoPendienteOc, 0, 'el saldo pendiente queda en 0');
    assert.equal(resultadoEntrega2.ordenActualizada.items[0].receivedQuantity, 50);
    assert.equal(resultadoEntrega2.ordenActualizada.items[1].receivedQuantity, 20);
    assert.ok(
        resultadoEntrega2.discrepancias.some((d) => d.includes('no coincide con lo facturado en Fac. N° 99401')),
        'si lo recibido no coincide con lo facturado debe generar alerta para el Administrador'
    );
});

test('[BACK-1][SCRUM] realiza una recepción mixta (10 conformes y 2 defectuosos) en una sola transacción: actualiza por separado las bolsas de stock disponible y cuarentena, registra movimientos y actualiza el estado de la OC', async () => {
    let estadoOcActual: 'Enviada' | 'Recibida parcial' | 'Recibida' = 'Enviada';
    let stockDisponible = 25; // Saldo previo en disponible
    let stockCuarentena = 1;  // Saldo previo en cuarentena
    let acumuladoConformeOc = 0;
    let acumuladoDefectuosoOc = 0;
    const movimientosBd: { id_movimiento: number; id_insumo: number; destino_bolsa: string; cantidad: number; referencia: string }[] = [];

    const clienteSimulado = {
        query: async (sql: string, params: any[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM ordenes_compra oc JOIN proveedor p')) {
                return {
                    rows: [
                        {
                            id_orden_compra: 55,
                            numero_oc: 'OC-2026-00055',
                            proveedor_id: 1,
                            nombre_proveedor: 'ElectroChile S.A.',
                            razon_social_proveedor: 'Comercializadora Electrica Chile S.A.',
                            rut_proveedor: '96.543.210-K',
                            correo_proveedor: 'ventas@electrochile.cl',
                            telefono_proveedor: '+56 2 2678 9000',
                            direccion_proveedor: 'Av. Matta 1234, Santiago',
                            estado: estadoOcActual,
                            origen: 'Manual',
                            fecha_estimada_oc: '2026-11-28',
                            fecha_creacion: new Date('2026-11-19T10:00:00Z'),
                            observaciones: null,
                            fecha_aprobacion: new Date('2026-11-19T10:30:00Z'),
                            id_usuario_aprobador: 1,
                            correo_enviado_a: 'ventas@electrochile.cl',
                            fecha_envio_correo: new Date('2026-11-19T10:30:00Z'),
                        },
                    ],
                };
            }

            if (q.includes('FROM oc_lineas l')) {
                return {
                    rows: [
                        {
                            id_oc_linea: 501,
                            id_orden_compra: 55,
                            id_articulo: 3,
                            sku: 'ELE-DIS-0016',
                            nombre_articulo: 'Disyuntor Termomagnetico 1P 16A',
                            unidad: 'un',
                            cantidad_orden: 12,
                            precio_unitario: 4520,
                            cantidad_recibida: acumuladoConformeOc,
                            cantidad_defectuosa: acumuladoDefectuosoOc,
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO recepciones (')) {
                return { rows: [{ id_recepcion: 901 }] };
            }

            if (q.startsWith('INSERT INTO recepcion_lineas')) {
                return { rows: [{ id_recepcion_linea: 700 + movimientosBd.length + 1 }] };
            }

            if (q.startsWith('INSERT INTO registro_recepcion_articulo (')) {
                return { rows: [{ id_registro_recepcion_articulo: 801 }] };
            }

            if (q.startsWith('INSERT INTO registro_recepcion_articulo_detalle')) {
                acumuladoConformeOc += Number(params[2]);
                acumuladoDefectuosoOc += Number(params[3]);
                return { rows: [] };
            }

            if (q.startsWith('SELECT id_stock')) {
                return {
                    rows: [
                        {
                            id_stock: 3,
                            cantidad_disponible: stockDisponible,
                            cantidad_cuarentena: stockCuarentena,
                            pmp: 4000,
                        },
                    ],
                };
            }

            if (q.startsWith('UPDATE articulos_stock')) {
                stockDisponible += Number(params[1]);
                stockCuarentena += Number(params[2]);
                return {
                    rows: [
                        {
                            cantidad_disponible: stockDisponible,
                            cantidad_cuarentena: stockCuarentena,
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO movimientos_inventario')) {
                const mov = {
                    id_movimiento: movimientosBd.length + 1,
                    id_insumo: Number(params[0]),
                    destino_bolsa: q.includes("'disponible'") ? 'disponible' : 'cuarentena',
                    cantidad: Number(params[4]),
                    referencia: String(params[9]),
                };
                movimientosBd.push(mov);
                return { rows: [{ id_movimiento: mov.id_movimiento }] };
            }

            if (q.startsWith('INSERT INTO movimiento_inventario')) {
                return { rows: [{ id_movimiento: movimientosBd.length }] };
            }

            if (q.startsWith('UPDATE ordenes_compra SET estado = $1')) {
                estadoOcActual = params[0];
                return { rows: [] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. [SCRUM] Recepción mixta de una línea de 12 unidades pedidas: llegan 10 conformes y 2 defectuosas
    const recepcionMixta = await ejecutarRecepcionOrdenCompraEnTransaccion(
        clienteSimulado,
        55,
        [{ sku: 'ELE-DIS-0016', cantidad_conforme: 10, cantidad_defectuosa: 2 }],
        2,
        'FAC-5501'
    );

    assert.equal(recepcionMixta.saldos_actualizados.length, 1);
    const saldo = recepcionMixta.saldos_actualizados[0];

    // Verificar bolsas de stock actualizadas por separado
    assert.equal(saldo.disponible_anterior, 25);
    assert.equal(saldo.conforme_ingresado, 10);
    assert.equal(saldo.disponible_nuevo, 35, 'lo conforme (10) suma exclusivamente a stock disponible (25 -> 35)');

    assert.equal(saldo.cuarentena_anterior, 1);
    assert.equal(saldo.defectuoso_ingresado, 2);
    assert.equal(saldo.cuarentena_nuevo, 3, 'lo defectuoso (2) suma exclusivamente a cuarentena (1 -> 3)');

    // Verificar movimientos registrados por separado para cada bolsa
    assert.equal(recepcionMixta.movimientos_registrados.length, 2, 'debe registrar 2 movimientos separados (uno a disponible y otro a cuarentena)');
    const movDisp = recepcionMixta.movimientos_registrados.find((m) => m.destino_bolsa === 'disponible');
    const movCuar = recepcionMixta.movimientos_registrados.find((m) => m.destino_bolsa === 'cuarentena');
    assert.ok(movDisp && movDisp.cantidad === 10);
    assert.ok(movCuar && movCuar.cantidad === 2);

    // Como llegaron 10 conformes de 12 pedidas (2 fueron a cuarentena), quedan 2 pendientes de reposición conforme -> estado 'Recibida parcial'
    assert.equal(recepcionMixta.orden_compra.estado, 'Recibida parcial');
    assert.equal(recepcionMixta.orden_compra.lineas[0].cantidad_recibida, 10);
    assert.equal(recepcionMixta.orden_compra.lineas[0].cantidad_defectuosa, 2);
    assert.equal(recepcionMixta.orden_compra.lineas[0].saldo_pendiente, 2);

    // 2. Segunda entrega con las 2 unidades de reemplazo conformes -> completa las 12 conformes y pasa la OC a 'Recibida'
    const recepcionCompletitud = await ejecutarRecepcionOrdenCompraEnTransaccion(
        clienteSimulado,
        55,
        [{ sku: 'ELE-DIS-0016', cantidad_conforme: 2, cantidad_defectuosa: 0 }],
        2
    );
    assert.equal(recepcionCompletitud.orden_compra.estado, 'Recibida', 'al completar las 12 conformes la OC pasa a Recibida');
    assert.equal(recepcionCompletitud.saldos_actualizados[0].disponible_nuevo, 37, 'disponible sube de 35 a 37');
    assert.equal(recepcionCompletitud.saldos_actualizados[0].cuarentena_nuevo, 3, 'cuarentena se mantiene en 3');
});

test('[DB][SCRUM] registra trazabilidad por línea en recepciones, recepcion_lineas (Conforme, Defectuoso, Faltante) y movimientos_inventario (con saldo_historico y pmp_historico) mantendo integridad referencial', async () => {
    // 1. Verificar cálculo exacto del PMP histórico:
    //    Stock previo: 20 un a $4.000 ($80.000) + Ingreso conforme: 10 un a $4.600 ($46.000) = 30 un por $126.000 -> PMP = $4.200
    const pmpCalculado = calcularPmpHistorico(20, 4000, 10, 4600);
    assert.equal(pmpCalculado, 4200, 'el PMP histórico ponderado debe ser exactamente 4200');

    // 2. [SCRUM] Verificar integridad referencial entre OC -> oc_lineas -> recepciones -> recepcion_lineas -> movimientos_inventario
    const tablaRecepciones: { id_recepcion: number; id_orden_compra: number }[] = [];
    const tablaRecepcionLineas: {
        id_recepcion_linea: number;
        id_recepcion: number;
        id_oc_linea: number;
        id_articulo: number;
        estado_linea: string;
        cantidad: number;
    }[] = [];
    const tablaMovimientosInventario: {
        id_movimiento: number;
        id_insumo: number;
        id_orden_compra: number;
        id_recepcion: number;
        id_recepcion_linea: number;
        destino_bolsa: string;
        cantidad: number;
        costo_unitario: number;
        saldo_historico: number;
        pmp_historico: number;
        valor_total_historico: number;
    }[] = [];

    let disp = 20;
    let cuar = 0;

    const clienteTrazabilidad = {
        query: async (sql: string, params: any[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM ordenes_compra oc JOIN proveedor p')) {
                return {
                    rows: [
                        {
                            id_orden_compra: 77,
                            numero_oc: 'OC-2026-00077',
                            proveedor_id: 1,
                            nombre_proveedor: 'ElectroChile S.A.',
                            razon_social_proveedor: 'Comercializadora Electrica Chile S.A.',
                            rut_proveedor: '96.543.210-K',
                            correo_proveedor: 'ventas@electrochile.cl',
                            telefono_proveedor: '+56 2 2678 9000',
                            direccion_proveedor: 'Av. Matta 1234, Santiago',
                            estado: 'Enviada',
                            origen: 'Manual',
                            fecha_estimada_oc: '2026-11-30',
                            fecha_creacion: new Date('2026-11-19T10:00:00Z'),
                            observaciones: null,
                            fecha_aprobacion: new Date('2026-11-19T10:30:00Z'),
                            id_usuario_aprobador: 1,
                            correo_enviado_a: 'ventas@electrochile.cl',
                            fecha_envio_correo: new Date('2026-11-19T10:30:00Z'),
                        },
                    ],
                };
            }

            if (q.includes('FROM oc_lineas l')) {
                return {
                    rows: [
                        {
                            id_oc_linea: 701,
                            id_orden_compra: 77,
                            id_articulo: 9,
                            sku: 'FER-SIL-0300',
                            nombre_articulo: 'Silicona Neutra Alta Temperatura',
                            unidad: 'un',
                            cantidad_orden: 15,
                            precio_unitario: 4600,
                            cantidad_recibida: 0,
                            cantidad_defectuosa: 0,
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO recepciones (')) {
                const idRec = 1001;
                tablaRecepciones.push({ id_recepcion: idRec, id_orden_compra: Number(params[0]) });
                return { rows: [{ id_recepcion: idRec }] };
            }

            if (q.startsWith('INSERT INTO registro_recepcion_articulo (')) {
                return { rows: [{ id_registro_recepcion_articulo: 2001 }] };
            }

            if (q.startsWith('SELECT id_stock')) {
                return { rows: [{ id_stock: 9, cantidad_disponible: disp, cantidad_cuarentena: cuar, pmp: 4000 }] };
            }

            if (q.startsWith('UPDATE articulos_stock')) {
                disp += Number(params[1]);
                cuar += Number(params[2]);
                return { rows: [{ cantidad_disponible: disp, cantidad_cuarentena: cuar }] };
            }

            if (q.startsWith('INSERT INTO recepcion_lineas')) {
                const estadoMatch = q.match(/'(Conforme|Defectuoso|Faltante)'/);
                const estado = estadoMatch ? estadoMatch[1] : 'Conforme';
                const idRl = 3000 + tablaRecepcionLineas.length + 1;
                tablaRecepcionLineas.push({
                    id_recepcion_linea: idRl,
                    id_recepcion: Number(params[0]),
                    id_oc_linea: Number(params[1]),
                    id_articulo: Number(params[2]),
                    estado_linea: estado,
                    cantidad: Number(params[3]),
                });
                return { rows: [{ id_recepcion_linea: idRl }] };
            }

            if (q.startsWith('INSERT INTO movimientos_inventario')) {
                const bolsa = q.includes("'disponible'") ? 'disponible' : 'cuarentena';
                const idMov = 5000 + tablaMovimientosInventario.length + 1;
                tablaMovimientosInventario.push({
                    id_movimiento: idMov,
                    id_insumo: Number(params[0]),
                    id_orden_compra: Number(params[1]),
                    id_recepcion: Number(params[2]),
                    id_recepcion_linea: Number(params[3]),
                    destino_bolsa: bolsa,
                    cantidad: Number(params[4]),
                    costo_unitario: Number(params[5]),
                    saldo_historico: Number(params[6]),
                    pmp_historico: Number(params[7]),
                    valor_total_historico: Number(params[8]),
                });
                return { rows: [{ id_movimiento: idMov }] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // De 15 unidades pedidas en la línea 701: llegan 10 Conformes, 2 Defectuosas y 3 Faltantes
    const res = await ejecutarRecepcionOrdenCompraEnTransaccion(
        clienteTrazabilidad,
        77,
        [{ id_oc_linea: 701, cantidad_conforme: 10, cantidad_defectuosa: 2, cantidad_faltante: 3 }],
        2
    );

    // Verificar cabecera en `recepciones` vinculada a la OC 77
    assert.equal(tablaRecepciones.length, 1);
    assert.equal(tablaRecepciones[0].id_orden_compra, 77);
    assert.equal(res.id_recepcion, 1001);

    // Verificar 3 filas en `recepcion_lineas` con los 3 estados: Conforme (10), Defectuoso (2) y Faltante (3)
    assert.equal(tablaRecepcionLineas.length, 3, 'debe registrar las 3 líneas de trazabilidad: Conforme, Defectuoso y Faltante');
    const rlConf = tablaRecepcionLineas.find((l) => l.estado_linea === 'Conforme')!;
    const rlDef = tablaRecepcionLineas.find((l) => l.estado_linea === 'Defectuoso')!;
    const rlFalt = tablaRecepcionLineas.find((l) => l.estado_linea === 'Faltante')!;

    assert.equal(rlConf.id_recepcion, 1001);
    assert.equal(rlConf.id_oc_linea, 701);
    assert.equal(rlConf.cantidad, 10);

    assert.equal(rlDef.id_recepcion, 1001);
    assert.equal(rlDef.id_oc_linea, 701);
    assert.equal(rlDef.cantidad, 2);

    assert.equal(rlFalt.id_recepcion, 1001);
    assert.equal(rlFalt.id_oc_linea, 701);
    assert.equal(rlFalt.cantidad, 3);

    // Verificar integridad referencial en `movimientos_inventario` (Cardex con saldo_historico y pmp_historico)
    assert.equal(tablaMovimientosInventario.length, 2, 'Conforme y Defectuoso generan movimientos en Cardex referenciando su recepcion_linea');
    const movConf = tablaMovimientosInventario.find((m) => m.destino_bolsa === 'disponible')!;
    const movDef = tablaMovimientosInventario.find((m) => m.destino_bolsa === 'cuarentena')!;

    assert.equal(movConf.id_orden_compra, 77);
    assert.equal(movConf.id_recepcion, 1001);
    assert.equal(movConf.id_recepcion_linea, rlConf.id_recepcion_linea, 'FK id_recepcion_linea apunta a la línea Conforme');
    assert.equal(movConf.saldo_historico, 30, 'saldo histórico disponible = 20 + 10 = 30');
    assert.equal(movConf.pmp_historico, 4200, 'PMP histórico ponderado = $4.200');
    assert.equal(movConf.valor_total_historico, 126000, 'valor total histórico = 30 * 4200 = $126.000');

    assert.equal(movDef.id_orden_compra, 77);
    assert.equal(movDef.id_recepcion, 1001);
    assert.equal(movDef.id_recepcion_linea, rlDef.id_recepcion_linea, 'FK id_recepcion_linea apunta a la línea Defectuoso');
    assert.equal(movDef.saldo_historico, 2, 'saldo histórico en cuarentena = 0 + 2 = 2');
    assert.equal(movDef.pmp_historico, 4200);
});

test('[FRONT-2][SCRUM] ingresa una factura real de prueba y valida todos los cálculos en pantalla (3 descuentos en cascada, neto, IVA, PMP y aviso de discrepancia con la recepción)', () => {
    // Factura real de prueba con 2 ítems y hasta 3 descuentos secuenciales en cascada:
    // Ítem 1: SKU 'CAB-6AWG', Cantidad: 100 m, P. Bruto: $10.000, D1: 10%, D2: 5%, D3: 2%
    //   Paso 1 (D1 10%): 10.000 * 0.90 = $9.000 (descuento unitario D1 = $1.000)
    //   Paso 2 (D2 5% sobre $9.000): 9.000 * 0.95 = $8.550 (descuento unitario D2 = $450)
    //   Paso 3 (D3 2% sobre $8.550): 8.550 * 0.98 = $8.379 (descuento unitario D3 = $171)
    //   Subtotal Bruto = $1.000.000 | Subtotal Neto = $837.900 | Descuento Línea = $162.100
    //   Stock actual: 100 m @ PMP $8.000 -> Nuevo PMP = (100*8000 + 100*8379) / 200 = $8.190
    //
    // Ítem 2: SKU 'AUT-3X32', Cantidad: 12 un, P. Bruto: $20.000, D1: 5%, D2: 5%, D3: 0%
    //   Paso 1 (D1 5%): 20.000 * 0.95 = $19.000
    //   Paso 2 (D2 5% sobre $19.000): 19.000 * 0.95 = $18.050
    //   Paso 3 (D3 0%): $18.050
    //   Subtotal Bruto = $240.000 | Subtotal Neto = $216.600 | Descuento Línea = $23.400
    const lineasFacturaPrueba = [
        {
            sku: 'CAB-6AWG',
            name: 'Cable THHN 6 AWG',
            unit: 'm',
            quantity: 100,
            grossPrice: 10000,
            disc1: 10,
            disc2: 5,
            disc3: 2,
            stockActual: 100,
            pmpActual: 8000,
        },
        {
            sku: 'AUT-3X32',
            name: 'Automático Trifásico 3x32A',
            unit: 'un',
            quantity: 12,
            grossPrice: 20000,
            disc1: 5,
            disc2: 5,
            disc3: 0,
            stockActual: 8,
            pmpActual: 19000,
        },
    ];

    const l1 = calcularLineaFacturaCascada(lineasFacturaPrueba[0]);
    assert.equal(l1.priceAfterDisc1, 9000, 'Paso 1: $10.000 - 10% = $9.000');
    assert.equal(l1.discount1UnitAmount, 1000);
    assert.equal(l1.priceAfterDisc2, 8550, 'Paso 2: $9.000 - 5% = $8.550');
    assert.equal(l1.discount2UnitAmount, 450);
    assert.equal(l1.netUnitPrice, 8379, 'Paso 3: $8.550 - 2% = $8.379');
    assert.equal(l1.discount3UnitAmount, 171);
    assert.equal(l1.effectiveDiscountPct, 16.21, 'Descuento efectivo acumulado en cascada = 16.21% (no 17%)');
    assert.equal(l1.subtotalGross, 1000000);
    assert.equal(l1.totalDiscountLine, 162100);
    assert.equal(l1.subtotalNet, 837900);
    assert.equal(
        l1.projectedPmp,
        calcularPmpConCostoNetoFactura(100, 8000, 100, 8379),
        'PMP proyectado coincide con la fórmula ponderada'
    );
    assert.equal(l1.projectedPmp, 8190);

    const totales = calcularTotalesFacturaCascada(lineasFacturaPrueba);
    assert.equal(totales.subtotalGross, 1240000, 'Total Bruto = $1.000.000 + $240.000 = $1.240.000');
    assert.equal(totales.totalDiscounts, 185500, 'Descuentos en cascada = $162.100 + $23.400 = $185.500');
    assert.equal(totales.subtotalNet, 1054500, 'Subtotal Neto = $837.900 + $216.600 = $1.054.500');
    assert.equal(totales.iva, Math.round(1054500 * 0.19), 'IVA 19% = $200.355');
    assert.equal(totales.iva, 200355);
    assert.equal(totales.total, 1254855, 'Total Factura CLP = $1.054.500 + $200.355 = $1.254.855');

    // Validar aviso de discrepancia en vivo cuando la recepción de la OC registró 10 conformes y 2 defectuosos en cuarentena
    // pero la factura cobra las 12 unidades de AUT-3X32:
    const ocConDiscrepancia = {
        code: 'OC-2026-00105',
        status: 'Recibida parcial',
        items: [
            { sku: 'CAB-6AWG', name: 'Cable THHN 6 AWG', unit: 'm', quantity: 100, unitPrice: 8379, receivedQuantity: 100, defectiveQuantity: 0 },
            { sku: 'AUT-3X32', name: 'Automático Trifásico 3x32A', unit: 'un', quantity: 12, unitPrice: 18050, receivedQuantity: 10, defectiveQuantity: 2 },
        ],
    };

    const disc = detectarDiscrepanciasFacturaConRecepcion(lineasFacturaPrueba, ocConDiscrepancia);
    assert.equal(disc.tieneDiscrepancia, true, 'debe activar aviso de discrepancia cuando lo facturado (12) no coincide con lo recibido conforme (10)');
    assert.ok(
        disc.detalles.some(
            (d) => d.sku === 'AUT-3X32' && d.tipo === 'CANTIDAD_FACTURADA_DISTINTA_A_RECIBIDA'
        ),
        'detecta diferencia entre cantidad facturada (12) y recibida conforme (10)'
    );
    assert.ok(
        disc.detalles.some(
            (d) => d.sku === 'AUT-3X32' && d.tipo === 'UNIDADES_EN_CUARENTENA'
        ),
        'advierte que existen 2 unidades en cuarentena en la recepción de la OC'
    );
});

test('[BACK-1][SCRUM] valida con calculadora un ítem con 3 descuentos en cascada más IVA y comprueba la actualización automática del nuevo PMP en base de datos al confirmar recepción conforme sin errores de redondeo', async () => {
    // 1. Validación con calculadora de un ítem con 3 descuentos secuenciales en cascada:
    //    Precio Bruto = $10.000, Cantidad = 10 un, D1 = 10%, D2 = 5%, D3 = 2%
    //    - Paso 1: 10.000 * (1 - 0,10) = $9.000
    //    - Paso 2: 9.000 * (1 - 0,05) = $8.550
    //    - Paso 3: 8.550 * (1 - 0,02) = $8.379 exacto
    //    - Subtotal Neto (10 un) = 10 * 8.379 = $83.790
    //    - IVA (19%) = Math.round(83.790 * 0,19) = Math.round(15.920,1) = $15.920
    //    - Total Factura = 83.790 + 15.920 = $99.710
    const lineaCalculadora = calcularLineaFacturaCascada({
        sku: 'CALC-3DESC',
        name: 'Insumo Calculadora 3 Descuentos',
        unit: 'un',
        quantity: 10,
        grossPrice: 10000,
        disc1: 10,
        disc2: 5,
        disc3: 2,
        stockActual: 20,
        pmpActual: 7500,
    });

    assert.equal(lineaCalculadora.priceAfterDisc1, 9000, 'Calculadora Paso 1: 10.000 * 0.90 = 9.000');
    assert.equal(lineaCalculadora.priceAfterDisc2, 8550, 'Calculadora Paso 2: 9.000 * 0.95 = 8.550');
    assert.equal(lineaCalculadora.netUnitPriceExact, 8379, 'Calculadora Paso 3 exacto: 8.550 * 0.98 = 8.379');
    assert.equal(lineaCalculadora.netUnitPrice, 8379, 'Costo neto unitario = $8.379');
    assert.equal(lineaCalculadora.subtotalNet, 83790, 'Subtotal neto (10 un) = $83.790');

    const totalesCalculadora = calcularTotalesFacturaCascada([
        {
            sku: 'CALC-3DESC',
            quantity: 10,
            grossPrice: 10000,
            disc1: 10,
            disc2: 5,
            disc3: 2,
        },
    ]);
    assert.equal(totalesCalculadora.subtotalNet, 83790);
    assert.equal(totalesCalculadora.iva, 15920, 'IVA 19% de $83.790 = $15.920');
    assert.equal(totalesCalculadora.total, 99710, 'Total con IVA = $99.710');

    // 2. Validación de la fórmula del PMP sin errores de redondeo:
    //    Fórmula: (valor stock actual + valor ingreso neto) / (stock actual + cantidad ingresada)
    //    Stock actual = 20 un @ PMP $7.500 -> Valor stock actual = 20 * 7.500 = $150.000
    //    Ingreso conforme = 10 un @ Costo neto factura $8.379 -> Valor ingreso neto = 10 * 8.379 = $83.790
    //    Nuevo PMP = (150.000 + 83.790) / (20 + 10) = 233.790 / 30 = $7.793 exacto
    const pmpExacto = calcularPmpExactoSinErrorRedondeo(20, 7500, 10, 8379);
    assert.equal(pmpExacto, 7793, '(150.000 + 83.790) / 30 = $7.793,00 sin error de redondeo');

    // 3. Comprobar que al confirmar la recepción conforme en `ejecutarRecepcionOrdenCompraEnTransaccion`,
    //    el backend toma automáticamente el costo neto de la factura registrada ($8.379 en lugar del precio bruto OC $10.000)
    //    y actualiza el nuevo PMP ($7.793) en `articulos_stock` y `movimientos_inventario`:
    let estadoOc: 'Enviada' | 'Recibida' | 'Recibida parcial' = 'Enviada';
    let stockDisponibleBd = 20;
    let stockCuarentenaBd = 0;
    let pmpEnBaseDeDatos = 7500;
    let cantRecibidaOc = 0;

    const clienteMockPmp = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM ordenes_compra oc') && q.includes('WHERE oc.id_orden_compra = $1')) {
                return {
                    rows: [
                        {
                            id_orden_compra: 88,
                            numero_oc: 'OC-2026-00088',
                            proveedor_id: 4,
                            nombre_proveedor: 'Proveedor Cascada S.A.',
                            razon_social_proveedor: 'Proveedor Cascada S.A.',
                            rut_proveedor: '76.888.999-0',
                            correo_proveedor: 'facturacion@cascada.cl',
                            telefono_proveedor: null,
                            direccion_proveedor: null,
                            estado: estadoOc,
                            origen: 'Manual',
                            fecha_estimada_oc: '2026-11-30',
                            fecha_creacion: '2026-11-19',
                            observaciones: null,
                            fecha_aprobacion: '2026-11-19',
                            id_usuario_aprobador: 1,
                            correo_enviado_a: 'facturacion@cascada.cl',
                            fecha_envio_correo: '2026-11-19',
                        },
                    ],
                };
            }

            if (q.includes('FROM oc_lineas l') && q.includes('WHERE l.id_orden_compra = $1')) {
                return {
                    rows: [
                        {
                            id_oc_linea: 801,
                            id_orden_compra: 88,
                            id_articulo: 501,
                            sku: 'CALC-3DESC',
                            nombre_articulo: 'Insumo Calculadora 3 Descuentos',
                            unidad: 'un',
                            cantidad_orden: 10,
                            precio_unitario: 10000, // Precio de lista bruto en la OC
                            subtotal_linea: 100000,
                            cantidad_recibida: cantRecibidaOc,
                            cantidad_defectuosa: 0,
                        },
                    ],
                };
            }

            // Devuelve el costo neto unitario de la factura con los 3 descuentos en cascada ($8.379)
            if (q.includes('FROM factura_detalle fd') && q.includes('JOIN factura f')) {
                return {
                    rows: [{ id_articulo: 501, precio_unitario: lineaCalculadora.netUnitPrice }],
                };
            }

            if (q.startsWith('INSERT INTO recepciones (')) {
                return { rows: [{ id_recepcion: 9001 }] };
            }
            if (q.startsWith('INSERT INTO registro_recepcion_articulo (')) {
                return { rows: [{ id_registro_recepcion_articulo: 9002 }] };
            }
            if (q.startsWith('INSERT INTO registro_recepcion_articulo_detalle')) {
                cantRecibidaOc += Number(params[2]);
                return { rowCount: 1, rows: [] };
            }
            if (q.startsWith('SELECT id_stock')) {
                return {
                    rows: [
                        {
                            id_stock: 55,
                            cantidad_disponible: stockDisponibleBd,
                            cantidad_cuarentena: stockCuarentenaBd,
                            pmp: pmpEnBaseDeDatos,
                        },
                    ],
                };
            }
            if (q.startsWith('UPDATE articulos_stock')) {
                stockDisponibleBd += Number(params[1]);
                stockCuarentenaBd += Number(params[2]);
                pmpEnBaseDeDatos = Number(params[3]);
                return {
                    rows: [
                        {
                            cantidad_disponible: stockDisponibleBd,
                            cantidad_cuarentena: stockCuarentenaBd,
                        },
                    ],
                };
            }
            if (q.startsWith('INSERT INTO recepcion_lineas')) {
                return { rows: [{ id_recepcion_linea: 9101 }] };
            }
            if (q.startsWith('INSERT INTO movimientos_inventario')) {
                return { rows: [{ id_movimiento: 9201 }] };
            }
            if (q.startsWith('UPDATE ordenes_compra SET estado = $1')) {
                estadoOc = params[0] as 'Recibida';
                return { rowCount: 1, rows: [] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    const resultadoRecepcion = await ejecutarRecepcionOrdenCompraEnTransaccion(
        clienteMockPmp,
        88,
        [{ id_oc_linea: 801, cantidad_conforme: 10, cantidad_defectuosa: 0 }],
        1,
        'FAC-CALC-001'
    );

    assert.equal(resultadoRecepcion.orden_compra.estado, 'Recibida');
    assert.equal(stockDisponibleBd, 30, 'Stock disponible pasa de 20 a 30');
    assert.equal(pmpEnBaseDeDatos, 7793, 'El nuevo PMP en base de datos se actualiza a $7.793 usando el costo neto de la factura ($8.379)');
    assert.equal(resultadoRecepcion.saldos_actualizados[0].costo_neto_ingreso, 8379);
    assert.equal(resultadoRecepcion.saldos_actualizados[0].pmp_anterior, 7500);
    assert.equal(resultadoRecepcion.saldos_actualizados[0].pmp_nuevo, 7793);
    assert.equal(resultadoRecepcion.movimientos_registrados[0].costo_unitario, 8379);
    assert.equal(resultadoRecepcion.movimientos_registrados[0].pmp_historico, 7793);
    assert.equal(resultadoRecepcion.movimientos_registrados[0].valor_total_historico, 30 * 7793);
});

test('[BACK-2][SCRUM] ingresa una factura con cantidad distinta a la recepción H33 (tanto cuando cobra más como cuando cobra menos) y verifica la alerta inmediata generada al Administrador', async () => {
    const ocRecepcionadaH33 = {
        code: 'OC-2026-00210',
        status: 'Recibida parcial',
        items: [
            {
                sku: 'TAB-24P',
                name: 'Tablero Embutido 24 Polos',
                unit: 'un',
                quantity: 10,
                unitPrice: 15000,
                receivedQuantity: 10, // 10 unidades recibidas conformes en H33
                defectiveQuantity: 0,
            },
        ],
    };

    // Caso 1: La factura cobra MÁS de lo recepcionado en H33 (12 facturadas vs 10 recibidas conformes)
    const discCobraMas = detectarDiscrepanciasFacturaConRecepcion(
        [{ sku: 'TAB-24P', name: 'Tablero Embutido 24 Polos', unit: 'un', quantity: 12, grossPrice: 15000 }],
        ocRecepcionadaH33
    );
    assert.equal(discCobraMas.tieneDiscrepancia, true, 'debe detectar discrepancia cuando la factura cobra más de lo recepcionado');
    assert.equal(discCobraMas.detalles[0].sentidoDiscrepancia, 'COBRA_MAS');
    assert.equal(discCobraMas.detalles[0].diferenciaUnidades, 2);
    assert.ok(discCobraMas.detalles[0].mensaje.includes('MÁS de lo recepcionado en H33'));

    // Caso 2: La factura cobra MENOS de lo recepcionado en H33 (8 facturadas vs 10 recibidas conformes)
    const discCobraMenos = detectarDiscrepanciasFacturaConRecepcion(
        [{ sku: 'TAB-24P', name: 'Tablero Embutido 24 Polos', unit: 'un', quantity: 8, grossPrice: 15000 }],
        ocRecepcionadaH33
    );
    assert.equal(discCobraMenos.tieneDiscrepancia, true, 'debe detectar discrepancia cuando la factura cobra menos de lo recepcionado');
    assert.equal(discCobraMenos.detalles[0].sentidoDiscrepancia, 'COBRA_MENOS');
    assert.equal(discCobraMenos.detalles[0].diferenciaUnidades, -2);
    assert.ok(discCobraMenos.detalles[0].mensaje.includes('MENOS de lo recepcionado en H33'));

    // Caso 3: Contraste automático en transacción de recepción H33 cuando ya existe una factura ingresada por 12 unidades
    // y el bodeguero recepciona solo 10 unidades conformes -> debe generar alerta inmediata en `alertas_sistema`
    const alertasInsertadas: { tipo: string; severidad: string; titulo: string; descripcion: string }[] = [];
    let estadoOc: 'Enviada' | 'Recibida parcial' = 'Enviada';
    let cantRecibida = 0;

    const clienteContrasteH33 = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM ordenes_compra oc') && q.includes('WHERE oc.id_orden_compra = $1')) {
                return {
                    rows: [
                        {
                            id_orden_compra: 99,
                            numero_oc: 'OC-2026-00099',
                            proveedor_id: 7,
                            nombre_proveedor: 'Proveedor Contraste H33',
                            razon_social_proveedor: 'Proveedor Contraste H33 S.A.',
                            rut_proveedor: '76.333.444-5',
                            correo_proveedor: 'ventas@contraste.cl',
                            telefono_proveedor: null,
                            direccion_proveedor: null,
                            estado: estadoOc,
                            origen: 'Manual',
                            fecha_estimada_oc: '2026-11-30',
                            fecha_creacion: '2026-11-19',
                            observaciones: null,
                            fecha_aprobacion: '2026-11-19',
                            id_usuario_aprobador: 1,
                            correo_enviado_a: 'ventas@contraste.cl',
                            fecha_envio_correo: '2026-11-19',
                        },
                    ],
                };
            }

            if (q.includes('FROM oc_lineas l') && q.includes('WHERE l.id_orden_compra = $1')) {
                return {
                    rows: [
                        {
                            id_oc_linea: 901,
                            id_orden_compra: 99,
                            id_articulo: 601,
                            sku: 'TAB-24P',
                            nombre_articulo: 'Tablero Embutido 24 Polos',
                            unidad: 'un',
                            cantidad_orden: 12,
                            precio_unitario: 15000,
                            subtotal_linea: 180000,
                            cantidad_recibida: cantRecibida,
                            cantidad_defectuosa: 0,
                        },
                    ],
                };
            }

            if (q.includes('FROM factura_detalle fd') && q.includes('JOIN factura f')) {
                return {
                    rows: [
                        {
                            id_factura: 777,
                            numero_factura: 'FAC-9901',
                            id_articulo: 601,
                            cantidad: 12, // Factura cobra 12 unidades
                            precio_unitario: 15000,
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO recepciones (')) {
                return { rows: [{ id_recepcion: 9501 }] };
            }
            if (q.startsWith('INSERT INTO registro_recepcion_articulo (')) {
                return { rows: [{ id_registro_recepcion_articulo: 9502 }] };
            }
            if (q.startsWith('INSERT INTO registro_recepcion_articulo_detalle')) {
                cantRecibida += Number(params[2]);
                return { rowCount: 1, rows: [] };
            }
            if (q.startsWith('SELECT id_stock')) {
                return { rows: [{ id_stock: 66, cantidad_disponible: 10, cantidad_cuarentena: 0, pmp: 15000 }] };
            }
            if (q.startsWith('UPDATE articulos_stock')) {
                return { rows: [{ cantidad_disponible: 10 + cantRecibida, cantidad_cuarentena: 0 }] };
            }
            if (q.startsWith('INSERT INTO recepcion_lineas')) {
                return { rows: [{ id_recepcion_linea: 9601 }] };
            }
            if (q.startsWith('INSERT INTO movimientos_inventario')) {
                return { rows: [{ id_movimiento: 9701 }] };
            }
            if (q.startsWith('UPDATE ordenes_compra SET estado = $1')) {
                estadoOc = params[0] as 'Recibida parcial';
                return { rowCount: 1, rows: [] };
            }
            if (q.includes("INSERT INTO alertas_sistema") && q.includes("'discrepancia_factura_recepcion'")) {
                const nuevaAlerta = {
                    id_alerta: 4001,
                    tipo: 'discrepancia_factura_recepcion',
                    severidad: 'rojo',
                    titulo: String(params[0]),
                    descripcion: String(params[1]),
                    id_articulo: Number(params[2]),
                    id_orden_compra: Number(params[3]),
                    leida: false,
                    fecha_creacion: new Date().toISOString(),
                };
                alertasInsertadas.push(nuevaAlerta);
                return { rows: [nuevaAlerta] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // Se recepcionan 10 conformes en H33, mientras la factura FAC-9901 cobra 12 -> dispara alerta inmediata al Administrador
    const resH33 = await ejecutarRecepcionOrdenCompraEnTransaccion(
        clienteContrasteH33,
        99,
        [{ id_oc_linea: 901, cantidad_conforme: 10, cantidad_defectuosa: 0 }],
        1,
        'FAC-9901'
    );

    assert.equal(alertasInsertadas.length, 1, 'debe insertar alerta inmediata de discrepancia factura vs recepción en alertas_sistema');
    assert.equal(alertasInsertadas[0].tipo, 'discrepancia_factura_recepcion');
    assert.equal(alertasInsertadas[0].severidad, 'rojo');
    assert.ok(alertasInsertadas[0].titulo.includes('FAC-9901'));
    assert.ok(alertasInsertadas[0].descripcion.includes('MÁS de lo recepcionado en H33'));
    assert.equal(resH33.alertas_discrepancia_factura?.length, 1);
});

test('[DB][SCRUM] tablas facturas_compra (restricción única proveedor_id + numero_factura, vínculo opcional a oc_id) y factura_lineas (3 descuentos porcentuales): intenta insertar una factura duplicada para el mismo proveedor y la bloquea', async () => {
    const tablaFacturasCompra: {
        id_factura: number;
        proveedor_id: number;
        numero_factura: string;
        oc_id: number | null;
        subtotal_neto: number;
        monto_iva: number;
        total_factura: number;
    }[] = [];
    const tablaFacturaLineas: {
        id_factura_linea: number;
        id_factura: number;
        id_articulo: number;
        cantidad: number;
        precio_bruto: number;
        descuento_1_pct: number;
        descuento_2_pct: number;
        descuento_3_pct: number;
        precio_unitario_neto: number;
    }[] = [];

    const clienteFacturasDb = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.startsWith('SELECT id_factura FROM facturas_compra')) {
                const provId = Number(params[0]);
                const numFac = String(params[1]).trim().toLowerCase();
                const existente = tablaFacturasCompra.find(
                    (f) => f.proveedor_id === provId && f.numero_factura.trim().toLowerCase() === numFac
                );
                return { rows: existente ? [{ id_factura: existente.id_factura }] : [] };
            }

            if (q.startsWith('INSERT INTO facturas_compra')) {
                const provId = Number(params[0]);
                const numFac = String(params[1]);
                const dup = tablaFacturasCompra.some(
                    (f) => f.proveedor_id === provId && f.numero_factura.trim().toLowerCase() === numFac.trim().toLowerCase()
                );
                if (dup) {
                    const err: any = new Error('duplicate key value violates unique constraint "uk_facturas_compra_proveedor_numero"');
                    err.code = '23505';
                    throw err;
                }
                const idFac = 500 + tablaFacturasCompra.length + 1;
                tablaFacturasCompra.push({
                    id_factura: idFac,
                    proveedor_id: provId,
                    numero_factura: numFac,
                    oc_id: params[2] != null ? Number(params[2]) : null,
                    subtotal_neto: Number(params[5]),
                    monto_iva: Number(params[6]),
                    total_factura: Number(params[7]),
                });
                return { rows: [{ id_factura: idFac }] };
            }

            if (q.startsWith('SELECT id_articulo FROM articulo')) {
                return { rows: [{ id_articulo: 301 }] };
            }

            if (q.startsWith('INSERT INTO factura_lineas')) {
                const idLin = 800 + tablaFacturaLineas.length + 1;
                tablaFacturaLineas.push({
                    id_factura_linea: idLin,
                    id_factura: Number(params[0]),
                    id_articulo: Number(params[1]),
                    cantidad: Number(params[2]),
                    precio_bruto: Number(params[3]),
                    descuento_1_pct: Number(params[4]),
                    descuento_2_pct: Number(params[5]),
                    descuento_3_pct: Number(params[6]),
                    precio_unitario_neto: Number(params[7]),
                });
                return { rows: [{ id_factura_linea: idLin }] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. Insertar primera factura del proveedor 10 con vínculo a oc_id = 45 y 3 descuentos porcentuales en factura_lineas
    const primera = await insertarFacturaCompraEnTransaccion(clienteFacturasDb, {
        proveedor_id: 10,
        numero_factura: 'FAC-2026-900',
        oc_id: 45,
        items: [
            {
                sku: 'CAB-3X10',
                quantity: 10,
                grossPrice: 10000,
                disc1: 10,
                disc2: 5,
                disc3: 2,
            },
        ],
    });

    assert.equal(primera.id_factura, 501);
    assert.equal(primera.proveedor_id, 10);
    assert.equal(primera.oc_id, 45);
    assert.equal(primera.lineas.length, 1);
    assert.equal(primera.lineas[0].descuento_1_pct, 10);
    assert.equal(primera.lineas[0].descuento_2_pct, 5);
    assert.equal(primera.lineas[0].descuento_3_pct, 2);
    assert.equal(primera.lineas[0].precio_unitario_neto, 8379);

    // 2. [SCRUM] Intentar insertar la misma factura 'FAC-2026-900' para el MISMO proveedor (proveedor_id = 10) -> debe fallar con 409
    await assert.rejects(
        () =>
            insertarFacturaCompraEnTransaccion(clienteFacturasDb, {
                proveedor_id: 10,
                numero_factura: 'fac-2026-900',
                oc_id: null,
                items: [{ sku: 'CAB-3X10', quantity: 5, grossPrice: 10000 }],
            }),
        (err: any) => err?.status === 409 || err?.statusCode === 409 || String(err?.message).includes('Restricción única'),
        'debe impedir registrar dos veces el mismo número de factura del mismo proveedor'
    );
    assert.equal(tablaFacturasCompra.length, 1, 'no debe haberse insertado la factura duplicada');

    // 3. Permitir el mismo número de factura si pertenece a OTRO proveedor (proveedor_id = 25) y con vínculo opcional oc_id = null
    const otroProveedor = await insertarFacturaCompraEnTransaccion(clienteFacturasDb, {
        proveedor_id: 25,
        numero_factura: 'FAC-2026-900',
        oc_id: null,
        items: [{ sku: 'CAB-3X10', quantity: 5, grossPrice: 10000, disc1: 5, disc2: 0, disc3: 0 }],
    });
    assert.equal(otroProveedor.id_factura, 502);
    assert.equal(otroProveedor.proveedor_id, 25);
    assert.equal(otroProveedor.oc_id, null);
    assert.equal(tablaFacturasCompra.length, 2);
});

test('[FRONT-1][SCRUM] formulario Nueva Solicitud de Insumos muestra stock disponible en vivo, alerta e impide enviar solicitudes que superen el disponible o para proyectos inactivos, y al crear una solicitud válida transfiere el stock a Comprometido en H6', () => {
    const catalogoInicialH6 = [
        {
            sku: 'CAB-THHN-12',
            name: 'Cable THHN 12 AWG Rojo',
            unit: 'm',
            stock: 50,      // Disponible en vivo
            committed: 10,  // Comprometido actual en H6
            quarantine: 0,
            minStock: 15,
            disabled: false,
        },
        {
            sku: 'TAB-12P',
            name: 'Tablero Sobreponer 12 Polos',
            unit: 'un',
            stock: 8,       // Disponible en vivo
            committed: 2,   // Comprometido actual en H6
            quarantine: 0,
            minStock: 3,
            disabled: false,
        },
    ];

    const proyectoActivo = {
        id: 'proj_act_1',
        code: 'PROY-2026-01',
        name: 'Instalación Eléctrica Bodega Sur',
        status: 'activo',
    };
    const proyectoCerradoInactivo = {
        id: 'proj_cer_2',
        code: 'PROY-2025-99',
        name: 'Obra Antigua Cerrada',
        status: 'cerrado',
    };
    const proyectoPausadoInactivo = {
        id: 'proj_pau_3',
        code: 'PROY-2026-04',
        name: 'Faena Pausada Temporalmente',
        status: 'pausado',
    };

    assert.equal(esProyectoActivoParaSolicitud(proyectoActivo), true);
    assert.equal(esProyectoActivoParaSolicitud(proyectoCerradoInactivo), false);
    assert.equal(esProyectoActivoParaSolicitud(proyectoPausadoInactivo), false);

    // 1. Impide enviar solicitud para un proyecto inactivo ('cerrado' o 'pausado')
    const valProyInactivo = validarFormularioNuevaSolicitudInsumos(
        proyectoCerradoInactivo,
        [{ sku: 'CAB-THHN-12', quantity: 10 }],
        catalogoInicialH6
    );
    assert.equal(valProyInactivo.esValida, false, 'debe bloquear solicitud para proyecto cerrado/inactivo');
    assert.equal(valProyInactivo.proyectoActivo, false);
    assert.ok(valProyInactivo.errorProyecto?.includes('inactivo'));

    // 2. Muestra stock disponible en vivo y alerta si la cantidad ingresada (65 m) supera el disponible (50 m)
    const valSuperaStock = validarFormularioNuevaSolicitudInsumos(
        proyectoActivo,
        [{ sku: 'CAB-THHN-12', quantity: 65 }],
        catalogoInicialH6
    );
    assert.equal(valSuperaStock.esValida, false, 'debe bloquear solicitud cuando la cantidad supera el stock disponible');
    assert.equal(valSuperaStock.lineasEvaluadas[0].stockDisponibleActual, 50);
    assert.equal(valSuperaStock.lineasEvaluadas[0].superaDisponible, true);
    assert.equal(valSuperaStock.lineasEvaluadas[0].faltante, 15, 'faltan 15 m (65 solicitados vs 50 disponibles)');
    assert.equal(valSuperaStock.faltantesStock.length, 1);
    assert.ok(valSuperaStock.faltantesStock[0].includes('supera el stock disponible en vivo'));

    // 3. [SCRUM] Crea una solicitud válida (20 m de CAB-THHN-12 y 3 un de TAB-12P) y verifica que el stock pase a Comprometido en H6
    const lineasValidas = [
        { sku: 'CAB-THHN-12', quantity: 20 },
        { sku: 'TAB-12P', quantity: 3 },
    ];
    const valValida = validarFormularioNuevaSolicitudInsumos(
        proyectoActivo,
        lineasValidas,
        catalogoInicialH6
    );
    assert.equal(valValida.esValida, true, 'solicitud válida dentro del stock disponible y proyecto activo');
    assert.equal(valValida.faltantesStock.length, 0);
    assert.equal(valValida.lineasEvaluadas[0].stockDisponibleRestanteH6, 30, 'Disponible CAB-THHN-12 proyectado en H6: 50 - 20 = 30');
    assert.equal(valValida.lineasEvaluadas[0].stockComprometidoNuevoH6, 30, 'Comprometido CAB-THHN-12 proyectado en H6: 10 + 20 = 30');
    assert.equal(valValida.lineasEvaluadas[1].stockDisponibleRestanteH6, 5, 'Disponible TAB-12P proyectado en H6: 8 - 3 = 5');
    assert.equal(valValida.lineasEvaluadas[1].stockComprometidoNuevoH6, 5, 'Comprometido TAB-12P proyectado en H6: 2 + 3 = 5');

    const catalogoActualizadoH6 = aplicarReservaComprometidoEnCatalogoH6(catalogoInicialH6, lineasValidas);
    const cableEnH6 = catalogoActualizadoH6.find((p) => p.sku === 'CAB-THHN-12')!;
    const tableroEnH6 = catalogoActualizadoH6.find((p) => p.sku === 'TAB-12P')!;

    assert.equal(cableEnH6.stock, 30, 'Stock disponible de CAB-THHN-12 en H6 baja de 50 a 30');
    assert.equal(cableEnH6.committed, 30, 'Stock comprometido de CAB-THHN-12 en H6 sube de 10 a 30');
    assert.equal(tableroEnH6.stock, 5, 'Stock disponible de TAB-12P en H6 baja de 8 a 5');
    assert.equal(tableroEnH6.committed, 5, 'Stock comprometido de TAB-12P en H6 sube de 2 a 5');

    // 4. Si la solicitud se anula o rechaza, el stock comprometido regresa a disponible en H6
    const catalogoLiberadoH6 = liberarReservaComprometidoEnCatalogoH6(catalogoActualizadoH6, lineasValidas);
    assert.equal(catalogoLiberadoH6[0].stock, 50);
    assert.equal(catalogoLiberadoH6[0].committed, 10);
});

test('[BACK-1][SCRUM] endpoint transaccional de emisión de solicitud: intenta solicitar 1 unidad más del disponible y verifica que rechace toda la solicitud sin crearla; y cuando cumple, descuenta de disponible, suma a comprometido y notifica al Administrador', async () => {
    const tablaSolicitudes: { id_solicitud: number; id_proyecto: number; estado_solicitud: string }[] = [];
    const tablaDetalleSolicitudes: { id_detalle_solicitud: number; id_solicitud: number; id_articulo: number; cantidad_solicitada: number }[] = [];
    const tablaAlertas: { id_alerta: number; tipo: string; titulo: string; descripcion: string }[] = [];

    let estadoProyectoBd = 'En Proceso'; // Proyecto activo
    const stockArticulos = new Map<number, { disponible: number; comprometido: number }>([
        [101, { disponible: 15, comprometido: 5 }],
        [102, { disponible: 10, comprometido: 0 }],
    ]);

    const clienteSolicitudMock = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM proyecto') && q.includes('WHERE id_proyecto = $1')) {
                return {
                    rows: [
                        {
                            id_proyecto: Number(params[0]),
                            nombre_proyecto: 'Proyecto Montaje Subestación Norte',
                            estado_proyecto: estadoProyectoBd,
                        },
                    ],
                };
            }

            if (q.includes('FROM articulo WHERE')) {
                const param = params[0];
                if (param === 101 || String(param).toUpperCase() === 'INS-101') {
                    return {
                        rows: [{ id_articulo: 101, sku: 'INS-101', nombre_articulo: 'Interruptor 3x63A', activo: true }],
                    };
                }
                if (param === 102 || String(param).toUpperCase() === 'INS-102') {
                    return {
                        rows: [{ id_articulo: 102, sku: 'INS-102', nombre_articulo: 'Contactor 40A', activo: true }],
                    };
                }
                return { rows: [] };
            }

            if (q.includes('FROM articulos_stock') && q.includes('FOR UPDATE')) {
                const idArt = Number(params[0]);
                const st = stockArticulos.get(idArt) ?? { disponible: 0, comprometido: 0 };
                return {
                    rows: [
                        {
                            cantidad_disponible: st.disponible,
                            cantidad_comprometida: st.comprometido,
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO solicitudes_insumos')) {
                return {
                    rows: [
                        {
                            id_solicitud: 700 + tablaSolicitudes.length + 1,
                            estado: 'Pendiente',
                            fecha_solicitud: new Date().toISOString(),
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO solicitudes (')) {
                const idSol = 700 + tablaSolicitudes.length + 1;
                tablaSolicitudes.push({
                    id_solicitud: idSol,
                    id_proyecto: Number(params[1]),
                    estado_solicitud: 'Pendiente',
                });
                return {
                    rows: [
                        {
                            id_solicitud: idSol,
                            estado_solicitud: 'Pendiente',
                            fecha_solicitud: new Date().toISOString(),
                        },
                    ],
                };
            }

            if (q.startsWith('INSERT INTO detalle_solicitudes')) {
                const idDet = 900 + tablaDetalleSolicitudes.length + 1;
                tablaDetalleSolicitudes.push({
                    id_detalle_solicitud: idDet,
                    id_solicitud: Number(params[0]),
                    id_articulo: Number(params[1]),
                    cantidad_solicitada: Number(params[2]),
                });
                return { rows: [{ id_detalle_solicitud: idDet }] };
            }

            if (q.startsWith('UPDATE articulos_stock SET cantidad_disponible = $2, cantidad_comprometida = $3')) {
                const idArt = Number(params[0]);
                stockArticulos.set(idArt, {
                    disponible: Number(params[1]),
                    comprometido: Number(params[2]),
                });
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('INSERT INTO alertas_sistema')) {
                const alerta = {
                    id_alerta: 3000 + tablaAlertas.length + 1,
                    tipo: 'nueva_solicitud_insumos',
                    severidad: 'amarillo',
                    titulo: String(params[0]),
                    descripcion: String(params[1]),
                    id_articulo: Number(params[2]),
                    id_orden_compra: null,
                    leida: false,
                    fecha_creacion: new Date().toISOString(),
                };
                tablaAlertas.push(alerta);
                return { rows: [alerta] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. [SCRUM] Intentar solicitar 1 unidad MÁS del disponible para INS-101 (Disponible = 15, se solicitan 16)
    //    junto con otro ítem válido (INS-102: 4 de 10 disponibles) -> debe rechazar TODA la solicitud
    await assert.rejects(
        () =>
            emitirSolicitudInsumosEnTransaccion(clienteSolicitudMock, {
                id_proyecto: 12,
                id_usuario: 2,
                items: [
                    { sku: 'INS-102', cantidad_solicitada: 4 },
                    { sku: 'INS-101', cantidad_solicitada: 16 }, // 15 + 1 = 16 (1 más del disponible)
                ],
            }),
        (err: any) => String(err?.message).includes('Stock disponible insuficiente'),
        'debe rechazar toda la solicitud si un ítem pide 1 unidad más del disponible'
    );

    // Verificar que NO se creó ninguna solicitud ni se modificó el stock de ninguno de los 2 insumos
    assert.equal(tablaSolicitudes.length, 0, 'no debe crearse la solicitud en base de datos');
    assert.equal(tablaDetalleSolicitudes.length, 0, 'no debe insertarse ningún detalle de solicitud');
    assert.equal(stockArticulos.get(101)?.disponible, 15, 'el disponible de INS-101 permanece intacto en 15');
    assert.equal(stockArticulos.get(101)?.comprometido, 5, 'el comprometido de INS-101 permanece intacto en 5');
    assert.equal(stockArticulos.get(102)?.disponible, 10, 'el disponible de INS-102 permanece intacto en 10');

    // 2. Intentar solicitar para un proyecto INACTIVO ('Completado' o 'Cancelado') -> debe rechazar con 400
    estadoProyectoBd = 'Completado';
    await assert.rejects(
        () =>
            emitirSolicitudInsumosEnTransaccion(clienteSolicitudMock, {
                id_proyecto: 12,
                id_usuario: 2,
                items: [{ sku: 'INS-101', cantidad_solicitada: 5 }],
            }),
        (err: any) => String(err?.message).includes('proyectos activos'),
        'debe rechazar solicitudes para proyectos inactivos'
    );
    assert.equal(tablaSolicitudes.length, 0);

    // 3. Emitir solicitud válida sobre proyecto activo ('En Proceso'): 15 un de INS-101 y 4 un de INS-102
    estadoProyectoBd = 'En Proceso';
    const emitida = await emitirSolicitudInsumosEnTransaccion(clienteSolicitudMock, {
        id_proyecto: 12,
        id_usuario: 2,
        descripcion_solicitud: 'Materiales para montaje de celda principal',
        items: [
            { sku: 'INS-101', cantidad_solicitada: 15 },
            { sku: 'INS-102', cantidad_solicitada: 4 },
        ],
    });

    assert.equal(emitida.id_solicitud, 701);
    assert.equal(emitida.estado_solicitud, 'Pendiente', 'el estado inicial es Pendiente');
    assert.equal(tablaSolicitudes.length, 1);
    assert.equal(tablaDetalleSolicitudes.length, 2);

    // Verificar que descontó de disponible y sumó a comprometido al instante
    assert.equal(stockArticulos.get(101)?.disponible, 0, 'INS-101 disponible pasa de 15 a 0');
    assert.equal(stockArticulos.get(101)?.comprometido, 20, 'INS-101 comprometido pasa de 5 a 20');
    assert.equal(stockArticulos.get(102)?.disponible, 6, 'INS-102 disponible pasa de 10 a 6');
    assert.equal(stockArticulos.get(102)?.comprometido, 4, 'INS-102 comprometido pasa de 0 a 4');

    // Verificar notificación al Administrador
    assert.equal(tablaAlertas.length, 1, 'debe generar notificación/alerta al Administrador');
    assert.equal(tablaAlertas[0].tipo, 'nueva_solicitud_insumos');
    assert.ok(emitida.alerta_administrador?.titulo.includes('#701'));
});

test('[DB][SCRUM] tablas solicitudes_insumos (proyecto_id, bodeguero_id, estado: Pendiente/Aprobada/Rechazada/Anulada, motivo_rechazo, nro_comprobante) y solicitud_lineas: revisa estructura y claves foráneas vinculando solicitudes solo a proyectos existentes', async () => {
    assert.deepEqual(
        ESTADOS_SOLICITUD_INSUMOS,
        ['Pendiente', 'Aprobada', 'Rechazada', 'Anulada'],
        'contempla los 4 estados de solicitudes_insumos: Pendiente, Aprobada, Rechazada y Anulada'
    );

    const proyectosExistentes = new Set<number>([10, 20]);
    const tablaSolicitudesInsumos: {
        id_solicitud: number;
        proyecto_id: number;
        bodeguero_id: number;
        estado: string;
        motivo_rechazo: string | null;
        nro_comprobante: string | null;
    }[] = [];
    const tablaSolicitudLineas: {
        id_solicitud_linea: number;
        id_solicitud: number;
        id_articulo: number;
        cantidad_solicitada: number;
    }[] = [];

    const clienteDbSolicitudes = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.startsWith('SELECT id_proyecto FROM proyecto WHERE id_proyecto = $1')) {
                const pid = Number(params[0]);
                return { rows: proyectosExistentes.has(pid) ? [{ id_proyecto: pid }] : [] };
            }

            if (q.startsWith('INSERT INTO solicitudes_insumos')) {
                const pid = Number(params[0]);
                if (!proyectosExistentes.has(pid)) {
                    const err: any = new Error('violates foreign key constraint "fk_solicitudes_insumos_proyecto"');
                    err.code = '23503';
                    throw err;
                }
                const idSol = 400 + tablaSolicitudesInsumos.length + 1;
                tablaSolicitudesInsumos.push({
                    id_solicitud: idSol,
                    proyecto_id: pid,
                    bodeguero_id: Number(params[1]),
                    estado: String(params[2]),
                    motivo_rechazo: params[3] != null ? String(params[3]) : null,
                    nro_comprobante: params[4] != null ? String(params[4]) : null,
                });
                return { rows: [{ id_solicitud: idSol }] };
            }

            if (q.startsWith('INSERT INTO solicitud_lineas')) {
                const idSol = Number(params[0]);
                const existeCab = tablaSolicitudesInsumos.some((s) => s.id_solicitud === idSol);
                if (!existeCab) {
                    const err: any = new Error('violates foreign key constraint "fk_solicitud_lineas_solicitud"');
                    err.code = '23503';
                    throw err;
                }
                const idLin = 600 + tablaSolicitudLineas.length + 1;
                tablaSolicitudLineas.push({
                    id_solicitud_linea: idLin,
                    id_solicitud: idSol,
                    id_articulo: Number(params[1]),
                    cantidad_solicitada: Number(params[2]),
                });
                return { rows: [{ id_solicitud_linea: idLin }] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. Insertar solicitud vinculada a un proyecto existente (proyecto_id = 10) con estado Aprobada y nro_comprobante
    const solAprobada = await insertarSolicitudInsumosDbEnTransaccion(clienteDbSolicitudes, {
        proyecto_id: 10,
        bodeguero_id: 2,
        estado: 'Aprobada',
        nro_comprobante: 'COMP-2026-001',
        lineas: [
            { id_articulo: 101, cantidad_solicitada: 12 },
            { id_articulo: 102, cantidad_solicitada: 5 },
        ],
    });
    assert.equal(solAprobada.id_solicitud, 401);
    assert.equal(solAprobada.proyecto_id, 10);
    assert.equal(solAprobada.bodeguero_id, 2);
    assert.equal(solAprobada.estado, 'Aprobada');
    assert.equal(solAprobada.nro_comprobante, 'COMP-2026-001');
    assert.equal(solAprobada.lineas.length, 2);
    assert.equal(solAprobada.lineas[0].id_solicitud, 401);

    // 2. Insertar solicitud en estado Rechazada con motivo_rechazo
    const solRechazada = await insertarSolicitudInsumosDbEnTransaccion(clienteDbSolicitudes, {
        proyecto_id: 20,
        bodeguero_id: 2,
        estado: 'Rechazada',
        motivo_rechazo: 'Partida reprogramada para el próximo mes',
        lineas: [{ id_articulo: 101, cantidad_solicitada: 3 }],
    });
    assert.equal(solRechazada.estado, 'Rechazada');
    assert.equal(solRechazada.motivo_rechazo, 'Partida reprogramada para el próximo mes');

    // 3. [SCRUM] Intentar vincular una solicitud a un proyecto INEXISTENTE (proyecto_id = 99999) -> viola FK 23503
    await assert.rejects(
        () =>
            insertarSolicitudInsumosDbEnTransaccion(clienteDbSolicitudes, {
                proyecto_id: 99999,
                bodeguero_id: 2,
                estado: 'Pendiente',
                lineas: [{ id_articulo: 101, cantidad_solicitada: 5 }],
            }),
        (err: any) => err?.code === '23503',
        'debe rechazar con 23503 (violación de clave foránea) cualquier solicitud hacia un proyecto que no existe'
    );
    assert.equal(tablaSolicitudesInsumos.length, 2, 'no debe insertar solicitudes vinculadas a proyectos inexistentes');
});

test('[FRONT-2][SCRUM] acciones de Editar y Anular en el listado de solicitudes del Bodeguero: activas únicamente cuando el estado es Pendiente y bloqueadas en Aprobada, Rechazada o Anulada', () => {
    // 1. Estado Pendiente -> Editar y Anular activos
    const enPendiente = obtenerEstadoAccionesBodegueroSolicitud('pendiente');
    assert.equal(enPendiente.puedeEditar, true, 'en estado Pendiente el botón Editar está activo');
    assert.equal(enPendiente.puedeAnular, true, 'en estado Pendiente el botón Anular está activo');
    assert.equal(enPendiente.motivoBloqueo, null);

    // 2. Estados Aprobada, Rechazada y Anulada -> Editar y Anular bloqueados
    const enAprobada = obtenerEstadoAccionesBodegueroSolicitud('aprobada');
    assert.equal(enAprobada.puedeEditar, false, 'solicitud Aprobada bloquea Editar');
    assert.equal(enAprobada.puedeAnular, false, 'solicitud Aprobada bloquea Anular');
    assert.ok(enAprobada.motivoBloqueo?.includes('APROBADA'));

    const enRechazada = obtenerEstadoAccionesBodegueroSolicitud('rechazada');
    assert.equal(enRechazada.puedeEditar, false, 'solicitud Rechazada bloquea Editar');
    assert.equal(enRechazada.puedeAnular, false, 'solicitud Rechazada bloquea Anular');
    assert.ok(enRechazada.motivoBloqueo?.includes('RECHAZADA'));

    const enAnulada = obtenerEstadoAccionesBodegueroSolicitud('anulada');
    assert.equal(enAnulada.puedeEditar, false, 'solicitud Anulada bloquea Editar');
    assert.equal(enAnulada.puedeAnular, false, 'solicitud Anulada bloquea Anular');

    // 3. [SCRUM] Simular edición y luego anulación desde la interfaz del Bodeguero ajustando el stock comprometido en H6:
    const catalogoInicial = [
        {
            sku: 'CAB-THHN-12',
            name: 'Cable THHN 12 AWG Rojo',
            unit: 'm',
            stock: 30,      // Disponible actual tras haber creado una solicitud pendiente de 20 m
            committed: 20,  // Comprometido actual por la solicitud pendiente
            quarantine: 0,
            minStock: 10,
        },
    ];
    const lineasOriginales = [{ sku: 'CAB-THHN-12', quantity: 20 }];

    // A) El Bodeguero edita la solicitud pendiente cambiando la cantidad de 20 m a 12 m:
    const trasLiberarOriginal = liberarReservaComprometidoEnCatalogoH6(catalogoInicial, lineasOriginales);
    assert.equal(trasLiberarOriginal[0].stock, 50);
    assert.equal(trasLiberarOriginal[0].committed, 0);

    const lineasEditadas = [{ sku: 'CAB-THHN-12', quantity: 12 }];
    const trasEditarSolicitud = aplicarReservaComprometidoEnCatalogoH6(trasLiberarOriginal, lineasEditadas);
    assert.equal(trasEditarSolicitud[0].stock, 38, 'tras editar de 20 m a 12 m, el disponible sube de 30 a 38');
    assert.equal(trasEditarSolicitud[0].committed, 12, 'tras editar de 20 m a 12 m, el comprometido pasa a 12');

    // B) El Bodeguero anula la solicitud pendiente: el stock comprometido (12 m) se libera de vuelta a disponible (50 m)
    const trasAnularSolicitud = liberarReservaComprometidoEnCatalogoH6(trasEditarSolicitud, lineasEditadas);
    assert.equal(trasAnularSolicitud[0].stock, 50, 'al anular la solicitud pendiente, el disponible vuelve a 50');
    assert.equal(trasAnularSolicitud[0].committed, 0, 'al anular la solicitud pendiente, el comprometido queda en 0');
});

test('[FRONT-1][SCRUM] bandeja de aprobación del Administrador: exige motivo obligatorio al rechazar, genera vista de comprobante numerado al aprobar y notifica el resultado al bodeguero solicitante', () => {
    const solicitudPendiente = {
        id: 'sol_2026_105',
        code: 'SOL-2026-105',
        projectCode: 'PROY-2026-01',
        projectName: 'Instalación Eléctrica Bodega Sur',
        technicianName: 'Camila Vera Soto',
        technicianRut: '15.321.654-2',
        items: [
            { sku: 'CAB-THHN-12', name: 'Cable THHN 12 AWG Rojo', quantity: 25, unit: 'm' },
            { sku: 'TAB-12P', name: 'Tablero Sobreponer 12 Polos', quantity: 2, unit: 'un' },
        ],
    };

    // 1. Intento de rechazo SIN motivo -> bloqueado (exige motivo obligatorio)
    const rechazoVacio = construirNotificacionRechazoSolicitud(
        solicitudPendiente,
        '   ',
        'Javier Muñoz Contreras'
    );
    assert.equal(rechazoVacio.esValido, false, 'debe bloquear rechazo sin motivo');
    assert.equal(rechazoVacio.error, 'El rechazo exige motivo obligatorio.');
    assert.equal(rechazoVacio.notificationToRequester, null);

    // 2. Rechazo CON motivo obligatorio -> válido y genera notificación al bodeguero solicitante
    const rechazoValido = construirNotificacionRechazoSolicitud(
        solicitudPendiente,
        'Excede el metraje de la etapa 1; ajustar a plano eléctrico.',
        'Javier Muñoz Contreras'
    );
    assert.equal(rechazoValido.esValido, true);
    assert.ok(rechazoValido.notificationToRequester);
    assert.equal(rechazoValido.notificationToRequester?.recipientName, 'Camila Vera Soto');
    assert.ok(rechazoValido.notificationToRequester?.message.includes('Excede el metraje de la etapa 1'));

    // 3. [SCRUM] Completa el flujo de aprobación y revisa el comprobante numerado generado y la notificación al bodeguero solicitante
    const numCorrelativo = generarNumeroComprobanteSolicitud(['COMP-2026-001', 'COMP-2026-004'], 2026);
    assert.equal(numCorrelativo, 'COMP-2026-005', 'genera numeración correlativa COMP-YYYY-NNN');

    const comprobante = construirComprobanteYNotificacionAprobacion(
        solicitudPendiente,
        'Javier Muñoz Contreras',
        ['COMP-2026-001', 'COMP-2026-004'],
        '2026-11-21'
    );

    assert.equal(comprobante.receiptNumber, 'COMP-2026-005');
    assert.equal(comprobante.requestCode, 'SOL-2026-105');
    assert.equal(comprobante.projectCode, 'PROY-2026-01');
    assert.equal(comprobante.requesterName, 'Camila Vera Soto');
    assert.equal(comprobante.approvedBy, 'Javier Muñoz Contreras');
    assert.equal(comprobante.totalItemsCount, 2);
    assert.equal(comprobante.totalUnitsCount, 27);
    assert.equal(comprobante.notificationToRequester.recipientName, 'Camila Vera Soto');
    assert.equal(comprobante.notificationToRequester.recipientRut, '15.321.654-2');
    assert.ok(comprobante.notificationToRequester.title.includes('COMP-2026-005'));
    assert.ok(comprobante.notificationToRequester.message.includes('aprobó su solicitud SOL-2026-105'));
});

test('[BACK-2][SCRUM] edición y anulación exclusivas en estado Pendiente: modifica y luego anula una solicitud pendiente verificando que recalcule la diferencia comprometida, libere el 100% al anular volviendo el stock disponible a su valor original y registre auditoría', async () => {
    // Stock original antes de cualquier solicitud:
    //   INS-201: Disponible = 40, Comprometido = 0
    //   INS-202: Disponible = 20, Comprometido = 0
    // Luego se creó la solicitud #801 en estado 'Pendiente' con:
    //   - INS-201: 15 un solicitadas -> Disponible actual = 25, Comprometido actual = 15
    //   - INS-202:  8 un solicitadas -> Disponible actual = 12, Comprometido actual =  8
    let estadoSolicitudActual = 'Pendiente';
    let lineasSolicitudActual = [
        { id_articulo: 201, sku: 'INS-201', nombre_articulo: 'Cable UTP Cat6', cantidad_solicitada: 15 },
        { id_articulo: 202, sku: 'INS-202', nombre_articulo: 'Patch Panel 24P', cantidad_solicitada: 8 },
    ];
    const stockBd = new Map<number, { disponible: number; comprometido: number }>([
        [201, { disponible: 25, comprometido: 15 }],
        [202, { disponible: 12, comprometido: 8 }],
    ]);
    const bitacoraAuditoria: { entidad: string; accion: string; descripcion: string }[] = [];

    const clienteMutacionSolicitud = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM solicitudes_insumos') && q.includes('FOR UPDATE')) {
                return {
                    rows: [
                        {
                            id_solicitud: Number(params[0]),
                            proyecto_id: 10,
                            bodeguero_id: 2,
                            estado: estadoSolicitudActual,
                            descripcion_solicitud: 'Solicitud cableado estructurado',
                        },
                    ],
                };
            }

            if (q.includes('FROM solicitud_lineas sl') && q.includes('WHERE sl.id_solicitud = $1')) {
                return {
                    rows: lineasSolicitudActual.map((l) => ({ ...l })),
                };
            }

            if (q.includes('FROM articulo WHERE')) {
                const p = params[0];
                if (p === 201 || String(p).toUpperCase() === 'INS-201') {
                    return {
                        rows: [{ id_articulo: 201, sku: 'INS-201', nombre_articulo: 'Cable UTP Cat6', activo: true }],
                    };
                }
                if (p === 202 || String(p).toUpperCase() === 'INS-202') {
                    return {
                        rows: [{ id_articulo: 202, sku: 'INS-202', nombre_articulo: 'Patch Panel 24P', activo: true }],
                    };
                }
                return { rows: [] };
            }

            if (q.includes('FROM articulos_stock') && q.includes('FOR UPDATE')) {
                const idArt = Number(params[0]);
                const st = stockBd.get(idArt) ?? { disponible: 0, comprometido: 0 };
                return {
                    rows: [
                        {
                            cantidad_disponible: st.disponible,
                            cantidad_comprometida: st.comprometido,
                        },
                    ],
                };
            }

            if (q.startsWith('UPDATE articulos_stock SET cantidad_disponible = $2, cantidad_comprometida = $3')) {
                const idArt = Number(params[0]);
                stockBd.set(idArt, {
                    disponible: Number(params[1]),
                    comprometido: Number(params[2]),
                });
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('DELETE FROM solicitud_lineas')) {
                lineasSolicitudActual = [];
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('INSERT INTO solicitud_lineas')) {
                const idArt = Number(params[1]);
                const cant = Number(params[2]);
                lineasSolicitudActual.push({
                    id_articulo: idArt,
                    sku: idArt === 201 ? 'INS-201' : 'INS-202',
                    nombre_articulo: idArt === 201 ? 'Cable UTP Cat6' : 'Patch Panel 24P',
                    cantidad_solicitada: cant,
                });
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith("UPDATE solicitudes_insumos SET estado = 'Anulada'")) {
                estadoSolicitudActual = 'Anulada';
                return { rowCount: 1, rows: [] };
            }

            if (q.includes('INSERT INTO bitacora_auditoria')) {
                bitacoraAuditoria.push({
                    entidad: String(params[1]),
                    accion: String(params[2]),
                    descripcion: String(params[6]),
                });
                return { rowCount: 1, rows: [] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. [SCRUM - Paso A] Modificar la solicitud pendiente #801:
    //    - INS-201 baja de 15 a 10 (delta = -5 -> libera 5 de comprometido a disponible: Disp 25 -> 30, Comp 15 -> 10)
    //    - INS-202 sube de  8 a 11 (delta = +3 -> compromete 3 adicionales de disponible: Disp 12 ->  9, Comp  8 -> 11)
    const editRes = await editarSolicitudInsumosEnTransaccion(clienteMutacionSolicitud, 801, {
        id_usuario: 2,
        items: [
            { sku: 'INS-201', cantidad_solicitada: 10 },
            { sku: 'INS-202', cantidad_solicitada: 11 },
        ],
    });

    assert.equal(editRes.estado, 'Pendiente');
    assert.equal(stockBd.get(201)?.disponible, 30, 'INS-201 disponible sube de 25 a 30 tras reducir 5 un');
    assert.equal(stockBd.get(201)?.comprometido, 10, 'INS-201 comprometido baja de 15 a 10');
    assert.equal(stockBd.get(202)?.disponible, 9, 'INS-202 disponible baja de 12 a 9 tras aumentar 3 un');
    assert.equal(stockBd.get(202)?.comprometido, 11, 'INS-202 comprometido sube de 8 a 11');
    assert.equal(bitacoraAuditoria.length, 1, 'registra auditoría al modificar la solicitud pendiente');
    assert.equal(bitacoraAuditoria[0].accion, 'editar_solicitud_pendiente');

    // 2. [SCRUM - Paso B] Anular la solicitud pendiente #801:
    //    Libera el 100% del stock comprometido (10 de INS-201 y 11 de INS-202) y verifica que el disponible
    //    vuelva exactamente al valor original (40 para INS-201 y 20 para INS-202, con comprometido = 0):
    const anulRes = await anularSolicitudInsumosEnTransaccion(clienteMutacionSolicitud, 801, 2);

    assert.equal(anulRes.estado, 'Anulada');
    assert.equal(stockBd.get(201)?.disponible, 40, 'INS-201 disponible vuelve exactamente a su valor original (40)');
    assert.equal(stockBd.get(201)?.comprometido, 0, 'INS-201 comprometido queda en 0 (nunca queda stock bloqueado)');
    assert.equal(stockBd.get(202)?.disponible, 20, 'INS-202 disponible vuelve exactamente a su valor original (20)');
    assert.equal(stockBd.get(202)?.comprometido, 0, 'INS-202 comprometido queda en 0 (nunca queda stock bloqueado)');
    assert.equal(bitacoraAuditoria.length, 2, 'registra auditoría al anular la solicitud pendiente');
    assert.equal(bitacoraAuditoria[1].accion, 'anular_solicitud_pendiente');

    // 3. Intentar editar o volver a anular una solicitud que ya NO está en estado Pendiente ('Anulada' o 'Aprobada') -> bloqueado con 400
    await assert.rejects(
        () =>
            editarSolicitudInsumosEnTransaccion(clienteMutacionSolicitud, 801, {
                items: [{ sku: 'INS-201', cantidad_solicitada: 5 }],
            }),
        (err: any) => String(err?.message).includes('Solo se pueden editar solicitudes en estado Pendiente'),
        'bloquea edición sobre solicitudes que no están en estado Pendiente'
    );

    await assert.rejects(
        () => anularSolicitudInsumosEnTransaccion(clienteMutacionSolicitud, 801, 2),
        (err: any) => String(err?.message).includes('Solo se pueden anular solicitudes en estado Pendiente'),
        'bloquea anulación sobre solicitudes que no están en estado Pendiente'
    );
});

test('[BACK-1][SCRUM] endpoint de resolución para el Administrador: prueba rechazar sin motivo (falla), rechazar con motivo (liberando stock comprometido a disponible) y aprobar (emitiendo comprobante correlativo único que habilita egreso H5 y conecta bloqueo de cierre de proyecto H34)', async () => {
    // 2 solicitudes pendientes del proyecto #10:
    //  - Solicitud #901: 12 un de INS-301 (Stock disponible actual: 28, Comprometido actual: 12 -> Original: 40)
    //  - Solicitud #902:  8 un de INS-302 (Stock disponible actual: 12, Comprometido actual:  8 -> Original: 20)
    const solicitudesBd = new Map<
        number,
        {
            id_solicitud: number;
            proyecto_id: number;
            bodeguero_id: number;
            estado: string;
            motivo_rechazo: string | null;
            nro_comprobante: string | null;
            lineas: { id_articulo: number; sku: string; nombre_articulo: string; cantidad_solicitada: number }[];
        }
    >([
        [
            901,
            {
                id_solicitud: 901,
                proyecto_id: 10,
                bodeguero_id: 2,
                estado: 'Pendiente',
                motivo_rechazo: null,
                nro_comprobante: null,
                lineas: [{ id_articulo: 301, sku: 'INS-301', nombre_articulo: 'Diferencial 2x25A', cantidad_solicitada: 12 }],
            },
        ],
        [
            902,
            {
                id_solicitud: 902,
                proyecto_id: 10,
                bodeguero_id: 2,
                estado: 'Pendiente',
                motivo_rechazo: null,
                nro_comprobante: null,
                lineas: [{ id_articulo: 302, sku: 'INS-302', nombre_articulo: 'Canaleta 40x40', cantidad_solicitada: 8 }],
            },
        ],
    ]);

    const stockBd = new Map<number, { disponible: number; comprometido: number }>([
        [301, { disponible: 28, comprometido: 12 }],
        [302, { disponible: 12, comprometido: 8 }],
    ]);
    const comprobantesEmitidos: string[] = ['COMP-2026-009'];
    const notificacionesBodeguero: { titulo: string; descripcion: string }[] = [];

    const clienteResolucionAdmin = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.includes('FROM solicitudes_insumos') && q.includes('FOR UPDATE')) {
                const sol = solicitudesBd.get(Number(params[0]));
                return { rows: sol ? [{ ...sol, descripcion_solicitud: null }] : [] };
            }

            if (q.includes('FROM solicitud_lineas sl') && q.includes('WHERE sl.id_solicitud = $1')) {
                const sol = solicitudesBd.get(Number(params[0]));
                return { rows: sol ? sol.lineas.map((l) => ({ ...l })) : [] };
            }

            if (q.includes('FROM articulos_stock') && q.includes('FOR UPDATE')) {
                const st = stockBd.get(Number(params[0])) ?? { disponible: 0, comprometido: 0 };
                return {
                    rows: [
                        {
                            cantidad_disponible: st.disponible,
                            cantidad_comprometida: st.comprometido,
                        },
                    ],
                };
            }

            if (q.startsWith('UPDATE articulos_stock SET cantidad_disponible = $2, cantidad_comprometida = $3')) {
                stockBd.set(Number(params[0]), {
                    disponible: Number(params[1]),
                    comprometido: Number(params[2]),
                });
                return { rowCount: 1, rows: [] };
            }

            if (q.includes("SET estado = 'Rechazada'")) {
                const sol = solicitudesBd.get(Number(params[0]));
                if (sol) {
                    sol.estado = 'Rechazada';
                    sol.motivo_rechazo = String(params[1]);
                    sol.nro_comprobante = null;
                }
                return { rowCount: 1, rows: [] };
            }

            if (q.includes("SET estado = 'Aprobada'")) {
                const sol = solicitudesBd.get(Number(params[0]));
                if (sol) {
                    sol.estado = 'Aprobada';
                    sol.nro_comprobante = String(params[1]);
                    sol.motivo_rechazo = null;
                    if (!comprobantesEmitidos.includes(sol.nro_comprobante)) {
                        comprobantesEmitidos.push(sol.nro_comprobante);
                    }
                }
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('SELECT nro_comprobante FROM solicitudes_insumos')) {
                return {
                    rows: comprobantesEmitidos.map((c) => ({ nro_comprobante: c })),
                };
            }

            if (q.includes("estado IN ('Pendiente', 'Aprobada')")) {
                const pid = Number(params[0]);
                const bloqueantes = Array.from(solicitudesBd.values())
                    .filter((s) => s.proyecto_id === pid && (s.estado === 'Pendiente' || s.estado === 'Aprobada'))
                    .map((s) => ({
                        id_solicitud: s.id_solicitud,
                        estado: s.estado,
                        nro_comprobante: s.nro_comprobante,
                    }));
                return { rows: bloqueantes };
            }

            if (q.startsWith('INSERT INTO alertas_sistema')) {
                const alerta = {
                    id_alerta: 6000 + notificacionesBodeguero.length + 1,
                    tipo: 'resolucion_solicitud_bodeguero',
                    severidad: 'info',
                    titulo: String(params[0]),
                    descripcion: String(params[1]),
                    id_articulo: Number(params[2]),
                    id_orden_compra: null,
                    leida: false,
                    fecha_creacion: new Date().toISOString(),
                };
                notificacionesBodeguero.push(alerta);
                return { rows: [alerta] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. [SCRUM - Paso 1] Intentar RECHAZAR la solicitud #901 SIN motivo -> debe fallar con 400 y no liberar stock
    await assert.rejects(
        () =>
            resolverSolicitudInsumosEnTransaccion(clienteResolucionAdmin, 901, {
                decision: 'Rechazada',
                motivo_rechazo: '   ',
                id_usuario_admin: 1,
            }),
        (err: any) => String(err?.message).includes('motivo de rechazo es obligatorio'),
        'rechazar sin motivo debe fallar'
    );
    assert.equal(solicitudesBd.get(901)?.estado, 'Pendiente', 'la solicitud #901 sigue Pendiente');
    assert.equal(stockBd.get(301)?.disponible, 28, 'el stock de INS-301 no cambió');
    assert.equal(stockBd.get(301)?.comprometido, 12, 'el comprometido de INS-301 sigue en 12');

    // 2. [SCRUM - Paso 2] RECHAZAR la solicitud #901 CON motivo obligatorio -> libera el stock comprometido a disponible y notifica al bodeguero
    const resRechazo = await resolverSolicitudInsumosEnTransaccion(clienteResolucionAdmin, 901, {
        decision: 'Rechazada',
        motivo_rechazo: 'Diferencial será provisto por el mandante según anexo 3.',
        id_usuario_admin: 1,
    });

    assert.equal(resRechazo.estado, 'Rechazada');
    assert.equal(resRechazo.motivo_rechazo, 'Diferencial será provisto por el mandante según anexo 3.');
    assert.equal(resRechazo.habilita_egreso_h5, false);
    assert.equal(stockBd.get(301)?.disponible, 40, 'al rechazar con motivo, libera las 12 un comprometidas de vuelta a disponible (28 + 12 = 40)');
    assert.equal(stockBd.get(301)?.comprometido, 0, 'el comprometido de INS-301 queda en 0');
    assert.ok(resRechazo.notificacion_bodeguero?.titulo.includes('Rechazada'));

    // 3. [SCRUM - Paso 3] APROBAR la solicitud #902 -> emite comprobante correlativo único (COMP-2026-010) que habilita el egreso (H5),
    //    notifica al bodeguero y mantiene activo el bloqueo de cierre del proyecto #10 (H34)
    const resAprobacion = await resolverSolicitudInsumosEnTransaccion(clienteResolucionAdmin, 902, {
        decision: 'Aprobada',
        id_usuario_admin: 1,
    });

    assert.equal(resAprobacion.estado, 'Aprobada');
    assert.equal(resAprobacion.nro_comprobante, 'COMP-2026-010', 'emite correlativo único siguiente a COMP-2026-009');
    assert.equal(resAprobacion.habilita_egreso_h5, true, 'habilita el egreso en bodega (H5)');
    assert.equal(resAprobacion.bloquea_cierre_proyecto_h34, true);
    assert.equal(stockBd.get(302)?.disponible, 12, 'mantiene reservado el stock para egreso en H5');
    assert.equal(stockBd.get(302)?.comprometido, 8);
    assert.ok(resAprobacion.notificacion_bodeguero?.titulo.includes('COMP-2026-010'));

    // 4. Verificar conexión con el bloqueo de cierre de proyecto (H34):
    //    El proyecto #10 tiene la solicitud #902 en estado 'Aprobada' sin egresar -> bloquea el cierre
    const bloqueoH34 = await verificarBloqueoCierreProyectoPorSolicitudesH34(clienteResolucionAdmin, 10);
    assert.equal(bloqueoH34.bloqueado, true, 'debe bloquear el cierre del proyecto mientras exista solicitud Pendiente o Aprobada sin egresar (H34)');
    assert.equal(bloqueoH34.solicitudesBloqueantes.length, 1);
    assert.equal(bloqueoH34.solicitudesBloqueantes[0].id_solicitud, 902);
    assert.equal(bloqueoH34.solicitudesBloqueantes[0].nro_comprobante, 'COMP-2026-010');
});

test('[FRONT-1][SCRUM] pantalla de "Registro de Salida Física": selecciona solicitud aprobada y técnico que retira en bodega, muestra saldo autorizado vs. entregado en tiempo real, ejecuta una salida parcial y luego completa el saldo restante', () => {
    // Catálogo inicial tras la creación y aprobación de la solicitud SOL-2026-025:
    // - INS-501: tenía 20 disponibles; al pedir 12 quedaron 8 en stock disponible y 12 en comprometido.
    // - INS-502: tenía 10 disponibles; al pedir 6 quedaron 4 en stock disponible y 6 en comprometido.
    let catalogoBodega = [
        {
            sku: 'INS-501',
            name: 'Cable Solar 6mm2 Rojo',
            stock: 8,
            committed: 12,
            isBulk: false,
            pmp: 1450,
            unitCost: 1450,
        },
        {
            sku: 'INS-502',
            name: 'Conector MC4 Par',
            stock: 4,
            committed: 6,
            isBulk: false,
            pmp: 2100,
            unitCost: 2100,
        },
    ];

    let solicitudAprobada = {
        id: 'req_025',
        code: 'SOL-2026-025',
        status: 'aprobada',
        receiptNumber: 'COMP-2026-025',
        projectCode: 'PRY-2026-010',
        projectName: 'Planta Fotovoltaica Curicó',
        technicianName: 'Matías Rojas',
        technicianRut: '17.456.789-0',
        items: [
            {
                sku: 'INS-501',
                name: 'Cable Solar 6mm2 Rojo',
                quantity: 12,
                deliveredQuantity: 0,
                unit: 'm',
            },
            {
                sku: 'INS-502',
                name: 'Conector MC4 Par',
                quantity: 6,
                deliveredQuantity: 0,
                unit: 'par',
            },
        ],
        timeline: [] as any[],
    };

    // 0. Validar que bloquea solicitudes no aprobadas o que superen el saldo autorizado/stock
    const intentoNoAprobada = ejecutarSalidaFisicaSolicitudEnMemoria({
        solicitud: { ...solicitudAprobada, status: 'pendiente' },
        itemsToDispatch: [{ sku: 'INS-501', quantity: 5 }],
        technicianRut: '18.222.333-4',
        technicianName: 'Pedro Soto',
        authorName: 'Camila Vera Soto',
        catalogo: catalogoBodega,
    });
    assert.equal(intentoNoAprobada.success, false, 'debe rechazar salida física si la solicitud no está Aprobada');

    // 1. [SCRUM - Paso 1] Simular selección de entrega parcial en pantalla (5 de 12 en INS-501 y 2 de 6 en INS-502)
    //    y verificar que calcula el saldo autorizado vs. entregado en tiempo real antes de confirmar
    const resumenTiempoRealParcial = calcularResumenSolicitudSalidaFisica(
        solicitudAprobada,
        { 'INS-501': 5, 'INS-502': 2 },
        catalogoBodega
    );
    assert.equal(resumenTiempoRealParcial.totalAutorizadoUnidades, 18, 'total autorizado = 12 + 6 = 18');
    assert.equal(resumenTiempoRealParcial.totalEntregadoPrevioUnidades, 0);
    assert.equal(resumenTiempoRealParcial.totalEntregandoAhoraUnidades, 7, 'entregando ahora = 5 + 2 = 7');
    assert.equal(resumenTiempoRealParcial.totalEntregadoAcumuladoUnidades, 7);
    assert.equal(resumenTiempoRealParcial.totalSaldoPendienteRestanteUnidades, 11, 'saldo restante = 18 - 7 = 11');
    assert.equal(resumenTiempoRealParcial.esEntregaParcial, true);
    assert.equal(resumenTiempoRealParcial.esEntregaCompleta, false);
    assert.equal(resumenTiempoRealParcial.tieneErroresLinea, false);

    // Ejecutar la primera salida física (PARCIAL) retirando el técnico Pedro Soto (18.222.333-4)
    const salidaParcial = ejecutarSalidaFisicaSolicitudEnMemoria({
        solicitud: solicitudAprobada,
        itemsToDispatch: [
            { sku: 'INS-501', quantity: 5 },
            { sku: 'INS-502', quantity: 2 },
        ],
        technicianRut: '18.222.333-4',
        technicianName: 'Pedro Soto',
        authorName: 'Camila Vera Soto',
        catalogo: catalogoBodega,
        dispatchCode: 'DESP-2026-101',
        dateStr: '2026-11-22',
    });

    assert.equal(salidaParcial.success, true, 'la salida parcial debe ejecutarse con éxito');
    assert.equal(salidaParcial.esEntregaCompleta, false, 'debe marcarse como entrega parcial');
    assert.equal(
        salidaParcial.solicitudActualizada?.status,
        'aprobada',
        'tras un egreso parcial la solicitud permanece en estado aprobada conservando el saldo pendiente'
    );
    assert.equal(salidaParcial.solicitudActualizada?.items[0].deliveredQuantity, 5);
    assert.equal(salidaParcial.solicitudActualizada?.items[1].deliveredQuantity, 2);

    // Verificar descuento inmediato del stock comprometido (sin descontar doblemente del disponible)
    catalogoBodega = salidaParcial.catalogoActualizado;
    solicitudAprobada = salidaParcial.solicitudActualizada!;
    assert.equal(catalogoBodega[0].stock, 8, 'el disponible libre de INS-501 se mantiene en 8');
    assert.equal(catalogoBodega[0].committed, 7, 'el comprometido de INS-501 baja de 12 a 7');
    assert.equal(catalogoBodega[1].stock, 4, 'el disponible libre de INS-502 se mantiene en 4');
    assert.equal(catalogoBodega[1].committed, 4, 'el comprometido de INS-502 baja de 6 a 4');

    // Verificar vínculo irreversible al proyecto y al técnico que retira
    assert.equal(salidaParcial.registroEgresoInmutable?.immutable, true);
    assert.equal(salidaParcial.registroEgresoInmutable?.projectCode, 'PRY-2026-010');
    assert.equal(salidaParcial.registroEgresoInmutable?.technicianRut, '18.222.333-4');
    assert.equal(salidaParcial.registroEgresoInmutable?.technicianName, 'Pedro Soto');

    // 2. [SCRUM - Paso 2] Completar el saldo restante (7 un. de INS-501 y 4 un. de INS-502)
    const resumenTiempoRealCompletar = calcularResumenSolicitudSalidaFisica(
        solicitudAprobada,
        { 'INS-501': 7, 'INS-502': 4 },
        catalogoBodega
    );
    assert.equal(resumenTiempoRealCompletar.totalAutorizadoUnidades, 18);
    assert.equal(resumenTiempoRealCompletar.totalEntregadoPrevioUnidades, 7, 'muestra las 7 unidades ya entregadas en la primera salida');
    assert.equal(resumenTiempoRealCompletar.totalEntregandoAhoraUnidades, 11, 'entregando las 11 unidades restantes');
    assert.equal(resumenTiempoRealCompletar.totalEntregadoAcumuladoUnidades, 18, 'acumulado llega al 100% autorizado (18/18)');
    assert.equal(resumenTiempoRealCompletar.totalSaldoPendienteRestanteUnidades, 0, 'saldo pendiente resultante queda en 0');
    assert.equal(resumenTiempoRealCompletar.porcentajeAvanceTotal, 100);
    assert.equal(resumenTiempoRealCompletar.esEntregaCompleta, true);

    const salidaFinal = ejecutarSalidaFisicaSolicitudEnMemoria({
        solicitud: solicitudAprobada,
        itemsToDispatch: [
            { sku: 'INS-501', quantity: 7 },
            { sku: 'INS-502', quantity: 4 },
        ],
        technicianRut: '18.222.333-4',
        technicianName: 'Pedro Soto',
        authorName: 'Camila Vera Soto',
        catalogo: catalogoBodega,
        dispatchCode: 'DESP-2026-102',
        dateStr: '2026-11-22',
    });

    assert.equal(salidaFinal.success, true, 'la segunda salida que completa el saldo restante debe ser exitosa');
    assert.equal(salidaFinal.esEntregaCompleta, true);
    assert.equal(
        salidaFinal.solicitudActualizada?.status,
        'entregada',
        'al completar el 100% del saldo autorizado la solicitud pasa a estado entregada'
    );
    assert.equal(salidaFinal.solicitudActualizada?.items[0].deliveredQuantity, 12, 'INS-501 entregado 12 de 12');
    assert.equal(salidaFinal.solicitudActualizada?.items[1].deliveredQuantity, 6, 'INS-502 entregado 6 de 6');

    catalogoBodega = salidaFinal.catalogoActualizado;
    assert.equal(catalogoBodega[0].committed, 0, 'INS-501 comprometido queda en 0 tras completar el egreso');
    assert.equal(catalogoBodega[1].committed, 0, 'INS-502 comprometido queda en 0 tras completar el egreso');
});

test('[BACK-1][SCRUM] egreso transaccional (todo o nada) solo sobre solicitudes Aprobadas: si una línea falla revierte toda la transacción; registra un egreso parcial descontando stock comprometido, verifica el saldo pendiente de retiro, genera fila en Cardex vinculada al proyecto y técnico que retira, y prohíbe editar el registro', async () => {
    const solicitudesBd = new Map<
        number,
        {
            id_solicitud: number;
            proyecto_id: number;
            bodeguero_id: number;
            estado: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Anulada';
            nro_comprobante: string | null;
        }
    >([
        [
            950,
            {
                id_solicitud: 950,
                proyecto_id: 15,
                bodeguero_id: 2,
                estado: 'Pendiente',
                nro_comprobante: null,
            },
        ],
        [
            951,
            {
                id_solicitud: 951,
                proyecto_id: 15,
                bodeguero_id: 2,
                estado: 'Aprobada',
                nro_comprobante: 'COMP-2026-051',
            },
        ],
    ]);

    const lineasSolicitudBd = new Map<
        number,
        {
            id_solicitud_linea: number;
            id_solicitud: number;
            id_articulo: number;
            sku: string;
            nombre_articulo: string;
            precio_unitario: number;
            cantidad_solicitada: number;
            cantidad_entregada: number;
        }[]
    >([
        [
            951,
            [
                {
                    id_solicitud_linea: 1,
                    id_solicitud: 951,
                    id_articulo: 601,
                    sku: 'INS-601',
                    nombre_articulo: 'Tubo Cobre Tipo L 3/4"',
                    precio_unitario: 18500,
                    cantidad_solicitada: 10,
                    cantidad_entregada: 0,
                },
                {
                    id_solicitud_linea: 2,
                    id_solicitud: 951,
                    id_articulo: 602,
                    sku: 'INS-602',
                    nombre_articulo: 'Válvula Bola Bronce 3/4"',
                    precio_unitario: 9200,
                    cantidad_solicitada: 6,
                    cantidad_entregada: 0,
                },
            ],
        ],
    ]);

    // Estado inicial de stock en articulos_stock tras la reserva de la solicitud #951:
    // - INS-601 (id 601): disponible = 20, comprometido = 10, pmp = 18500
    // - INS-602 (id 602): disponible = 15, comprometido = 6, pmp = 9200
    const stockBd = new Map<number, { disponible: number; comprometido: number; pmp: number }>([
        [601, { disponible: 20, comprometido: 10, pmp: 18500 }],
        [602, { disponible: 15, comprometido: 6, pmp: 9200 }],
    ]);

    const egresosBodegaBd: {
        id_egreso: number;
        codigo_egreso: string;
        id_solicitud: number;
        proyecto_id: number;
        tecnico_retira_id: number | null;
        tecnico_retira_rut: string;
        tecnico_retira_nombre: string;
        bodeguero_id: number;
    }[] = [];

    const egresoLineasBd: {
        id_egreso: number;
        id_solicitud_linea: number;
        id_articulo: number;
        cantidad_egresada: number;
        saldo_pendiente_resultante: number;
        costo_unitario_pmp: number;
    }[] = [];

    const cardexMovimientosBd: {
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
        id_usuario: number;
    }[] = [];

    const auditoriaEgresos: any[] = [];

    const clienteEgresoTx = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.startsWith('SELECT id_solicitud, proyecto_id, bodeguero_id, estado::text AS estado, nro_comprobante FROM solicitudes_insumos')) {
                const idSol = Number(params[0]);
                const sol = solicitudesBd.get(idSol);
                return { rows: sol ? [{ ...sol }] : [] };
            }

            if (q.startsWith('SELECT sl.id_solicitud_linea, sl.id_articulo')) {
                const idSol = Number(params[0]);
                return {
                    rows: (lineasSolicitudBd.get(idSol) ?? []).map((l) => ({ ...l })),
                };
            }

            if (q.startsWith('SELECT COALESCE(cantidad_disponible, 0)::float8 AS cantidad_disponible, COALESCE(cantidad_comprometida, 0)::float8 AS cantidad_comprometida, COALESCE(pmp, 0)::float8 AS pmp FROM articulos_stock')) {
                const idArt = Number(params[0]);
                const st = stockBd.get(idArt);
                return {
                    rows: st
                        ? [
                              {
                                  cantidad_disponible: st.disponible,
                                  cantidad_comprometida: st.comprometido,
                                  pmp: st.pmp,
                              },
                          ]
                        : [],
                };
            }

            if (q.startsWith('INSERT INTO egresos_bodega')) {
                const idEg = 500 + egresosBodegaBd.length + 1;
                egresosBodegaBd.push({
                    id_egreso: idEg,
                    codigo_egreso: String(params[0]),
                    id_solicitud: Number(params[1]),
                    proyecto_id: Number(params[2]),
                    tecnico_retira_id: params[3] != null ? Number(params[3]) : null,
                    tecnico_retira_rut: String(params[4]),
                    tecnico_retira_nombre: String(params[5]),
                    bodeguero_id: Number(params[6]),
                });
                return { rows: [{ id_egreso: idEg }] };
            }

            if (q.startsWith('UPDATE articulos_stock SET cantidad_comprometida = $2 WHERE id_articulo = $1')) {
                const idArt = Number(params[0]);
                const actual = stockBd.get(idArt);
                if (actual) {
                    stockBd.set(idArt, {
                        ...actual,
                        comprometido: Number(params[1]),
                    });
                }
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('UPDATE solicitud_lineas SET cantidad_entregada = $2 WHERE id_solicitud_linea = $1')) {
                const idLin = Number(params[0]);
                const nuevaEntregada = Number(params[1]);
                for (const [, lineas] of lineasSolicitudBd.entries()) {
                    for (const l of lineas) {
                        if (l.id_solicitud_linea === idLin) {
                            l.cantidad_entregada = nuevaEntregada;
                        }
                    }
                }
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('INSERT INTO egreso_lineas')) {
                egresoLineasBd.push({
                    id_egreso: Number(params[0]),
                    id_solicitud_linea: Number(params[1]),
                    id_articulo: Number(params[2]),
                    cantidad_egresada: Number(params[3]),
                    saldo_pendiente_resultante: Number(params[4]),
                    costo_unitario_pmp: Number(params[5]),
                });
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('INSERT INTO movimientos_inventario')) {
                const idMov = 8000 + cardexMovimientosBd.length + 1;
                cardexMovimientosBd.push({
                    id_movimiento: idMov,
                    id_insumo: Number(params[0]),
                    tipo_movimiento: 'Salida',
                    destino_bolsa: 'comprometido',
                    cantidad: Number(params[1]),
                    costo_unitario: Number(params[2]),
                    saldo_historico: Number(params[3]),
                    pmp_historico: Number(params[4]),
                    valor_total_historico: Number(params[5]),
                    referencia: String(params[6]),
                    id_usuario: Number(params[7]),
                });
                return { rows: [{ id_movimiento: idMov }] };
            }

            if (q.startsWith('INSERT INTO movimiento_inventario')) {
                return { rowCount: 1, rows: [] };
            }

            if (q.startsWith('INSERT INTO auditoria')) {
                auditoriaEgresos.push({
                    entidad: params[0],
                    accion: params[1],
                    id_registro: params[2],
                    descripcion: params[8],
                });
                return { rowCount: 1, rows: [] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. Validar que SOLO opera sobre solicitudes Aprobadas (intentar egresar sobre #950 en estado Pendiente debe fallar)
    await assert.rejects(
        () =>
            registrarEgresoSolicitudEnTransaccion(clienteEgresoTx, 950, {
                bodeguero_id: 2,
                tecnico_retira_rut: '16.543.210-9',
                tecnico_retira_nombre: 'Sebastián Mora',
                items: [{ id_articulo: 601, cantidad_egreso: 2 }],
            }),
        (err: any) => String(err?.message).includes('Solo se puede registrar el egreso físico sobre solicitudes Aprobadas'),
        'debe rechazar egresos sobre solicitudes que no estén Aprobadas'
    );

    // 2. [Todo o Nada] Intentar un egreso de 2 líneas donde la 1ª línea es válida (4 de 10 de INS-601)
    //    pero la 2ª línea falla por superar el saldo autorizado/stock comprometido (8 de 6 de INS-602).
    //    Debe revertir toda la transacción sin descontar stock de la 1ª línea ni crear filas en Cardex.
    await assert.rejects(
        () =>
            registrarEgresoSolicitudEnTransaccion(clienteEgresoTx, 951, {
                bodeguero_id: 2,
                tecnico_retira_rut: '16.543.210-9',
                tecnico_retira_nombre: 'Sebastián Mora',
                items: [
                    { id_articulo: 601, cantidad_egreso: 4 },
                    { id_articulo: 602, cantidad_egreso: 8 }, // Supera las 6 autorizadas y comprometidas
                ],
            }),
        (err: any) => String(err?.message).includes('Egreso revertido por validación transaccional (todo o nada)'),
        'si una línea falla debe abortar y revertir toda la transacción'
    );

    assert.equal(stockBd.get(601)?.comprometido, 10, 'INS-601 mantiene intacto su comprometido (10) tras el rollback');
    assert.equal(stockBd.get(602)?.comprometido, 6, 'INS-602 mantiene intacto su comprometido (6) tras el rollback');
    assert.equal(cardexMovimientosBd.length, 0, 'no se generó ninguna fila en Cardex tras el fallo de la 2ª línea');
    assert.equal(egresosBodegaBd.length, 0, 'no se insertó cabecera de egreso');

    // 3. [SCRUM] Registrar un EGRESO PARCIAL válido sobre la solicitud Aprobada #951:
    //    - Retira 4 de 10 en INS-601 (quedan 6 pendientes de retiro)
    //    - Retira 2 de 6 en INS-602 (quedan 4 pendientes de retiro)
    const egresoParcial = await registrarEgresoSolicitudEnTransaccion(clienteEgresoTx, 951, {
        bodeguero_id: 2,
        tecnico_retira_id: 7,
        tecnico_retira_rut: '16.543.210-9',
        tecnico_retira_nombre: 'Sebastián Mora',
        codigo_egreso: 'DESP-2026-951-A',
        items: [
            { id_articulo: 601, cantidad_egreso: 4 },
            { id_articulo: 602, cantidad_egreso: 2 },
        ],
    });

    assert.equal(egresoParcial.id_egreso, 501);
    assert.equal(egresoParcial.codigo_egreso, 'DESP-2026-951-A');
    assert.equal(egresoParcial.es_entrega_parcial, true, 'debe identificar que es un egreso parcial');
    assert.equal(egresoParcial.es_entrega_completa, false);
    assert.equal(egresoParcial.proyecto_id, 15, 'queda vinculado irreversiblemente al proyecto #15');
    assert.equal(egresoParcial.tecnico_retira_rut, '16.543.210-9', 'queda vinculado al RUT del técnico que retira');
    assert.equal(egresoParcial.tecnico_retira_nombre, 'Sebastián Mora', 'queda vinculado al nombre del técnico que retira');
    assert.equal(egresoParcial.inmutable, true);

    // 3.1 Verificar el saldo pendiente de retiro por línea y global
    assert.equal(egresoParcial.total_autorizado_unidades, 16, '10 + 6 = 16 autorizadas');
    assert.equal(egresoParcial.total_entregado_acumulado_unidades, 6, '4 + 2 = 6 entregadas');
    assert.equal(egresoParcial.total_saldo_pendiente_retiro_unidades, 10, '6 + 4 = 10 pendientes de retiro');
    assert.equal(egresoParcial.saldos_lineas_solicitud[0].cantidad_entregada, 4);
    assert.equal(egresoParcial.saldos_lineas_solicitud[0].saldo_pendiente_retiro, 6, 'INS-601 conserva 6 unidades pendientes de retiro');
    assert.equal(egresoParcial.saldos_lineas_solicitud[1].cantidad_entregada, 2);
    assert.equal(egresoParcial.saldos_lineas_solicitud[1].saldo_pendiente_retiro, 4, 'INS-602 conserva 4 unidades pendientes de retiro');

    // 3.2 Verificar descuento de stock comprometido en articulos_stock
    assert.equal(stockBd.get(601)?.comprometido, 6, 'comprometido de INS-601 baja de 10 a 6');
    assert.equal(stockBd.get(601)?.disponible, 20, 'disponible libre de INS-601 permanece en 20');
    assert.equal(stockBd.get(602)?.comprometido, 4, 'comprometido de INS-602 baja de 6 a 4');
    assert.equal(stockBd.get(602)?.disponible, 15, 'disponible libre de INS-602 permanece en 15');

    // 3.3 Verificar el registro en Cardex (una fila por cada línea de salida con saldo histórico, PMP, proyecto y técnico)
    assert.equal(cardexMovimientosBd.length, 2, 'cada línea egresada genera su fila en Cardex');
    assert.equal(cardexMovimientosBd[0].id_insumo, 601);
    assert.equal(cardexMovimientosBd[0].tipo_movimiento, 'Salida');
    assert.equal(cardexMovimientosBd[0].destino_bolsa, 'comprometido');
    assert.equal(cardexMovimientosBd[0].cantidad, 4);
    assert.equal(cardexMovimientosBd[0].saldo_historico, 26, 'saldo físico en bodega de INS-601 pasa de 30 (20+10) a 26 (20+6)');
    assert.equal(cardexMovimientosBd[0].pmp_historico, 18500);
    assert.ok(cardexMovimientosBd[0].referencia.includes('Proyecto #15'));
    assert.ok(cardexMovimientosBd[0].referencia.includes('Sebastián Mora (16.543.210-9)'));

    assert.equal(cardexMovimientosBd[1].id_insumo, 602);
    assert.equal(cardexMovimientosBd[1].tipo_movimiento, 'Salida');
    assert.equal(cardexMovimientosBd[1].cantidad, 2);
    assert.equal(cardexMovimientosBd[1].saldo_historico, 19, 'saldo físico en bodega de INS-602 pasa de 21 (15+6) a 19 (15+4)');
    assert.equal(cardexMovimientosBd[1].pmp_historico, 9200);

    // 4. Verificar que prohíbe editar el registro de egreso (las correcciones se hacen solo por movimiento de ajuste)
    assert.throws(
        () => rechazarModificacionEgresoInmutable(),
        (err: any) =>
            err?.estado === 403 &&
            String(err?.message).includes('inmutable') &&
            String(err?.message).includes('movimiento de ajuste'),
        'cualquier intento de editar un egreso debe rechazarse con 403 indicando que las correcciones son solo por ajuste'
    );
});

test('[DB][SCRUM] tablas salidas_bodega (solicitud_id, proyecto_id, tecnico_retira_id, fecha) y salida_lineas con restricción CHECK (disponible >= 0 y comprometido >= 0) e inmutabilidad de registros: verifica restricciones de integridad en motor de base de datos que impiden saldos negativos y borrado de salidas', async () => {
    const solicitudesExistentes = new Set<number>([951]);
    const proyectosExistentes = new Set<number>([15]);
    const tecnicosExistentes = new Set<number>([7]);

    const tablaSalidasBodega: {
        id_salida: number;
        solicitud_id: number;
        proyecto_id: number;
        tecnico_retira_id: number;
        fecha: string;
    }[] = [];

    const tablaSalidaLineas: {
        id_salida_linea: number;
        id_salida: number;
        id_solicitud_linea: number | null;
        id_articulo: number;
        cantidad_entregada: number;
        disponible: number;
        comprometido: number;
        saldo_pendiente_resultante: number;
        costo_unitario_pmp: number;
    }[] = [];

    const stockInsumosDb = new Map<number, { disponible: number; comprometido: number }>([
        [601, { disponible: 20, comprometido: 10 }],
        [602, { disponible: 15, comprometido: 6 }],
    ]);

    const clienteDbSalidas = {
        query: async (sql: string, params: unknown[] = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            // 1. Trigger de inmutabilidad en base de datos sobre salidas_bodega y salida_lineas
            if (
                q.startsWith('DELETE FROM salidas_bodega') ||
                q.startsWith('UPDATE salidas_bodega') ||
                q.startsWith('DELETE FROM salida_lineas') ||
                q.startsWith('UPDATE salida_lineas')
            ) {
                const err: any = new Error(
                    'El registro de salida/egreso de bodega es inmutable y está vinculado de forma irreversible al proyecto y al técnico que retira. Las correcciones se realizan mediante un movimiento de ajuste en Cardex, nunca editando ni borrando el registro.'
                );
                err.code = 'P0001';
                throw err;
            }

            // 2. Inserción en salidas_bodega con verificación de claves foráneas (solicitud_id, proyecto_id, tecnico_retira_id)
            if (q.startsWith('INSERT INTO salidas_bodega')) {
                const solicitudId = Number(params[0]);
                const proyectoId = Number(params[1]);
                const tecnicoId = Number(params[2]);
                const fecha = String(params[3]);

                if (
                    !solicitudesExistentes.has(solicitudId) ||
                    !proyectosExistentes.has(proyectoId) ||
                    !tecnicosExistentes.has(tecnicoId)
                ) {
                    const err: any = new Error(
                        'insert or update on table "salidas_bodega" violates foreign key constraint'
                    );
                    err.code = '23503';
                    throw err;
                }

                const idSalida = 700 + tablaSalidasBodega.length + 1;
                tablaSalidasBodega.push({
                    id_salida: idSalida,
                    solicitud_id: solicitudId,
                    proyecto_id: proyectoId,
                    tecnico_retira_id: tecnicoId,
                    fecha,
                });
                return { rows: [{ id_salida: idSalida, fecha }] };
            }

            // 3. Restricción CHECK (disponible >= 0 AND comprometido >= 0) en stock_insumos / articulos_stock
            if (q.startsWith('UPDATE stock_insumos') || q.startsWith('UPDATE articulos_stock')) {
                const idArt = Number(params[0]);
                const disp = Number(params[1]);
                const comp = Number(params[2]);

                if (disp < 0 || comp < 0) {
                    const err: any = new Error(
                        'new row for relation "stock_insumos" violates check constraint "chk_articulos_stock_no_negativo" (disponible >= 0 AND comprometido >= 0)'
                    );
                    err.code = '23514';
                    throw err;
                }

                stockInsumosDb.set(idArt, { disponible: disp, comprometido: comp });
                return { rowCount: 1, rows: [] };
            }

            // 4. Inserción en salida_lineas con restricción CHECK (cantidad_entregada > 0 AND disponible >= 0 AND comprometido >= 0)
            if (q.startsWith('INSERT INTO salida_lineas')) {
                const idSalida = Number(params[0]);
                const idSolLin = params[1] != null ? Number(params[1]) : null;
                const idArt = Number(params[2]);
                const cantEntregada = Number(params[3]);
                const disp = Number(params[4]);
                const comp = Number(params[5]);
                const saldoPend = Number(params[6]);
                const pmp = Number(params[7]);

                if (cantEntregada <= 0 || disp < 0 || comp < 0 || saldoPend < 0) {
                    const err: any = new Error(
                        'new row for relation "salida_lineas" violates check constraint "chk_salida_lineas_saldos_no_negativos" (disponible >= 0 AND comprometido >= 0)'
                    );
                    err.code = '23514';
                    throw err;
                }

                const idLinea = 900 + tablaSalidaLineas.length + 1;
                tablaSalidaLineas.push({
                    id_salida_linea: idLinea,
                    id_salida: idSalida,
                    id_solicitud_linea: idSolLin,
                    id_articulo: idArt,
                    cantidad_entregada: cantEntregada,
                    disponible: disp,
                    comprometido: comp,
                    saldo_pendiente_resultante: saldoPend,
                    costo_unitario_pmp: pmp,
                });
                return { rows: [{ id_salida_linea: idLinea }] };
            }

            return { rows: [] };
        },
    } as unknown as PoolClient;

    // 1. Insertar una salida física válida en salidas_bodega y salida_lineas
    const salidaValida = await insertarSalidaBodegaDbEnTransaccion(clienteDbSalidas, {
        solicitud_id: 951,
        proyecto_id: 15,
        tecnico_retira_id: 7,
        fecha: '2026-11-22T12:00:00Z',
        lineas: [
            {
                id_articulo: 601,
                id_solicitud_linea: 1,
                cantidad_entregada: 4,
                disponible: 20,
                comprometido: 6,
                saldo_pendiente_resultante: 6,
                costo_unitario_pmp: 18500,
            },
            {
                id_articulo: 602,
                id_solicitud_linea: 2,
                cantidad_entregada: 2,
                disponible: 15,
                comprometido: 4,
                saldo_pendiente_resultante: 4,
                costo_unitario_pmp: 9200,
            },
        ],
    });

    assert.equal(salidaValida.id_salida, 701);
    assert.equal(salidaValida.solicitud_id, 951);
    assert.equal(salidaValida.proyecto_id, 15);
    assert.equal(salidaValida.tecnico_retira_id, 7);
    assert.equal(salidaValida.fecha, '2026-11-22T12:00:00Z');
    assert.equal(salidaValida.inmutable, true);
    assert.equal(salidaValida.lineas.length, 2);
    assert.equal(stockInsumosDb.get(601)?.comprometido, 6);
    assert.equal(stockInsumosDb.get(602)?.comprometido, 4);

    // 2. [SCRUM - Restricción CHECK comprometido >= 0] Intentar registrar una salida que deje comprometido negativo (-2) -> PostgreSQL 23514
    await assert.rejects(
        () =>
            insertarSalidaBodegaDbEnTransaccion(clienteDbSalidas, {
                solicitud_id: 951,
                proyecto_id: 15,
                tecnico_retira_id: 7,
                lineas: [
                    {
                        id_articulo: 601,
                        cantidad_entregada: 8,
                        disponible: 20,
                        comprometido: -2, // Violación de CHECK (comprometido >= 0)
                    },
                ],
            }),
        (err: any) =>
            err?.estado === 400 &&
            String(err?.message).includes('23514') &&
            String(err?.message).includes('disponible >= 0 y comprometido >= 0'),
        'la base de datos debe impedir saldos negativos en comprometido (CHECK 23514)'
    );

    // 3. [SCRUM - Restricción CHECK disponible >= 0] Intentar registrar una salida que deje disponible negativo (-1) -> PostgreSQL 23514
    await assert.rejects(
        () =>
            insertarSalidaBodegaDbEnTransaccion(clienteDbSalidas, {
                solicitud_id: 951,
                proyecto_id: 15,
                tecnico_retira_id: 7,
                lineas: [
                    {
                        id_articulo: 602,
                        cantidad_entregada: 1,
                        disponible: -1, // Violación de CHECK (disponible >= 0)
                        comprometido: 4,
                    },
                ],
            }),
        (err: any) =>
            err?.estado === 400 &&
            String(err?.message).includes('23514') &&
            String(err?.message).includes('impide saldos negativos'),
        'la base de datos debe impedir saldos negativos en disponible (CHECK 23514)'
    );

    // 4. [SCRUM - Inmutabilidad / Prohibición de borrado de salidas] Intentar borrar la salida #701 en base de datos -> bloqueado por trigger
    await assert.rejects(
        () => intentarEliminarSalidaBodegaEnDb(clienteDbSalidas, 701),
        (err: any) =>
            err?.estado === 403 &&
            String(err?.message).includes('inmutable') &&
            String(err?.message).includes('movimiento de ajuste'),
        'el motor de base de datos debe impedir el borrado de salidas en salidas_bodega'
    );
    assert.equal(tablaSalidasBodega[0].id_salida, 701, 'la salida #701 permanece intacta en salidas_bodega');
});

test('[FRONT-1][SCRUM] vista de Cardex de solo lectura con filtros dinámicos, tabla cronológica de saldos/PMP y exportación a Excel: muestra trazabilidad completa sin opciones de edición y contrasta el saldo actual del insumo con la última línea del Cardex', () => {
    const catalogoInsumos = [
        {
            sku: 'ELE-CBL-0012',
            name: 'Cable THHN 12 AWG rollo 100 m',
            stock: 185.45,
            pmp: 635,
            unitCost: 650,
            unit: 'm',
        },
        {
            sku: 'ELE-DIS-0016',
            name: 'Disyuntor termomagnético 16 A',
            stock: 12,
            pmp: 4520,
            unitCost: 4590,
            unit: 'un',
        },
    ];

    // Movimientos desordenados para verificar que la tabla los ordena cronológicamente
    const movimientosCardex = [
        {
            id: 'cdx-01',
            sku: 'ELE-DIS-0016',
            productName: 'Disyuntor termomagnético 16 A',
            date: '12-10-2026 14:30',
            type: 'salida_obra',
            typeLabel: 'Salida a obra',
            reference: 'SOL-2026-0407',
            projectCode: 'OB-2026-014',
            projectName: 'Edificio Los Aromos',
            qtyIn: 0,
            qtyOut: 10,
            balance: 12,
            pmp: 4520,
            totalValue: 54240,
            userName: 'Camila Vera Soto',
            userRole: 'Bodeguero',
            userRut: '15.321.654-2',
        },
        {
            id: 'cdx-02',
            sku: 'ELE-DIS-0016',
            productName: 'Disyuntor termomagnético 16 A',
            date: '10-10-2026 11:15',
            type: 'entrada_compra',
            typeLabel: 'Entrada por compra',
            reference: 'OC-2026-092',
            qtyIn: 20,
            qtyOut: 0,
            balance: 22,
            pmp: 4520,
            totalValue: 99440,
            userName: 'Camila Vera Soto',
            userRole: 'Bodeguero',
            userRut: '15.321.654-2',
        },
        {
            id: 'cdx-05b',
            sku: 'ELE-CBL-0012',
            productName: 'Cable THHN 12 AWG',
            date: '14-10-2026 11:00',
            type: 'ajuste_conteo',
            typeLabel: 'Ajuste por conteo físico',
            reference: 'CNT-2026-004',
            qtyIn: 0,
            qtyOut: 0,
            balance: 185.45,
            pmp: 635,
            totalValue: 117760,
            userName: 'Javier Muñoz Contreras',
            userRole: 'Administrador',
            userRut: '12.456.789-5',
        },
        {
            id: 'cdx-05a',
            sku: 'ELE-CBL-0012',
            productName: 'Cable THHN 12 AWG',
            date: '05-10-2026 09:15',
            type: 'entrada_compra',
            typeLabel: 'Entrada por compra',
            reference: 'FAC-2026-880',
            qtyIn: 250,
            qtyOut: 0,
            balance: 250,
            pmp: 635,
            totalValue: 158750,
            userName: 'Camila Vera Soto',
            userRole: 'Bodeguero',
            userRut: '15.321.654-2',
        },
        {
            id: 'cdx-05',
            sku: 'ELE-CBL-0012',
            productName: 'Cable THHN 12 AWG',
            date: '12-10-2026 10:20',
            type: 'salida_obra',
            typeLabel: 'Salida a obra (granel)',
            reference: 'SOL-2026-0402',
            projectCode: 'OB-2026-014',
            projectName: 'Edificio Los Aromos',
            qtyIn: 0,
            qtyOut: 64.55,
            balance: 185.45,
            pmp: 635,
            totalValue: 117760,
            userName: 'Camila Vera Soto',
            userRole: 'Bodeguero',
            userRut: '15.321.654-2',
        },
    ];

    // 1. Verificar que la vista de Cardex es estrictamente de solo lectura y ordena cronológicamente los movimientos
    const vistaCable = filtrarYOrdenarCardexSoloLectura(movimientosCardex, {
        insumoQuery: 'ELE-CBL-0012',
        ordenCronologico: 'asc',
    });

    assert.equal(vistaCable.soloLectura, true, 'la vista de Cardex debe ser de solo lectura');
    assert.equal(vistaCable.permiteEditar, false, 'no debe ofrecer opciones de edición');
    assert.equal(vistaCable.permiteEliminar, false, 'no debe ofrecer opciones de eliminación');
    assert.equal(vistaCable.movimientosOrdenados.length, 3);
    assert.deepEqual(
        vistaCable.movimientosOrdenados.map((m) => m.id),
        ['cdx-05a', 'cdx-05', 'cdx-05b'],
        'debe ordenar la tabla cronológicamente de más antiguo (05-10) a más reciente (14-10)'
    );
    assert.deepEqual(
        vistaCable.movimientosOrdenados.map((m) => m.balance),
        [250, 185.45, 185.45],
        'muestra la evolución cronológica del saldo después de cada movimiento (250 -> 185.45 -> 185.45)'
    );

    // 2. Verificar filtros dinámicos por tipo de movimiento y por rango de fechas (7 días)
    const soloSalidasObra = filtrarYOrdenarCardexSoloLectura(movimientosCardex, {
        tipoMovimiento: 'salida_obra',
        ordenCronologico: 'asc',
    });
    assert.equal(soloSalidasObra.movimientosOrdenados.length, 2);
    assert.ok(soloSalidasObra.movimientosOrdenados.every((m) => m.type === 'salida_obra'));

    const ultimos7Dias = filtrarYOrdenarCardexSoloLectura(movimientosCardex, {
        insumoQuery: 'ELE-CBL-0012',
        rangoFechas: '7d',
        ordenCronologico: 'asc',
    });
    assert.deepEqual(
        ultimos7Dias.movimientosOrdenados.map((m) => m.id),
        ['cdx-05', 'cdx-05b'],
        'el filtro de últimos 7 días excluye el movimiento del 05-10 y conserva los del 12-10 y 14-10'
    );

    // 3. [SCRUM] Contrastar el saldo actual del insumo con la última línea del Cardex
    const contrasteCable = contrastarSaldoInsumoConUltimaLineaCardex(
        catalogoInsumos[0],
        movimientosCardex
    );
    assert.equal(contrasteCable.sku, 'ELE-CBL-0012');
    assert.equal(contrasteCable.saldoActualInsumo, 185.45);
    assert.equal(contrasteCable.saldoUltimaLineaCardex, 185.45);
    assert.equal(contrasteCable.ultimaLineaCardex?.id, 'cdx-05b', 'la última línea cronológica es cdx-05b del 14-10-2026');
    assert.equal(contrasteCable.diferenciaSaldo, 0);
    assert.equal(
        contrasteCable.coincideSaldoConUltimaLinea,
        true,
        'el saldo actual del insumo ELE-CBL-0012 (185.45 m) coincide exactamente con la última línea del Cardex (185.45 m)'
    );
    assert.equal(contrasteCable.coincidePmpConUltimaLinea, true);

    const contrasteDisyuntor = contrastarSaldoInsumoConUltimaLineaCardex(
        catalogoInsumos[1],
        movimientosCardex
    );
    assert.equal(contrasteDisyuntor.saldoActualInsumo, 12);
    assert.equal(contrasteDisyuntor.saldoUltimaLineaCardex, 12);
    assert.equal(contrasteDisyuntor.ultimaLineaCardex?.id, 'cdx-01', 'la última línea cronológica es cdx-01 (22 - 10 = 12)');
    assert.equal(contrasteDisyuntor.coincideSaldoConUltimaLinea, true);

    // 4. Verificar exportación a Excel con todas las columnas de trazabilidad (saldo, PMP, valorizado, responsable)
    const excelExport = generarContenidoExcelCardex(vistaCable.movimientosOrdenados);
    assert.ok(excelExport.nombreArchivo.endsWith('.csv'));
    assert.equal(excelExport.filas.length, 3);
    assert.ok(excelExport.encabezados.includes('Saldo Posterior'));
    assert.ok(excelExport.encabezados.includes('PMP Posterior (CLP)'));
    assert.ok(excelExport.contenidoCsvExcel.includes('ELE-CBL-0012'));
    assert.ok(excelExport.contenidoCsvExcel.includes('185.45'));
});

test('[FRONT-2][SCRUM] formularios de movimiento de bodega admiten hasta 3 decimales en insumos a granel, muestran unidad de medida y capacidad restante del contenedor, y prueban egreso fraccionado desde la interfaz de bodega', () => {
    // 1. Validar sanitización de entrada numérica en formularios de movimiento (hasta 3 decimales en granel vs enteros en discretos)
    const entradaGranel3Dec = sanitizarEntradaCantidadBodega('12,3759', true, 3);
    assert.equal(entradaGranel3Dec.textoSanitizado, '12.375', 'trunca a máximo 3 decimales y normaliza coma a punto');
    assert.equal(entradaGranel3Dec.valorNumerico, 12.375);
    assert.equal(entradaGranel3Dec.decimalesIngresados, 3);
    assert.equal(entradaGranel3Dec.excedeMaxDecimales, true);

    const entradaDiscreta = sanitizarEntradaCantidadBodega('15.5', false, 3);
    assert.equal(entradaDiscreta.decimalesIngresados, 0, 'insumo discreto no admite decimales');

    assert.equal(
        formatearCantidadMovimientoBodega(173.075, true, 'm', true),
        '173.075 m',
        'formatea con 3 decimales exactos y unidad de medida'
    );

    // 2. Catálogo con insumos a granel y contenedor (carrete de cable de 500 m y bidón de aceite de 20 l)
    const catalogoBodegaGranel = [
        {
            sku: 'ELE-CBL-0012',
            name: 'Cable THHN 12 AWG rollo 500 m',
            unit: 'm',
            stock: 185.45,
            committed: 25.0,
            isBulk: true,
            containerCapacity: 500,
            pmp: 635,
        },
        {
            sku: 'CHE-LUB-0005',
            name: 'Aceite lubricante compresor POE 68',
            unit: 'l',
            stock: 14.75,
            committed: 2.5,
            isBulk: true,
            containerCapacity: 20,
            pmp: 14600,
        },
    ];

    const solicitudAprobadaGranel = {
        id: 'sol_granel_01',
        code: 'SOL-2026-0510',
        status: 'aprobada',
        receiptNumber: 'COMP-2026-0510',
        projectCode: 'OB-2026-014',
        projectName: 'Edificio Los Aromos',
        technicianName: 'Alejandro Rojas Pino',
        technicianRut: '17.894.562-1',
        items: [
            {
                sku: 'ELE-CBL-0012',
                name: 'Cable THHN 12 AWG rollo 500 m',
                quantity: 25.0,
                deliveredQuantity: 0,
                unit: 'm',
            },
            {
                sku: 'CHE-LUB-0005',
                name: 'Aceite lubricante compresor POE 68',
                quantity: 2.5,
                deliveredQuantity: 0,
                unit: 'l',
            },
        ],
        timeline: [],
    };

    // 3. [SCRUM] Prueba 1 de egreso fraccionado con 3 decimales desde la interfaz de bodega:
    //    - Retira 12.375 m de Cable THHN 12 AWG (de 25.000 m autorizados)
    //    - Retira 1.125 l de Aceite lubricante POE 68 (de 2.500 l autorizados)
    const resumenVivoPaso1 = calcularResumenSolicitudSalidaFisica(
        solicitudAprobadaGranel,
        {
            'ELE-CBL-0012': 12.375,
            'CHE-LUB-0005': 1.125,
        },
        catalogoBodegaGranel
    );

    const lineaCablePaso1 = resumenVivoPaso1.lineas[0];
    assert.equal(lineaCablePaso1.esGranel, true);
    assert.equal(lineaCablePaso1.maxDecimales, 3);
    assert.equal(lineaCablePaso1.unit, 'm');
    assert.equal(lineaCablePaso1.entregandoAhora, 12.375);
    assert.equal(lineaCablePaso1.saldoPendienteRestante, 12.625, '25.000 - 12.375 = 12.625 m pendientes en la solicitud');
    // Stock respaldo = 185.45 disp + 25.0 comp = 210.45 m -> tras egresar 12.375 m queda un remanente exacto de 198.075 m en el contenedor de 500 m
    assert.equal(lineaCablePaso1.stockRespaldoParaEgreso, 210.45);
    assert.equal(lineaCablePaso1.remanenteExactoBodegaDespues, 198.075, '210.450 - 12.375 = 198.075 m remanentes');
    assert.equal(lineaCablePaso1.remanenteEnContenedorActual, 198.075);
    assert.equal(lineaCablePaso1.capacidadNominalContenedor, 500);
    assert.ok(
        lineaCablePaso1.etiquetaUnidadYRemanente.includes('198.075 m'),
        'muestra unidad de medida y remanente exacto en pantalla (198.075 m)'
    );
    assert.ok(
        lineaCablePaso1.etiquetaCapacidadContenedor?.includes('198.075 / 500 m'),
        'muestra la capacidad restante del contenedor en pantalla (198.075 / 500 m)'
    );

    const lineaAceitePaso1 = resumenVivoPaso1.lineas[1];
    assert.equal(lineaAceitePaso1.unit, 'l');
    assert.equal(lineaAceitePaso1.entregandoAhora, 1.125);
    assert.equal(lineaAceitePaso1.saldoPendienteRestante, 1.375, '2.500 - 1.125 = 1.375 l pendientes en la solicitud');
    // Stock respaldo = 14.75 disp + 2.5 comp = 17.25 l -> tras egresar 1.125 l queda un remanente exacto de 16.125 l en el bidón de 20 l
    assert.equal(lineaAceitePaso1.remanenteExactoBodegaDespues, 16.125);
    assert.ok(lineaAceitePaso1.etiquetaCapacidadContenedor?.includes('16.125 / 20 l'));

    // Ejecutar el primer egreso fraccionado
    const ejecucionFraccionada1 = ejecutarSalidaFisicaSolicitudEnMemoria({
        solicitud: solicitudAprobadaGranel,
        itemsToDispatch: [
            { sku: 'ELE-CBL-0012', quantity: 12.375 },
            { sku: 'CHE-LUB-0005', quantity: 1.125 },
        ],
        technicianRut: '17.894.562-1',
        technicianName: 'Alejandro Rojas Pino',
        authorName: 'Camila Vera Soto',
        catalogo: catalogoBodegaGranel,
        dispatchCode: 'DESP-2026-GRN-01',
    });

    assert.equal(ejecucionFraccionada1.success, true);
    assert.equal(ejecucionFraccionada1.esEntregaCompleta, false, 'es un egreso parcial fraccionado');
    assert.equal(ejecucionFraccionada1.solicitudActualizada?.items[0].deliveredQuantity, 12.375);
    assert.equal(ejecucionFraccionada1.solicitudActualizada?.items[1].deliveredQuantity, 1.125);
    assert.equal(
        ejecucionFraccionada1.catalogoActualizado[0].committed,
        12.625,
        'el stock comprometido del cable baja exactamente de 25.000 a 12.625 m'
    );
    assert.equal(
        ejecucionFraccionada1.catalogoActualizado[1].committed,
        1.375,
        'el stock comprometido del aceite baja exactamente de 2.500 a 1.375 l'
    );

    // 4. [SCRUM] Prueba 2 de egreso fraccionado completando el remanente exacto de 3 decimales (12.625 m y 1.375 l)
    const ejecucionFraccionada2 = ejecutarSalidaFisicaSolicitudEnMemoria({
        solicitud: ejecucionFraccionada1.solicitudActualizada!,
        itemsToDispatch: [
            { sku: 'ELE-CBL-0012', quantity: 12.625 },
            { sku: 'CHE-LUB-0005', quantity: 1.375 },
        ],
        technicianRut: '17.894.562-1',
        technicianName: 'Alejandro Rojas Pino',
        authorName: 'Camila Vera Soto',
        catalogo: ejecucionFraccionada1.catalogoActualizado,
        dispatchCode: 'DESP-2026-GRN-02',
    });

    assert.equal(ejecucionFraccionada2.success, true);
    assert.equal(ejecucionFraccionada2.esEntregaCompleta, true, 'completa el 100% de la solicitud tras el segundo egreso fraccionado');
    assert.equal(ejecucionFraccionada2.solicitudActualizada?.status, 'entregada');
    assert.equal(ejecucionFraccionada2.solicitudActualizada?.items[0].deliveredQuantity, 25);
    assert.equal(ejecucionFraccionada2.solicitudActualizada?.items[1].deliveredQuantity, 2.5);
    assert.equal(ejecucionFraccionada2.catalogoActualizado[0].committed, 0);
    assert.equal(ejecucionFraccionada2.catalogoActualizado[1].committed, 0);

    // 5. Verificar cálculo de remanente de contenedor también en Merma y Conteo Físico con 3 decimales
    const remanenteMerma = calcularRemanenteContenedorGranel(
        ejecucionFraccionada2.catalogoActualizado[0],
        {
            cantidadMovimiento: 0.45,
            tipoMovimiento: 'merma',
        }
    );
    assert.equal(remanenteMerma.remanenteExactoDespues, 185, '185.450 - 0.450 = 185.000 m');
    assert.ok(remanenteMerma.etiquetaUnidadYRemanente.includes('185.000 m'));

    const remanenteConteo = calcularRemanenteContenedorGranel(
        ejecucionFraccionada2.catalogoActualizado[1],
        {
            tipoMovimiento: 'conteo',
            cantidadContadaFisica: 14.125,
        }
    );
    assert.equal(remanenteConteo.remanenteExactoDespues, 14.125);
    assert.equal(remanenteConteo.deltaMovimiento, -0.625, '14.125 - 14.750 = -0.625 l');
    assert.ok(remanenteConteo.etiquetaCapacidadContenedor?.includes('14.125 / 20 l'));
});













