const pool = require('../config/db');

// Listar todos
const obtenerArticulos = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM articulo ORDER BY id_articulo ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener artículos:', error);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
};

// Obtener uno por ID
const obtenerArticuloPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM articulo WHERE id_articulo = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Artículo no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener artículo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un artículo
const crearArticulo = async (req, res) => {
    const { nombre_articulo, sku, precio_unitario, categoria, id_proveedor } = req.body;

    if (!nombre_articulo || !categoria) {
        return res.status(400).json({ mensaje: 'El nombre y la categoría son obligatorios' });
    }

    try {
        const query = `
      INSERT INTO articulo (nombre_articulo, sku, precio_unitario, categoria, id_proveedor)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const values = [nombre_articulo, sku || null, precio_unitario || 0, categoria, id_proveedor || null];

        const result = await pool.query(query, values);
        res.status(201).json({
            mensaje: 'Artículo creado exitosamente',
            articulo: result.rows[0]
        });
    } catch (error) {
        // Código 23505 = unique_violation en PostgreSQL
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: `El SKU '${sku}' ya está registrado` });
        }
        console.error('Error al crear artículo:', error);
        res.status(500).json({ error: 'Error al crear el artículo' });
    }
};

// Modificar un artículo
const actualizarArticulo = async (req, res) => {
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

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Artículo no encontrado para actualizar' });
        }

        res.status(200).json({
            mensaje: 'Artículo actualizado exitosamente',
            articulo: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: `El SKU '${sku}' ya pertenece a otro artículo` });
        }
        console.error('Error al actualizar artículo:', error);
        res.status(500).json({ error: 'Error al actualizar el artículo' });
    }
};

// Eliminar un artículo
const eliminarArticulo = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM articulo WHERE id_articulo = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Artículo no encontrado para eliminar' });
        }

        res.status(200).json({
            mensaje: 'Artículo eliminado correctamente',
            articuloEliminado: result.rows[0]
        });
    } catch (error) {
        // (se intenta borrar un artículo que se usa en otra tabla)
        if (error.code === '23503') {
            return res.status(400).json({
                mensaje: 'No se puede eliminar el artículo porque está asociado a registros de inventario o proyectos'
            });
        }
        console.error('Error al eliminar artículo:', error);
        res.status(500).json({ error: 'Error al eliminar el artículo' });
    }
};

module.exports = {
    obtenerArticulos,
    obtenerArticuloPorId,
    crearArticulo,
    actualizarArticulo,
    eliminarArticulo
};