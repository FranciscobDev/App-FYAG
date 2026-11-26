import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registrarAvanceProyectoEnTransaccion } from '../controllers/proyectoController';

interface ArticuloMock {
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    stock_actual: number;
}

interface AvanceMock {
    id_avance: number;
    proyecto_id: number;
    tecnico_id: number;
    tecnico_nombre: string;
    porcentaje_avance: number;
    comentarios: string;
    fecha_registro: string;
}

interface UsoInsumoMock {
    id_uso: number;
    proyecto_id: number;
    tecnico_id: number;
    id_articulo: number;
    cantidad_utilizada: number;
    id_avance: number;
}

const crearEscenarioAvance = (opts: {
    estadoProyecto?: string;
    tecnicoAsignado?: boolean;
    stockInicial?: number;
} = {}) => {
    const estado = {
        proyecto: {
            id_proyecto: 10,
            nombre_proyecto: 'Instalación Data Center',
            estado_proyecto: opts.estadoProyecto ?? 'En ejecución',
            porcentaje_avance: 20,
        },
        tecnico: {
            id_usuario: 3,
            nombre: 'Carlos',
            apellido: 'Técnico',
            rol: 'technician',
        },
        asignado: opts.tecnicoAsignado ?? true,
        articulos: new Map<number, ArticuloMock>([
            [101, { id_articulo: 101, sku: 'CBL-UTP-06', nombre_articulo: 'Cable UTP Cat 6', stock_actual: opts.stockInicial ?? 50 }],
        ]),
        avances: [] as AvanceMock[],
        usos: [] as UsoInsumoMock[],
        cardex: [] as any[], // Movimientos de inventario de bodega
        auditoria: [] as any[],
    };

    const clienteMock = {
        query: async (sql: string, params: any[] = []) => {
            if (sql.includes('bitacora_auditoria')) {
                estado.auditoria.push(params);
                return { rows: [] };
            }

            // Verificación de asignación de técnico
            if (sql.includes('asignaciones_proyecto') || sql.includes('proyecto_tecnico')) {
                return { rows: estado.asignado ? [{ '?column?': 1 }] : [] };
            }

            // Consulta de proyecto
            if (sql.includes('FROM proyecto WHERE id_proyecto')) {
                return { rows: [estado.proyecto] };
            }

            // Actualización de porcentaje_avance en proyecto
            if (sql.includes('UPDATE proyecto SET porcentaje_avance')) {
                estado.proyecto.porcentaje_avance = params[0];
                return { rows: [] };
            }

            // Consulta de usuario técnico
            if (sql.includes('FROM usuario WHERE id_usuario')) {
                return { rows: [estado.tecnico] };
            }

            // Consulta de artículo en catálogo
            if (sql.includes('FROM articulo WHERE id_articulo')) {
                const art = estado.articulos.get(params[0]);
                return { rows: art ? [art] : [] };
            }
            if (sql.includes('FROM articulo WHERE UPPER(TRIM(sku))')) {
                const art = Array.from(estado.articulos.values()).find((a) => a.sku === params[0]);
                return { rows: art ? [art] : [] };
            }

            // Inserción de cabecera de avance
            if (sql.includes('INSERT INTO avances_proyecto')) {
                const nuevo: AvanceMock = {
                    id_avance: estado.avances.length + 1,
                    proyecto_id: params[0],
                    tecnico_id: params[1],
                    tecnico_nombre: params[2],
                    porcentaje_avance: params[3],
                    comentarios: params[4],
                    fecha_registro: new Date().toISOString(),
                };
                estado.avances.push(nuevo);
                return { rows: [{ id_avance: nuevo.id_avance, fecha_registro: nuevo.fecha_registro }] };
            }

            // Inserción de materiales utilizados
            if (sql.includes('INSERT INTO uso_insumos_proyecto')) {
                const nuevoUso: UsoInsumoMock = {
                    id_uso: estado.usos.length + 1,
                    proyecto_id: params[0],
                    tecnico_id: params[1],
                    id_articulo: params[2],
                    cantidad_utilizada: params[3],
                    id_avance: params[6],
                };
                estado.usos.push(nuevoUso);
                return { rows: [{ id_uso: nuevoUso.id_uso }] };
            }

            // Inserción en movimientos_inventario (Cardex) - ¡NO DEBE SER LLAMADO EN ESTE FLUJO!
            if (sql.includes('INSERT INTO movimientos_inventario')) {
                estado.cardex.push(params);
                return { rows: [{ id_movimiento: 100 }] };
            }

            // Actualización de stock_actual en articulo - ¡NO DEBE SER LLAMADO EN ESTE FLUJO!
            if (sql.includes('UPDATE articulo SET stock_actual')) {
                const art = estado.articulos.get(params[1]);
                if (art) art.stock_actual = params[0];
                return { rows: [] };
            }

            return { rows: [] };
        },
    };

    return { estado, clienteMock };
};

