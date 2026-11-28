import nodemailer, { Transporter } from 'nodemailer';

export interface AdjuntoCorreo {
    filename: string;
    content: Buffer;
    contentType: string;
}

export interface CorreoSaliente {
    para: string;
    asunto: string;
    texto: string;
    html?: string;
    adjuntos?: AdjuntoCorreo[];
}

export type EnviadorCorreo = (correo: CorreoSaliente) => Promise<void>;

let transporte: Transporter | null = null;

/**
 * Envío real por SMTP. Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Sin SMTP_HOST: en desarrollo imprime el contenido en consola; en producción falla,
 * para no perder enlaces de recuperación ni órdenes de compra en silencio.
 */
const enviarCorreoSmtp: EnviadorCorreo = async ({ para, asunto, texto, html, adjuntos }) => {
    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SMTP_HOST no está configurado; no se pueden enviar correos');
        }
        const infoAdjuntos = adjuntos && adjuntos.length > 0
            ? ` | Adjuntos: ${adjuntos.map((a) => `${a.filename} (${a.contentType}, ${a.content.length} bytes)`).join(', ')}`
            : '';
        console.log(`[CORREO-DEV] Para: ${para} | Asunto: ${asunto}${infoAdjuntos}\n${texto}`);
        return;
    }

    if (!transporte) {
        transporte = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
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
        html,
        attachments: adjuntos?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
        })),
    });
};

let enviador: EnviadorCorreo = enviarCorreoSmtp;

/** Punto de entrada único para correos salientes. */
export const enviarCorreo: EnviadorCorreo = (correo) => enviador(correo);

/**
 * Permite reemplazar el envío (pruebas de integración capturan el correo y sus adjuntos PDF sin SMTP).
 * Llamar sin argumento restaura el envío real.
 */
export const fijarEnviadorCorreo = (nuevo?: EnviadorCorreo): void => {
    enviador = nuevo ?? enviarCorreoSmtp;
};
