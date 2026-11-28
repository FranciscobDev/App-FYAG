import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
    buscarInsumoInstantaneoPorCodigo,
    exportarCodigosQrLoteEnTransaccion,
    generarCodigosQrInsumoEnTransaccion,
    marcarCodigoQrAsignadoEnTransaccion,
    SLA_BUSQUEDA_ESCANER_MS,
} from '../controllers/codigoQrController';
import {
    ESTADO_QR_ASIGNADO_OBJETO,
    ESTADO_QR_IMPRESO,
    ESTADO_QR_PENDIENTE_IMPRESION,
    EstadoAsignacionQr,
    construirPayloadQrH35,
    decodificarPayloadQrEscanerH18,
} from '../services/codigoQrService';

const crearEscenarioQrH35 = (opts: { tamanoH39Mm?: number } = {}) => {
    const estado = {
        secuencia: 0,
        tamanoImpresionQrMm: opts.tamanoH39Mm ?? 50,
        catalogoH35: new Map<
            number,
            {
                id_articulo: number;
                sku: string;
                codigo_barras?: string;
                nombre_articulo: string;
                categoria: string;
                unidad_medida: string;
                precio_unitario?: number;
                cantidad_disponible?: number;
                cantidad_comprometida?: number;
                cantidad_cuarentena?: number;
                stock_minimo?: number;
                cant_reposicion?: number;
                pmp?: number;
                ubicacion: string;
                activo: boolean;
            }
        >([
            [
                500,
                {
                    id_articulo: 500,
                    sku: 'ELE-DIS-0016',
                    codigo_barras: '7801234560016',
                    nombre_articulo: 'Disyuntor termomagnético 16 A',
                    categoria: 'Materiales',
                    unidad_medida: 'un',
                    precio_unitario: 6800,
                    cantidad_disponible: 42,
                    cantidad_comprometida: 8,
                    cantidad_cuarentena: 0,
                    stock_minimo: 10,
                    cant_reposicion: 30,
                    pmp: 6500,
                    ubicacion: 'Pasillo A - Estante 3',
                    activo: true,
                },
            ],
        ]),
        codigosQr: [] as {
            id_codigo_qr: number;
            codigo_qr: string;
            id_articulo: number;
            sku: string;
            nombre_articulo: string;
            unidad_medida: string;
            ubicacion: string | null;
            lote: string | null;
            payload_qr: string;
            estado_asignacion: EstadoAsignacionQr;
            asignado_objeto_fisico: boolean;
            id_usuario_creador: number | null;
        }[],
        auditoria: [] as {
            id_usuario: number | null;
            entidad: string;
            accion: string;
            valor_anterior: string | null;
            valor_nuevo: string | null;
            descripcion: string | null;
            id_registro_afectado: number | null;
        }[],
    };

    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                estado.auditoria.push({
                    id_usuario: p[0],
                    entidad: p[1],
                    accion: p[2],
                    valor_anterior: p[3],
                    valor_nuevo: p[4],
                    descripcion: p[5],
                    id_registro_afectado: p[6],
                });
                return { rows: [] };
            }

            const etiqueta = /\/\* (qr:[a-z0-9-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'qr:select-tamano-h39':
                    return { rows: [{ valor: estado.tamanoImpresionQrMm }] };
                case 'qr:select-insumo': {
                    const art = estado.catalogoH35.get(Number(p[0]));
                    return { rows: art ? [art] : [] };
                }
                case 'qr:select-insumo-sku': {
                    const art = Array.from(estado.catalogoH35.values()).find(
                        (item) => item.sku.toUpperCase() === String(p[0]).trim().toUpperCase()
                    );
                    return { rows: art ? [art] : [] };
                }
                case 'qr:nextval': {
                    estado.secuencia += 1;
                    return { rows: [{ correlativo: estado.secuencia }] };
                }
                case 'qr:check-duplicado': {
                    const existente = estado.codigosQr.find(
                        (c) => c.codigo_qr.toUpperCase() === String(p[0]).toUpperCase()
                    );
                    return {
                        rows: existente
                            ? [{ id_codigo_qr: existente.id_codigo_qr, id_articulo: existente.id_articulo }]
                            : [],
                    };
                }
                case 'qr:insert-codigo': {
                    const idCodigo = estado.codigosQr.length + 1;
                    estado.codigosQr.push({
                        id_codigo_qr: idCodigo,
                        codigo_qr: String(p[0]),
                        id_articulo: Number(p[1]),
                        sku: String(p[2]),
                        nombre_articulo: String(p[3]),
                        unidad_medida: String(p[4]),
                        ubicacion: p[6] ?? null,
                        lote: p[7] ?? null,
                        payload_qr: String(p[8]),
                        id_usuario_creador: p[9] ?? null,
                        estado_asignacion: (p[10] as EstadoAsignacionQr) ?? ESTADO_QR_PENDIENTE_IMPRESION,
                        asignado_objeto_fisico: Boolean(p[11]),
                    });
                    return {
                        rows: [{ id_codigo_qr: idCodigo, fecha_creacion: new Date().toISOString() }],
                    };
                }
                case 'qr:select-lote-ids': {
                    const ids: number[] = Array.isArray(p[0]) ? p[0].map(Number) : [];
                    return {
                        rows: estado.codigosQr
                            .filter((c) => ids.includes(c.id_codigo_qr))
                            .map((c) => ({ ...c })),
                    };
                }
                case 'qr:select-lote-codigos': {
                    const cods: string[] = Array.isArray(p[0]) ? p[0].map((x) => String(x).toUpperCase()) : [];
                    return {
                        rows: estado.codigosQr
                            .filter((c) => cods.includes(c.codigo_qr.toUpperCase()))
                            .map((c) => ({ ...c })),
                    };
                }
                case 'qr:update-exportacion': {
                    const item = estado.codigosQr.find((c) => c.id_codigo_qr === Number(p[0]));
                    if (item) {
                        item.estado_asignacion = p[1] as EstadoAsignacionQr;
                        item.asignado_objeto_fisico = Boolean(p[2]);
                    }
                    return { rows: [] };
                }
                case 'qr:select-por-id': {
                    const item = estado.codigosQr.find((c) => c.id_codigo_qr === Number(p[0]));
                    return { rows: item ? [{ ...item }] : [] };
                }
                case 'qr:update-asignar': {
                    const item = estado.codigosQr.find((c) => c.id_codigo_qr === Number(p[0]));
                    if (item) {
                        item.estado_asignacion = p[1] as EstadoAsignacionQr;
                        item.asignado_objeto_fisico = true;
                        if (p[2]) item.ubicacion = String(p[2]);
                    }
                    return { rows: [] };
                }
                case 'qr:busqueda-instantanea': {
                    const codigoQrBusq = p[0] ? String(p[0]).toUpperCase() : null;
                    const skuOBarrasBusq = String(p[1] ?? '').toUpperCase();

                    const qrMatch = codigoQrBusq
                        ? estado.codigosQr.find((c) => c.codigo_qr.toUpperCase() === codigoQrBusq)
                        : undefined;

                    const artMatch = qrMatch
                        ? estado.catalogoH35.get(qrMatch.id_articulo)
                        : Array.from(estado.catalogoH35.values()).find(
                              (a) =>
                                  a.sku.toUpperCase() === skuOBarrasBusq ||
                                  (a.codigo_barras && a.codigo_barras.toUpperCase() === skuOBarrasBusq)
                          );

                    if (!artMatch) return { rows: [] };

                    return {
                        rows: [
                            {
                                id_articulo: artMatch.id_articulo,
                                sku: artMatch.sku,
                                codigo_barras: artMatch.codigo_barras ?? null,
                                nombre_articulo: artMatch.nombre_articulo,
                                categoria: artMatch.categoria,
                                unidad_medida: artMatch.unidad_medida,
                                precio_unitario: artMatch.precio_unitario ?? 0,
                                activo: artMatch.activo,
                                cantidad_disponible: artMatch.cantidad_disponible ?? 0,
                                cantidad_comprometida: artMatch.cantidad_comprometida ?? 0,
                                cantidad_cuarentena: artMatch.cantidad_cuarentena ?? 0,
                                stock_minimo: artMatch.stock_minimo ?? 0,
                                cant_reposicion: artMatch.cant_reposicion ?? 0,
                                pmp: artMatch.pmp ?? 0,
                                ubicacion: artMatch.ubicacion,
                                bloqueado_por_conteo: false,
                                id_codigo_qr: qrMatch?.id_codigo_qr ?? null,
                                codigo_qr: qrMatch?.codigo_qr ?? null,
                                estado_asignacion: qrMatch?.estado_asignacion ?? null,
                                asignado_objeto_fisico: qrMatch?.asignado_objeto_fisico ?? null,
                                lote: qrMatch?.lote ?? null,
                            },
                        ],
                    };
                }
            }
            return { rows: [] };
        },
    } as unknown as PoolClient;

    return { estado, cliente };
};

