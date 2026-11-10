import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import pool from '../config/db';
import { normalizarRol } from '../middleware/authMiddleware';

export interface Proyecto {
    id_proyecto: number;
    nombre_proyecto: string;
    tipo_proyecto: string;
    cliente: string | null;
    direccion: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    presupuesto_inicial: number;
    presupuesto_horas: number;
    valor_venta: number;
    porcentaje_avance: number;
    estado_proyecto: string;
    id_usuario: number | null;
}

interface ProyectoBody {
    nombre_proyecto?: string;
    tipo_proyecto?: string;
    cliente?: string | null;
    direccion?: string | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    presupuesto_inicial?: number;
    presupuesto_horas?: number;
    valor_venta?: number;
    porcentaje_avance?: number;
    estado_proyecto?: string;
    id_usuario?: number | null;
    id_kit_proyecto?: number | null;
}

interface TecnicoResumen {
    id_usuario: number;
    nombre: string;
}

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

// Listar todos
export const obtenerProyectos = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        const result = esTecnico
            ? await pool.query<Proyecto>(
                `SELECT p.*
                 FROM proyecto p
                 JOIN proyecto_tecnico pt ON pt.id_proyecto = p.id_proyecto
                 WHERE pt.id_usuario = $1
                 ORDER BY p.id_proyecto ASC`,
                [payload?.id]
            )
            : await pool.query<Proyecto>('SELECT * FROM proyecto ORDER BY id_proyecto ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({ error: 'Error al obtener los proyectos' });
    }
};

// Obtener uno por ID
export const obtenerProyectoPorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        const result = esTecnico
            ? await pool.query<Proyecto>(
                `SELECT p.*
                 FROM proyecto p
                 JOIN proyecto_tecnico pt ON pt.id_proyecto = p.id_proyecto
                 WHERE p.id_proyecto = $1 AND pt.id_usuario = $2`,
                [id, payload?.id]
            )
            : await pool.query<Proyecto>(
                'SELECT * FROM proyecto WHERE id_proyecto = $1',
                [id]
            );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado' });
            return;
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener proyecto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un proyecto
export const crearProyecto = async (req: Request<Record<string, string>, unknown, ProyectoBody>, res: Response): Promise<void> => {
    const {
        nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio, fecha_fin,
        presupuesto_inicial, presupuesto_horas, valor_venta,
        porcentaje_avance, estado_proyecto, id_usuario, id_kit_proyecto
    } = req.body;

    if (!nombre_proyecto) {
        res.status(400).json({ mensaje: 'El nombre del proyecto es obligatorio' });
        return;
    }

    try {
        let presupuestoFinal = Number(presupuesto_inicial) || 0;

        // Si se seleccionó un kit y no se especificó un presupuesto manual distinto de 0,
        // calculamos el presupuesto sumando el costo de los insumos del kit
        if (id_kit_proyecto && (!presupuestoFinal || presupuestoFinal === 0)) {
            try {
                const kitCostRes = await pool.query<{ costo_total: string }>(`
                    SELECT COALESCE(SUM(dk.cantidad_requerida_kit * a.precio_unitario), 0) AS costo_total
                    FROM detalle_kit dk
                    JOIN articulo a ON a.id_articulo = dk.id_articulo
                    WHERE dk.id_kit_proyecto = $1
                `, [id_kit_proyecto]);
                if (kitCostRes.rows.length > 0) {
                    presupuestoFinal = Math.round(Number(kitCostRes.rows[0].costo_total) || 0);
                }
            } catch (errKitCost) {
                console.warn('No se pudo calcular costo automático del kit:', errKitCost);
            }
        }

        const query = `
        INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
        const values = [
            nombre_proyecto,
            tipo_proyecto || 'Instalacion',
            cliente || null,
            direccion || null,
            fecha_inicio || null,
            fecha_fin || null,
            presupuestoFinal,
            presupuesto_horas || 0,
            valor_venta || 0,
            porcentaje_avance || 0,
            estado_proyecto || 'Planificado',
            id_usuario || null
        ];

        const result = await pool.query<Proyecto>(query, values);
        const proyectoCreado = result.rows[0];

        // Si se asignó un kit, vinculamos sus insumos al proyecto
        if (id_kit_proyecto && proyectoCreado) {
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS articulo_en_proyecto (
                        id_articulo_proyecto SERIAL PRIMARY KEY,
                        id_proyecto INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
                        id_articulo INT NOT NULL REFERENCES articulo(id_articulo),
                        cantidad NUMERIC(10,2) NOT NULL,
                        id_unidad INT
                    );
                `);
                await pool.query(`
                    INSERT INTO articulo_en_proyecto (id_proyecto, id_articulo, cantidad, id_unidad)
                    SELECT $1, dk.id_articulo, dk.cantidad_requerida_kit, a.id_unidad
                    FROM detalle_kit dk
                    JOIN articulo a ON a.id_articulo = dk.id_articulo
                    WHERE dk.id_kit_proyecto = $2;
                `, [proyectoCreado.id_proyecto, id_kit_proyecto]);
            } catch (kitErr) {
                console.warn('Advertencia al vincular insumos del kit al proyecto:', kitErr);
            }
        }

        res.status(201).json({
            mensaje: 'Proyecto creado exitosamente',
            proyecto: proyectoCreado
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '22P02') {
            res.status(400).json({ mensaje: 'Valor inválido en tipo_proyecto, estado_proyecto o algún número' });
            return;
        }
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({ mensaje: 'El usuario responsable no existe' });
            return;
        }
        console.error('Error al crear proyecto:', error);
        res.status(500).json({ error: 'Error al crear el proyecto' });
    }
};

