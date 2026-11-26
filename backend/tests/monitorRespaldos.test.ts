import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    ejecutarRespaldoMonitoreado,
    verificarSaludRespaldosEnTransaccion,
    registrarPruebaRestauracionEnTransaccion,
} from '../controllers/respaldoController';
import {
    ErrorRespaldo,
    evaluarRpo,
    evaluarPruebaRestauracion,
    cumpleRto,
    validarPruebaRestauracion,
    fijarEjecutorRespaldo,
} from '../services/respaldoMonitorService';
import { fijarEnviadorCorreo } from '../services/correo';

// Silenciar el envío real de correos durante toda la suite (evita timeout SMTP en sandbox)
const correosGlobales: any[] = [];
fijarEnviadorCorreo(async (m) => { correosGlobales.push(m); });

// ── Helper: cliente simulado ──────────────────────────────────────────────────
const crearCliente = (overrides: { alertaReciente?: boolean; sinRespaldoExitoso?: boolean; sinPruebaExitosa?: boolean } = {}) => {
    const s = {
        respaldos: [] as any[],
        pruebas:   [] as any[],
        alertas:   [] as any[],
        params: new Map<string, number>([
            ['dias_retencion_respaldos',   30],
            ['horas_max_perdida_datos',    24],
            ['dias_prueba_restauracion',   90],
            ['horas_max_recuperacion',      4],
        ]),
    };

    const cliente: any = {
        query: async (sql: string, p: any[] = []) => {
            // Parámetros del sistema
            if (sql.includes('resp:param')) {
                const v = s.params.get(p[0] as string);
                return { rows: v !== undefined ? [{ valor: String(v) }] : [] };
            }
            // Insertar ejecución de respaldo
            if (sql.includes('resp:insert') && !sql.includes('prueba')) {
                const r: any = {
                    id_ejecucion:  s.respaldos.length + 1,
                    origen:        p[0],
                    estado:        p[1],
                    fecha_inicio:  p[2],
                    fecha_fin:     p[3],
                    duracion_ms:   p[4],
                    tamano_bytes:  p[5],
                    ubicacion_nube:p[6],
                    cifrado:       p[7],
                    codigo_error:  p[8],
                    mensaje_error: p[9],
                    id_usuario:    p[10],
                };
                s.respaldos.push(r);
                return { rows: [r] };
            }
            // Insertar prueba de restauración
            if (sql.includes('resp:insert-prueba')) {
                const r: any = {
                    id_prueba:              s.pruebas.length + 1,
                    fecha_prueba:           p[0],
                    id_respaldo:            p[1],
                    resultado:              p[2],
                    tiempo_recuperacion_min:p[3],
                    cumple_rto:             p[4],
                    observaciones:          p[5],
                    id_usuario:             p[6],
                };
                s.pruebas.push(r);
                return { rows: [r] };
            }
            // Config correo (alerta)
            if (sql.includes('alerta:select-config-correo')) return { rows: [] };
            // Insertar alerta
            if (sql.includes('alerta:insert')) {
                const a = { tipo: p[0], severidad: p[1], titulo: p[2], descripcion: p[3] };
                s.alertas.push(a);
                return { rows: [{ id_alerta: s.alertas.length, fecha_creacion: new Date().toISOString() }] };
            }
            // Último éxito para RPO
            if (sql.includes('resp:ultimo-exito')) {
                if (overrides.sinRespaldoExitoso) return { rows: [{ fecha: null }] };
                const exitosos = s.respaldos.filter((r) => r.estado === 'exito');
                const fecha = exitosos.length ? exitosos[exitosos.length - 1].fecha_fin : null;
                return { rows: [{ fecha }] };
            }
            // Última prueba exitosa
            if (sql.includes('resp:ultima-prueba')) {
                if (overrides.sinPruebaExitosa) return { rows: [{ fecha: null }] };
                const exitosas = s.pruebas.filter((pr) => pr.resultado === 'exitosa');
                const fecha = exitosas.length ? exitosas[exitosas.length - 1].fecha_prueba : null;
                return { rows: [{ fecha }] };
            }
            // Alerta reciente (anti-duplicado)
            if (sql.includes('resp:alerta-reciente')) {
                return { rows: overrides.alertaReciente ? [{ 1: 1 }] : [] };
            }
            // Auditoría
            if (sql.includes('bitacora_auditoria')) return { rows: [] };
            return { rows: [] };
        },
    };

    return { s, cliente };
};

// ── 1. Utilitarios puros ──────────────────────────────────────────────────────

test('[BACK-2] evaluarRpo: cumple cuando el último éxito está dentro del horizonte', () => {
    const ahora = Date.now();
    const hace10h = new Date(ahora - 10 * 3600 * 1000);
    const r = evaluarRpo(hace10h, 24, ahora);
    assert.equal(r.cumple, true);
    assert.equal(r.horas_desde_ultimo_exito, 10);
});

