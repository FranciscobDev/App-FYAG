import { ErrorAplicacion } from './errores';

export type CodigoErrorRespaldo =
    | 'CLOUD_AUTH'
    | 'CLOUD_CONNECTION'
    | 'CLOUD_NOT_CONFIGURED'
    | 'NO_CIFRADO'
    | 'ERROR_DESCONOCIDO';

/** Error tipado que el ejecutor de respaldo puede lanzar para clasificar la causa del fallo. */
export class ErrorRespaldo extends Error {
    constructor(public readonly codigo: CodigoErrorRespaldo, mensaje: string) {
        super(mensaje);
        this.name = 'ErrorRespaldo';
    }
}

export interface ContextoRespaldo {
    dias_retencion: number;
}

export interface ResultadoRespaldo {
    tamano_bytes: number;
    ubicacion_nube: string;
    cifrado: boolean;
}

/** Quien realmente vuelca la BD, cifra y sube a la nube (pg_dump + cifrado + proveedor cloud). */
export type EjecutorRespaldo = (ctx: ContextoRespaldo) => Promise<ResultadoRespaldo>;

/** Sin integración con la nube configurada el respaldo FALLA de forma explícita (nunca "éxito" silencioso). */
export const ejecutorRespaldoPorDefecto: EjecutorRespaldo = async () => {
    throw new ErrorRespaldo(
        'CLOUD_NOT_CONFIGURED',
        'No hay un ejecutor de respaldo en la nube configurado (pg_dump + cifrado + subida)'
    );
};

let ejecutorActual: EjecutorRespaldo = ejecutorRespaldoPorDefecto;
export const obtenerEjecutorRespaldo = (): EjecutorRespaldo => ejecutorActual;
export const fijarEjecutorRespaldo = (nuevo?: EjecutorRespaldo): void => {
    ejecutorActual = nuevo ?? ejecutorRespaldoPorDefecto;
};

export const clasificarErrorRespaldo = (e: unknown): { codigo: CodigoErrorRespaldo; mensaje: string } => {
    if (e instanceof ErrorRespaldo) return { codigo: e.codigo, mensaje: e.message.slice(0, 500) };
    const mensaje = e instanceof Error ? e.message : String(e);
    return { codigo: 'ERROR_DESCONOCIDO', mensaje: mensaje.slice(0, 500) };
};

const MS_HORA = 3600 * 1000;
const MS_DIA = 24 * MS_HORA;

/** RPO: el último respaldo exitoso no puede tener más de N horas (24 por defecto). */
export const evaluarRpo = (ultimoExito: Date | string | null, horasMax: number, ahoraMs: number) => {
    if (!ultimoExito) return { cumple: false, horas_desde_ultimo_exito: null as number | null };
    const horas = (ahoraMs - new Date(ultimoExito).getTime()) / MS_HORA;
    return { cumple: horas <= horasMax, horas_desde_ultimo_exito: Math.round(horas * 10) / 10 };
};

/** Prueba de restauración al menos cada N días (trimestre = 90). Solo cuentan las exitosas. */
export const evaluarPruebaRestauracion = (ultimaExitosa: Date | string | null, diasMax: number, ahoraMs: number) => {
    if (!ultimaExitosa) return { vigente: false, dias_desde_ultima: null as number | null };
    const dias = Math.floor((ahoraMs - new Date(ultimaExitosa).getTime()) / MS_DIA);
    return { vigente: dias <= diasMax, dias_desde_ultima: dias };
};

/** RTO: la restauración debe completarse en N horas (4 por defecto). */
export const cumpleRto = (minutos: number, horasMax: number): boolean => minutos <= horasMax * 60;

export interface DatosPruebaRestauracion {
    fecha_prueba: string;
    resultado: 'exitosa' | 'fallida';
    tiempo_recuperacion_min: number;
    observaciones: string | null;
    id_respaldo: number | null;
}

export const validarPruebaRestauracion = (b: Record<string, unknown>, hoy: string): DatosPruebaRestauracion => {
    const fecha = String(b.fecha_prueba ?? hoy);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
        throw new ErrorAplicacion(400, 'fecha_prueba debe tener formato AAAA-MM-DD');
    }
    if (fecha > hoy) throw new ErrorAplicacion(400, 'La fecha de la prueba no puede ser futura');
    const resultado = String(b.resultado ?? '').toLowerCase();
    if (resultado !== 'exitosa' && resultado !== 'fallida') {
        throw new ErrorAplicacion(400, 'resultado debe ser "exitosa" o "fallida"');
    }
    const min = Number(b.tiempo_recuperacion_min);
    if (!Number.isInteger(min) || min < 0) {
        throw new ErrorAplicacion(400, 'tiempo_recuperacion_min debe ser un entero de minutos (>= 0)');
    }
    const obs = b.observaciones != null ? String(b.observaciones).trim().slice(0, 500) : '';
    if (resultado === 'fallida' && !obs) {
        throw new ErrorAplicacion(400, 'Una prueba fallida requiere observaciones que documenten la causa');
    }
    const idResp = b.id_respaldo != null && b.id_respaldo !== '' ? Number(b.id_respaldo) : null;
    if (idResp !== null && (!Number.isInteger(idResp) || idResp <= 0)) {
        throw new ErrorAplicacion(400, 'id_respaldo debe ser un entero positivo');
    }
    return { fecha_prueba: fecha, resultado, tiempo_recuperacion_min: min, observaciones: obs || null, id_respaldo: idResp };
};

/** Milisegundos hasta la próxima ventana de baja actividad (hora local, 02:00 por defecto). */
export const msHastaProximaVentana = (ahora: Date, hora = 2): number => {
    const prox = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hora, 0, 0, 0);
    if (prox.getTime() <= ahora.getTime()) prox.setDate(prox.getDate() + 1);
    return prox.getTime() - ahora.getTime();
};
