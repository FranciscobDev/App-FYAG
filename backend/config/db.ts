import fs from 'fs';
import path from 'path';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import { resolverSslBaseDatos } from './entorno';

types.setTypeParser(1082, (valor: string) => valor);

// Carga backend/.env como fallback (soporta ejecución desde src/ con tsx y desde dist/ con node).
const rutaEnvUno = path.resolve(__dirname, '../.env');
const rutaEnvDos = path.resolve(__dirname, '../../.env');
dotenv.config({ path: fs.existsSync(rutaEnvUno) ? rutaEnvUno : rutaEnvDos });

const databaseUrl = process.env.DATABASE_URL?.trim();

const pool = new Pool(
    databaseUrl
        ? {
              connectionString: databaseUrl,
              ssl: resolverSslBaseDatos(process.env),
              max: 10,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
              statement_timeout: 30000,
          }
        : {
              user: process.env.DB_USER,
              host: process.env.DB_HOST,
              database: process.env.DB_DATABASE,
              password: process.env.DB_PASSWORD,
              port: Number(process.env.DB_PORT),
              ssl: resolverSslBaseDatos(process.env),
              max: 10,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
              statement_timeout: 30000,
          }
);

export default pool;
