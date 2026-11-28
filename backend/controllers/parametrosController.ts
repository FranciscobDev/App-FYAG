import { Request, Response } from 'express';
import { actualizarParametro, listarParametros } from '../services/parametros';
import { enviarErrorHttp } from '../services/errores';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';

// GET /parametros
export const obtenerParametros = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json(await listarParametros());
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar los parámetros');
    }
};

// PUT /parametros/:clave   body: { valor }
// La validación de rango ocurre en el servicio, antes del UPDATE; un valor inválido no deja auditoría.
export const modificarParametro = async (
    req: Request<{ clave: string }, unknown, { valor?: unknown }>,
    res: Response
): Promise<void> => {
    if (req.body?.valor === undefined) {
        res.status(400).json({ mensaje: 'Debes indicar el nuevo valor del parámetro' });
        return;
    }

    try {
        const parametro = await actualizarParametro(req.params.clave, req.body.valor, obtenerIdEjecutor(req));
        res.status(200).json({ mensaje: 'Parámetro actualizado correctamente', parametro });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error interno al actualizar el parámetro');
    }
};
