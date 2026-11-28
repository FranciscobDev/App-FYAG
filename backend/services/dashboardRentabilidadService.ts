import { ErrorAplicacion } from './errores';

export type CategoriaCosto = 'materiales' | 'mermas' | 'horas';

export interface EntradaDashboardRentabilidad {
    valor_venta: number;
    presupuesto_inicial: number;
    presupuesto_materiales: number | null;
    presupuesto_horas: number; // horas planificadas
    presupuesto_mermas: number;
    costo_hora: number; // H39
    egresos_netos_pmp: number; // egresos a PMP menos devoluciones (H36)
    mermas_total: number; // pérdidas a PMP asociadas al proyecto
    horas_registradas: number; // H41
}

export interface FilaCategoriaRentabilidad {
    categoria: CategoriaCosto;
    planificado: number;
    real: number;
    desviacion_monto: number; // real - planificado (positivo = sobrecosto)
    desviacion_porcentaje: number | null; // null si no había planificado
    composicion_porcentaje: number; // % del costo real total
    sobrecosto: boolean;
}

export interface DashboardRentabilidad {
    categorias: FilaCategoriaRentabilidad[];
    totales: {
        planificado: number;
        real: number;
        desviacion_monto: number;
        desviacion_porcentaje: number | null;
        margen_real: number;
        margen_planificado: number;
    };
    categoria_mayor_sobrecosto: CategoriaCosto | null;
    grafico_barras: { categoria: CategoriaCosto; planificado: number; real: number }[];
    grafico_torta: { categoria: CategoriaCosto; monto: number; porcentaje: number }[];
}

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const pct = (parte: number, base: number): number | null => (base > 0 ? r2((parte / base) * 100) : null);

/** Solo los proyectos Cerrados (H34) acceden al dashboard final. */
export const validarProyectoCerrado = (estado: string | null | undefined): void => {
    if (String(estado ?? '').trim().toLowerCase() !== 'cerrado') {
        throw new ErrorAplicacion(
            403,
            `El dashboard de rentabilidad solo está disponible para proyectos Cerrados (estado actual: ${estado ?? 'sin estado'})`
        );
    }
};

export const calcularDashboardRentabilidad = (e: EntradaDashboardRentabilidad): DashboardRentabilidad => {
    const plantHoras = r0(e.presupuesto_horas * e.costo_hora);
    const plantMateriales =
        e.presupuesto_materiales != null && e.presupuesto_materiales > 0
            ? r0(e.presupuesto_materiales)
            : Math.max(r0(e.presupuesto_inicial) - plantHoras, 0);

    const base: { categoria: CategoriaCosto; planificado: number; real: number }[] = [
        { categoria: 'materiales', planificado: plantMateriales, real: r0(e.egresos_netos_pmp) },
        { categoria: 'mermas', planificado: r0(e.presupuesto_mermas), real: r0(e.mermas_total) },
        { categoria: 'horas', planificado: plantHoras, real: r0(e.horas_registradas * e.costo_hora) },
    ];

    const totalReal = base.reduce((a, c) => a + c.real, 0);
    const totalPlan = base.reduce((a, c) => a + c.planificado, 0);

    const categorias: FilaCategoriaRentabilidad[] = base.map((c) => ({
        ...c,
        desviacion_monto: c.real - c.planificado,
        desviacion_porcentaje: pct(c.real - c.planificado, c.planificado),
        composicion_porcentaje: totalReal > 0 ? r2((c.real / totalReal) * 100) : 0,
        sobrecosto: c.real > c.planificado,
    }));

    const sobrecostos = categorias.filter((c) => c.desviacion_monto > 0);
    const mayor = sobrecostos.sort((a, b) => b.desviacion_monto - a.desviacion_monto)[0];

    return {
        categorias,
        totales: {
            planificado: totalPlan,
            real: totalReal,
            desviacion_monto: totalReal - totalPlan,
            desviacion_porcentaje: pct(totalReal - totalPlan, totalPlan),
            margen_real: r0(e.valor_venta) - totalReal,
            margen_planificado: r0(e.valor_venta) - totalPlan,
        },
        categoria_mayor_sobrecosto: mayor ? mayor.categoria : null,
        grafico_barras: base,
        grafico_torta: categorias.map((c) => ({ categoria: c.categoria, monto: c.real, porcentaje: c.composicion_porcentaje })),
    };
};
