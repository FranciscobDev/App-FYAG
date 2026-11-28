import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import pool from '../config/db';

export interface ItemKitDetalle {
    id_detalle_kit?: number;
    id_articulo: number;
    nombre_articulo: string;
    sku?: string | null;
    precio_unitario: number;
    cantidad_requerida_kit: number;
    subtotal: number;
}

export interface KitProyectoConDetalle {
    id_kit_proyecto: number;
    nombre_kit: string;
    descripcion_kit: string | null;
    categoria: string | null;
    disponible_kit: number;
    costo_total: number;
    total_articulos: number;
    items: ItemKitDetalle[];
}

interface KitBodyItem {
    id_articulo: number;
    cantidad_requerida_kit: number;
}

interface KitBody {
    nombre_kit: string;
    descripcion_kit?: string;
    categoria?: string;
    disponible_kit?: number;
    items?: KitBodyItem[];
}

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

// Asegura que existan las tablas kit_proyecto y detalle_kit
let tablasVerificadas = false;
export const asegurarTablasKits = async (): Promise<void> => {
    if (tablasVerificadas) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS kit_proyecto (
                id_kit_proyecto SERIAL PRIMARY KEY,
                disponible_kit INT DEFAULT 0,
                nombre_kit VARCHAR(250) NOT NULL,
                descripcion_kit VARCHAR(250),
                categoria VARCHAR(50)
            );
            CREATE TABLE IF NOT EXISTS detalle_kit (
                id_detalle_kit SERIAL PRIMARY KEY,
                id_kit_proyecto INT NOT NULL REFERENCES kit_proyecto(id_kit_proyecto) ON DELETE CASCADE,
                id_articulo INT NOT NULL REFERENCES articulo(id_articulo),
                cantidad_requerida_kit NUMERIC(10,2) NOT NULL
            );
        `);
        tablasVerificadas = true;
    } catch (err) {
        console.warn('Advertencia al verificar tablas de kits:', err);
    }
};

// Listar todos los kits con sus insumos y costo calculado
export const obtenerKits = async (_req: Request, res: Response): Promise<void> => {
    await asegurarTablasKits();
    try {
        const kitsRes = await pool.query<{
            id_kit_proyecto: number;
            nombre_kit: string;
            descripcion_kit: string | null;
            categoria: string | null;
            disponible_kit: number;
        }>('SELECT * FROM kit_proyecto ORDER BY id_kit_proyecto ASC');

        if (kitsRes.rows.length === 0) {
            res.status(200).json([]);
            return;
        }

        const detallesRes = await pool.query<{
            id_detalle_kit: number;
            id_kit_proyecto: number;
            id_articulo: number;
            cantidad_requerida_kit: string;
            nombre_articulo: string;
            sku: string | null;
            precio_unitario: number;
        }>(`
            SELECT 
                dk.id_detalle_kit,
                dk.id_kit_proyecto,
                dk.id_articulo,
                dk.cantidad_requerida_kit,
                a.nombre_articulo,
                a.sku,
                COALESCE(a.precio_unitario, 0) AS precio_unitario
            FROM detalle_kit dk
            JOIN articulo a ON a.id_articulo = dk.id_articulo
            ORDER BY dk.id_detalle_kit ASC
        `);

        const kitsConDetalle: KitProyectoConDetalle[] = kitsRes.rows.map((k) => {
            const itemsKit = detallesRes.rows.filter((d) => d.id_kit_proyecto === k.id_kit_proyecto);
            const items: ItemKitDetalle[] = itemsKit.map((d) => {
                const cantidad = Number(d.cantidad_requerida_kit) || 0;
                const precio = Number(d.precio_unitario) || 0;
                return {
                    id_detalle_kit: d.id_detalle_kit,
                    id_articulo: d.id_articulo,
                    nombre_articulo: d.nombre_articulo,
                    sku: d.sku,
                    precio_unitario: precio,
                    cantidad_requerida_kit: cantidad,
                    subtotal: Math.round(cantidad * precio),
                };
            });

            const costo_total = items.reduce((acc, it) => acc + it.subtotal, 0);

            return {
                id_kit_proyecto: k.id_kit_proyecto,
                nombre_kit: k.nombre_kit,
                descripcion_kit: k.descripcion_kit,
                categoria: k.categoria,
                disponible_kit: k.disponible_kit || 0,
                costo_total,
                total_articulos: items.length,
                items,
            };
        });

        res.status(200).json(kitsConDetalle);
    } catch (error) {
        console.error('Error al obtener kits:', error);
        res.status(500).json({ error: 'Error al obtener los kits predeterminados' });
    }
};

// Obtener un kit por ID con sus insumos
export const obtenerKitPorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    await asegurarTablasKits();
    const { id } = req.params;
    try {
        const kitRes = await pool.query<{
            id_kit_proyecto: number;
            nombre_kit: string;
            descripcion_kit: string | null;
            categoria: string | null;
            disponible_kit: number;
        }>('SELECT * FROM kit_proyecto WHERE id_kit_proyecto = $1', [id]);

        if (kitRes.rows.length === 0) {
            res.status(404).json({ mensaje: 'Kit predeterminado no encontrado' });
            return;
        }

        const k = kitRes.rows[0];

        const detallesRes = await pool.query<{
            id_detalle_kit: number;
            id_articulo: number;
            cantidad_requerida_kit: string;
            nombre_articulo: string;
            sku: string | null;
            precio_unitario: number;
        }>(`
            SELECT 
                dk.id_detalle_kit,
                dk.id_articulo,
                dk.cantidad_requerida_kit,
                a.nombre_articulo,
                a.sku,
                COALESCE(a.precio_unitario, 0) AS precio_unitario
            FROM detalle_kit dk
            JOIN articulo a ON a.id_articulo = dk.id_articulo
            WHERE dk.id_kit_proyecto = $1
            ORDER BY dk.id_detalle_kit ASC
        `, [id]);

        const items: ItemKitDetalle[] = detallesRes.rows.map((d) => {
            const cantidad = Number(d.cantidad_requerida_kit) || 0;
            const precio = Number(d.precio_unitario) || 0;
            return {
                id_detalle_kit: d.id_detalle_kit,
                id_articulo: d.id_articulo,
                nombre_articulo: d.nombre_articulo,
                sku: d.sku,
                precio_unitario: precio,
                cantidad_requerida_kit: cantidad,
                subtotal: Math.round(cantidad * precio),
            };
        });

        const costo_total = items.reduce((acc, it) => acc + it.subtotal, 0);

        const kitCompleto: KitProyectoConDetalle = {
            id_kit_proyecto: k.id_kit_proyecto,
            nombre_kit: k.nombre_kit,
            descripcion_kit: k.descripcion_kit,
            categoria: k.categoria,
            disponible_kit: k.disponible_kit || 0,
            costo_total,
            total_articulos: items.length,
            items,
        };

        res.status(200).json(kitCompleto);
    } catch (error) {
        console.error('Error al obtener kit por ID:', error);
        res.status(500).json({ error: 'Error al consultar kit' });
    }
};

// Crear un kit predeterminado junto con sus insumos
export const crearKit = async (req: Request<Record<string, string>, unknown, KitBody>, res: Response): Promise<void> => {
    await asegurarTablasKits();
    const { nombre_kit, descripcion_kit, categoria, disponible_kit, items } = req.body;

    if (!nombre_kit || !nombre_kit.trim()) {
        res.status(400).json({ mensaje: 'El nombre del kit es obligatorio' });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertKitQuery = `
            INSERT INTO kit_proyecto (nombre_kit, descripcion_kit, categoria, disponible_kit)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const kitValues = [
            nombre_kit.trim(),
            descripcion_kit?.trim() || null,
            categoria?.trim() || null,
            disponible_kit || 0,
        ];
        const kitRes = await client.query(insertKitQuery, kitValues);
        const nuevoKit = kitRes.rows[0];
        const idKit = nuevoKit.id_kit_proyecto;

        if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                const cantidad = Number(item.cantidad_requerida_kit) || 0;
                if (item.id_articulo && cantidad > 0) {
                    await client.query(
                        `INSERT INTO detalle_kit (id_kit_proyecto, id_articulo, cantidad_requerida_kit)
                         VALUES ($1, $2, $3)`,
                        [idKit, item.id_articulo, cantidad]
                    );
                }
            }
        }

        await client.query('COMMIT');

        // Retorna el kit con detalle y costos calculados
        const detallesRes = await pool.query<{
            id_detalle_kit: number;
            id_articulo: number;
            cantidad_requerida_kit: string;
            nombre_articulo: string;
            sku: string | null;
            precio_unitario: number;
        }>(`
            SELECT 
                dk.id_detalle_kit,
                dk.id_articulo,
                dk.cantidad_requerida_kit,
                a.nombre_articulo,
                a.sku,
                COALESCE(a.precio_unitario, 0) AS precio_unitario
            FROM detalle_kit dk
            JOIN articulo a ON a.id_articulo = dk.id_articulo
            WHERE dk.id_kit_proyecto = $1
        `, [idKit]);

        const itemsCalculados: ItemKitDetalle[] = detallesRes.rows.map((d) => {
            const cantidad = Number(d.cantidad_requerida_kit) || 0;
            const precio = Number(d.precio_unitario) || 0;
            return {
                id_detalle_kit: d.id_detalle_kit,
                id_articulo: d.id_articulo,
                nombre_articulo: d.nombre_articulo,
                sku: d.sku,
                precio_unitario: precio,
                cantidad_requerida_kit: cantidad,
                subtotal: Math.round(cantidad * precio),
            };
        });

        const costo_total = itemsCalculados.reduce((acc, it) => acc + it.subtotal, 0);

        res.status(201).json({
            mensaje: 'Kit predeterminado creado exitosamente',
            kit: {
                id_kit_proyecto: idKit,
                nombre_kit: nuevoKit.nombre_kit,
                descripcion_kit: nuevoKit.descripcion_kit,
                categoria: nuevoKit.categoria,
                disponible_kit: nuevoKit.disponible_kit,
                costo_total,
                total_articulos: itemsCalculados.length,
                items: itemsCalculados,
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear kit predeterminado:', error);
        res.status(500).json({ error: 'Error al registrar el kit predeterminado' });
    } finally {
        client.release();
    }
};

// Actualizar kit predeterminado y sus insumos
export const actualizarKit = async (req: Request<{ id: string }, unknown, KitBody>, res: Response): Promise<void> => {
    await asegurarTablasKits();
    const { id } = req.params;
    const { nombre_kit, descripcion_kit, categoria, disponible_kit, items } = req.body;

    if (!nombre_kit || !nombre_kit.trim()) {
        res.status(400).json({ mensaje: 'El nombre del kit es obligatorio' });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateRes = await client.query(
            `UPDATE kit_proyecto
             SET nombre_kit = $1, descripcion_kit = $2, categoria = $3, disponible_kit = $4
             WHERE id_kit_proyecto = $5
             RETURNING *;`,
            [nombre_kit.trim(), descripcion_kit?.trim() || null, categoria?.trim() || null, disponible_kit || 0, id]
        );

        if (updateRes.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ mensaje: 'Kit no encontrado' });
            return;
        }

        // Si se enviaron items, sincronizamos detalle_kit
        if (Array.isArray(items)) {
            await client.query('DELETE FROM detalle_kit WHERE id_kit_proyecto = $1', [id]);
            for (const item of items) {
                const cantidad = Number(item.cantidad_requerida_kit) || 0;
                if (item.id_articulo && cantidad > 0) {
                    await client.query(
                        `INSERT INTO detalle_kit (id_kit_proyecto, id_articulo, cantidad_requerida_kit)
                         VALUES ($1, $2, $3)`,
                        [id, item.id_articulo, cantidad]
                    );
                }
            }
        }

        await client.query('COMMIT');

        const detallesRes = await pool.query<{
            id_detalle_kit: number;
            id_articulo: number;
            cantidad_requerida_kit: string;
            nombre_articulo: string;
            sku: string | null;
            precio_unitario: number;
        }>(`
            SELECT 
                dk.id_detalle_kit,
                dk.id_articulo,
                dk.cantidad_requerida_kit,
                a.nombre_articulo,
                a.sku,
                COALESCE(a.precio_unitario, 0) AS precio_unitario
            FROM detalle_kit dk
            JOIN articulo a ON a.id_articulo = dk.id_articulo
            WHERE dk.id_kit_proyecto = $1
        `, [id]);

        const itemsCalculados: ItemKitDetalle[] = detallesRes.rows.map((d) => {
            const cantidad = Number(d.cantidad_requerida_kit) || 0;
            const precio = Number(d.precio_unitario) || 0;
            return {
                id_detalle_kit: d.id_detalle_kit,
                id_articulo: d.id_articulo,
                nombre_articulo: d.nombre_articulo,
                sku: d.sku,
                precio_unitario: precio,
                cantidad_requerida_kit: cantidad,
                subtotal: Math.round(cantidad * precio),
            };
        });

        const costo_total = itemsCalculados.reduce((acc, it) => acc + it.subtotal, 0);

        res.status(200).json({
            mensaje: 'Kit predeterminado actualizado exitosamente',
            kit: {
                id_kit_proyecto: Number(id),
                nombre_kit: updateRes.rows[0].nombre_kit,
                descripcion_kit: updateRes.rows[0].descripcion_kit,
                categoria: updateRes.rows[0].categoria,
                disponible_kit: updateRes.rows[0].disponible_kit,
                costo_total,
                total_articulos: itemsCalculados.length,
                items: itemsCalculados,
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar kit:', error);
        res.status(500).json({ error: 'Error al actualizar el kit' });
    } finally {
        client.release();
    }
};

// Eliminar kit predeterminado
export const eliminarKit = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    await asegurarTablasKits();
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM kit_proyecto WHERE id_kit_proyecto = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Kit no encontrado' });
            return;
        }
        res.status(200).json({ mensaje: 'Kit eliminado correctamente', kitEliminado: result.rows[0] });
    } catch (error) {
        console.error('Error al eliminar kit:', error);
        res.status(500).json({ error: 'Error al eliminar el kit predeterminado' });
    }
};