test('[BACK-2] evaluarRpo: no cumple cuando supera las horas máximas de RPO', () => {
    const ahora = Date.now();
    const hace30h = new Date(ahora - 30 * 3600 * 1000);
    const r = evaluarRpo(hace30h, 24, ahora);
    assert.equal(r.cumple, false);
    assert.equal(r.horas_desde_ultimo_exito, 30);
});

test('[BACK-2] evaluarRpo: sin ningún éxito previo devuelve cumple=false y horas=null', () => {
    const r = evaluarRpo(null, 24, Date.now());
    assert.equal(r.cumple, false);
    assert.equal(r.horas_desde_ultimo_exito, null);
});

test('[BACK-2] evaluarPruebaRestauracion: vigente dentro del trimestre (90 días)', () => {
    const ahora = Date.now();
    const hace30d = new Date(ahora - 30 * 24 * 3600 * 1000);
    const r = evaluarPruebaRestauracion(hace30d, 90, ahora);
    assert.equal(r.vigente, true);
    assert.equal(r.dias_desde_ultima, 30);
});

test('[BACK-2] evaluarPruebaRestauracion: vencida si supera los días máximos', () => {
    const ahora = Date.now();
    const hace100d = new Date(ahora - 100 * 24 * 3600 * 1000);
    const r = evaluarPruebaRestauracion(hace100d, 90, ahora);
    assert.equal(r.vigente, false);
    assert.ok(r.dias_desde_ultima! >= 100);
});

test('[BACK-2] evaluarPruebaRestauracion: sin ninguna prueba previa devuelve vigente=false y días=null', () => {
    const r = evaluarPruebaRestauracion(null, 90, Date.now());
    assert.equal(r.vigente, false);
    assert.equal(r.dias_desde_ultima, null);
});

test('[BACK-2] cumpleRto: 180 min cumple RTO de 4 h (240 min)', () => {
    assert.equal(cumpleRto(180, 4), true);
});

test('[BACK-2] cumpleRto: 300 min no cumple RTO de 4 h (240 min)', () => {
    assert.equal(cumpleRto(300, 4), false);
});

test('[BACK-2] cumpleRto: exactamente en el límite (240/240) cumple', () => {
    assert.equal(cumpleRto(240, 4), true);
});

// ── 2. [SCRUM] Fallo de credenciales de nube ─────────────────────────────────

test('[BACK-2][SCRUM] fallo de credenciales de nube: estado=fallo, código=CLOUD_AUTH, alerta roja y correo', async () => {
    correosGlobales.length = 0; // limpiar antes del test

    const { s, cliente } = crearCliente();

    const result = await ejecutarRespaldoMonitoreado(cliente, {
        origen: 'automatico',
        ejecutor: async () => {
            throw new ErrorRespaldo('CLOUD_AUTH', 'Credenciales inválidas para acceder al proveedor de nube');
        },
    });

    // Estado del respaldo
    assert.equal(result.estado, 'fallo');
    assert.equal(result.respaldo.codigo_error, 'CLOUD_AUTH');

    // Alerta generada
    assert.ok(result.alerta_generada !== null, 'Debe haberse generado una alerta');
    const alerta = s.alertas[0];
    assert.ok(alerta, 'La alerta debe estar registrada en el mock');
    assert.equal(alerta.tipo, 'respaldo_fallido');
    assert.equal(alerta.severidad, 'rojo');
    assert.ok(alerta.titulo.includes('CLOUD_AUTH'), `Título debe mencionar el código: ${alerta.titulo}`);

    // Correo enviado al Administrador
    assert.equal(correosGlobales.length, 1, 'Se debe enviar exactamente un correo');
    const correo = correosGlobales[0];
    const contenido = `${correo.asunto ?? ''} ${correo.subject ?? ''} ${correo.texto ?? ''} ${correo.text ?? ''} ${correo.html ?? ''}`;
    assert.ok(
        contenido.toLowerCase().includes('cloud_auth') || contenido.toLowerCase().includes('respaldo'),
        `El correo debe mencionar CLOUD_AUTH o "respaldo": ${contenido.slice(0, 200)}`
    );
});

// ── 3. Éxito con cifrado ──────────────────────────────────────────────────────

