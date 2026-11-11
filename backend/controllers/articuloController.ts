import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { registrarAuditoria } from '../services/auditoriaService';
import { ejecutarTransaccion } from '../services/transaccion';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';

export interface Articulo {
    id_articulo: number;
    nombre_articulo: string;
    sku: string | null;
    precio_unitario: number;
    categoria: string;
    id_proveedor: number | null;
    id_unidad: number | null;
    activo: boolean;
    cantidad_disponible: number | null;
    stock_minimo: number | null;
    ubicacion: string | null;
}

interface ArticuloBody {
    nombre_articulo?: string;
    sku?: string | null;
    precio_unitario?: number;
    categoria?: string;
    id_proveedor?: number | null;
    id_unidad?: number | null;
    activo?: boolean;
    stock?: number;
    stock_minimo?: number;
    ubicacion?: string | null;
}

/** Campos cuyo cambio dispara un registro de auditoría individual (campos críticos). */
const CAMPOS_CRITICOS: { campo: string; label: string; origen: 'articulo' | 'stock' }[] = [
    { campo: 'stock_minimo', label: 'stock mínimo', origen: 'stock' },
    { campo: 'id_unidad', label: 'unidad de medida', origen: 'articulo' },
    { campo: 'id_proveedor', label: 'proveedor predeterminado', origen: 'articulo' },
];

// Debe coincidir con categoria_enum de la base de datos y con CATEGORIAS_ARTICULO del frontend
export const CATEGORIAS_ARTICULO = ['Herramientas', 'Materiales', 'Equipos', 'Consumibles', 'Seguridad'] as const;

/** Devuelve un mensaje de error si la categoría no es válida, o null si lo es. */
export const validarCategoriaArticulo = (categoria: unknown): string | null => {
    if (typeof categoria === 'string' && (CATEGORIAS_ARTICULO as readonly string[]).includes(categoria)) {
        return null;
    }
    return `La categoría debe ser una de: ${CATEGORIAS_ARTICULO.join(', ')}`;
};

const esNumeroNoNegativo = (valor: unknown): boolean =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

// Artículo + su stock (tabla articulos_stock). ::float8 evita que PostgreSQL devuelva NUMERIC como texto.
const SELECT_ARTICULO = `
    SELECT a.id_articulo, a.nombre_articulo, a.sku, a.precio_unitario, a.categoria,
           a.id_proveedor, a.id_unidad, a.activo,
           s.cantidad_disponible::float8 AS cantidad_disponible,
           s.stock_minimo::float8 AS stock_minimo,
           s.ubicacion
    FROM articulo a
    LEFT JOIN articulos_stock s ON s.id_articulo = a.id_articulo
`;

const leerArticulo = async (cliente: Pick<PoolClient, 'query'>, id: number | string): Promise<Articulo | null> => {
    const res = await cliente.query<Articulo>(`${SELECT_ARTICULO} WHERE a.id_articulo = $1`, [id]);
    return res.rows[0] ?? null;
};

/**
 * Registra auditoría granular por cada campo crítico que haya cambiado.
 * Se llama DENTRO de la transacción que ya hizo la mutación.
 */
const auditarCamposCriticos = async (
    cliente: PoolClient,
    idArticulo: number | string,
    antes: Articulo,
    despues: Articulo,
    idUsuarioEjecutor: number | null,
): Promise<void> => {
    for (const { campo, label } of CAMPOS_CRITICOS) {
        const valorAnterior = (antes as unknown as Record<string, unknown>)[campo];
        const valorNuevo = (despues as unknown as Record<string, unknown>)[campo];
        // Solo si realmente cambió (incluyendo null ↔ valor)
        if (valorAnterior === valorNuevo) continue;
        if (valorAnterior == null && valorNuevo == null) continue;

        await registrarAuditoria({
            entidad: 'insumo',
            accion: 'editar_campo_critico',
            idRegistro: idArticulo,
            idUsuarioEjecutor,
            estadoAnterior: { [campo]: valorAnterior },
            estadoNuevo: { [campo]: valorNuevo },
            descripcion: `Campo crítico «${label}» cambiado de ${String(valorAnterior ?? 'vacío')} a ${String(valorNuevo ?? 'vacío')} en artículo ID ${idArticulo}`,
        }, cliente);
    }
};

// Listar todos (administración, bodega y técnicos: el técnico solo lee)
export const obtenerArticulos = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<Articulo>(`${SELECT_ARTICULO} ORDER BY a.id_articulo ASC`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener artículos:', error);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
};