test('[BACK-1] construirPayloadQrH35 codifica SKU, nombre y unidad de medida en un payload JSON legible por el escáner H18', () => {
    const generado = construirPayloadQrH35({
        idArticulo: 500,
        sku: 'ELE-DIS-0016',
        nombreArticulo: 'Disyuntor termomagnético 16 A',
        unidadMedida: 'un',
        correlativo: 1,
        categoria: 'Materiales',
        ubicacion: 'Pasillo A - Estante 3',
    });

    assert.equal(generado.codigo_qr, 'FYAG-QR-ELE-DIS-0016-0001');

    // Verificar compatibilidad con el escáner óptico de H18
    const leidoPorEscaner = decodificarPayloadQrEscanerH18(generado.payload_qr);
    assert.equal(leidoPorEscaner.sistema, 'FYAG');
    assert.equal(leidoPorEscaner.tipo, 'INSUMO');
    assert.equal(leidoPorEscaner.codigoQr, 'FYAG-QR-ELE-DIS-0016-0001');
    assert.equal(leidoPorEscaner.sku, 'ELE-DIS-0016');
    assert.equal(leidoPorEscaner.nombre, 'Disyuntor termomagnético 16 A');
    assert.equal(leidoPorEscaner.unidad, 'un');
    assert.equal(leidoPorEscaner.ubicacion, 'Pasillo A - Estante 3');
});