test('[BACK-2] respaldo exitoso con cifrado: estado=exito y sin alerta', async () => {
    const { s, cliente } = crearCliente();

    const result = await ejecutarRespaldoMonitoreado(cliente, {
        origen: 'manual',
        ejecutor: async () => ({ tamano_bytes: 1_024_000, ubicacion_nube: 's3://bucket/backup-2026.enc', cifrado: true }),
    });

    assert.equal(result.estado, 'exito');
    assert.equal(result.alerta_generada, null);
    assert.equal(result.respaldo.cifrado, true);
    assert.equal(result.respaldo.tamano_bytes, 1_024_000);
    assert.equal(s.alertas.length, 0);
});

// ── 4. Fallo por respaldo no cifrado ─────────────────────────────────────────

test('[BACK-2] respaldo sin cifrado: estado=fallo, código=NO_CIFRADO y alerta roja', async () => {
    const { s, cliente } = crearCliente();

    const result = await ejecutarRespaldoMonitoreado(cliente, {
        origen: 'automatico',
        ejecutor: async () => ({ tamano_bytes: 512_000, ubicacion_nube: 's3://bucket/backup.db', cifrado: false }),
    });

    assert.equal(result.estado, 'fallo');
    assert.equal(result.respaldo.codigo_error, 'NO_CIFRADO');
    assert.ok(result.alerta_generada !== null, 'Debe generarse alerta por respaldo no cifrado');
    const alerta = s.alertas[0];
    assert.equal(alerta.tipo, 'respaldo_fallido');
    assert.equal(alerta.severidad, 'rojo');
});

// ── 5. Verificación de salud RPO ─────────────────────────────────────────────

test('[BACK-2] verificarSalud: RPO vencido sin respaldo previo genera alerta respaldo_desactualizado', async () => {
    const { s, cliente } = crearCliente({ sinRespaldoExitoso: true, sinPruebaExitosa: false });
    // Simular prueba existente reciente para que solo falle el RPO
    s.pruebas.push({ resultado: 'exitosa', fecha_prueba: new Date().toISOString().slice(0, 10) });

    const ahora = Date.now();
    const result = await verificarSaludRespaldosEnTransaccion(cliente, ahora);

    assert.equal(result.rpo.cumple, false);
    assert.ok(result.alertas_generadas.includes('respaldo_desactualizado'));
    const alerta = s.alertas.find((a) => a.tipo === 'respaldo_desactualizado');
    assert.ok(alerta, 'Debe registrarse alerta de respaldo_desactualizado');
    assert.equal(alerta.severidad, 'amarillo');
});

test('[BACK-2] verificarSalud: alerta no se duplica si ya existe una reciente (anti-spam)', async () => {
    // alertaReciente=true → el mock devuelve rows=[{1:1}] en resp:alerta-reciente → no inserta
    const { s, cliente } = crearCliente({ sinRespaldoExitoso: true, alertaReciente: true, sinPruebaExitosa: true });

    await verificarSaludRespaldosEnTransaccion(cliente, Date.now());

    assert.equal(s.alertas.length, 0, 'No debe duplicar alertas cuando ya existe una reciente');
});

test('[BACK-2] verificarSalud: prueba trimestral vencida genera alerta prueba_restauracion_pendiente', async () => {
    // Respaldo exitoso muy reciente (hace 1 h) → RPO OK; pero sin prueba exitosa → prueba vencida
    const { s, cliente } = crearCliente({ sinPruebaExitosa: true });
    // Agregar un respaldo exitoso reciente para que el RPO cumpla
    s.respaldos.push({ estado: 'exito', fecha_fin: new Date(Date.now() - 1 * 3600 * 1000) });

    const result = await verificarSaludRespaldosEnTransaccion(cliente, Date.now());

    assert.equal(result.prueba_restauracion.vigente, false);
    assert.ok(result.alertas_generadas.includes('prueba_restauracion_pendiente'));
    const alerta = s.alertas.find((a) => a.tipo === 'prueba_restauracion_pendiente');
    assert.ok(alerta, 'Debe registrarse alerta de prueba_restauracion_pendiente');
    assert.equal(alerta.severidad, 'amarillo');
});

// ── 6. Registro de prueba de restauración ────────────────────────────────────

test('[BACK-2] prueba exitosa en 180 min con RTO=4h (240 min): cumple_rto=true', async () => {
    const { s, cliente } = crearCliente();
    const hoy = new Date().toISOString().slice(0, 10);

    const result = await registrarPruebaRestauracionEnTransaccion(
        cliente,
        { fecha_prueba: hoy, resultado: 'exitosa', tiempo_recuperacion_min: 180, observaciones: null },
        1
    );

    assert.equal(result.cumple_rto, true);
    assert.equal(result.rto_horas, 4);
    assert.equal(s.pruebas[0].resultado, 'exitosa');
    assert.equal(s.pruebas[0].cumple_rto, true);
});

