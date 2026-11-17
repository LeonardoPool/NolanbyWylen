/**
 * Motor de Cálculo de Vacaciones conforme a la Ley Federal del Trabajo (LFT)
 * Cumplimiento estricto de los Artículos 76, 78, 80 y 81 de la LFT.
 */

import {
  obtenerFechaHoyMerida,
  compararFechasCalendario,
  calcularDiasEntreFechas,
  sumarDiasAFecha,
} from "../utils/fechas-laborales";

/**
 * Tabla legal de vacaciones mínimas de la Ley Federal del Trabajo (Art. 76 LFT).
 * Reforma 'Vacaciones Dignas' vigente.
 */
export function calcularDiasPorAnioServicioLFT(aniosCumplidos: number): number {
  if (aniosCumplidos < 1) return 0;
  if (aniosCumplidos === 1) return 12;
  if (aniosCumplidos === 2) return 14;
  if (aniosCumplidos === 3) return 16;
  if (aniosCumplidos === 4) return 18;
  if (aniosCumplidos === 5) return 20;
  if (aniosCumplidos <= 10) return 22;
  if (aniosCumplidos <= 15) return 24;
  if (aniosCumplidos <= 20) return 26;
  if (aniosCumplidos <= 25) return 28;
  if (aniosCumplidos <= 30) return 30;
  return 32;
}

/**
 * Calcula los aniversarios de servicio cumplidos según la fecha real de ingreso.
 * Los derechos se generan ÚNICAMENTE al cumplir el aniversario, NUNCA por año calendario.
 */
export function calcularAniversariosCumplidos(
  fechaIngresoYmd: string,
  fechaReferenciaYmd?: string
): {
  aniosCumplidos: number;
  fechaUltimoAniversario: string | null;
  fechaProximoAniversario: string;
  diasParaProximoAniversario: number;
} {
  const hoy = fechaReferenciaYmd || obtenerFechaHoyMerida();
  const [yIngreso, mIngreso, dIngreso] = fechaIngresoYmd.split("-").map(Number);
  const [yHoy, mHoy, dHoy] = hoy.split("-").map(Number);

  let anios = yHoy - yIngreso;

  // Fecha de aniversario para el año en curso
  const mStr = String(mIngreso).padStart(2, "0");
  const dStr = String(dIngreso).padStart(2, "0");
  const aniversarioEsteAnio = `${yHoy}-${mStr}-${dStr}`;

  if (compararFechasCalendario(hoy, aniversarioEsteAnio) < 0) {
    // Aún no ha cumplido el aniversario de este año
    anios = Math.max(0, anios - 1);
  }

  const aniosCumplidos = Math.max(0, anios);

  // Fecha del último aniversario cumplido
  const fechaUltimoAniversario =
    aniosCumplidos > 0 ? `${yIngreso + aniosCumplidos}-${mStr}-${dStr}` : null;

  // Próximo aniversario
  const fechaProximoAniversario = `${yIngreso + aniosCumplidos + 1}-${mStr}-${dStr}`;
  const diasParaProximo = Math.max(0, calcularDiasEntreFechas(hoy, fechaProximoAniversario) - 1);

  return {
    aniosCumplidos,
    fechaUltimoAniversario,
    fechaProximoAniversario,
    diasParaProximoAniversario: diasParaProximo,
  };
}
