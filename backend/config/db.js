const { Pool } = require('pg');
const { types } = require('pg');
types.setTypeParser(1082, (valor) => valor);
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
});

module.exports = pool;