test('[BACK-1][SCRUM] Genera 3 códigos para un mismo insumo y revisa las filas en auditoría (H14)', async () => {
    const { estado, cliente } = crearEscenarioQrH35();
    const idAdmin = 1;

    // Generar 3 códigos QR para el mismo insumo #500 (ELE-DIS-0016)
    const qr1 = (await generarCodigosQrInsumoEnTransaccion(cliente, { id_articulo: 500 }, idAdmin))[0];
    const qr2 = (await generarCodigosQrInsumoEnTransaccion(cliente, { id_articulo: 500 }, idAdmin))[0];
    const qr3 = (await generarCodigosQrInsumoEnTransaccion(cliente, { id_articulo: 500 }, idAdmin))[0];

    // 1. Verificar que los 3 códigos pertenecen al mismo insumo pero son únicos e irrepetibles entre sí
    const codigosSet = new Set([qr1.codigo_qr, qr2.codigo_qr, qr3.codigo_qr]);
    assert.equal(codigosSet.size, 3, 'los 3 códigos QR generados para las 3 unidades físicas deben ser únicos');
    assert.equal(qr1.codigo_qr, 'FYAG-QR-ELE-DIS-0016-0001');
    assert.equal(qr2.codigo_qr, 'FYAG-QR-ELE-DIS-0016-0002');
    assert.equal(qr3.codigo_qr, 'FYAG-QR-ELE-DIS-0016-0003');

    // 2. Verificar que los 3 incluyen SKU, nombre y unidad de medida de H35 y son legibles por el escáner H18
    for (const qr of [qr1, qr2, qr3]) {
        assert.equal(qr.id_articulo, 500);
        assert.equal(qr.sku, 'ELE-DIS-0016');
        assert.equal(qr.nombre_articulo, 'Disyuntor termomagnético 16 A');
        assert.equal(qr.unidad_medida, 'un');

        const escaneado = decodificarPayloadQrEscanerH18(qr.payload_qr);
        assert.equal(escaneado.sku, 'ELE-DIS-0016');
        assert.equal(escaneado.nombre, 'Disyuntor termomagnético 16 A');
        assert.equal(escaneado.unidad, 'un');
        assert.equal(escaneado.codigoQr, qr.codigo_qr);
    }

    // 3. [SCRUM] Revisar las 3 filas en bitacora_auditoria (H14)
    assert.equal(estado.auditoria.length, 3, 'deben haberse registrado exactamente 3 filas en bitacora_auditoria (H14)');
    for (let idx = 0; idx < 3; idx += 1) {
        const filaAud = estado.auditoria[idx];
        assert.equal(filaAud.id_usuario, idAdmin);
        assert.equal(filaAud.entidad, 'codigo_qr_insumo');
        assert.equal(filaAud.accion, 'generar_qr');
        assert.equal(filaAud.id_registro_afectado, idx + 1);

        const valorNuevo = JSON.parse(filaAud.valor_nuevo!);
        assert.equal(valorNuevo.id_articulo, 500);
        assert.equal(valorNuevo.sku, 'ELE-DIS-0016');
        assert.equal(valorNuevo.nombre_articulo, 'Disyuntor termomagnético 16 A');
        assert.equal(valorNuevo.unidad_medida, 'un');
        assert.equal(valorNuevo.codigo_qr, `FYAG-QR-ELE-DIS-0016-000${idx + 1}`);
    }
});

