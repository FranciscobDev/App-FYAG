import pool from '../config/db';

async function verificarAuditoria() {
    try {
        console.log('--- Último registro de auditoría ---');
        const res = await pool.query(`
            SELECT * FROM bitacora_auditoria 
            ORDER BY fecha_evento DESC 
            LIMIT 1
        `);
        
        if (res.rows.length > 0) {
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('No hay registros en la bitácora de auditoría.');
        }
    } catch (err) {
        console.error('Error al consultar la auditoría:', err);
    } finally {
        await pool.end();
    }
}

verificarAuditoria();