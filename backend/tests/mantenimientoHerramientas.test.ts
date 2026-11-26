import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    procesarAvisosMantenimientoEnTransaccion,
    registrarMantenimientoEnTransaccion,
} from '../controllers/mantenimientoHerramientaController';
import { fijarEnviadorCorreo } from '../services/correo';
import { esAlertaVisibleParaUsuario } from '../services/alertaService';
import {
    avisoMantenimientoPendiente,
    diasHastaVencimiento,
    estaMantenimientoVencido,
} from '../services/mantenimientoHerramientaService';

const HOY = '2026-11-25';
const sumarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const crearEscenario = (estado = 'disponible', fecha: string | null = null) => {
    const s = {
        h: {
            id_herramienta: 1,
            codigo_herramienta: 'HERR-001',
            nombre: 'Termofusora',
            estado,
            fecha_proximo_mantenimiento: fecha,
            aviso_mant_previo_para: null as string | null,
            aviso_mant_final_para: null as string | null,
            activo: true,
        } as any,
        alertas: [] as any[],
        historial: [] as any[],
        auditoria: [] as any[],
    };
    const cliente: any = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) { s.auditoria.push(p); return { rows: [] }; }
            if (sql.includes('mant:param')) return { rows: [] }; // usa 7 y 1 por defecto
            if (sql.includes('mant:candidatas')) return { rows: [s.h] };
            if (sql.includes('alerta:select-config-correo')) return { rows: [] };
            if (sql.includes('alerta:insert')) {
                s.alertas.push({ tipo: p[0], severidad: p[1], titulo: p[2], rol_destino: p[6], correo_enviado: p[8] });
                return { rows: [{ id_alerta: s.alertas.length, fecha_creacion: new Date().toISOString() }] };
            }
            if (sql.includes('mant:marcar-previo')) { s.h.aviso_mant_previo_para = p[0]; return { rows: [] }; }
            if (sql.includes('mant:marcar-final')) { s.h.aviso_mant_final_para = p[0]; return { rows: [] }; }
            if (sql.includes('SELECT * FROM herramientas')) return { rows: [s.h] };
            if (sql.includes('INSERT INTO mantenimientos_herramienta')) {
                const m = { id_herramienta: p[0], fecha_realizada: p[1], fecha_siguiente: p[3] };
                s.historial.push(m);
                return { rows: [m] };
            }
            if (sql.includes('UPDATE herramientas SET fecha_proximo_mantenimiento')) {
                s.h.fecha_proximo_mantenimiento = p[0];
                if (s.h.estado === 'en mantención') s.h.estado = 'disponible';
                s.h.aviso_mant_previo_para = null;
                s.h.aviso_mant_final_para = null;
                return { rows: [s.h] };
            }
            return { rows: [] };
        },
    };
    return { s, cliente };
};

test('[BACK-1] cálculo de días, aviso pendiente y marca de vencido', () => {
    assert.equal(diasHastaVencimiento('2026-12-02', HOY), 7);
    assert.equal(diasHastaVencimiento('2026-11-26', HOY), 1);
    assert.equal(diasHastaVencimiento('2026-11-24', HOY), -1);
    const nada = { previo: false, final: false };
    assert.equal(avisoMantenimientoPendiente(7, 7, 1, nada), 'previo');
    assert.equal(avisoMantenimientoPendiente(1, 7, 1, nada), 'final');
    assert.equal(avisoMantenimientoPendiente(3, 7, 1, nada), 'previo');
    assert.equal(avisoMantenimientoPendiente(8, 7, 1, nada), null);
    assert.equal(avisoMantenimientoPendiente(-1, 7, 1, nada), null);
    assert.equal(avisoMantenimientoPendiente(7, 7, 1, { previo: true, final: false }), null);
    assert.equal(estaMantenimientoVencido({ fecha_proximo_mantenimiento: '2026-11-24', estado: 'disponible' }, HOY), true);
    assert.equal(estaMantenimientoVencido({ fecha_proximo_mantenimiento: '2026-11-24', estado: 'dada de baja' }, HOY), false);
    assert.equal(estaMantenimientoVencido({ fecha_proximo_mantenimiento: '2026-11-25', estado: 'disponible' }, HOY), false);
});