test('[BACK-1] impide repetir un mismo código QR (409) y rechaza insumos que no existan en H35 (404)', async () => {
    const { estado, cliente } = crearEscenarioQrH35();

    await generarCodigosQrInsumoEnTransaccion(
        cliente,
        { id_articulo: 500, codigo_qr: 'FYAG-QR-ELE-DIS-0016-0001' },
        1
    );

    // Intentar repetir el mismo código QR falla con 409 sin agregar fila en auditoría
    await assert.rejects(
        () =>
            generarCodigosQrInsumoEnTransaccion(
                cliente,
                { id_articulo: 500, codigo_qr: 'FYAG-QR-ELE-DIS-0016-0001' },
                1
            ),
        (err: any) => err.estado === 409 && /no puede repetirse/i.test(err.message)
    );
    assert.equal(estado.codigosQr.length, 1);
    assert.equal(estado.auditoria.length, 1);

    // Intentar generar QR para un insumo inexistente en H35 falla con 404
    await assert.rejects(
        () => generarCodigosQrInsumoEnTransaccion(cliente, { id_articulo: 9999 }, 1),
        (err: any) => err.estado === 404
    );
});

test('[BACK-2][SCRUM] Cambia el tamaño de impresión en H39, exporta un lote en PDF y PNG, marca uno como asignado y revisa la auditoría (H14)', async () => {
    const { estado, cliente } = crearEscenarioQrH35({ tamanoH39Mm: 50 });
    const idAdmin = 1;

    // 1. Generar un lote de 3 códigos QR para el insumo #500
    const loteCreado = await generarCodigosQrInsumoEnTransaccion(
        cliente,
        { id_articulo: 500, cantidad: 3 },
        idAdmin
    );
    assert.equal(loteCreado.length, 3);
    assert.equal(estado.auditoria.length, 3, '3 filas de creación en auditoría');

    // 2. [SCRUM] Cambiar el tamaño de impresión configurado en H39 (de 50 mm a 80 mm)
    estado.tamanoImpresionQrMm = 80;

    // 3. [SCRUM] Exportar el lote de 3 códigos en PDF aplicando el nuevo tamaño de H39 (80 mm)
    const expPdf = await exportarCodigosQrLoteEnTransaccion(
        cliente,
        {
            formato: 'pdf',
            ids_codigo_qr: [1, 2, 3],
        },
        idAdmin
    );
    assert.equal(expPdf.formato, 'pdf');
    assert.equal(expPdf.mime_type, 'application/pdf');
    assert.equal(expPdf.tamano_impresion_mm, 80, 'aplica el nuevo tamaño de 80 mm configurado en H39');
    assert.equal(expPdf.cantidad_etiquetas, 3);
    assert.equal(expPdf.ancho, Math.round(80 * 2.83465));

    const textoPdf = expPdf.buffer.toString('utf8');
    assert.ok(textoPdf.startsWith('%PDF-1.4'), 'produce un documento binario PDF 1.4 válido');
    assert.match(textoPdf, /SKU: ELE-DIS-0016/, 'incluye el SKU en texto legible dentro del PDF');
    assert.match(textoPdf, /Disyuntor termomagnetico 16 A/, 'incluye el nombre del insumo en texto legible');
    assert.match(textoPdf, /FYAG-QR-ELE-DIS-0016-0001/);
    assert.match(textoPdf, /FYAG-QR-ELE-DIS-0016-0002/);
    assert.match(textoPdf, /FYAG-QR-ELE-DIS-0016-0003/);
    assert.match(textoPdf, /80mm H39/);
    assert.equal(estado.codigosQr[0].estado_asignacion, ESTADO_QR_IMPRESO);

    // 4. [SCRUM] Exportar el mismo lote en PNG aplicando el tamaño de H39 (80 mm)
    const expPng = await exportarCodigosQrLoteEnTransaccion(
        cliente,
        {
            formato: 'png',
            ids_codigo_qr: [1, 2, 3],
        },
        idAdmin
    );
    assert.equal(expPng.formato, 'png');
    assert.equal(expPng.mime_type, 'image/png');
    assert.equal(expPng.tamano_impresion_mm, 80);
    assert.equal(expPng.ancho, 80 * 4, 'ancho en píxeles escalado a 80 mm (320 px)');
    assert.equal(expPng.alto, 80 * 5 * 3, 'alto en píxeles escalado para las 3 etiquetas del lote (1200 px)');
    assert.equal(expPng.buffer[0], 0x89);
    assert.equal(expPng.buffer.subarray(1, 4).toString('ascii'), 'PNG', 'firma binaria PNG válida');
    const textoPng = expPng.buffer.toString('utf8');
    assert.match(textoPng, /SKU: ELE-DIS-0016/, 'incluye SKU legible en metadatos tEXt del PNG');
    assert.match(textoPng, /Disyuntor termomagnético 16 A/);
    assert.match(textoPng, /TamanoH39: 80mm/);

    // 5. [SCRUM] Marcar uno de los códigos (#1) como "Asignado a objeto físico"
    const asignado = await marcarCodigoQrAsignadoEnTransaccion(
        cliente,
        1,
        { ubicacion: 'Tablero General Sala 2' },
        idAdmin
    );
    assert.equal(asignado.estado_asignacion, ESTADO_QR_ASIGNADO_OBJETO);
    assert.equal(asignado.asignado_objeto_fisico, true);
    assert.equal(estado.codigosQr[0].asignado_objeto_fisico, true);
    assert.equal(estado.codigosQr[0].estado_asignacion, ESTADO_QR_ASIGNADO_OBJETO);

    // 6. [SCRUM] Revisar la auditoría (H14): 3 creaciones + 1 exportación PDF + 1 exportación PNG + 1 asignación a objeto físico = 6 filas
    assert.equal(estado.auditoria.length, 6);

    const audPdf = estado.auditoria[3];
    assert.equal(audPdf.accion, 'exportar_qr_lote');
    const jsonAudPdf = JSON.parse(audPdf.valor_nuevo!);
    assert.equal(jsonAudPdf.formato, 'PDF');
    assert.equal(jsonAudPdf.tamano_impresion_mm, 80);
    assert.equal(jsonAudPdf.cantidad_codigos, 3);

    const audPng = estado.auditoria[4];
    assert.equal(audPng.accion, 'exportar_qr_lote');
    const jsonAudPng = JSON.parse(audPng.valor_nuevo!);
    assert.equal(jsonAudPng.formato, 'PNG');
    assert.equal(jsonAudPng.tamano_impresion_mm, 80);
    assert.equal(jsonAudPng.cantidad_codigos, 3);

    const audAsignar = estado.auditoria[5];
    assert.equal(audAsignar.accion, 'asignar_qr_objeto_fisico');
    assert.equal(audAsignar.id_registro_afectado, 1);
    const jsonAudAsignar = JSON.parse(audAsignar.valor_nuevo!);
    assert.equal(jsonAudAsignar.estado_asignacion, ESTADO_QR_ASIGNADO_OBJETO);
    assert.equal(jsonAudAsignar.asignado_objeto_fisico, true);
});

