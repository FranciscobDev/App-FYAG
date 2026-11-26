import express from 'express';
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

/** Aplicación Express sin arrancar el servidor (permite probarla con pruebas de integración). */
export const app = express();

app.use(cors());

// El lote de sincronización lleva fotos en base64: tiene su propio límite de cuerpo (más alto) y se
// parsea DESPUÉS de validar el token, para no leer cuerpos grandes de peticiones sin sesión.
const analizadorJsonGeneral = express.json();
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/sincronizacion')) {
        next();
        return;
    }
    analizadorJsonGeneral(req, res, next);
});

// Log de peticiones entrantes para diagnóstico en desarrollo
app.use((req, _res, next) => {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Ruta pública de diagnóstico de conexión
app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, mensaje: 'Backend FYAG operativo' });
});

// Público: login y flujo de recuperación de contraseña
app.use('/api/auth', authRoutes);

// Protegido: requiere token y sesión válida en el encabezado Authorization
app.use('/api/articulos', verificarToken, articuloRoutes);
app.use('/api/proveedores', verificarToken, proveedorRoutes);
app.use('/api/usuarios', verificarToken, usuarioRoutes);
app.use('/api/proyectos', verificarToken, proyectoRoutes);
app.use('/api/kits', verificarToken, kitRoutes);
app.use('/api/clientes', verificarToken, clienteRoutes);
app.use('/api/parametros', verificarToken, parametrosRoutes);
app.use('/api/ordenes-compra', verificarToken, ordenCompraRoutes);
app.use('/api/solicitudes', verificarToken, solicitudRoutes);
app.use('/api/devoluciones', verificarToken, devolucionRoutes);
app.use('/api/sincronizacion', verificarToken, sincronizacionRoutes);
app.use('/api/cardex', verificarToken, cardexRoutes);
app.use('/api/conteos', verificarToken, conteoFisicoRoutes);
app.use('/api/conteos-fisicos', verificarToken, conteoFisicoRoutes);
app.use('/api/devoluciones-proveedor', verificarToken, devolucionProveedorRoutes);
app.use('/api/cuarentena', verificarToken, devolucionProveedorRoutes);
app.use('/api/mermas', verificarToken, mermaRoutes);
app.use('/api/codigos-qr', verificarToken, codigoQrRoutes);
app.use('/api/alertas', verificarToken, alertaRoutes);
app.use('/api/notificaciones', verificarToken, alertaRoutes);
app.use('/api/herramientas', verificarToken, herramientaRoutes);
app.use('/api/prestamos-herramientas', verificarToken, prestamoHerramientaRoutes);
app.use('/api/reportes', verificarToken, reporteRoutes);
app.use('/api/respaldos', verificarToken, respaldoRoutes);

export default app;
