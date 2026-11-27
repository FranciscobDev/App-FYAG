import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    MAX_ITEMS_POR_PAGINA,
    cabecerasSeguridadHttp,
    crearRateLimiter,
    exigirHttpsEnProduccion,
    manejadorErroresGlobal,
    middlewarePaginacionListados,
    obtenerIpCliente,
    proteccionCsrfMutaciones,
    sanitizarUrlParaLog,
} from '../middleware/seguridadHttp';
import { resolverSslBaseDatos, validarConfiguracionEntorno } from '../config/entorno';
import { cifrarDatoSensible, descifrarDatoSensible, estaCifradoEnReposo } from '../services/cifradoReposo';
import { purgarDatosAutenticacionExpirados } from '../services/sesiones';
import { detectarMimePorMagicBytes, esBinarioImagenSeguro, validarRegistroEntrante } from '../services/sincronizacionService';

const crearResSimulada = () => {
    const cabeceras = new Map<string, string>();
    let codigoEstado = 200;
    let cuerpoJson: any = null;
    let redireccion: { codigo: number; url: string } | null = null;

    const res: any = {
        removeHeader: (nombre: string) => {
            cabeceras.delete(nombre.toLowerCase());
        },
        setHeader: (nombre: string, valor: string) => {
            cabeceras.set(nombre.toLowerCase(), valor);
        },
        getHeader: (nombre: string) => cabeceras.get(nombre.toLowerCase()),
        redirect: (codigo: number, url: string) => {
            codigoEstado = codigo;
            redireccion = { codigo, url };
            return res;
        },
        status: (codigo: number) => {
            codigoEstado = codigo;
            return res;
        },
        json: (datos: any) => {
            cuerpoJson = datos;
            return res;
        },
    };

    return {
        res,
        cabeceras,
        obtenerEstado: () => codigoEstado,
        obtenerCuerpo: () => cuerpoJson,
        obtenerRedireccion: () => redireccion,
    };
};

test('cabecerasSeguridadHttp fija cabeceras tipo Helmet, X-API-Version y oculta X-Powered-By', () => {
    const { res, cabeceras } = crearResSimulada();
    res.setHeader('X-Powered-By', 'Express');
    let llamadoNext = false;

    cabecerasSeguridadHttp({} as any, res, () => {
        llamadoNext = true;
    });

    assert.equal(llamadoNext, true);
    assert.equal(cabeceras.has('x-powered-by'), false);
    assert.equal(cabeceras.get('x-content-type-options'), 'nosniff');
    assert.equal(cabeceras.get('x-frame-options'), 'DENY');
    assert.equal(cabeceras.get('referrer-policy'), 'no-referrer');
    assert.equal(cabeceras.get('cross-origin-resource-policy'), 'same-site');
    assert.equal(cabeceras.get('x-api-version'), 'v1');
    assert.ok(cabeceras.get('content-security-policy')?.includes("frame-ancestors 'none'"));
});

test('exigirHttpsEnProduccion redirige GET HTTP a HTTPS (301) y bloquea POST sobre HTTP plano (403)', () => {
    const envOriginal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        // 1. GET sobre HTTP plano -> 301 a https://
        const reqGet: any = {
            method: 'GET',
            originalUrl: '/api/v1/articulos?page=1',
            secure: false,
            headers: { host: 'api.fyag.cl', 'x-forwarded-proto': 'http' },
        };
        const capGet = crearResSimulada();
        let pasoGet = false;
        exigirHttpsEnProduccion(reqGet, capGet.res, () => {
            pasoGet = true;
        });
        assert.equal(pasoGet, false);
        assert.deepEqual(capGet.obtenerRedireccion(), {
            codigo: 301,
            url: 'https://api.fyag.cl/api/v1/articulos?page=1',
        });

        // 2. POST sobre HTTP plano -> 403 HTTPS_REQUIRED
        const reqPost: any = {
            method: 'POST',
            originalUrl: '/api/v1/auth/login',
            secure: false,
            headers: { host: 'api.fyag.cl' },
        };
        const capPost = crearResSimulada();
        exigirHttpsEnProduccion(reqPost, capPost.res, () => {});
        assert.equal(capPost.obtenerEstado(), 403);
        assert.equal(capPost.obtenerCuerpo().codigo, 'HTTPS_REQUIRED');

        // 3. Petición con x-forwarded-proto: https pasa
        const reqHttps: any = {
            method: 'POST',
            originalUrl: '/api/v1/auth/login',
            secure: false,
            headers: { 'x-forwarded-proto': 'https' },
        };
        const capHttps = crearResSimulada();
        let pasoHttps = false;
        exigirHttpsEnProduccion(reqHttps, capHttps.res, () => {
            pasoHttps = true;
        });
        assert.equal(pasoHttps, true);
    } finally {
        process.env.NODE_ENV = envOriginal;
    }
});