test('[BACK-1][SCRUM] Prueba consultar un código existente (QR y código de barras) y uno inexistente midiendo el tiempo de respuesta (< 200 ms)', async () => {
    const { cliente } = crearEscenarioQrH35();

    // Generar etiqueta QR real en catálogo para el insumo #500
    const [qrCreado] = await generarCodigosQrInsumoEnTransaccion(
        cliente,
        { id_articulo: 500, lote: 'LOTE-2026-A' },
        1
    );

    // 1. [SCRUM] Consultar código QR existente (payload JSON escaneado por cámara H18) y medir tiempo (< 200 ms)
    const t0Existente = performance.now();
    const resQr = await buscarInsumoInstantaneoPorCodigo(cliente, qrCreado.payload_qr);
    const duracionQrMs = performance.now() - t0Existente;

    assert.equal(resQr.valido, true);
    assert.equal(resQr.formato_detectado, 'QR_JSON_H47');
    assert.equal(resQr.cumple_sla_200ms, true);
    assert.ok(
        resQr.tiempo_respuesta_ms < SLA_BUSQUEDA_ESCANER_MS && duracionQrMs < SLA_BUSQUEDA_ESCANER_MS,
        `Tiempo de respuesta (${resQr.tiempo_respuesta_ms} ms) debe ser menor a 200 ms`
    );
    // Verifica ficha técnica y stock devueltos
    assert.equal(resQr.insumo.id_articulo, 500);
    assert.equal(resQr.insumo.sku, 'ELE-DIS-0016');
    assert.equal(resQr.insumo.nombre_articulo, 'Disyuntor termomagnético 16 A');
    assert.equal(resQr.insumo.unidad_medida, 'un');
    assert.equal(resQr.stock.cantidad_disponible, 42);
    assert.equal(resQr.stock.cantidad_comprometida, 8);
    assert.equal(resQr.stock.pmp, 6500);
    assert.equal(resQr.etiqueta_qr?.codigo_qr, 'FYAG-QR-ELE-DIS-0016-0001');

    // 2. Consultar por código de barras EAN-13 existente ('7801234560016') en menos de 200 ms
    const resBarras = await buscarInsumoInstantaneoPorCodigo(cliente, '7801234560016');
    assert.equal(resBarras.valido, true);
    assert.equal(resBarras.insumo.sku, 'ELE-DIS-0016');
    assert.equal(resBarras.stock.cantidad_disponible, 42);
    assert.ok(resBarras.tiempo_respuesta_ms < SLA_BUSQUEDA_ESCANER_MS);

    // 3. [SCRUM] Consultar un código inexistente midiendo el tiempo de respuesta (< 200 ms) -> Devuelve 404 claro para bloquear la operación
    const t0Inexistente = performance.now();
    await assert.rejects(
        () => buscarInsumoInstantaneoPorCodigo(cliente, 'FYAG-QR-NO-EXISTE-9999'),
        (err: any) => {
            const duracionErrorMs = performance.now() - t0Inexistente;
            assert.equal(err.estado, 404, 'un código inexistente debe devolver 404 para bloquear la operación');
            assert.match(err.message, /no existe.*Operación bloqueada/i);
            assert.ok(
                duracionErrorMs < SLA_BUSQUEDA_ESCANER_MS,
                `El rechazo 404 (${duracionErrorMs.toFixed(2)} ms) debe responder en menos de 200 ms`
            );
            return true;
        }
    );
});

