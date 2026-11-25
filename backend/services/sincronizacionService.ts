/**
 * [BACK-1] Reglas puras (sin base de datos) de la sincronización offline por lotes:
 * límites, validación de fotos (máx. 5 MB c/u) y detección de conflicto de versiones.
 */

export const MAX_BYTES_FOTO = 5 * 1024 * 1024; // 5 MB por foto
export const MAX_REGISTROS_POR_LOTE = 10;
export const MAX_FOTOS_POR_REGISTRO = 8;
export const MAX_BYTES_LOTE = 40 * 1024 * 1024; // tope de fotos por petición
export const LIMITE_JSON_SINCRONIZACION = '60mb'; // base64 pesa ~37% más que el binario

export const TIPOS_REGISTRO_SYNC = ['hoja_servicio', 'checklist'] as const;
export type TipoRegistroSync = (typeof TIPOS_REGISTRO_SYNC)[number];

export interface FotoEntrante {
    nombre: string;
    mime_type: string;
    tamano_bytes: number;
    contenido: Buffer;
}

export interface RegistroEntrante {
    tipo_registro: TipoRegistroSync;
    id_local: string;
    id_envio: string;
    /** Última versión de la central que el móvil conocía (0 si el registro nació offline). */
    base_version: number;
    fecha_cliente: Date | null;
    datos: Record<string, unknown>;
    fotos: FotoEntrante[];
}

export type CodigoRechazoSync =
    | 'REGISTRO_INVALIDO'
    | 'FOTO_INVALIDA'
    | 'FOTO_EXCEDE_5MB'
    | 'DEMASIADAS_FOTOS';

export type ValidacionRegistro =
    | { ok: true; valor: RegistroEntrante }
    | { ok: false; codigo: CodigoRechazoSync; mensaje: string; id_local: string | null; id_envio: string | null };

const BASE64_VALIDO = /^[A-Za-z0-9+/]*={0,2}$/;
const PREFIJO_DATA_URI = /^data:([^;,]+)(?:;[^,]*)?;base64,/i;

export const formatearMegabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const limpiarBase64 = (texto: string): string => texto.replace(PREFIJO_DATA_URI, '').replace(/\s+/g, '');

/** Tamaño real en bytes de un base64 SIN decodificarlo (evita cargar fotos enormes en memoria). */
export const calcularBytesBase64 = (base64: string): number => {
    const limpio = limpiarBase64(base64);
    const relleno = limpio.endsWith('==') ? 2 : limpio.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((limpio.length * 3) / 4) - relleno);
};

const esObjetoPlano = (valor: unknown): valor is Record<string, unknown> =>
    typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const textoNoVacio = (valor: unknown, maximo: number): string | null => {
    if (typeof valor !== 'string') return null;
    const limpio = valor.trim();
    return limpio.length > 0 && limpio.length <= maximo ? limpio : null;
};

/**
 * Valida un registro del lote. Si CUALQUIER foto supera 5 MB (o es inválida) el registro completo
 * se rechaza sin guardar nada: el móvil lo conserva como pendiente y puede corregirlo.
 */
