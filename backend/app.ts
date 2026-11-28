import express, { Router } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import articuloRoutes from './routes/articuloRoutes';
import proveedorRoutes from './routes/proveedorRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import proyectoRoutes from './routes/proyectoRoutes';
import kitRoutes from './routes/kitRoutes';
import clienteRoutes from './routes/clienteRoutes';
import parametrosRoutes from './routes/parametrosRoutes';
import ordenCompraRoutes from './routes/ordenCompraRoutes';
import solicitudRoutes from './routes/solicitudRoutes';
import devolucionRoutes from './routes/devolucionRoutes';
import sincronizacionRoutes from './routes/sincronizacionRoutes';
import cardexRoutes from './routes/cardexRoutes';
import conteoFisicoRoutes from './routes/conteoFisicoRoutes';
import devolucionProveedorRoutes from './routes/devolucionProveedorRoutes';
import mermaRoutes from './routes/mermaRoutes';
import codigoQrRoutes from './routes/codigoQrRoutes';
import alertaRoutes from './routes/alertaRoutes';
import herramientaRoutes from './routes/herramientaRoutes';
import prestamoHerramientaRoutes from './routes/prestamoHerramientaRoutes';
import reporteRoutes from './routes/reporteRoutes';
import respaldoRoutes from './routes/respaldoRoutes';
import verificarToken from './middleware/authMiddleware';
import {
    cabecerasSeguridadHttp,
    exigirHttpsEnProduccion,
    limitadorGlobalApi,
    limitadorPorUsuarioApi,
    manejadorErroresGlobal,
    middlewarePaginacionListados,
    obtenerIpCliente,
    proteccionCsrfMutaciones,
    sanitizarUrlParaLog,
} from './middleware/seguridadHttp';
import { obtenerOrigenesCors } from './config/entorno';

/** Aplicación Express sin arrancar el servidor (permite probarla con pruebas de integración). */
export const app = express();
// Confía en el primer proxy inverso (Render / Railway / Cloudflare) para req.ip y req.secure
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cabecerasSeguridadHttp);
app.use(exigirHttpsEnProduccion);

const origenesPermitidos = obtenerOrigenesCors();
app.use(cors({
    origin: (origen, callback) => {
        callback(null, !origen || origenesPermitidos.includes(origen));
    },
    credentials: false,
}));

app.use('/api', limitadorGlobalApi);
app.use('/api', proteccionCsrfMutaciones(origenesPermitidos));
app.use('/api', middlewarePaginacionListados);

// El lote de sincronización lleva fotos en base64: tiene su propio límite de cuerpo (más alto) y se
// parsea DESPUÉS de validar el token, para no leer cuerpos grandes de peticiones sin sesión.
const analizadorJsonGeneral = express.json({ limit: '512kb' });
app.use((req, res, next) => {
    if (
        req.originalUrl.startsWith('/api/sincronizacion') ||
        req.originalUrl.startsWith('/api/v1/sincronizacion')
    ) {
        next();
        return;
    }
    analizadorJsonGeneral(req, res, next);
});

// Log de peticiones entrantes con IP, origen y URL sanitizada (sin filtrar tokens en query strings)
app.use((req, _res, next) => {
    if (process.env.NODE_ENV !== 'test') {
        const ip = obtenerIpCliente(req);
        const origen = typeof req.headers.origin === 'string' ? req.headers.origin : '-';
        const urlSegura = sanitizarUrlParaLog(req.originalUrl);
        console.log(`📡 [${new Date().toISOString()}] ${req.method} ${urlSegura} (ip=${ip}, origin=${origen})`);
    }
    next();
});

// Router versionado de la API (expuesto en /api/v1 y en /api para compatibilidad con clientes actuales)
const apiRouter = Router();

// Ruta pública de diagnóstico de conexión
apiRouter.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, version: 'v1', mensaje: 'Backend FYAG operativo' });
});

// Público: login, 2FA, refresh y flujo de recuperación de contraseña
apiRouter.use('/auth', authRoutes);

// Protegido: requiere token de acceso, sesión válida en servidor y límite de tasa por usuario autenticado
const autenticado = [verificarToken, limitadorPorUsuarioApi] as const;

apiRouter.use('/articulos', ...autenticado, articuloRoutes);
apiRouter.use('/proveedores', ...autenticado, proveedorRoutes);
apiRouter.use('/usuarios', ...autenticado, usuarioRoutes);
apiRouter.use('/proyectos', ...autenticado, proyectoRoutes);
apiRouter.use('/kits', ...autenticado, kitRoutes);
apiRouter.use('/clientes', ...autenticado, clienteRoutes);
apiRouter.use('/parametros', ...autenticado, parametrosRoutes);
apiRouter.use('/ordenes-compra', ...autenticado, ordenCompraRoutes);
apiRouter.use('/solicitudes', ...autenticado, solicitudRoutes);
apiRouter.use('/devoluciones', ...autenticado, devolucionRoutes);
apiRouter.use('/sincronizacion', ...autenticado, sincronizacionRoutes);
apiRouter.use('/cardex', ...autenticado, cardexRoutes);
apiRouter.use('/conteos', ...autenticado, conteoFisicoRoutes);
apiRouter.use('/conteos-fisicos', ...autenticado, conteoFisicoRoutes);
apiRouter.use('/devoluciones-proveedor', ...autenticado, devolucionProveedorRoutes);
apiRouter.use('/cuarentena', ...autenticado, devolucionProveedorRoutes);
apiRouter.use('/mermas', ...autenticado, mermaRoutes);
apiRouter.use('/codigos-qr', ...autenticado, codigoQrRoutes);
apiRouter.use('/alertas', ...autenticado, alertaRoutes);
apiRouter.use('/notificaciones', ...autenticado, alertaRoutes);
apiRouter.use('/herramientas', ...autenticado, herramientaRoutes);
apiRouter.use('/prestamos-herramientas', ...autenticado, prestamoHerramientaRoutes);
apiRouter.use('/reportes', ...autenticado, reporteRoutes);
apiRouter.use('/respaldos', ...autenticado, respaldoRoutes);

// Montaje en /api/v1 (versionado explícito) y /api (alias retrocompatible)
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Respuesta 404 genérica en JSON para endpoints inexistentes
app.use('/api', (_req, res) => {
    res.status(404).json({
        codigo: 'ENDPOINT_NOT_FOUND',
        mensaje: 'El recurso o endpoint solicitado no existe',
    });
});

// Manejador global de errores sin trazas de pila (stack traces)
app.use(manejadorErroresGlobal);

export default app;
