import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import pool from './config/db';
import articuloRoutes from './routes/articuloRoutes';
import proveedorRoutes from './routes/proveedorRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import proyectoRoutes from './routes/proyectoRoutes';
import authRoutes from './routes/authRoutes';
import verificarToken from './middleware/authMiddleware';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

// Público: solo el login
app.use('/api/auth', authRoutes);

// Protegido: requiere token en el encabezado Authorization
app.use('/api/articulos', verificarToken, articuloRoutes);
app.use('/api/proveedores', verificarToken, proveedorRoutes);
app.use('/api/usuarios', verificarToken, usuarioRoutes);
app.use('/api/proyectos', verificarToken, proyectoRoutes);

const probarConexion = async (): Promise<void> => {
    try {
        const res = await pool.query<{ now: Date }>('SELECT NOW()');
        console.log('--------------------------------------------------');
        console.log('✅ Conexión a PostgreSQL establecida exitosamente');
        console.log(`🕒 Hora actual del servidor DB: ${res.rows[0].now}`);
        console.log('--------------------------------------------------');
    } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        console.error('❌ Error al conectar a PostgreSQL:', mensaje);
    }
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en puerto ${PORT}`);
    probarConexion();
});

