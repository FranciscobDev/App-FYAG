import type { PoolClient } from 'pg';
import { registrarAuditoria } from './auditoriaService';
import { generarPdfOrdenCompra } from './ocPdfService';
import {
    OrdenCompraCompleta,
    cargarOrdenCompraCompleta,
    generarSiguienteNumeroOc,
} from '../controllers/ordenCompraController';

export interface AlertaReposicionH40 {
    id_alerta: number;
    tipo: string;
    severidad: 'rojo' | 'amarillo' | 'info';
    titulo: string;
    descripcion: string;
    id_articulo: number;
    id_orden_compra: number;
    leida: boolean;
    fecha_creacion: string;
}

export interface ResultadoEvaluacionReposicion {
    id_articulo: number;
    sku: string | null;
    nombre_articulo: string;
    bajo_minimo: boolean;
    cantidad_disponible: number;
    stock_minimo: number;
    cant_reposicion: number;
    creada: boolean;
    motivo: string;
    orden_compra: OrdenCompraCompleta | null;
    alerta_h40: AlertaReposicionH40 | null;
    pdf_corporativo_bytes?: number;
}

/**
 * Determina si un insumo está en condición de stock mínimo y requiere evaluar reposición (H35).
 */
export const requiereReposicionPorStockMinimo = (
    activo: boolean,
    cantidadDisponible: number | null | undefined,
    stockMinimo: number | null | undefined,
    idProveedor: number | null | undefined
): boolean => {
    if (!activo) return false;
    if (idProveedor == null || !Number.isInteger(Number(idProveedor)) || Number(idProveedor) <= 0) {
        return false;
    }
    const disp = Number(cantidadDisponible ?? 0);
    const min = Number(stockMinimo ?? 0);
    if (!Number.isFinite(disp) || !Number.isFinite(min) || min <= 0) {
        return false;
    }
    return disp <= min;
};

/**
 * Calcula la cantidad a reponer según el maestro del catálogo (H35).
 * Si `cant_reposicion` > 0 usa ese valor; de lo contrario usa `stock_minimo * 2` (mínimo 1).
 */
export const resolverCantidadReposicionCatalogo = (
    cantReposicion: number | null | undefined,
    stockMinimo: number | null | undefined
): number => {
    const rep = Number(cantReposicion ?? 0);
    if (Number.isFinite(rep) && rep > 0) {
        return Number(rep.toFixed(3));
    }
    const min = Number(stockMinimo ?? 0);
    return Number(Math.max(min * 2, 1).toFixed(3));
};

/**
 * [BACK-1] Motor automático de reposición por stock mínimo (H35 / H40 / H43).
 *
 * Evalúa un insumo dentro de la transacción activa:
 *  - Si `cantidad_disponible <= stock_minimo` (con `stock_minimo > 0` y `id_proveedor` válido):
 *  - Verifica si ya existe una OC abierta (`Borrador`, `Enviada` o `Recibida parcial`) para ese insumo.
 *  - Si ya existe una OC abierta, NO crea duplicados.
 *  - Si no existe, crea un único borrador de OC (`estado = 'Borrador'`, `origen = 'Stock Critico'`)
 *    usando el proveedor predeterminado y la cantidad de reposición del catálogo (`cant_reposicion`),
 *    prepara su PDF corporativo con numeración correlativa sin enviarlo por correo (H43)
 *    y registra una alerta en `alertas_sistema` para el panel H40.
 */