test('proteccionCsrfMutaciones rechaza orígenes cruzados no autorizados y formularios HTML sin sesión', () => {
    const csrf = proteccionCsrfMutaciones(['https://app.fyag.cl']);

    // 1. Origen externo malicioso en POST -> 403 CSRF_ORIGIN_FORBIDDEN
    const capOrigen = crearResSimulada();
    let paso1 = false;
    csrf(
        { method: 'POST', headers: { origin: 'https://sitio-atacante.com', 'content-type': 'application/json' } } as any,
        capOrigen.res,
        () => {
            paso1 = true;
        }
    );
    assert.equal(paso1, false);
    assert.equal(capOrigen.obtenerEstado(), 403);
    assert.equal(capOrigen.obtenerCuerpo().codigo, 'CSRF_ORIGIN_FORBIDDEN');

    // 2. Formulario HTML application/x-www-form-urlencoded sin Authorization -> 403
    const capForm = crearResSimulada();
    let paso2 = false;
    csrf(
        { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } } as any,
        capForm.res,
        () => {
            paso2 = true;
        }
    );
    assert.equal(paso2, false);
    assert.equal(capForm.obtenerEstado(), 403);
    assert.equal(capForm.obtenerCuerpo().codigo, 'CSRF_CONTENT_TYPE_FORBIDDEN');

    // 3. Petición legítima desde https://app.fyag.cl con application/json -> pasa
    const capOk = crearResSimulada();
    let paso3 = false;
    csrf(
        { method: 'POST', headers: { origin: 'https://app.fyag.cl', 'content-type': 'application/json' } } as any,
        capOk.res,
        () => {
            paso3 = true;
        }
    );
    assert.equal(paso3, true);
});

test('crearRateLimiter limita tanto por IP como por id de usuario autenticado aunque cambie de IP', () => {
    let reloj = 1_000_000;
    const limiter = crearRateLimiter({
        ventanaMs: 60_000,
        maxPeticiones: 2,
        porUsuarioOIp: true,
        codigo: 'TEST_LIMIT',
        ahora: () => reloj,
    });

    // El mismo usuario #42 envía peticiones desde 3 IPs distintas: la 3.ª es bloqueada por su id de usuario
    const reqUserIpA: any = { usuario: { id: 42, rol: 'Tecnico' }, headers: { 'x-forwarded-for': '203.0.113.1' } };
    const reqUserIpB: any = { usuario: { id: 42, rol: 'Tecnico' }, headers: { 'x-forwarded-for': '203.0.113.2' } };
    const reqUserIpC: any = { usuario: { id: 42, rol: 'Tecnico' }, headers: { 'x-forwarded-for': '203.0.113.3' } };

    limiter(reqUserIpA, crearResSimulada().res, () => {});
    limiter(reqUserIpB, crearResSimulada().res, () => {});

    const cap3 = crearResSimulada();
    let paso3 = false;
    limiter(reqUserIpC, cap3.res, () => {
        paso3 = true;
    });
    assert.equal(paso3, false);
    assert.equal(cap3.obtenerEstado(), 429);

    // Otro usuario #99 desde la misma IP 203.0.113.1 sí pasa
    const reqOtroUser: any = { usuario: { id: 99, rol: 'Tecnico' }, headers: { 'x-forwarded-for': '203.0.113.1' } };
    let pasoOtro = false;
    limiter(reqOtroUser, crearResSimulada().res, () => {
        pasoOtro = true;
    });
    assert.equal(pasoOtro, true);

    reloj += 61_000;
    let pasoDespues = false;
    limiter(reqUserIpA, crearResSimulada().res, () => {
        pasoDespues = true;
    });
    assert.equal(pasoDespues, true);
});

