require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const articuloRoutes = require('./routes/articuloRoutes');
const proveedorRoutes = require('./routes/proveedorRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const proyectoRoutes = require('./routes/proyectoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rutas de la API
app.use('/api/articulos', articuloRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/proyectos', proyectoRoutes);

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