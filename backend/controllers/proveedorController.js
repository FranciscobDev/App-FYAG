const pool = require('../config/db');

const obtenerProveedores = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM proveedor ORDER BY id_proveedor ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ error: 'Error al obtener los proveedores' });
    }
};

const obtenerProveedorPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM proveedor WHERE id_proveedor = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener proveedor:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const crearProveedor = async (req, res) => {
    const { nombre_proveedor, rut_proveedor, telefono, correo_contacto, direccion } = req.body;

    if (!nombre_proveedor || !rut_proveedor) {
        return res.status(400).json({ mensaje: 'El nombre y el rut son obligatorios' });
    }

    try {
        const query = `
      INSERT INTO proveedor (nombre_proveedor,rut_proveedor,correo_contacto,telefono,direccion )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const values = [nombre_proveedor, rut_proveedor, correo_contacto, telefono || null, direccion || null];

        const result = await pool.query(query, values);
        res.status(201).json({
            mensaje: 'Proveedor creado exitosamente',
            proveedor: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: `El proveedor '${nombre_proveedor}' ya está registrado` });
        }
        console.error('Error al crear proveedor:', error);
        res.status(500).json({ error: 'Error al crear el proveedor' });
    }
};

const actualizarProveedor = async (req, res) => {
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

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado para actualizar' });
        }

        res.status(200).json({
            mensaje: 'Proveedor actualizado exitosamente',
            proveedor: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: `El rut '${rut_proveedor}' ya pertenece a otro proveedor` });
        }
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({ error: 'Error al actualizar el proveedor' });
    }
};

const eliminarProveedor = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM proveedor WHERE id_proveedor = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado para eliminar' });
        }

        res.status(200).json({
            mensaje: 'Proveedor eliminado correctamente',
            proveedorEliminado: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({
                mensaje: 'No se puede eliminar el proveedor porque está asociado a registros de inventario'
            });
        }
        console.error('Error al eliminar proveedor:', error);
        res.status(500).json({ error: 'Error al eliminar el proveedor' });
    }
};

module.exports = {
    obtenerProveedores,
    obtenerProveedorPorId,
    crearProveedor,
    actualizarProveedor,
    eliminarProveedor
};