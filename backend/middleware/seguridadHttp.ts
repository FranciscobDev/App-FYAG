import { Request, Response, NextFunction } from 'express';
import { obtenerOrigenesCors } from '../config/entorno';

/**
 * Middleware de cabeceras de seguridad HTTP (equivalente ligero a Helmet sin dependencias externas).
 */
export const cabecerasSeguridadHttp = (_req: Request, res: Response, next: NextFunction): void => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-API-Version', 'v1');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
};

/**
 * En producción exige HTTPS obligatorio: redirige peticiones GET/HEAD con 301 a https://
 * y rechaza mutaciones sobre HTTP plano con 403.
 */
export const exigirHttpsEnProduccion = (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV !== 'production') {
        next();
        return;
    }

    const protoReenviado = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(protoReenviado)
        ? protoReenviado[0]
        : typeof protoReenviado === 'string'
          ? protoReenviado.split(',')[0].trim()
          : '';
    const esHttps = Boolean(req.secure) || proto.toLowerCase() === 'https';

    if (esHttps) {
        next();
        return;
    }

    const host = typeof req.headers.host === 'string' ? req.headers.host : '';
    if ((req.method === 'GET' || req.method === 'HEAD') && host) {
        res.redirect(301, `https://${host}${req.originalUrl}`);
        return;
    }

    res.status(403).json({
        codigo: 'HTTPS_REQUIRED',
        mensaje: 'Se requiere una conexión segura HTTPS en producción',
    });
};

const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Protección anti-CSRF para acciones que cambian estado:
 * - Si la petición incluye encabezado Origin o Referer (navegadores web), exige que pertenezca
 *   a la lista blanca explícita de orígenes permitidos.
 * - Rechaza peticiones de formulario HTML cross-site (application/x-www-form-urlencoded o multipart/form-data
 *   sin encabezado Authorization ni JSON).
 */
export const proteccionCsrfMutaciones = (
    origenesPermitidos: string[] = obtenerOrigenesCors()
) => {
    const conjuntoPermitidos = new Set(origenesPermitidos);

    return (req: Request, res: Response, next: NextFunction): void => {
        if (!METODOS_MUTACION.has(req.method.toUpperCase())) {
            next();
            return;
        }

        const origen = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
        if (origen && !conjuntoPermitidos.has(origen)) {
            res.status(403).json({
                codigo: 'CSRF_ORIGIN_FORBIDDEN',
                mensaje: 'Origen no autorizado para ejecutar esta operación',
            });
            return;
        }

        const contentType = typeof req.headers['content-type'] === 'string'
            ? req.headers['content-type'].toLowerCase()
            : '';
        const esFormularioSimple =
            contentType.startsWith('application/x-www-form-urlencoded') ||
            contentType.startsWith('multipart/form-data') ||
            contentType.startsWith('text/plain');

        if (esFormularioSimple && !req.headers.authorization) {
            res.status(403).json({
                codigo: 'CSRF_CONTENT_TYPE_FORBIDDEN',
                mensaje: 'Las operaciones de modificación requieren formato application/json',
            });
            return;
        }

        next();
    };
};

/**
 * Obtiene la IP del cliente de forma segura (primer salto de x-forwarded-for o socket.remoteAddress).
 */
