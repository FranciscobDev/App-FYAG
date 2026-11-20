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
    esProyectoActivoParaSolicitud,
    liberarReservaComprometidoEnCatalogoH6,
    validarFormularioNuevaSolicitudInsumos,
} from '../services/solicitudInsumosService';
import {
    ESTADOS_SOLICITUD_INSUMOS,
    emitirSolicitudInsumosEnTransaccion,
    insertarSolicitudInsumosDbEnTransaccion,
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