test('middlewarePaginacionListados pagina con ?page=&limit= y aplica tope máximo de seguridad', () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));

    // 1. Con ?page=2&limit=10 devuelve los elementos 11..20 y expone X-Total-Count=250
    const reqPaginado: any = { method: 'GET', query: { page: '2', limit: '10' } };
    const capPaginado = crearResSimulada();
    middlewarePaginacionListados(reqPaginado, capPaginado.res, () => {});
    capPaginado.res.json(items);

    assert.equal(capPaginado.cabeceras.get('x-total-count'), '250');
    assert.equal(capPaginado.cabeceras.get('x-page-limit'), '10');
    assert.equal(capPaginado.cabeceras.get('x-page-offset'), '10');
    assert.equal(capPaginado.obtenerCuerpo().length, 10);
    assert.equal(capPaginado.obtenerCuerpo()[0].id, 11);

    // 2. Sin query params pero superando MAX_ITEMS_POR_PAGINA (200), acota a 200
    const reqSinQuery: any = { method: 'GET', query: {} };
    const capTope = crearResSimulada();
    middlewarePaginacionListados(reqSinQuery, capTope.res, () => {});
    capTope.res.json(items);
    assert.equal(capTope.obtenerCuerpo().length, MAX_ITEMS_POR_PAGINA);
});

test('manejadorErroresGlobal devuelve respuestas genéricas sin exponer stack traces ni detalles SQL', () => {
    const errorSqlInterno = new Error('SELECT * FROM usuario WHERE contrasena_hash = ...');
    errorSqlInterno.stack = 'Error: SELECT ...\n    at PoolClient.query (/app/db.ts:12:3)';

    const cap500 = crearResSimulada();
    manejadorErroresGlobal(errorSqlInterno, {} as any, cap500.res, () => {});

    assert.equal(cap500.obtenerEstado(), 500);
    const cuerpo = JSON.stringify(cap500.obtenerCuerpo());
    assert.equal(cuerpo.includes('SELECT'), false);
    assert.equal(cuerpo.includes('stack'), false);
    assert.equal(cap500.obtenerCuerpo().error, 'Error interno del servidor');
});

test('sanitizarUrlParaLog redacta tokens y contraseñas en query strings y obtenerIpCliente toma el primer salto', () => {
    const url = '/api/auth/restablecer-clave?token=secreto123&vista=compacta&password_reset=abc';
    const limpia = sanitizarUrlParaLog(url);

    assert.equal(limpia.includes('secreto123'), false);
    assert.equal(limpia.includes('abc'), false);
    assert.equal(limpia.includes('vista=compacta'), true);
    assert.equal(
        obtenerIpCliente({ headers: { 'x-forwarded-for': ' 190.45.12.8 , 172.16.0.1 ' } } as any),
        '190.45.12.8'
    );
});

test('Base de datos: validarConfiguracionEntorno rechaza superusuarios (postgres/root) en producción y activa TLS', () => {
    const baseProd = {
        NODE_ENV: 'production',
        PORT: '3000',
        JWT_SECRET: 'secreto-super-seguro-de-al-menos-32-caracteres',
        DB_HOST: 'db.privada.fyag.internal',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASSWORD: 'clave-db-produccion',
        DB_DATABASE: 'fyag_db',
        CORS_ORIGIN: 'https://app.fyag.cl',
        SMTP_HOST: 'smtp.fyag.cl',
        SMTP_PORT: '587',
        SMTP_USER: 'alertas@fyag.cl',
        SMTP_PASS: 'clave-smtp',
    };

    assert.throws(
        () => validarConfiguracionEntorno(baseProd),
        /superusuario "postgres"/
    );

    const cfgValida = validarConfiguracionEntorno({ ...baseProd, DB_USER: 'fyag_app' });
    assert.equal(cfgValida.dbUser, 'fyag_app');
    assert.equal(cfgValida.dbSsl, true);
    assert.deepEqual(resolverSslBaseDatos({ NODE_ENV: 'production' }), { rejectUnauthorized: true });
    assert.equal(resolverSslBaseDatos({ NODE_ENV: 'development' }), false);
});