test('[BACK-1][SCRUM] ajusta la fecha a 7 y a 1 día, ejecuta el job y verifica correo y alerta H40', async () => {
    const correos: any[] = [];
    fijarEnviadorCorreo(async (c) => { correos.push(c); });
    try {
        const { s, cliente } = crearEscenario('disponible', sumarDias(HOY, 7));

        // A 7 días: aviso previo por sistema y correo
        const r7 = await procesarAvisosMantenimientoEnTransaccion(cliente, HOY);
        assert.equal(r7.avisos_generados, 1);
        assert.equal(r7.avisos[0].aviso, 'previo');
        assert.equal(s.alertas.length, 1);
        assert.equal(s.alertas[0].tipo, 'mantenimiento_herramienta_proximo');
        assert.equal(s.alertas[0].rol_destino, 'admin');
        assert.equal(correos.length, 1);
        assert.match(correos[0].asunto, /H40/);
        assert.match(correos[0].asunto, /7 días/);

        // Reejecutar el mismo día no duplica
        assert.equal((await procesarAvisosMantenimientoEnTransaccion(cliente, HOY)).avisos_generados, 0);

        // A 1 día: aviso final, severidad roja
        s.h.fecha_proximo_mantenimiento = sumarDias(HOY, 1);
        const r1 = await procesarAvisosMantenimientoEnTransaccion(cliente, HOY);
        assert.equal(r1.avisos[0].aviso, 'final');
        assert.equal(s.alertas.length, 2);
        assert.equal(s.alertas[1].severidad, 'rojo');
        assert.equal(correos.length, 2);
        assert.match(correos[1].asunto, /mañana/);

        // Fuera de ventana (10 días) no avisa
        const lejos = crearEscenario('disponible', sumarDias(HOY, 10));
        assert.equal((await procesarAvisosMantenimientoEnTransaccion(lejos.cliente, HOY)).avisos_generados, 0);
    } finally {
        fijarEnviadorCorreo();
    }
});

test('[BACK-1] el Técnico no ve alertas de mantenimiento; el Administrador sí', () => {
    const a = { tipo: 'mantenimiento_herramienta_proximo', rol_destino: 'admin' };
    assert.equal(esAlertaVisibleParaUsuario(a, { id_usuario: 1, rol: 'admin' }), true);
    assert.equal(esAlertaVisibleParaUsuario(a, { id_usuario: 2, rol: 'technician' }), false);
});

test('[BACK-1] registrar mantenimiento actualiza la fecha siguiente, limpia vencido y re-arma avisos', async () => {
    const { s, cliente } = crearEscenario('en mantención', '2026-11-20'); // vencida y en mantención
    s.h.aviso_mant_previo_para = '2026-11-20';
    assert.equal(estaMantenimientoVencido(s.h, HOY), true);

    const r = await registrarMantenimientoEnTransaccion(
        cliente, 1, { fecha_realizada: HOY, fecha_siguiente: '2027-05-25', observacion: 'Calibración' }, 1, HOY
    );
    assert.equal(r.herramienta.fecha_proximo_mantenimiento, '2027-05-25');
    assert.equal(s.h.estado, 'disponible');
    assert.equal(s.h.aviso_mant_previo_para, null);
    assert.equal(estaMantenimientoVencido(s.h, HOY), false);
    assert.equal(s.historial.length, 1);
    assert.equal(s.auditoria.length, 1);

    await assert.rejects(
        () => registrarMantenimientoEnTransaccion(cliente, 1, { fecha_realizada: HOY, fecha_siguiente: HOY }, 1, HOY),
        (e: any) => e.estado === 400
    );
    await assert.rejects(
        () => registrarMantenimientoEnTransaccion(cliente, 1, { fecha_siguiente: undefined }, 1, HOY),
        (e: any) => e.estado === 400
    );
    s.h.estado = 'dada de baja';
    await assert.rejects(
        () => registrarMantenimientoEnTransaccion(cliente, 1, { fecha_siguiente: '2027-01-01' }, 1, HOY),
        (e: any) => e.estado === 409
    );
});
