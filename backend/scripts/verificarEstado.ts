import pool from '../config/db';

async function verificarEstado() {
    try {
        console.log('--- ESTADO ACTUAL DEL INSUMO ID 2 ---');
        const res = await pool.query(`
            SELECT a.nombre_articulo, s.stock_minimo 
            FROM articulo a
            JOIN articulos_stock s ON a.id_articulo = s.id_articulo
            WHERE a.id_articulo = 2
        `);
        console.log(res.rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}
verificarEstado();