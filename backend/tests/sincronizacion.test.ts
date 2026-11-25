import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { procesarRegistroSincronizadoEnTransaccion } from '../controllers/sincronizacionController';
import {
    MAX_BYTES_FOTO,
    calcularBytesBase64,
    hayConflictoDeVersion,
    validarRegistroEntrante,
} from '../services/sincronizacionService';

// ---------------------------------------------------------------------------------------------
// Cliente PG falso en memoria: interpreta las consultas del servicio por su etiqueta /* sync:x */
// ---------------------------------------------------------------------------------------------
interface Registro { id_registro: number; tipo_registro: string; id_local: string; id_usuario_creador: number | null; datos: any; version: number; tiene_conflicto: boolean }
interface Version { id_version: number; id_registro: number; numero_version: number | null; estado: string; origen: string; base_version: number | null; id_envio: string | null; datos: any }

const crearBaseFalsa = () => {
    const estado = {
        registros: [] as Registro[],
        versiones: [] as Version[],
        fotos: [] as { id_version: number; tamano_bytes: number }[],
        alertas: [] as { titulo: string; descripcion: string }[],
        auditoria: [] as any[][],
    };
    const cliente = {
        query: async (sql: string, p: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                estado.auditoria.push(p);
                return { rows: [] };
            }
            const etiqueta = /\/\* (sync:[a-z-]+) \*\//.exec(sql)?.[1];
            switch (etiqueta) {
                case 'sync:select-registro':
                    return { rows: estado.registros.filter((r) => r.tipo_registro === p[0] && r.id_local === p[1]) };
                case 'sync:insert-registro': {
                    if (estado.registros.some((r) => r.tipo_registro === p[0] && r.id_local === p[1])) return { rows: [] };
                    const fila: Registro = { id_registro: estado.registros.length + 1, tipo_registro: p[0], id_local: p[1], id_usuario_creador: p[2], datos: JSON.parse(p[3]), version: 1, tiene_conflicto: false };
                    estado.registros.push(fila);
                    return { rows: [{ id_registro: fila.id_registro }] };
                }
                case 'sync:select-envio':
                    return { rows: estado.versiones.filter((v) => v.id_registro === p[0] && v.id_envio === p[1]) };
                case 'sync:insert-version': {
                    const v: Version = { id_version: estado.versiones.length + 1, id_registro: p[0], numero_version: p[1], estado: p[2], origen: p[3], base_version: p[4], id_envio: p[5], datos: JSON.parse(p[7]) };
                    estado.versiones.push(v);
                    return { rows: [{ id_version: v.id_version }] };
                }
                case 'sync:archivar-vigente':
                    estado.versiones.filter((v) => v.id_registro === p[0] && v.estado === 'vigente').forEach((v) => (v.estado = 'historica'));
                    return { rows: [] };
                case 'sync:update-registro': {
                    const r = estado.registros.find((x) => x.id_registro === p[0])!;
                    r.datos = JSON.parse(p[1]);
                    r.version = p[2];
                    return { rows: [] };
                }
                case 'sync:marcar-conflicto':
                    estado.registros.find((x) => x.id_registro === p[0])!.tiene_conflicto = true;
                    return { rows: [] };
                case 'sync:insert-foto':
                    estado.fotos.push({ id_version: p[1], tamano_bytes: p[4] });
                    return { rows: [] };
                case 'sync:insert-alerta':
                    estado.alertas.push({ titulo: p[0], descripcion: p[1] });
                    return { rows: [] };
                default:
                    throw new Error(`Consulta no soportada por el fake: ${sql.slice(0, 60)}`);
            }
        },
    } as unknown as PoolClient;
    return { estado, cliente };
};

const base64DeBytes = (bytes: number): string => Buffer.alloc(bytes, 7).toString('base64');

const registroBase = (extra: Record<string, unknown> = {}) => ({
    tipo_registro: 'hoja_servicio',
    id_local: 'hoja-local-1',
    id_envio: 'envio-1',
    base_version: 0,
    datos: { receptor: 'Cliente A', notas: 'Original del móvil' },
    ...extra,
});

