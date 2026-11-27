export interface ConfiguracionEntorno {
    port: number;
    dbHost: string;
    dbUser: string;
    dbPassword: string;
    dbDatabase: string;
    dbPort: number;
    dbSsl: boolean;
    jwtSecret: string;
    corsOrigins: string[];
}

const USUARIOS_BD_PROHIBIDOS_PRODUCCION = new Set(['postgres', 'root', 'sa', 'superuser', 'rdsadmin']);

const leerRequerido = (entorno: NodeJS.ProcessEnv, clave: string): string => {
    const valor = entorno[clave]?.trim();
    if (!valor) {
        throw new Error(`Falta configurar la variable obligatoria ${clave}`);
    }
    return valor;
};

const leerPuerto = (entorno: NodeJS.ProcessEnv, clave: string, defecto?: number): number => {
    const valor = entorno[clave]?.trim();
    if (!valor && defecto !== undefined) return defecto;
    if (!valor || !/^\d+$/.test(valor)) {
        throw new Error(`${clave} debe ser un puerto numérico entre 1 y 65535`);
    }
    const puerto = Number(valor);
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
        throw new Error(`${clave} debe ser un puerto numérico entre 1 y 65535`);
    }
    return puerto;
};

export const validarOrigenesCors = (valor: string): string[] => {
    const origenes = valor.split(',').map((origen) => origen.trim()).filter(Boolean);
    if (origenes.length === 0) {
        throw new Error('CORS_ORIGIN debe incluir al menos un origen permitido');
    }

    return origenes.map((origen) => {
        let url: URL;
        try {
            url = new URL(origen);
        } catch {
            throw new Error('CORS_ORIGIN contiene un origen inválido');
        }

        if (
            (url.protocol !== 'http:' && url.protocol !== 'https:') ||
            url.origin !== origen.replace(/\/$/, '') ||
            url.username ||
            url.password
        ) {
            throw new Error('CORS_ORIGIN debe contener únicamente orígenes HTTP o HTTPS, sin rutas');
        }
        return url.origin;
    });
};

export const obtenerOrigenesCors = (entorno: NodeJS.ProcessEnv = process.env): string[] => {
    const configurado = entorno.CORS_ORIGIN?.trim();
    if (configurado) return validarOrigenesCors(configurado);
    if (entorno.NODE_ENV === 'production') {
        throw new Error('Falta configurar la variable obligatoria CORS_ORIGIN');
    }
    return ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006'];
};

/**
 * Resuelve la configuración TLS/SSL para PostgreSQL:
 * - En producción activa TLS por defecto (salvo que DB_SSL="false" para red local aislada).
 * - En desarrollo se activa si DB_SSL="true".
 */
export const resolverSslBaseDatos = (
    entorno: NodeJS.ProcessEnv = process.env
): false | { rejectUnauthorized: boolean; ca?: string } => {
    const produccion = entorno.NODE_ENV === 'production';
    const flag = entorno.DB_SSL?.trim().toLowerCase();
    const habilitarSsl = flag === 'true' || (produccion && flag !== 'false');

    if (!habilitarSsl) return false;

    const rejectUnauthorized = entorno.DB_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== 'false';
    const ca = entorno.DB_SSL_CA?.trim() || undefined;
    return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
};

export const validarConfiguracionEntorno = (
    entorno: NodeJS.ProcessEnv = process.env
): ConfiguracionEntorno => {
    const jwtSecret = leerRequerido(entorno, 'JWT_SECRET');
    if (jwtSecret.length < 32) {
        throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
    }

    const produccion = entorno.NODE_ENV === 'production';
    const dbHost = leerRequerido(entorno, 'DB_HOST');
    const dbUser = leerRequerido(entorno, 'DB_USER');
    const dbPassword = leerRequerido(entorno, 'DB_PASSWORD');
    const dbDatabase = leerRequerido(entorno, 'DB_DATABASE');
    const dbPort = leerPuerto(entorno, 'DB_PORT');
    const port = leerPuerto(entorno, 'PORT', 3000);
    const corsOrigins = obtenerOrigenesCors(entorno);

    if (produccion) {
        if (USUARIOS_BD_PROHIBIDOS_PRODUCCION.has(dbUser.toLowerCase())) {
            throw new Error(
                `DB_USER no puede ser el superusuario "${dbUser}" en producción; usa una cuenta de aplicación con permisos mínimos`
            );
        }
        leerRequerido(entorno, 'SMTP_HOST');
        leerPuerto(entorno, 'SMTP_PORT');
        leerRequerido(entorno, 'SMTP_USER');
        leerRequerido(entorno, 'SMTP_PASS');
    }

    return {
        port,
        dbHost,
        dbUser,
        dbPassword,
        dbDatabase,
        dbPort,
        dbSsl: Boolean(resolverSslBaseDatos(entorno)),
        jwtSecret,
        corsOrigins,
    };
};

export const obtenerJwtSecret = (): string => {
    const secreto = process.env.JWT_SECRET?.trim();
    if (!secreto || secreto.length < 32) {
        throw new Error('JWT_SECRET no está configurado correctamente');
    }
    return secreto;
};