test('[BACK-2] prueba exitosa en 300 min con RTO=4h (240 min): cumple_rto=false', async () => {
    const { s, cliente } = crearCliente();
    const hoy = new Date().toISOString().slice(0, 10);

    const result = await registrarPruebaRestauracionEnTransaccion(
        cliente,
        { fecha_prueba: hoy, resultado: 'exitosa', tiempo_recuperacion_min: 300, observaciones: null },
        1
    );

    assert.equal(result.cumple_rto, false);
    assert.equal(s.pruebas[0].cumple_rto, false);
});

test('[BACK-2] prueba fallida sin observaciones: rechaza con 400', async () => {
    const { cliente } = crearCliente();
    const hoy = new Date().toISOString().slice(0, 10);

    await assert.rejects(
        () => registrarPruebaRestauracionEnTransaccion(
            cliente,
            { fecha_prueba: hoy, resultado: 'fallida', tiempo_recuperacion_min: 60, observaciones: null },
            1
        ),
        (e: any) => e.estado === 400 && /fallida/.test(e.message)
    );
});

// ── 7. Validación de validarPruebaRestauracion ────────────────────────────────

test('[BACK-2] validarPruebaRestauracion: fecha futura rechaza con 400', () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const hoy    = new Date().toISOString().slice(0, 10);
    assert.throws(
        () => validarPruebaRestauracion({ fecha_prueba: manana, resultado: 'exitosa', tiempo_recuperacion_min: 60 }, hoy),
        (e: any) => e.estado === 400 && /futura/.test(e.message)
    );
});

test('[BACK-2] validarPruebaRestauracion: resultado inválido rechaza con 400', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    assert.throws(
        () => validarPruebaRestauracion({ fecha_prueba: hoy, resultado: 'parcial', tiempo_recuperacion_min: 60 }, hoy),
        (e: any) => e.estado === 400 && /resultado/.test(e.message)
    );
});

test('[BACK-2] validarPruebaRestauracion: tiempo negativo rechaza con 400', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    assert.throws(
        () => validarPruebaRestauracion({ fecha_prueba: hoy, resultado: 'exitosa', tiempo_recuperacion_min: -5 }, hoy),
        (e: any) => e.estado === 400 && /minutos/.test(e.message)
    );
});

test('[BACK-2] validarPruebaRestauracion: id_respaldo no entero positivo rechaza con 400', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    assert.throws(
        () => validarPruebaRestauracion({ fecha_prueba: hoy, resultado: 'exitosa', tiempo_recuperacion_min: 60, id_respaldo: -1 }, hoy),
        (e: any) => e.estado === 400 && /id_respaldo/.test(e.message)
    );
});

test('[BACK-2] validarPruebaRestauracion: prueba fallida sin observaciones rechaza con 400', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    assert.throws(
        () => validarPruebaRestauracion({ fecha_prueba: hoy, resultado: 'fallida', tiempo_recuperacion_min: 90, observaciones: '' }, hoy),
        (e: any) => e.estado === 400 && /fallida/.test(e.message)
    );
});

test('[BACK-2] validarPruebaRestauracion: exitosa con todos los campos válidos no lanza error', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const d = validarPruebaRestauracion(
        { fecha_prueba: hoy, resultado: 'exitosa', tiempo_recuperacion_min: 120, observaciones: 'Todo OK', id_respaldo: 7 },
        hoy
    );
    assert.equal(d.resultado, 'exitosa');
    assert.equal(d.tiempo_recuperacion_min, 120);
    assert.equal(d.id_respaldo, 7);
});

// ── 8. CLOUD_CONNECTION y ERROR_DESCONOCIDO ───────────────────────────────────

test('[BACK-2] fallo CLOUD_CONNECTION: estado=fallo, código clasificado correctamente', async () => {
    const { s, cliente } = crearCliente();

    const result = await ejecutarRespaldoMonitoreado(cliente, {
        ejecutor: async () => { throw new ErrorRespaldo('CLOUD_CONNECTION', 'Timeout al conectar con el proveedor'); },
    });

    assert.equal(result.estado, 'fallo');
    assert.equal(result.respaldo.codigo_error, 'CLOUD_CONNECTION');
    const alerta = s.alertas[0];
    assert.equal(alerta.tipo, 'respaldo_fallido');
});

test('[BACK-2] error genérico (no ErrorRespaldo): clasificado como ERROR_DESCONOCIDO', async () => {
    const { s, cliente } = crearCliente();

    const result = await ejecutarRespaldoMonitoreado(cliente, {
        ejecutor: async () => { throw new Error('Fallo inesperado del SO'); },
    });

    assert.equal(result.estado, 'fallo');
    assert.equal(result.respaldo.codigo_error, 'ERROR_DESCONOCIDO');
    assert.equal(s.alertas[0].tipo, 'respaldo_fallido');
});