// Obtener uno por ID
export const obtenerArticuloPorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const articulo = await leerArticulo(pool, id);
        if (!articulo) {
            res.status(404).json({ mensaje: 'Artículo no encontrado' });
            return;
        }
        res.status(200).json(articulo);
    } catch (error) {
        console.error('Error al obtener artículo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un artículo (insumo) con su stock inicial: ambas filas en la misma transacción
export const crearArticulo = async (req: Request<Record<string, string>, unknown, ArticuloBody>, res: Response): Promise<void> => {
    const { nombre_articulo, sku, precio_unitario, categoria, id_proveedor, id_unidad, activo, stock, stock_minimo, ubicacion } = req.body;

    if (!nombre_articulo || !categoria) {
        res.status(400).json({ mensaje: 'El nombre y la categoría son obligatorios' });
        return;
    }

    const errorCategoria = validarCategoriaArticulo(categoria);
    if (errorCategoria) {
        res.status(400).json({ mensaje: errorCategoria });
        return;
    }

    if (stock !== undefined && !esNumeroNoNegativo(stock)) {
        res.status(400).json({ mensaje: 'El stock inicial debe ser un número mayor o igual a 0' });
        return;
    }

    try {
        const creado = await ejecutarTransaccion(async (cliente) => {
            const insertado = await cliente.query<{ id_articulo: number }>(
                `INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor, id_unidad, activo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id_articulo`,
                [
                    nombre_articulo.trim(),
                    sku || null,
                    precio_unitario || 0,
                    categoria,
                    id_proveedor || null,
                    id_unidad || null,
                    activo !== false,
                ]
            );
            const id = insertado.rows[0].id_articulo;

            await cliente.query(
                `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, stock_minimo, ubicacion)
                 VALUES ($1, $2, $3, $4)`,
                [id, stock ?? 0, stock_minimo ?? 0, ubicacion ?? null]
            );

            const nuevo = await leerArticulo(cliente, id);

            await registrarAuditoria({
                entidad: 'insumo',
                accion: 'crear',
                idRegistro: id,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: null,
                estadoNuevo: nuevo,
                descripcion: `Insumo «${nombre_articulo.trim()}» (SKU ${sku || 'sin SKU'}) creado con stock inicial ${stock ?? 0}`,
            }, cliente);

            return nuevo;
        });

        res.status(201).json({
            mensaje: 'Artículo creado exitosamente',
            articulo: creado,
        });
    } catch (error) {
        // Código 23505 = unique_violation en PostgreSQL
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: `El SKU '${sku}' ya está registrado` });
            return;
        }
        enviarErrorHttp(res, error, 'Error al crear el artículo');
    }
};

// Modificar un artículo (insumo): solo cambia los campos enviados; el resto conserva su valor.
// Los cambios en stock_minimo, id_unidad o id_proveedor generan registros de auditoría individuales.
export const actualizarArticulo = async (req: Request<{ id: string }, unknown, ArticuloBody>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { nombre_articulo, sku, precio_unitario, categoria, id_proveedor, id_unidad, activo, stock, stock_minimo, ubicacion } = req.body;

    if (categoria !== undefined) {
        const errorCategoria = validarCategoriaArticulo(categoria);
        if (errorCategoria) {
            res.status(400).json({ mensaje: errorCategoria });
            return;
        }
    }

    if (stock !== undefined && !esNumeroNoNegativo(stock)) {
        res.status(400).json({ mensaje: 'El stock debe ser un número mayor o igual a 0' });
        return;
    }

    try {
        const actualizado = await ejecutarTransaccion(async (cliente) => {
            // FOR UPDATE: evita que dos ediciones simultáneas se pisen
            const previo = await cliente.query<Articulo>(`${SELECT_ARTICULO} WHERE a.id_articulo = $1 FOR UPDATE OF a`, [id]);
            const antes = previo.rows[0];
            if (!antes) {
                throw new ErrorAplicacion(404, 'Artículo no encontrado para actualizar');
            }

            await cliente.query(
                `UPDATE articulo
                 SET nombre_articulo = COALESCE($1, nombre_articulo),
                     sku             = COALESCE($2, sku),
                     precio_unitario = COALESCE($3, precio_unitario),
                     categoria       = COALESCE($4, categoria),
                     id_proveedor    = COALESCE($5, id_proveedor),
                     id_unidad       = COALESCE($6, id_unidad),
                     activo          = COALESCE($7, activo)
                 WHERE id_articulo = $8`,
                [
                    nombre_articulo?.trim() ?? null,
                    sku ?? null,
                    precio_unitario ?? null,
                    categoria ?? null,
                    id_proveedor ?? null,
                    id_unidad ?? null,
                    typeof activo === 'boolean' ? activo : null,
                    id,
                ]
            );

            if (stock !== undefined || stock_minimo !== undefined || ubicacion !== undefined) {
                const filas = await cliente.query(
                    `UPDATE articulos_stock
                     SET cantidad_disponible = COALESCE($2, cantidad_disponible),
                         stock_minimo        = COALESCE($3, stock_minimo),
                         ubicacion           = COALESCE($4, ubicacion)
                     WHERE id_articulo = $1`,
                    [id, stock ?? null, stock_minimo ?? null, ubicacion ?? null]
                );
                // Artículo sin fila de stock (p. ej. creado antes de esta función): se crea
                if ((filas.rowCount ?? 0) === 0) {
                    await cliente.query(
                        `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, stock_minimo, ubicacion)
                         VALUES ($1, $2, $3, $4)`,
                        [id, stock ?? 0, stock_minimo ?? 0, ubicacion ?? null]
                    );
                }
            }

            const despues = await leerArticulo(cliente, id);
            const idEjecutor = obtenerIdEjecutor(req);

            // Auditoría granular: un registro por cada campo crítico que haya cambiado
            await auditarCamposCriticos(cliente, id, antes, despues!, idEjecutor);

            // Auditoría general de la mutación
            await registrarAuditoria({
                entidad: 'insumo',
                accion: activo === false ? 'deshabilitar' : 'editar',
                idRegistro: id,
                idUsuarioEjecutor: idEjecutor,
                estadoAnterior: antes,
                estadoNuevo: despues,
                descripcion: `Insumo «${despues?.nombre_articulo ?? antes.nombre_articulo}» (ID ${id}) actualizado`,
            }, cliente);

            return despues;
        });

        res.status(200).json({
            mensaje: 'Artículo actualizado exitosamente',
            articulo: actualizado,
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: `El SKU '${sku}' ya pertenece a otro artículo` });
            return;
        }
        enviarErrorHttp(res, error, 'Error al actualizar el artículo');
    }
};

