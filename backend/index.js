require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const articuloRoutes = require('./routes/articuloRoutes');
const proveedorRoutes = require('./routes/proveedorRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const proyectoRoutes = require('./routes/proyectoRoutes');
const authRoutes = require('./routes/authRoutes');
const verificarToken = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Público: solo el login
app.use('/api/auth', authRoutes);

// Protegido: requiere token en el encabezado Authorization
app.use('/api/articulos', verificarToken, articuloRoutes);
app.use('/api/proveedores', verificarToken, proveedorRoutes);
app.use('/api/usuarios', verificarToken, usuarioRoutes);
app.use('/api/proyectos', verificarToken, proyectoRoutes);

const probarConexion = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('--------------------------------------------------');
        console.log('✅ Conexión a PostgreSQL establecida exitosamente');
        console.log(`🕒 Hora actual del servidor DB: ${res.rows[0].now}`);
        console.log('--------------------------------------------------');
    } catch (err) {
        console.error('❌ Error al conectar a PostgreSQL:', err.message);
    }
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor en puerto ${PORT}`);
    probarConexion();
});