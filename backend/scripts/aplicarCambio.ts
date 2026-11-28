import pool from '../config/db';

async function simularCambio() {
    try {
        console.log('--- ACTUALIZANDO STOCK MÍNIMO A 80 ---');
        // Esto es lo que hace tu controlador: actualiza y registra auditoría
        await pool.query(`UPDATE articulos_stock SET stock_minimo = 80 WHERE id_articulo = 2`);
        
        await pool.query(`
            INSERT INTO bitacora_auditoria (fecha_evento, id_usuario, entidad, accion, valor_anterior, valor_nuevo, id_registro_afectado)
            VALUES (NOW(), 5, 'insumo', 'editar', '{"stock_minimo": 25}', '{"stock_minimo": 80}', 2)
        `);
        console.log('✅ Cambio aplicado y auditoría registrada.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}
simularCambio();