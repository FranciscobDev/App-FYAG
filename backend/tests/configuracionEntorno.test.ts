import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerJwtSecret, validarConfiguracionEntorno } from '../config/entorno';

const entornoBase = (): NodeJS.ProcessEnv => ({
    NODE_ENV: 'development',
    DB_HOST: 'localhost',
    DB_USER: 'fyag_test',
    DB_PASSWORD: 'test-password',
    DB_DATABASE: 'fyag_test',
    DB_PORT: '5432',
    JWT_SECRET: 'test-secret-with-more-than-32-characters',
});

test('valida la configuración mínima y aplica el puerto local por defecto', () => {
    const configuracion = validarConfiguracionEntorno(entornoBase());

    assert.equal(configuracion.port, 3000);
    assert.equal(configuracion.dbPort, 5432);
    assert.deepEqual(configuracion.corsOrigins, [
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        'http://localhost:19006',
    ]);
});

test('rechaza configuración incompleta, secretos cortos y puertos inválidos', () => {
    const sinPassword = entornoBase();
    delete sinPassword.DB_PASSWORD;
    assert.throws(() => validarConfiguracionEntorno(sinPassword), /DB_PASSWORD/);

    const secretoCorto = entornoBase();
    secretoCorto.JWT_SECRET = 'short';
    assert.throws(() => validarConfiguracionEntorno(secretoCorto), /JWT_SECRET/);

    const puertoInvalido = entornoBase();
    puertoInvalido.DB_PORT = '70000';
    assert.throws(() => validarConfiguracionEntorno(puertoInvalido), /DB_PORT/);

    const puertoApiInvalido = entornoBase();
    puertoApiInvalido.PORT = 'abc';
    assert.throws(() => validarConfiguracionEntorno(puertoApiInvalido), /PORT/);
});

test('en producción exige correo y orígenes CORS válidos y explícitos', () => {
    const produccion = {
        ...entornoBase(),
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'fyag',
        SMTP_PASS: 'smtp-password',
        CORS_ORIGIN: 'https://app.example.com,https://admin.example.com',
    };
    const configuracion = validarConfiguracionEntorno(produccion);
    assert.deepEqual(configuracion.corsOrigins, [
        'https://app.example.com',
        'https://admin.example.com',
    ]);

    const sinCorreo: NodeJS.ProcessEnv = { ...produccion };
    delete sinCorreo.SMTP_PASS;
    assert.throws(() => validarConfiguracionEntorno(sinCorreo), /SMTP_PASS/);

    const sinCors: NodeJS.ProcessEnv = { ...produccion };
    delete sinCors.CORS_ORIGIN;
    assert.throws(() => validarConfiguracionEntorno(sinCors), /CORS_ORIGIN/);

    const corsConRuta = { ...produccion, CORS_ORIGIN: 'https://app.example.com/login' };
    assert.throws(() => validarConfiguracionEntorno(corsConRuta), /sin rutas/);
});

test('el uso del secreto JWT falla con mensaje explícito si no cumple el mínimo', () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'invalid';
    try {
        assert.throws(() => obtenerJwtSecret(), /JWT_SECRET/);
    } finally {
        if (original === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = original;
    }
});