// Modificar un proyecto
export const actualizarProyecto = async (req: Request<{ id: string }, unknown, ProyectoBody>, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
        nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio, fecha_fin,
        presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario
    } = req.body;

    try {
        const query = `
      UPDATE proyecto
      SET nombre_proyecto = $1, tipo_proyecto = $2, cliente = $3, direccion = $4,
          fecha_inicio = $5, fecha_fin = $6, presupuesto_inicial = $7, presupuesto_horas = $8, valor_venta = $9,
          porcentaje_avance = $10, estado_proyecto = $11, id_usuario = $12
      WHERE id_proyecto = $13
      RETURNING *;
    `;
        const values = [
            nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio,
            fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario, id
        ];

        const result = await pool.query<Proyecto>(query, values);

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado para actualizar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proyecto actualizado exitosamente',
            proyecto: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '22P02') {
            res.status(400).json({ mensaje: 'Valor inválido en tipo_proyecto, estado_proyecto o algún número' });
            return;
        }
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({ mensaje: 'El usuario responsable no existe' });
            return;
        }
        console.error('Error al actualizar proyecto:', error);
        res.status(500).json({ error: 'Error al actualizar el proyecto' });
    }
};

// Eliminar un proyecto
export const eliminarProyecto = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<Proyecto>(
            'DELETE FROM proyecto WHERE id_proyecto = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado para eliminar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proyecto eliminado correctamente',
            proyectoEliminado: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el proyecto porque tiene horas o solicitudes asociadas'
            });
            return;
        }
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({ error: 'Error al eliminar el proyecto' });
    }
};

// ---------- Técnicos asignados a proyectos ----------

// Listar usuarios con rol técnico activos (para el selector)
export const listarTecnicos = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<TecnicoResumen>(
            `SELECT u.id_usuario,
                    TRIM(u.nombre_usuario || ' ' || u.apellido_usuario) AS nombre
             FROM usuario u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE r.nombre_rol = 'Tecnico' AND u.activo = TRUE
             ORDER BY u.nombre_usuario ASC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al listar técnicos:', error);
        res.status(500).json({ error: 'Error al obtener los técnicos' });
    }
};

// Técnicos asignados a un proyecto
export const obtenerTecnicosDeProyecto = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<TecnicoResumen>(
            `SELECT u.id_usuario,
                    TRIM(u.nombre_usuario || ' ' || u.apellido_usuario) AS nombre
             FROM proyecto_tecnico pt
             JOIN usuario u ON u.id_usuario = pt.id_usuario
             WHERE pt.id_proyecto = $1
             ORDER BY u.nombre_usuario ASC`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener técnicos del proyecto:', error);
        res.status(500).json({ error: 'Error al obtener los técnicos del proyecto' });
    }
};

// Asignar un técnico a un proyecto (solo usuarios con rol técnico)
export const asignarTecnico = async (
    req: Request<{ id: string }, unknown, { id_usuario?: number }>,
    res: Response
): Promise<void> => {
    const { id } = req.params;
    const { id_usuario } = req.body;

    if (!id_usuario) {
        res.status(400).json({ mensaje: 'Debe indicar el técnico a asignar' });
        return;
    }

    try {
        const esTecnico = await pool.query(
            `SELECT 1
             FROM usuario u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1 AND r.nombre_rol = 'Tecnico'`,
            [id_usuario]
        );
        if (esTecnico.rows.length === 0) {
            res.status(400).json({ mensaje: 'El usuario seleccionado no es un técnico' });
            return;
        }

        await pool.query(
            'INSERT INTO proyecto_tecnico (id_proyecto, id_usuario) VALUES ($1, $2)',
            [id, id_usuario]
        );
        res.status(201).json({ mensaje: 'Técnico asignado al proyecto' });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(409).json({ mensaje: 'El técnico ya está asignado a este proyecto' });
            return;
        }
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({ mensaje: 'El proyecto o el técnico no existe' });
            return;
        }
        if (esErrorPg(error) && error.code === '22P02') {
            res.status(400).json({ mensaje: 'Identificador inválido' });
            return;
        }
        console.error('Error al asignar técnico:', error);
        res.status(500).json({ error: 'Error al asignar el técnico' });
    }
};

// Quitar un técnico de un proyecto
export const quitarTecnico = async (req: Request<{ id: string; idUsuario: string }>, res: Response): Promise<void> => {
    const { id, idUsuario } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM proyecto_tecnico WHERE id_proyecto = $1 AND id_usuario = $2 RETURNING *',
            [id, idUsuario]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'El técnico no está asignado a este proyecto' });
            return;
        }

        res.status(200).json({ mensaje: 'Técnico quitado del proyecto' });
    } catch (error) {
        console.error('Error al quitar técnico:', error);
        res.status(500).json({ error: 'Error al quitar el técnico' });
    }
};

