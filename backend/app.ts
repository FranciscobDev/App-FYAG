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
import verificarToken from './middleware/authMiddleware';
import cardexRoutes from './routes/cardexRoutes';

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

export default app;