test('[BACK-1] Valida porcentaje entre 0 y 100, comentarios obligatorios e insumo existente', async () => {
    const { clienteMock } = crearEscenarioAvance();

    // 1. Porcentaje negativo
    await assert.rejects(
        () => registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
            porcentaje_avance: -5,
            comentarios: 'Avance con porcentaje inválido',
        }),
        (err: any) => {
            assert.equal(err.estado, 400);
            assert.match(err.message, /entre 0 y 100/);
            return true;
        }
    );

    // 2. Porcentaje mayor a 100
    await assert.rejects(
        () => registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
            porcentaje_avance: 105,
            comentarios: 'Avance con porcentaje excesivo',
        }),
        (err: any) => {
            assert.equal(err.estado, 400);
            assert.match(err.message, /entre 0 y 100/);
            return true;
        }
    );

    // 3. Comentarios vacíos
    await assert.rejects(
        () => registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
            porcentaje_avance: 50,
            comentarios: '   ',
        }),
        (err: any) => {
            assert.equal(err.estado, 400);
            assert.match(err.message, /obligatorios/);
            return true;
        }
    );

    // 4. Insumo no encontrado
    await assert.rejects(
        () => registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
            porcentaje_avance: 50,
            comentarios: 'Insumo inválido',
            materiales_utilizados: [{ id_articulo: 9999, cantidad: 5 }],
        }),
        (err: any) => {
            assert.equal(err.estado, 400);
            assert.match(err.message, /no encontrado en el catálogo/);
            return true;
        }
    );
});

test('[BACK-1] Bloquea registro de avance a técnicos no asignados al proyecto (403)', async () => {
    const { clienteMock } = crearEscenarioAvance({ tecnicoAsignado: false });

    await assert.rejects(
        () => registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
            porcentaje_avance: 50,
            comentarios: 'Técnico intruso',
        }),
        (err: any) => {
            assert.equal(err.estado, 403);
            assert.match(err.message, /no tienes permiso.*no asignado/i);
            return true;
        }
    );
});

test('[BACK-1] Bloquea registro de avances en proyectos cerrados o completados (400)', async () => {
    const { clienteMock } = crearEscenarioAvance({ estadoProyecto: 'Completado' });

    await assert.rejects(
        () => registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
            porcentaje_avance: 80,
            comentarios: 'Intento de modificar proyecto cerrado',
        }),
        (err: any) => {
            assert.equal(err.estado, 400);
            assert.match(err.message, /cerrado o completado/i);
            return true;
        }
    );
});

test('[BACK-1][SCRUM] Registra uso de materiales en terreno y comprueba que el Cardex de bodega no se duplique', async () => {
    const stockInicialBodega = 50;
    const { estado, clienteMock } = crearEscenarioAvance({ stockInicial: stockInicialBodega });

    // Cardex inicial tiene 0 movimientos de este evento
    const movimientosCardexPrevios = estado.cardex.length;
    assert.equal(movimientosCardexPrevios, 0);

    // Técnico en terreno declara un avance del 50 % y 12 metros de cable utilizados
    const resultado = await registrarAvanceProyectoEnTransaccion(clienteMock, 10, 3, 'technician', {
        porcentaje_avance: 50,
        comentarios: 'Canalizaciones terminadas y cableado de sala de servidores al 50%',
        materiales_utilizados: [
            { id_articulo: 101, cantidad: 12 },
        ],
    });

    // 1. Verifica respuesta y cabecera de avance guardada
    assert.equal(resultado.proyecto_id, 10);
    assert.equal(resultado.porcentaje_avance, 50);
    assert.equal(resultado.tecnico_id, 3);
    assert.equal(resultado.tecnico_nombre, 'Carlos Técnico');
    assert.ok(resultado.fecha_registro, 'Debe incluir fecha y hora de registro');
    assert.equal(resultado.materiales_utilizados.length, 1);
    assert.equal(resultado.materiales_utilizados[0].cantidad_utilizada, 12);

    // 2. Verifica actualización del proyecto
    assert.equal(estado.proyecto.porcentaje_avance, 50);

    // 3. Verifica registro en uso_insumos_proyecto vinculado al avance
    assert.equal(estado.usos.length, 1);
    assert.equal(estado.usos[0].id_articulo, 101);
    assert.equal(estado.usos[0].cantidad_utilizada, 12);
    assert.equal(estado.usos[0].id_avance, resultado.id_avance);

    // 4. [CRITERIO SCRUM FUNDAMENTAL] El Cardex de bodega NO se altera ni se duplica
    assert.equal(
        estado.cardex.length,
        movimientosCardexPrevios,
        'El Cardex de bodega no debe recibir ningún nuevo movimiento porque el material ya fue egresado previamente'
    );

    // 5. [CRITERIO FUNDAMENTAL] El stock disponible de bodega NO disminuye
    assert.equal(
        estado.articulos.get(101)!.stock_actual,
        stockInicialBodega,
        'El stock físico de bodega no debe alterarse al declarar consumo en faena'
    );

    // 6. Auditoría inmutable registrada
    assert.equal(estado.auditoria.length, 1);
    assert.equal(estado.auditoria[0][2], 'REGISTRO_AVANCE_TERRENO');
    assert.equal(estado.auditoria[0][0], 3); // idUsuarioEjecutor
});
