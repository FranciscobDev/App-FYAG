import { Request, Response } from 'express';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

const CANTIDAD_VALIDA = /^\d+(\.\d{1,3})?$/;
const MOTIVOS = ['dano', 'vencimiento', 'extravio', 'otro'];

/**
 * [BACK-2] POST /mermas (Bodeguero y Administrador)
 * En una sola transacción: valida contra el stock disponible, descuenta, registra la merma
 * valorizada al PMP actual, la salida en Cardex, la alerta para el Administrador y la auditoría.
 */
export const registrarMerma = async (req: Request, res: Response): Promise<void> => {
    const idUsuario = obtenerIdEjecutor(req);
    const idArticulo = Number(req.body?.id_articulo);
    const cantidad = String(req.body?.cantidad_baja ?? '').trim();
    const motivo = String(req.body?.motivo ?? '').trim();
    const observacion = req.body?.observacion ? String(req.body.observacion).trim().slice(0, 250) : null;

    if (!Number.isInteger(idArticulo) || idArticulo <= 0) {
        res.status(400).json({ mensaje: 'Identificador de artículo inválido' });
        return;
    }
    if (!CANTIDAD_VALIDA.test(cantidad) || Number(cantidad) <= 0) {
        res.status(400).json({ mensaje: 'La cantidad de merma debe ser positiva con máximo 3 decimales' });
        return;
    }
    if (!MOTIVOS.includes(motivo)) {
        res.status(400).json({ mensaje: `Motivo inválido. Valores permitidos: ${MOTIVOS.join(', ')}` });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion(async (cliente) => {
            const stock = await cliente.query<{
                disponible: string; pmp: string; sku: string; nombre: string; alcanza: boolean;
            }>(
                `SELECT s.cantidad_disponible::text AS disponible, s.pmp::text AS pmp,
                        i.sku, i.nombre, (s.cantidad_disponible >= $2::numeric) AS alcanza
                 FROM articulos_stock s
                 JOIN insumos i ON i.id_insumo = s.id_articulo
                 WHERE s.id_articulo = $1
                 FOR UPDATE OF s`,
                [idArticulo, cantidad]
            );
            if (stock.rows.length === 0) {
                throw new ErrorAplicacion(404, 'El artículo no tiene registro de stock');
            }
            const fila = stock.rows[0];
            if (!fila.alcanza) {
                throw new ErrorAplicacion(
                    400,
                    `La merma (${cantidad}) supera el stock disponible (${fila.disponible}). No se registró.`
                );
            }

            const descuento = await cliente.query<{ disponible: string }>(
                `UPDATE articulos_stock
                 SET cantidad_disponible = cantidad_disponible - $2::numeric
                 WHERE id_articulo = $1
                 RETURNING cantidad_disponible::text AS disponible`,
                [idArticulo, cantidad]
            );
            const disponibleNuevo = descuento.rows[0].disponible;

            const merma = await cliente.query<{ id_merma: number; precio: string; perdida: string }>(
                `INSERT INTO mermas (id_insumo, precio_unitario, cantidad_baja, id_usuario,
                                     observacion_merma, perdida_valor_total, motivo_merma)
                 VALUES ($1, $2::numeric, $3::numeric, $4, $5, ROUND($3::numeric * $2::numeric, 2), $6)
                 RETURNING id_merma, precio_unitario::text AS precio, perdida_valor_total::text AS perdida`,
                [idArticulo, fila.pmp, cantidad, idUsuario, observacion, motivo]
            );
            const { id_merma: idMerma, precio, perdida } = merma.rows[0];

            // Salida por merma en el Cardex (el enum de movimientos no tiene "Merma": destino = 'merma')
            await cliente.query(
                `INSERT INTO movimientos_inventario (id_insumo, tipo_movimiento, destino_bolsa, cantidad,
                     costo_unitario, saldo_historico, pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, 'Salida', 'merma', $2::numeric, $3::numeric, $4::numeric, $3::numeric,
                         ROUND($4::numeric * $3::numeric, 2), $5, $6)`,
                [idArticulo, cantidad, precio, disponibleNuevo, `Merma #${idMerma} - ${motivo}`, idUsuario]
            );

            const alerta = await cliente.query(
                `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
                 VALUES ('merma_registrada', 'amarillo', $1, $2, $3, NULL, FALSE)
                 RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, leida`,
                [
                    `Merma registrada: ${fila.sku}`,
                    `Merma #${idMerma} por ${motivo}: ${cantidad} de ${fila.nombre}. Pérdida valorizada a PMP: $${perdida}. Stock disponible: ${disponibleNuevo}.`,
                    idArticulo,
                ]
            );

            await registrarAuditoria(
                {
                    entidad: 'merma',
                    accion: 'registrar_merma',
                    idRegistro: idMerma,
                    idUsuarioEjecutor: idUsuario,
                    estadoAnterior: { disponible: fila.disponible },
                    estadoNuevo: { disponible: disponibleNuevo, perdida_valor_total: perdida },
                },
                cliente
            );

            return { idMerma, precio, perdida, disponibleNuevo, alerta: alerta.rows[0] };
        });

        res.status(201).json({
            mensaje: 'Merma registrada: stock descontado, salida en Cardex y alerta enviada al Administrador',
            id_merma: resultado.idMerma,
            precio_unitario: resultado.precio,
            perdida_valor_total: resultado.perdida,
            stock_disponible_nuevo: resultado.disponibleNuevo,
            alerta: resultado.alerta,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar la merma');
    }
};