export const obtenerIpCliente = (req: Request): string => {
    const reenviado = req.headers['x-forwarded-for'];
    if (typeof reenviado === 'string' && reenviado.trim()) {
        return reenviado.split(',')[0].trim();
    }
    if (Array.isArray(reenviado) && reenviado[0]) {
        return reenviado[0].split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'ip-desconocida';
};

/**
 * Sanitiza la URL antes de registrarla en logs para no filtrar tokens ni parámetros sensibles en query strings.
 */
export const sanitizarUrlParaLog = (originalUrl: string): string => {
    const indiceQuery = originalUrl.indexOf('?');
    if (indiceQuery === -1) return originalUrl;
    const ruta = originalUrl.slice(0, indiceQuery);
    const query = originalUrl.slice(indiceQuery + 1);
    const params = new URLSearchParams(query);
    const clavesSensibles = ['token', 'clave', 'contrasena', 'password', 'secret', 'jwt', 'codigo'];

    for (const clave of Array.from(params.keys())) {
        if (clavesSensibles.some((s) => clave.toLowerCase().includes(s))) {
            params.set(clave, '[REDACTADO]');
        }
    }
    const querySanitizada = params.toString();
    return querySanitizada ? `${ruta}?${querySanitizada}` : ruta;
};

export interface OpcionesRateLimit {
    ventanaMs: number;
    maxPeticiones: number;
    mensaje?: string;
    codigo?: string;
    /** Por defecto agrupa por usuario autenticado (si existe req.usuario.id) o por IP. */
    porUsuarioOIp?: boolean;
    ahora?: () => number;
}

interface RegistroVentana {
    contador: number;
    reiniciaEn: number;
}

const obtenerClaveRateLimit = (req: Request, porUsuarioOIp: boolean): string => {
    if (porUsuarioOIp && typeof req.usuario === 'object' && req.usuario && req.usuario.id) {
        return `user:${req.usuario.id}`;
    }
    return `ip:${obtenerIpCliente(req)}`;
};

/**
 * Crea un limitador de tasa por IP y/o por usuario autenticado con cabeceras estándar RateLimit-* y Retry-After.
 * Expone `.reiniciar()` para limpiar contadores en pruebas automatizadas.
 */
export const crearRateLimiter = (opciones: OpcionesRateLimit) => {
    const {
        ventanaMs,
        maxPeticiones,
        mensaje = 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
        codigo = 'RATE_LIMIT_EXCEEDED',
        porUsuarioOIp = true,
        ahora = () => Date.now(),
    } = opciones;

    const clientes = new Map<string, RegistroVentana>();

    const middleware = (req: Request, res: Response, next: NextFunction): void => {
        const instante = ahora();
        const clave = obtenerClaveRateLimit(req, porUsuarioOIp);

        if (clientes.size > 5000) {
            for (const [k, valor] of clientes.entries()) {
                if (valor.reiniciaEn <= instante) {
                    clientes.delete(k);
                }
            }
        }

        let registro = clientes.get(clave);
        if (!registro || registro.reiniciaEn <= instante) {
            registro = { contador: 0, reiniciaEn: instante + ventanaMs };
            clientes.set(clave, registro);
        }

        registro.contador += 1;
        const restantes = Math.max(0, maxPeticiones - registro.contador);
        const segundosRestantes = Math.max(1, Math.ceil((registro.reiniciaEn - instante) / 1000));

        res.setHeader('RateLimit-Limit', String(maxPeticiones));
        res.setHeader('RateLimit-Remaining', String(restantes));
        res.setHeader('RateLimit-Reset', String(segundosRestantes));

        if (registro.contador > maxPeticiones) {
            res.setHeader('Retry-After', String(segundosRestantes));
            res.status(429).json({
                codigo,
                mensaje,
                reintentar_en_segundos: segundosRestantes,
            });
            return;
        }

        next();
    };

    middleware.reiniciar = (): void => {
        clientes.clear();
    };

    return middleware;
};

/** Limitador global por IP: 300 peticiones por minuto por IP. */
export const limitadorGlobalApi = crearRateLimiter({
    ventanaMs: 60 * 1000,
    maxPeticiones: 300,
    porUsuarioOIp: false,
});

/** Limitador por usuario autenticado: 180 peticiones por minuto por cuenta. */
export const limitadorPorUsuarioApi = crearRateLimiter({
    ventanaMs: 60 * 1000,
    maxPeticiones: 180,
    porUsuarioOIp: true,
    codigo: 'USER_RATE_LIMIT_EXCEEDED',
    mensaje: 'Has superado el límite de peticiones por minuto para tu cuenta.',
});

/** Limitador estricto para /api/auth/login: 15 intentos cada 15 minutos por IP. */
export const limitadorLogin = crearRateLimiter({
    ventanaMs: 15 * 60 * 1000,
    maxPeticiones: 15,
    porUsuarioOIp: false,
    codigo: 'LOGIN_RATE_LIMIT',
    mensaje: 'Demasiados intentos de inicio de sesión desde esta IP. Espera unos minutos antes de reintentar.',
});

/** Limitador estricto para recuperación y restablecimiento de contraseña: 5 solicitudes cada 15 minutos por IP. */
export const limitadorRecuperacionClave = crearRateLimiter({
    ventanaMs: 15 * 60 * 1000,
    maxPeticiones: 5,
    porUsuarioOIp: false,
    codigo: 'RECOVERY_RATE_LIMIT',
    mensaje: 'Demasiadas solicitudes de recuperación de contraseña desde esta IP. Intenta nuevamente más tarde.',
});

export const MAX_ITEMS_POR_PAGINA = 200;

export interface ParametrosPaginacion {
    paginadoExplicito: boolean;
    limit: number;
    offset: number;
    page: number;
}

/**
 * Extrae y valida parámetros de paginación (?limit=&offset= o ?page=&limit=),
 * aplicando siempre un tope máximo de seguridad (MAX_ITEMS_POR_PAGINA = 200).
 */
export const resolverPaginacion = (query: Record<string, unknown> = {}): ParametrosPaginacion => {
    const tieneLimit = query.limit !== undefined && query.limit !== '';
    const tieneOffset = query.offset !== undefined && query.offset !== '';
    const tienePage = query.page !== undefined && query.page !== '';
    const paginadoExplicito = tieneLimit || tieneOffset || tienePage;

    const rawLimit = Number(query.limit);
    const limit =
        Number.isInteger(rawLimit) && rawLimit > 0
            ? Math.min(rawLimit, MAX_ITEMS_POR_PAGINA)
            : MAX_ITEMS_POR_PAGINA;

    const rawPage = Number(query.page);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

    const rawOffset = Number(query.offset);
    const offset =
        Number.isInteger(rawOffset) && rawOffset >= 0
            ? rawOffset
            : tienePage
              ? (page - 1) * limit
              : 0;

    return { paginadoExplicito, limit, offset, page };
};

/**
 * Middleware que acota automáticamente los listados JSON de arreglos en peticiones GET
 * según `?limit=&offset=` o `?page=&limit=` (y con tope de MAX_ITEMS_POR_PAGINA),
 * exponiendo el total y rango en las cabeceras `X-Total-Count`, `X-Page-Limit` y `X-Page-Offset`
 * sin romper el contrato de arreglo esperado por el cliente móvil/web.
 */
export const middlewarePaginacionListados = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
        next();
        return;
    }

    const jsonOriginal = res.json.bind(res);
    res.json = ((cuerpo: unknown) => {
        if (Array.isArray(cuerpo)) {
            const { paginadoExplicito, limit, offset } = resolverPaginacion(
                (req.query ?? {}) as Record<string, unknown>
            );
            res.setHeader('X-Total-Count', String(cuerpo.length));
            res.setHeader('X-Page-Limit', String(limit));
            res.setHeader('X-Page-Offset', String(offset));

            if (paginadoExplicito || cuerpo.length > MAX_ITEMS_POR_PAGINA) {
                return jsonOriginal(cuerpo.slice(offset, offset + limit));
            }
        }
        return jsonOriginal(cuerpo);
    }) as Response['json'];

    next();
};

/**
 * Manejador global de errores de Express: garantiza respuestas genéricas en producción,
 * sin filtrar jamás trazas de pila (stack traces) ni detalles internos de SQL o sintaxis.
 */
export const manejadorErroresGlobal = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
        res.status(413).json({
            codigo: 'PAYLOAD_TOO_LARGE',
            mensaje: 'El cuerpo de la petición supera el tamaño máximo permitido',
        });
        return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
            codigo: 'INVALID_JSON',
            mensaje: 'El cuerpo de la petición no contiene un JSON válido',
        });
        return;
    }

    const estado = Number.isInteger(err?.estado) && err.estado >= 400 && err.estado < 600 ? err.estado : 500;
    if (estado >= 500) {
        console.error('Error no controlado en Express:', err instanceof Error ? err.message : String(err));
        res.status(500).json({
            codigo: 'INTERNAL_SERVER_ERROR',
            error: 'Error interno del servidor',
        });
        return;
    }

    res.status(estado).json({
        mensaje: typeof err?.message === 'string' ? err.message : 'Solicitud inválida',
    });
};