test('Cifrado en reposo AES-256-GCM: cifra con IV aleatorio, descifra exactamente y detecta manipulación', () => {
    const clave = 'clave-maestra-de-cifrado-en-reposo-32-chars';
    const datoOriginal = 'Cuenta Corriente 00-123-45678-9 • Banco Estado • RUT 76.543.210-K';

    const cifrado1 = cifrarDatoSensible(datoOriginal, clave);
    const cifrado2 = cifrarDatoSensible(datoOriginal, clave);

    assert.equal(estaCifradoEnReposo(cifrado1), true);
    assert.equal(cifrado1.includes('76.543.210-K'), false);
    // Dos cifrados del mismo texto producen salidas distintas por el IV aleatorio de 12 bytes
    assert.notEqual(cifrado1, cifrado2);

    assert.equal(descifrarDatoSensible(cifrado1, clave), datoOriginal);
    assert.equal(descifrarDatoSensible(cifrado2, clave), datoOriginal);

    // Si el texto cifrado o el tag GCM es alterado, lanza error de integridad autenticada
    const adulterado = `${cifrado1.slice(0, -4)}AAAA`;
    assert.throws(() => descifrarDatoSensible(adulterado, clave));
});

test('Retención y minimización: purgarDatosAutenticacionExpirados elimina desafíos 2FA, enlaces y sesiones caducadas', async () => {
    const consultas: string[] = [];
    const clienteMock: any = {
        query: async (sql: string) => {
            consultas.push(sql);
            if (sql.includes('retencion:purgar-2fa')) return { rowCount: 4, rows: [] };
            if (sql.includes('retencion:purgar-tokens-clave')) return { rowCount: 2, rows: [] };
            if (sql.includes('retencion:purgar-sesiones')) return { rowCount: 9, rows: [] };
            return { rowCount: 0, rows: [] };
        },
    };

    const resultado = await purgarDatosAutenticacionExpirados(clienteMock, 30);

    assert.equal(resultado.desafios_2fa_eliminados, 4);
    assert.equal(resultado.tokens_recuperacion_eliminados, 2);
    assert.equal(resultado.sesiones_antiguas_eliminadas, 9);
    assert.equal(consultas.length, 3);
});

test('Archivos subidos: detecta magic bytes reales y rechaza SVG con <script>, ejecutables MZ y PDFs disfrazados de imagen', () => {
    const jpegReal = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const pngReal = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const pdfDisfrazado = Buffer.from('%PDF-1.7 contenido pdf', 'utf8');
    const exeDisfrazado = Buffer.from('MZ\x90\x00\x03\x00\x00\x00ejecutable', 'binary');
    const svgConXss = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8');

    assert.equal(detectarMimePorMagicBytes(jpegReal), 'image/jpeg');
    assert.equal(detectarMimePorMagicBytes(pngReal), 'image/png');
    assert.equal(detectarMimePorMagicBytes(pdfDisfrazado), 'application/pdf');

    assert.equal(esBinarioImagenSeguro(jpegReal, 'image/jpeg'), true);
    assert.equal(esBinarioImagenSeguro(pngReal, 'image/png'), true);
    assert.equal(esBinarioImagenSeguro(pdfDisfrazado, 'image/png'), false);
    assert.equal(esBinarioImagenSeguro(exeDisfrazado, 'image/jpeg'), false);
    assert.equal(esBinarioImagenSeguro(svgConXss, 'image/svg+xml'), false);
    assert.equal(esBinarioImagenSeguro(svgConXss, 'image/png'), false);

    // validarRegistroEntrante rechaza una foto con payload SVG/script disfrazado de image/png
    const validacionXss = validarRegistroEntrante({
        tipo_registro: 'hoja_servicio',
        id_local: 'id-1',
        id_envio: 'env-1',
        base_version: 0,
        datos: { receptor: 'Obra' },
        fotos: [
            {
                nombre: 'trampa.png',
                mime_type: 'image/png',
                contenido_base64: svgConXss.toString('base64'),
            },
        ],
    });
    assert.equal(validacionXss.ok, false);
    if (!validacionXss.ok) {
        assert.equal(validacionXss.codigo, 'FOTO_INVALIDA');
    }
});