const validarOk = (bruto: unknown) => {
    const v = validarRegistroEntrante(bruto);
    assert.equal(v.ok, true, v.ok ? '' : v.mensaje);
    if (!v.ok) throw new Error('inalcanzable');
    return v.valor;
};

test('calcularBytesBase64 mide el tamaño real sin decodificar', () => {
    assert.equal(calcularBytesBase64(base64DeBytes(1000)), 1000);
    assert.equal(calcularBytesBase64(`data:image/jpeg;base64,${base64DeBytes(1001)}`), 1001);
});

test('rechaza una foto de 5 MB + 1 byte y acepta una de exactamente 5 MB', () => {
    const grande = validarRegistroEntrante(
        registroBase({ fotos: [{ nombre: 'grande.jpg', mime_type: 'image/jpeg', contenido_base64: base64DeBytes(MAX_BYTES_FOTO + 1) }] })
    );
    assert.equal(grande.ok, false);
    if (!grande.ok) {
        assert.equal(grande.codigo, 'FOTO_EXCEDE_5MB');
        assert.match(grande.mensaje, /grande\.jpg/);
        assert.equal(grande.id_local, 'hoja-local-1');
    }

    const justa = validarRegistroEntrante(
        registroBase({ fotos: [{ nombre: 'justa.jpg', mime_type: 'image/jpeg', contenido_base64: base64DeBytes(MAX_BYTES_FOTO) }] })
    );
    assert.equal(justa.ok, true);
});

test('rechaza el registro completo si una de varias fotos supera 5 MB', () => {
    const resultado = validarRegistroEntrante(
        registroBase({
            fotos: [
                { nombre: 'ok.jpg', mime_type: 'image/jpeg', contenido_base64: base64DeBytes(1024) },
                { nombre: 'pesada.png', mime_type: 'image/png', contenido_base64: base64DeBytes(MAX_BYTES_FOTO + 10) },
            ],
        })
    );
    assert.equal(resultado.ok, false);
});

test('valida tipo, ids, base64 y mime de las fotos', () => {
    assert.equal(validarRegistroEntrante(registroBase({ tipo_registro: 'otro' })).ok, false);
    assert.equal(validarRegistroEntrante(registroBase({ id_local: '' })).ok, false);
    assert.equal(validarRegistroEntrante(registroBase({ id_envio: undefined })).ok, false);
    assert.equal(validarRegistroEntrante(registroBase({ fotos: [{ mime_type: 'image/png', contenido_base64: '***' }] })).ok, false);
    assert.equal(validarRegistroEntrante(registroBase({ fotos: [{ mime_type: 'application/pdf', contenido_base64: base64DeBytes(10) }] })).ok, false);
});

test('hayConflictoDeVersion solo cuando el móvil partió de una versión anterior', () => {
    assert.equal(hayConflictoDeVersion(1, 2), true);
    assert.equal(hayConflictoDeVersion(2, 2), false);
    assert.equal(hayConflictoDeVersion(0, 1), true);
});

test('registro nuevo offline: queda en versión 1 con sus fotos', async () => {
    const { estado, cliente } = crearBaseFalsa();
    const reg = validarOk(registroBase({ fotos: [{ nombre: 'a.jpg', mime_type: 'image/jpeg', contenido_base64: base64DeBytes(2048) }] }));
    const r = await procesarRegistroSincronizadoEnTransaccion(cliente, reg, 7);

    assert.equal(r.estado, 'sincronizado');
    assert.equal(r.version_central, 1);
    assert.equal(r.fotos_guardadas, 1);
    assert.equal(estado.registros.length, 1);
    assert.equal(estado.fotos[0].tamano_bytes, 2048);
    assert.equal(estado.alertas.length, 0);
});

test('reintento del mismo envío es idempotente (no duplica versiones ni fotos)', async () => {
    const { estado, cliente } = crearBaseFalsa();
    const reg = validarOk(registroBase({ fotos: [{ nombre: 'a.jpg', mime_type: 'image/jpeg', contenido_base64: base64DeBytes(100) }] }));
    await procesarRegistroSincronizadoEnTransaccion(cliente, reg, 7);
    const segundo = await procesarRegistroSincronizadoEnTransaccion(cliente, reg, 7);

    assert.equal(segundo.estado, 'duplicado');
    assert.equal(estado.versiones.length, 1);
    assert.equal(estado.fotos.length, 1);
});

