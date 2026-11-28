import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import pool from '../config/db';

export interface Proveedor {
    id_proveedor: number;
    nombre_proveedor: string;
    rut_proveedor: string;
    correo_contacto: string | null;
    telefono: string | null;
    direccion: string | null;
}

interface ProveedorBody {
    nombre_proveedor?: string;
    rut_proveedor?: string;
    correo_contacto?: string | null;
    telefono?: string | null;
    direccion?: string | null;
}

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

export const obtenerProveedores = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<Proveedor>('SELECT * FROM proveedor ORDER BY id_proveedor ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener los proveedores' });
    }
};

export const obtenerProveedorPorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<Proveedor>(
            'SELECT * FROM proveedor WHERE id_proveedor = $1',
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proveedor no encontrado' });
            return;
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener proveedor:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const crearProveedor = async (req: Request<Record<string, string>, unknown, ProveedorBody>, res: Response): Promise<void> => {
    const { nombre_proveedor, rut_proveedor, telefono, correo_contacto, direccion } = req.body;

    if (!nombre_proveedor || !rut_proveedor) {
        res.status(400).json({ mensaje: 'El nombre y el rut son obligatorios' });
        return;
    }

    try {
        const query = `
      INSERT INTO proveedor (nombre_proveedor,rut_proveedor,correo_contacto,telefono,direccion )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const values = [nombre_proveedor, rut_proveedor, correo_contacto, telefono || null, direccion || null];

        const result = await pool.query<Proveedor>(query, values);
        res.status(201).json({
            mensaje: 'Proveedor creado exitosamente',
            proveedor: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: `El proveedor '${nombre_proveedor}' ya está registrado` });
            return;
        }
        console.error('Error al crear proveedor:', error);
        res.status(500).json({ error: 'Error al crear el proveedor' });
    }
};

export const actualizarProveedor = async (req: Request<{ id: string }, unknown, ProveedorBody>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion } = req.body;

    try {
        const query = `
      UPDATE proveedor
      SET nombre_proveedor = $1, rut_proveedor = $2, correo_contacto = $3, telefono = $4, direccion = $5
      WHERE id_proveedor = $6
      RETURNING *;
    `;
        const values = [nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion, id];

        const result = await pool.query<Proveedor>(query, values);

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proveedor no encontrado para actualizar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proveedor actualizado exitosamente',
            proveedor: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(400).json({ mensaje: `El rut '${rut_proveedor}' ya pertenece a otro proveedor` });
            return;
        }
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({ error: 'Error al actualizar el proveedor' });
    }
};

export const eliminarProveedor = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<Proveedor>(
            'DELETE FROM proveedor WHERE id_proveedor = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proveedor no encontrado para eliminar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proveedor eliminado correctamente',
            proveedorEliminado: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el proveedor porque está asociado a registros de inventario'
            });
            return;
        }
        console.error('Error al eliminar proveedor:', error);
        res.status(500).json({ error: 'Error al eliminar el proveedor' });
    }
};