export const evaluarReposicionArticuloEnTransaccion = async (
    cliente: PoolClient,
    idArticulo: number | string,
    idUsuarioEjecutor: number | null = null
): Promise<ResultadoEvaluacionReposicion | null> => {
    // Bloquear la fila del artículo para evitar creación duplicada ante disparos concurrentes
    const artRes = await cliente.query<{
        id_articulo: number;
        nombre_articulo: string;
        sku: string | null;
        precio_unitario: number;
        id_proveedor: number | null;
        activo: boolean;
        cantidad_disponible: number | null;
        stock_minimo: number | null;
        cant_reposicion: number | null;
    }>(
        `SELECT a.id_articulo, a.nombre_articulo, a.sku, a.precio_unitario,
                a.id_proveedor, a.activo,
                COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                COALESCE(s.stock_minimo, 0)::float8 AS stock_minimo,
                COALESCE(s.cant_reposicion, 0)::float8 AS cant_reposicion
         FROM articulo a
         LEFT JOIN articulos_stock s ON s.id_articulo = a.id_articulo
         WHERE a.id_articulo = $1
         FOR UPDATE OF a`,
        [idArticulo]
    );

    if (artRes.rows.length === 0) return null;
    const art = artRes.rows[0];
    const disp = Number(art.cantidad_disponible ?? 0);
    const min = Number(art.stock_minimo ?? 0);
    const cantRep = resolverCantidadReposicionCatalogo(art.cant_reposicion, min);
    const bajoMinimo = disp <= min && min > 0;

    if (!requiereReposicionPorStockMinimo(art.activo, disp, min, art.id_proveedor)) {
        return {
            id_articulo: Number(art.id_articulo),
            sku: art.sku,
            nombre_articulo: art.nombre_articulo,
            bajo_minimo: bajoMinimo,
            cantidad_disponible: disp,
            stock_minimo: min,
            cant_reposicion: cantRep,
            creada: false,
            motivo: !art.activo
                ? 'El insumo está inactivo'
                : !art.id_proveedor
                    ? 'El insumo no tiene proveedor predeterminado asignado (H35)'
                    : min <= 0
                        ? 'El insumo no tiene stock mínimo configurado mayor a 0'
                        : 'El stock disponible es superior al stock mínimo',
            orden_compra: null,
            alerta_h40: null,
        };
    }

    // Verificar que el proveedor predeterminado exista y esté activo
    const provRes = await cliente.query<{ id_proveedor: number; nombre_proveedor: string; activo?: boolean }>(
        'SELECT id_proveedor, nombre_proveedor, activo FROM proveedor WHERE id_proveedor = $1',
        [art.id_proveedor]
    );
    if (provRes.rows.length === 0 || provRes.rows[0].activo === false) {
        return {
            id_articulo: Number(art.id_articulo),
            sku: art.sku,
            nombre_articulo: art.nombre_articulo,
            bajo_minimo: true,
            cantidad_disponible: disp,
            stock_minimo: min,
            cant_reposicion: cantRep,
            creada: false,
            motivo: 'El proveedor predeterminado no existe o está inactivo',
            orden_compra: null,
            alerta_h40: null,
        };
    }

    // Regla anti-duplicados: Verificar si ya existe una OC abierta (Borrador, Enviada o Recibida parcial) para este insumo
    const abiertaRes = await cliente.query<{ id_orden_compra: number; numero_oc: string; estado: string }>(
        `SELECT oc.id_orden_compra, oc.numero_oc, oc.estado::text AS estado
         FROM ordenes_compra oc
         JOIN oc_lineas l ON l.id_orden_compra = oc.id_orden_compra
         WHERE l.id_articulo = $1
           AND oc.estado IN ('Borrador', 'Enviada', 'Recibida parcial')
         ORDER BY oc.id_orden_compra DESC
         LIMIT 1`,
        [art.id_articulo]
    );

    if (abiertaRes.rows.length > 0) {
        const existente = await cargarOrdenCompraCompleta(cliente, abiertaRes.rows[0].id_orden_compra);
        return {
            id_articulo: Number(art.id_articulo),
            sku: art.sku,
            nombre_articulo: art.nombre_articulo,
            bajo_minimo: true,
            cantidad_disponible: disp,
            stock_minimo: min,
            cant_reposicion: cantRep,
            creada: false,
            motivo: `Ya existe una OC abierta (${abiertaRes.rows[0].numero_oc} en estado ${abiertaRes.rows[0].estado}) para este insumo`,
            orden_compra: existente,
            alerta_h40: null,
        };
    }

    // Crear nueva OC automática en estado Borrador (H35 / H43: no se envía hasta aprobación del Admin)
    const numeroOc = await generarSiguienteNumeroOc(cliente);
    const precioUnitario = Math.max(0, Math.round(Number(art.precio_unitario ?? 0)));

    const insOc = await cliente.query<{ id_orden_compra: number }>(
        `INSERT INTO ordenes_compra
            (numero_oc, proveedor_id, estado, origen, fecha_estimada_oc, observaciones)
         VALUES ($1, $2, 'Borrador', 'Stock Critico', CURRENT_DATE + INTERVAL '7 days', $3)
         RETURNING id_orden_compra`,
        [
            numeroOc,
            Number(art.id_proveedor),
            `Generada automáticamente por stock mínimo (${disp} <= ${min}). Pendiente de aprobación del Administrador (H35/H43).`,
        ]
    );
    const idOrden = insOc.rows[0].id_orden_compra;

    await cliente.query(
        `INSERT INTO oc_lineas (id_orden_compra, id_articulo, cantidad_orden, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [idOrden, art.id_articulo, cantRep, precioUnitario]
    );

    // Generar alerta para el panel H40
    const severidad: 'rojo' | 'amarillo' = disp <= 0 ? 'rojo' : 'amarillo';
    const tituloAlerta = `Stock mínimo alcanzado: ${art.nombre_articulo} (${numeroOc} en Borrador)`;
    const descripcionAlerta = `El insumo «${art.nombre_articulo}» (SKU ${art.sku || art.id_articulo}) cayó a ${disp} unidades (mínimo: ${min}). Se generó automáticamente el borrador ${numeroOc} por ${cantRep} unidades al proveedor ${provRes.rows[0].nombre_proveedor}, pendiente de aprobación.`;

    const alertaRes = await cliente.query<{
        id_alerta: number;
        tipo: string;
        severidad: 'rojo' | 'amarillo' | 'info';
        titulo: string;
        descripcion: string;
        id_articulo: number;
        id_orden_compra: number;
        leida: boolean;
        fecha_creacion: Date | string;
    }>(
        `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('stock_minimo_oc', $1, $2, $3, $4, $5, FALSE)
         RETURNING *`,
        [severidad, tituloAlerta, descripcionAlerta, art.id_articulo, idOrden]
    );

    const ocCreada = (await cargarOrdenCompraCompleta(cliente, idOrden))!;

    // Verificar generación del PDF corporativo con numeración correlativa (listo para vista previa, sin enviar por correo hasta aprobación H43)
    const pdfBuffer = generarPdfOrdenCompra({
        id_orden_compra: ocCreada.id_orden_compra,
        numero_oc: ocCreada.numero_oc,
        estado: ocCreada.estado,
        origen: ocCreada.origen,
        fecha_emision: ocCreada.fecha_creacion.slice(0, 10),
        fecha_estimada_oc: ocCreada.fecha_estimada_oc,
        observaciones: ocCreada.observaciones,
        proveedor: {
            id_proveedor: ocCreada.proveedor_id,
            nombre_proveedor: ocCreada.nombre_proveedor,
            razon_social: ocCreada.razon_social_proveedor,
            rut_proveedor: ocCreada.rut_proveedor,
            correo_contacto: ocCreada.correo_proveedor,
            telefono: ocCreada.telefono_proveedor,
            direccion: ocCreada.direccion_proveedor,
        },
        lineas: ocCreada.lineas.map((l) => ({
            sku: l.sku,
            nombre_articulo: l.nombre_articulo,
            unidad: l.unidad,
            cantidad: l.cantidad_orden,
            precio_unitario: l.precio_unitario,
            subtotal_linea: l.subtotal_linea,
        })),
        subtotal_neto: ocCreada.subtotal_neto,
        iva: ocCreada.iva,
        total: ocCreada.total,
    });

    await registrarAuditoria(
        {
            entidad: 'orden_compra',
            accion: 'crear_automatica_stock_minimo',
            idRegistro: idOrden,
            idUsuarioEjecutor,
            estadoAnterior: null,
            estadoNuevo: {
                id_orden_compra: ocCreada.id_orden_compra,
                numero_oc: ocCreada.numero_oc,
                proveedor_id: ocCreada.proveedor_id,
                estado: ocCreada.estado,
                origen: ocCreada.origen,
                id_articulo: Number(art.id_articulo),
                cantidad_orden: cantRep,
                total: ocCreada.total,
                id_alerta_h40: alertaRes.rows[0].id_alerta,
            },
            descripcion: `Borrador automático de OC ${ocCreada.numero_oc} creado por stock mínimo de «${art.nombre_articulo}» (${disp} <= ${min}) con cantidad de reposición ${cantRep} (H35/H40/H43)`,
        },
        cliente
    );

    const filaAlerta = alertaRes.rows[0];
    return {
        id_articulo: Number(art.id_articulo),
        sku: art.sku,
        nombre_articulo: art.nombre_articulo,
        bajo_minimo: true,
        cantidad_disponible: disp,
        stock_minimo: min,
        cant_reposicion: cantRep,
        creada: true,
        motivo: `Borrador automático ${ocCreada.numero_oc} creado exitosamente y alerta H40 generada`,
        orden_compra: ocCreada,
        alerta_h40: {
            id_alerta: Number(filaAlerta.id_alerta),
            tipo: filaAlerta.tipo,
            severidad: filaAlerta.severidad,
            titulo: filaAlerta.titulo,
            descripcion: filaAlerta.descripcion,
            id_articulo: Number(filaAlerta.id_articulo),
            id_orden_compra: Number(filaAlerta.id_orden_compra),
            leida: Boolean(filaAlerta.leida),
            fecha_creacion:
                filaAlerta.fecha_creacion instanceof Date
                    ? filaAlerta.fecha_creacion.toISOString()
                    : String(filaAlerta.fecha_creacion),
        },
        pdf_corporativo_bytes: pdfBuffer.length,
    };
};

export interface InsumoBajoMinimoSinOcAbierta {
    id_articulo: number;
    sku: string | null;
    nombre_articulo: string;
    categoria: string;
    id_proveedor: number | null;
    id_unidad: number | null;
    precio_unitario: number;
    cantidad_disponible: number;
    stock_minimo: number;
    cant_reposicion: number;
}

/**
 * [DB] Consulta SQL optimizada con anti-join (NOT EXISTS + índices parciales)
 * que detecta exclusivamente insumos activos con `disponible <= stock_minimo`
 * que NO tengan ninguna Orden de Compra abierta ('Borrador', 'Enviada' o 'Recibida parcial').
 */
export const CONSULTA_INSUMOS_BAJO_MINIMO_SIN_OC_ABIERTA = `
    SELECT
        a.id_articulo,
        a.sku,
        a.nombre_articulo,
        a.categoria,
        a.id_proveedor,
        a.id_unidad,
        a.precio_unitario::int AS precio_unitario,
        COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
        COALESCE(s.stock_minimo, 0)::float8 AS stock_minimo,
        CASE
            WHEN COALESCE(s.cant_reposicion, 0) > 0 THEN COALESCE(s.cant_reposicion, 0)::float8
            ELSE GREATEST(COALESCE(s.stock_minimo, 0) * 2, 1)::float8
        END AS cant_reposicion
    FROM articulo a
    JOIN articulos_stock s ON s.id_articulo = a.id_articulo
    WHERE a.activo = TRUE
      AND COALESCE(s.stock_minimo, 0) > 0
      AND COALESCE(s.cantidad_disponible, 0) <= COALESCE(s.stock_minimo, 0)
      AND NOT EXISTS (
          SELECT 1
          FROM oc_lineas l
          JOIN ordenes_compra oc ON oc.id_orden_compra = l.id_orden_compra
          WHERE l.id_articulo = a.id_articulo
            AND oc.estado IN ('Borrador', 'Enviada', 'Recibida parcial')
      )
    ORDER BY a.id_articulo ASC
`;

/**
 * [DB] Ejecuta la consulta optimizada y devuelve únicamente los insumos activos
 * con stock disponible <= stock mínimo que no tienen reposición abierta en curso.
 */
export const detectarInsumosBajoMinimoSinOcAbierta = async (
    consultor: Pick<PoolClient, 'query'>
): Promise<InsumoBajoMinimoSinOcAbierta[]> => {
    const res = await consultor.query<InsumoBajoMinimoSinOcAbierta>(
        CONSULTA_INSUMOS_BAJO_MINIMO_SIN_OC_ABIERTA
    );
    return res.rows.map((r) => ({
        id_articulo: Number(r.id_articulo),
        sku: r.sku ?? null,
        nombre_articulo: r.nombre_articulo,
        categoria: r.categoria,
        id_proveedor: r.id_proveedor != null ? Number(r.id_proveedor) : null,
        id_unidad: r.id_unidad != null ? Number(r.id_unidad) : null,
        precio_unitario: Number(r.precio_unitario ?? 0),
        cantidad_disponible: Number(r.cantidad_disponible ?? 0),
        stock_minimo: Number(r.stock_minimo ?? 0),
        cant_reposicion: Number(r.cant_reposicion ?? 0),
    }));
};

/**
 * Evalúa todo el catálogo de insumos activos usando la consulta optimizada [DB]
 * y genera borradores automáticos de OC (uno por insumo sin OC abierta) junto con sus alertas H40.
 */
export const ejecutarMotorReposicionCatalogo = async (
    cliente: PoolClient,
    idUsuarioEjecutor: number | null = null
): Promise<ResultadoEvaluacionReposicion[]> => {
    const pendientes = await detectarInsumosBajoMinimoSinOcAbierta(cliente);

    const resultados: ResultadoEvaluacionReposicion[] = [];
    for (const item of pendientes) {
        const res = await evaluarReposicionArticuloEnTransaccion(
            cliente,
            item.id_articulo,
            idUsuarioEjecutor
        );
        if (res) resultados.push(res);
    }
    return resultados;
};