// Deshabilitar un artículo (insumo) lógicamente: pone activo = false sin borrar datos.
// Los insumos con historial solo se deshabilitan; nunca se eliminan físicamente.
export const deshabilitarArticulo = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const deshabilitado = await ejecutarTransaccion(async (cliente) => {
            const previo = await cliente.query<Articulo>(`${SELECT_ARTICULO} WHERE a.id_articulo = $1 FOR UPDATE OF a`, [id]);
            const antes = previo.rows[0];
            if (!antes) {
                throw new ErrorAplicacion(404, 'Artículo no encontrado para deshabilitar');
            }
            if (!antes.activo) {
                throw new ErrorAplicacion(400, 'El artículo ya está deshabilitado');
            }

            await cliente.query('UPDATE articulo SET activo = FALSE WHERE id_articulo = $1', [id]);

            const despues = await leerArticulo(cliente, id);

            await registrarAuditoria({
                entidad: 'insumo',
                accion: 'deshabilitar',
                idRegistro: id,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: antes,
                estadoNuevo: despues,
                descripcion: `Insumo «${antes.nombre_articulo}» (ID ${id}) deshabilitado lógicamente`,
            }, cliente);

            return despues;
        });

        res.status(200).json({
            mensaje: 'Artículo deshabilitado correctamente',
            articulo: deshabilitado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al deshabilitar el artículo');
    }
};

// Eliminar un artículo: mutación + auditoría con el estado eliminado
export const eliminarArticulo = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const eliminado = await ejecutarTransaccion(async (cliente) => {
            const previo = await cliente.query<Articulo>(`${SELECT_ARTICULO} WHERE a.id_articulo = $1 FOR UPDATE OF a`, [id]);
            const antes = previo.rows[0];
            if (!antes) {
                throw new ErrorAplicacion(404, 'Artículo no encontrado para eliminar');
            }

            // El stock se borra en cascada (ON DELETE CASCADE)
            await cliente.query('DELETE FROM articulo WHERE id_articulo = $1', [id]);

            await registrarAuditoria({
                entidad: 'articulo',
                accion: 'eliminar',
                idRegistro: id,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: antes,
                estadoNuevo: null,
                descripcion: `Artículo ${antes.nombre_articulo} (ID ${id}) eliminado`,
            }, cliente);

            return antes;
        });

        res.status(200).json({
            mensaje: 'Artículo eliminado correctamente',
            articuloEliminado: eliminado,
        });
    } catch (error) {
        // (se intenta borrar un artículo que se usa en otra tabla)
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el artículo porque está asociado a registros de inventario o proyectos'
            });
            return;
        }
        enviarErrorHttp(res, error, 'Error al eliminar el artículo');
    }
};