export const validarRegistroEntrante = (bruto: unknown): ValidacionRegistro => {
    const crudo = esObjetoPlano(bruto) ? bruto : {};
    const idLocal = textoNoVacio(crudo.id_local, 80);
    const idEnvio = textoNoVacio(crudo.id_envio, 80);
    const rechazo = (codigo: CodigoRechazoSync, mensaje: string): ValidacionRegistro => ({
        ok: false,
        codigo,
        mensaje,
        id_local: idLocal,
        id_envio: idEnvio,
    });

    if (!(TIPOS_REGISTRO_SYNC as readonly string[]).includes(String(crudo.tipo_registro))) {
        return rechazo('REGISTRO_INVALIDO', `tipo_registro debe ser: ${TIPOS_REGISTRO_SYNC.join(', ')}`);
    }
    if (!idLocal) return rechazo('REGISTRO_INVALIDO', 'id_local es obligatorio (UUID generado en el dispositivo)');
    if (!idEnvio) return rechazo('REGISTRO_INVALIDO', 'id_envio es obligatorio (identifica este envío para reintentos)');
    if (!esObjetoPlano(crudo.datos)) return rechazo('REGISTRO_INVALIDO', 'datos debe ser un objeto con los campos del registro');

    const baseBruta = crudo.base_version === undefined || crudo.base_version === null ? 0 : Number(crudo.base_version);
    if (!Number.isInteger(baseBruta) || baseBruta < 0) {
        return rechazo('REGISTRO_INVALIDO', 'base_version debe ser un entero mayor o igual a 0');
    }

    let fechaCliente: Date | null = null;
    if (crudo.fecha_cliente !== undefined && crudo.fecha_cliente !== null) {
        const fecha = new Date(String(crudo.fecha_cliente));
        if (Number.isNaN(fecha.getTime())) return rechazo('REGISTRO_INVALIDO', 'fecha_cliente no es una fecha válida');
        fechaCliente = fecha;
    }

    const fotosBrutas = crudo.fotos === undefined || crudo.fotos === null ? [] : crudo.fotos;
    if (!Array.isArray(fotosBrutas)) return rechazo('FOTO_INVALIDA', 'fotos debe ser una lista');
    if (fotosBrutas.length > MAX_FOTOS_POR_REGISTRO) {
        return rechazo('DEMASIADAS_FOTOS', `Máximo ${MAX_FOTOS_POR_REGISTRO} fotos por registro`);
    }

    // Primero se mide TODO (sin decodificar) y luego se decodifica: una foto grande no consume memoria.
    const medidas: { nombre: string; mime: string; base64: string; bytes: number }[] = [];
    for (let i = 0; i < fotosBrutas.length; i += 1) {
        const foto = fotosBrutas[i];
        if (!esObjetoPlano(foto)) return rechazo('FOTO_INVALIDA', `La foto #${i + 1} no es válida`);
        const nombre = textoNoVacio(foto.nombre, 200) ?? `foto-${i + 1}`;
        const contenido = typeof foto.contenido_base64 === 'string' ? foto.contenido_base64 : '';
        const coincidencia = PREFIJO_DATA_URI.exec(contenido);
        const mime = String(foto.mime_type ?? coincidencia?.[1] ?? '').toLowerCase();
        const limpio = limpiarBase64(contenido);

        if (!mime.startsWith('image/')) return rechazo('FOTO_INVALIDA', `La foto "${nombre}" debe ser una imagen`);
        if (limpio.length === 0 || limpio.length % 4 !== 0 || !BASE64_VALIDO.test(limpio)) {
            return rechazo('FOTO_INVALIDA', `La foto "${nombre}" no es un base64 válido`);
        }
        const bytes = calcularBytesBase64(limpio);
        if (bytes <= 0) return rechazo('FOTO_INVALIDA', `La foto "${nombre}" está vacía`);
        if (bytes > MAX_BYTES_FOTO) {
            return rechazo(
                'FOTO_EXCEDE_5MB',
                `La foto "${nombre}" pesa ${formatearMegabytes(bytes)} y supera el máximo permitido de 5 MB. Comprímela y vuelve a sincronizar; el registro sigue pendiente en el dispositivo.`
            );
        }
        medidas.push({ nombre, mime, base64: limpio, bytes });
    }

    return {
        ok: true,
        valor: {
            tipo_registro: crudo.tipo_registro as TipoRegistroSync,
            id_local: idLocal,
            id_envio: idEnvio,
            base_version: baseBruta,
            fecha_cliente: fechaCliente,
            datos: crudo.datos,
            fotos: medidas.map((m) => ({
                nombre: m.nombre,
                mime_type: m.mime,
                tamano_bytes: m.bytes,
                contenido: Buffer.from(m.base64, 'base64'),
            })),
        },
    };
};

/**
 * Hay conflicto cuando el móvil editó a partir de una versión anterior a la que hoy está vigente
 * en la central (alguien la modificó mientras el técnico estaba sin conexión).
 */
export const hayConflictoDeVersion = (versionBaseMovil: number, versionCentral: number): boolean =>
    versionBaseMovil < versionCentral;

export const construirTextoAlertaConflicto = (datos: {
    tipoRegistro: string;
    idLocal: string;
    idUsuario: number | null;
    versionBase: number;
    versionCentral: number;
    idVersionConflicto: number;
}): { titulo: string; descripcion: string } => ({
    titulo: `Conflicto de sincronización en ${datos.tipoRegistro.replace('_', ' ')}`.slice(0, 200),
    descripcion: (
        `El usuario #${datos.idUsuario ?? 'desconocido'} sincronizó cambios offline del registro ${datos.idLocal} ` +
        `(versión base ${datos.versionBase}) pero la central ya estaba en la versión ${datos.versionCentral}. ` +
        `Se conservaron ambas versiones; revisa la versión en conflicto #${datos.idVersionConflicto}.`
    ).slice(0, 500),
});
