import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import pool from '../config/db';

export interface Articulo {
    id_articulo: number;
    nombre_articulo: string;
    sku: string | null;
    precio_unitario: number;
    categoria: string;
    id_proveedor: number | null;
}

interface ArticuloBody {
    nombre_articulo?: string;
    sku?: string | null;
    precio_unitario?: number;
    categoria?: string;
    id_proveedor?: number | null;
}

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

// Listar todos
export const obtenerArticulos = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<Articulo>('SELECT * FROM articulo ORDER BY id_articulo ASC');
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
        const result = await pool.query<Articulo>(
            'SELECT * FROM articulo WHERE id_articulo = $1',
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Artículo no encontrado' });
            return;
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener artículo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un artículo
export const crearArticulo = async (req: Request<Record<string, string>, unknown, ArticuloBody>, res: Response): Promise<void> => {
    const { nombre_articulo, sku, precio_unitario, categoria, id_proveedor } = req.body;

    if (!nombre_articulo || !categoria) {
        res.status(400).json({ mensaje: 'El nombre y la categoría son obligatorios' });
        return;
    }

    try {
        const query = `
      INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const values = [nombre_articulo, sku || null, precio_unitario || 0, categoria, id_proveedor || null];

        const result = await pool.query<Articulo>(query, values);
        res.status(201).json({
            mensaje: 'Artículo creado exitosamente',
            articulo: result.rows[0]
        });
    } catch (error) {
        // Código 23505 = unique_violation en PostgreSQL
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: `El SKU '${sku}' ya está registrado` });
            return;
        }
        console.error('Error al crear artículo:', error);
        res.status(500).json({ error: 'Error al crear el artículo' });
    }
};

// Modificar un artículo
export const actualizarArticulo = async (req: Request<{ id: string }, unknown, ArticuloBody>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { nombre_articulo, sku, precio_unitario, categoria, id_proveedor } = req.body;

    try {
        const query = `
      UPDATE articulo
      SET nombre_articulo = $1, sku = $2, precio_unitario = $3, categoria = $4, id_proveedor = $5
      WHERE id_articulo = $6
      RETURNING *;
    `;
        const values = [nombre_articulo, sku, precio_unitario, categoria, id_proveedor, id];

        const result = await pool.query<Articulo>(query, values);

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Artículo no encontrado para actualizar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Artículo actualizado exitosamente',
            articulo: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: `El SKU '${sku}' ya pertenece a otro artículo` });
            return;
        }
        console.error('Error al actualizar artículo:', error);
        res.status(500).json({ error: 'Error al actualizar el artículo' });
    }
};

// Eliminar un artículo
export const eliminarArticulo = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<Articulo>(
            'DELETE FROM articulo WHERE id_articulo = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Artículo no encontrado para eliminar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Artículo eliminado correctamente',
            articuloEliminado: result.rows[0]
        });
    } catch (error) {
        // (se intenta borrar un artículo que se usa en otra tabla)
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el artículo porque está asociado a registros de inventario o proyectos'
            });
            return;
        }
        console.error('Error al eliminar artículo:', error);
        res.status(500).json({ error: 'Error al eliminar el artículo' });
    }
};

