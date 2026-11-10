import nodemailer, { Transporter } from 'nodemailer';

export interface CorreoSaliente {
    para: string;
    asunto: string;
    texto: string;
}

export type EnviadorCorreo = (correo: CorreoSaliente) => Promise<void>;

let transporte: Transporter | null = null;

/**
 * Envío real por SMTP. Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Sin SMTP_HOST: en desarrollo imprime el contenido en consola; en producción falla,
 * para no perder enlaces de recuperación en silencio.
 */
const enviarCorreoSmtp: EnviadorCorreo = async ({ para, asunto, texto }) => {
    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SMTP_HOST no está configurado; no se pueden enviar correos');
        }
        console.log(`[CORREO-DEV] Para: ${para} | Asunto: ${asunto}\n${texto}`);
        return;
    }

    if (!transporte) {
        transporte = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
        });
    }

    await transporte.sendMail({
        from: process.env.SMTP_FROM || 'FYAG <no-responder@fyag.cl>',
        to: para,
        subject: asunto,
        text: texto,
    });
};

let enviador: EnviadorCorreo = enviarCorreoSmtp;

/** Punto de entrada único para correos salientes. */
export const enviarCorreo: EnviadorCorreo = (correo) => enviador(correo);

/**
 * Permite reemplazar el envío (pruebas de integración capturan el enlace sin SMTP).
 * Llamar sin argumento restaura el envío real.
 */
export const fijarEnviadorCorreo = (nuevo?: EnviadorCorreo): void => {
    enviador = nuevo ?? enviarCorreoSmtp;
};
