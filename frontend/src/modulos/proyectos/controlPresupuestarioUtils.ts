// Utilidades de cálculo presupuestario en vivo (H27) para el Administrador:
// semáforo financiero (verde, amarillo, rojo), consumo de presupuesto y margen estimado.
import { Proyecto } from "@/nucleo/tipos";

export type NivelSemaforoPresupuesto = "verde" | "amarillo" | "rojo";

export interface ResumenPresupuestoProyectoH27 {
  proyecto: Proyecto;
  presupuestoTotal: number;
  presupuestoMateriales: number;
  presupuestoManoObra: number;
  valorVenta: number;
  costoMaterialesReal: number;
  costoManoObraReal: number;
  costoOtrosBase: number;
  horasReales: number;
  horasPresupuestadas: number;
  tasaHoraria: number;
  costoRealTotal: number;
  saldoPresupuesto: number;
  porcentajeConsumo: number;
  margenEstimadoClp: number;
  margenEstimadoPct: number;
  semaforo: NivelSemaforoPresupuesto;
  etiquetaSemaforo: string;
  descripcionSemaforo: string;
  cantidadDespachos: number;
  cantidadRegistrosHoras: number;
}

export interface AjusteSimuladoH27 {
  materialesExtraClp: number;
  horasExtraHh: number;
}

/**
 * Clasifica el indicador de semáforo presupuestario según el porcentaje de consumo:
 * - Verde: < 80 % del presupuesto consumido
 * - Amarillo: entre 80 % y 100 % (zona de alerta preventiva)
 * - Rojo: > 100 % (sobrecosto presupuestario)
 */
export function clasificarSemaforoPresupuesto(
  porcentajeConsumo: number
): {
  semaforo: NivelSemaforoPresupuesto;
  etiqueta: string;
  descripcion: string;
} {
  if (porcentajeConsumo > 100) {
    return {
      semaforo: "rojo",
      etiqueta: "Sobrecosto (> 100 %)",
      descripcion: "El costo real supera el presupuesto aprobado de la obra.",
    };
  }
  if (porcentajeConsumo >= 80) {
    return {
      semaforo: "amarillo",
      etiqueta: "Alerta (80 % - 100 %)",
      descripcion: "Consumo cercano al límite presupuestado; controlar egresos y HH.",
    };
  }
  return {
    semaforo: "verde",
    etiqueta: "Saludable (< 80 %)",
    descripcion: "Ejecución financiera controlada dentro del presupuesto planificado.",
  };
}

/**
 * Calcula en vivo el control presupuestario y margen estimado de un proyecto según la fórmula H27:
 *   Costo Real Total = Costo Materiales (PMP) + Costo Mano de Obra (HH × Tasa Horaria) [+ Otros Base]
 *   Consumo (%)      = (Costo Real Total / Presupuesto Total) × 100
 *   Margen ($)       = Valor de Venta − Costo Real Total
 *   Margen (%)       = (Margen ($) / Valor de Venta) × 100
 */
export function calcularControlPresupuestarioH27(
  proyecto: Proyecto,
  ajusteSimulado?: AjusteSimuladoH27
): ResumenPresupuestoProyectoH27 {
  const tasaHoraria = Number(proyecto.hourlyRate || 18500);
  const horasPresupuestadas = Number(proyecto.budgetHours || 0);
  const presupuestoMateriales = Number(proyecto.budgetMaterials || 0);
  const presupuestoManoObra = horasPresupuestadas * tasaHoraria;
  const presupuestoTotal =
    Number(proyecto.budget || 0) > 0
      ? Number(proyecto.budget)
      : presupuestoMateriales + presupuestoManoObra;

  const valorVenta = Number(proyecto.saleValue || 0);

  const despachos = Array.isArray(proyecto.dispatches) ? proyecto.dispatches : [];
  const registrosHoras = Array.isArray(proyecto.laborEntries) ? proyecto.laborEntries : [];

  const costoMaterialesDesdeDespachos = despachos.reduce(
    (acc, d) => acc + Number(d.totalCost ?? Number(d.quantity || 0) * Number(d.unitCost || 0)),
    0
  );
  const costoMaterialesBase =
    costoMaterialesDesdeDespachos > 0
      ? costoMaterialesDesdeDespachos
      : Number(proyecto.costRealMaterials || 0);

  const horasDesdeRegistros = registrosHoras.reduce((acc, h) => acc + Number(h.hours || 0), 0);
  const horasBase =
    horasDesdeRegistros > 0 ? horasDesdeRegistros : Number(proyecto.hoursReal || 0);

  const costoManoObraDesdeRegistros = registrosHoras.reduce(
    (acc, h) => acc + Number(h.totalCost ?? Number(h.hours || 0) * Number(h.hourlyCost || tasaHoraria)),
    0
  );
  const costoManoObraBase =
    costoManoObraDesdeRegistros > 0
      ? costoManoObraDesdeRegistros
      : Number(proyecto.costRealHours || horasBase * tasaHoraria);

  // Si el proyecto tiene costReal registrado mayor a la suma desglosada, conservar diferencia como base
  const sumaDesglosada = costoMaterialesBase + costoManoObraBase;
  const costoOtrosBase =
    Number(proyecto.costReal || 0) > sumaDesglosada
      ? Math.round(Number(proyecto.costReal) - sumaDesglosada)
      : 0;

  const materialesExtra = Math.max(0, Number(ajusteSimulado?.materialesExtraClp || 0));
  const horasExtra = Math.max(0, Number(ajusteSimulado?.horasExtraHh || 0));

  const costoMaterialesReal = Math.round(costoMaterialesBase + materialesExtra);
  const horasReales = Number((horasBase + horasExtra).toFixed(2));
  const costoManoObraReal = Math.round(costoManoObraBase + horasExtra * tasaHoraria);
  const costoRealTotal = costoMaterialesReal + costoManoObraReal + costoOtrosBase;

  const saldoPresupuesto = presupuestoTotal - costoRealTotal;
  const porcentajeConsumo =
    presupuestoTotal > 0 ? Number(((costoRealTotal / presupuestoTotal) * 100).toFixed(1)) : 0;

  const margenEstimadoClp = valorVenta - costoRealTotal;
  const margenEstimadoPct =
    valorVenta > 0 ? Number(((margenEstimadoClp / valorVenta) * 100).toFixed(1)) : 0;

  const clasificacion = clasificarSemaforoPresupuesto(porcentajeConsumo);

  return {
    proyecto,
    presupuestoTotal,
    presupuestoMateriales,
    presupuestoManoObra,
    valorVenta,
    costoMaterialesReal,
    costoManoObraReal,
    costoOtrosBase,
    horasReales,
    horasPresupuestadas,
    tasaHoraria,
    costoRealTotal,
    saldoPresupuesto,
    porcentajeConsumo,
    margenEstimadoClp,
    margenEstimadoPct,
    semaforo: clasificacion.semaforo,
    etiquetaSemaforo: clasificacion.etiqueta,
    descripcionSemaforo: clasificacion.descripcion,
    cantidadDespachos: despachos.length,
    cantidadRegistrosHoras: registrosHoras.length,
  };
}
