import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import articuloRoutes from './routes/articuloRoutes';
import proveedorRoutes from './routes/proveedorRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import proyectoRoutes from './routes/proyectoRoutes';
import parametrosRoutes from './routes/parametrosRoutes';
import verificarToken from './middleware/authMiddleware';

/** Aplicación Express sin arrancar el servidor (permite probarla con pruebas de integración). */
export const app = express();

app.use(cors());
app.use(express.json());

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
app.use('/api/parametros', verificarToken, parametrosRoutes);

export default app;
