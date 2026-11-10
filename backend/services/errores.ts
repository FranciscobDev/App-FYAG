import type { Response } from 'express';

/**
 * Error controlado de negocio: el controlador lo traduce a la respuesta HTTP indicada.
 * Cualquier otro error se considera interno (500).
 */
export class ErrorAplicacion extends Error {
    constructor(public readonly estado: number, mensaje: string) {
        super(mensaje);
        this.name = 'ErrorAplicacion';
    }
}

/** Traduce un error a respuesta HTTP: ErrorAplicacion conserva su estado; el resto es 500. */
export const enviarErrorHttp = (res: Response, error: unknown, mensajeInterno: string): void => {
    if (error instanceof ErrorAplicacion) {
        res.status(error.estado).json({ mensaje: error.message });
        return;
    }
    console.error(mensajeInterno, error);
    res.status(500).json({ error: mensajeInterno });
};