test('móvil al día con la central: avanza versión y conserva la anterior como histórica', async () => {
    const { estado, cliente } = crearBaseFalsa();
    await procesarRegistroSincronizadoEnTransaccion(cliente, validarOk(registroBase()), 7);
    const r = await procesarRegistroSincronizadoEnTransaccion(
        cliente,
        validarOk(registroBase({ id_envio: 'envio-2', base_version: 1, datos: { receptor: 'Cliente A', notas: 'Segunda edición' } })),
        7
    );

    assert.equal(r.estado, 'sincronizado');
    assert.equal(r.version_central, 2);
    assert.equal(estado.registros[0].datos.notas, 'Segunda edición');
    assert.deepEqual(estado.versiones.map((v) => v.estado), ['historica', 'vigente']);
    assert.equal(estado.alertas.length, 0);
});

test('[SCRUM] edición en web + sincronización offline del mismo registro: se guardan AMBAS versiones y alerta', async () => {
    const { estado, cliente } = crearBaseFalsa();

    // 1) El móvil sincroniza la hoja por primera vez (versión 1) y queda conociendo base_version = 1.
    await procesarRegistroSincronizadoEnTransaccion(cliente, validarOk(registroBase()), 7);

    // 2) Un Administrador modifica el mismo registro en la web (la central pasa a versión 2).
    const central = estado.registros[0];
    estado.versiones.forEach((v) => (v.estado = 'historica'));
    central.datos = { receptor: 'Cliente A', notas: 'EDITADO EN LA CENTRAL' };
    central.version = 2;
    estado.versiones.push({ id_version: 99, id_registro: 1, numero_version: 2, estado: 'vigente', origen: 'central', base_version: 1, id_envio: null, datos: central.datos });

    // 3) El técnico, sin conexión, editó la misma hoja desde la versión 1 y ahora sincroniza (con una foto).
    const reg = validarOk(
        registroBase({
            id_envio: 'envio-offline-2',
            base_version: 1,
            datos: { receptor: 'Cliente A', notas: 'EDITADO OFFLINE EN TERRENO' },
            fotos: [{ nombre: 'terreno.jpg', mime_type: 'image/jpeg', contenido_base64: base64DeBytes(4096) }],
        })
    );
    const r = await procesarRegistroSincronizadoEnTransaccion(cliente, reg, 7);

    // Resultado: conflicto, nada se sobrescribe ni se pierde
    assert.equal(r.estado, 'conflicto');
    assert.equal(r.codigo, 'CONFLICTO_VERSION');
    assert.equal(r.version_central, 2);
    assert.ok(r.id_version_conflicto);

    // Versión de la central intacta
    assert.equal(central.datos.notas, 'EDITADO EN LA CENTRAL');
    assert.equal(central.version, 2);
    assert.equal(central.tiene_conflicto, true);

    // Versión del móvil conservada aparte, con su foto
    const delMovil = estado.versiones.find((v) => v.id_version === r.id_version_conflicto)!;
    assert.equal(delMovil.estado, 'conflicto');
    assert.equal(delMovil.datos.notas, 'EDITADO OFFLINE EN TERRENO');
    assert.equal(estado.fotos.filter((f) => f.id_version === delMovil.id_version).length, 1);

    // Alerta al Administrador + auditoría
    assert.equal(estado.alertas.length, 1);
    assert.match(estado.alertas[0].titulo, /Conflicto de sincronización/);
    assert.match(estado.alertas[0].descripcion, /versión 2/);
    assert.equal(estado.auditoria.length, 1);

    // Reintentar el mismo envío no genera otra alerta ni otra versión en conflicto
    const reintento = await procesarRegistroSincronizadoEnTransaccion(cliente, reg, 7);
    assert.equal(reintento.estado, 'duplicado');
    assert.equal(reintento.id_version_conflicto, r.id_version_conflicto);
    assert.equal(estado.alertas.length, 1);
    assert.equal(estado.versiones.filter((v) => v.estado === 'conflicto').length, 1);
});
