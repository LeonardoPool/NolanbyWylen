/**
 * Motor Centralizado de Fechas y Tiempos para NOLAN by WYLEN
 * Zona horaria legal y operativa estricta: America/Merida (UTC-6).
 *
 * REGLA CRÍTICA DE ARQUITECTURA:
 * En Vercel o entornos serverless el runtime opera en UTC. A partir de las 18:00 hrs
 * locales de Mérida ya es el día siguiente en UTC. Todas las comparaciones y fechas
 * de negocio DEBEN calcularse explícitamente en 'America/Merida' mediante Intl.DateTimeFormat.
 */

export const ZONA_HORARIA_MERIDA = "America/Merida";

const formateadorFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA_MERIDA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formateadorHora = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONA_HORARIA_MERIDA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formateadorPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA_MERIDA,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
});

/**
 * Devuelve la fecha actual en America/Merida en formato ISO calendario: YYYY-MM-DD.
 */
export function obtenerFechaHoyMerida(fechaBase?: Date | string | number): string {
  const d = fechaBase ? new Date(fechaBase) : new Date();
  // 'en-CA' produce formato ISO YYYY-MM-DD directamente
  return formateadorFecha.format(d);
}

/**
 * Devuelve la hora y minutos en America/Merida en formato 24h: HH:mm.
 */
export function obtenerHoraMerida(fechaBase?: Date | string | number): string {
  const d = fechaBase ? new Date(fechaBase) : new Date();
  return formateadorHora.format(d);
}

/**
 * Devuelve los minutos transcurridos desde las 00:00 del día en America/Merida.
 * Reemplaza de forma segura a Date.getHours() * 60 + Date.getMinutes().
 */
export function obtenerMinutosDelDiaMerida(fechaBase: Date | string | number): number {
  const d = typeof fechaBase === "object" ? fechaBase : new Date(fechaBase);
  const partes = formateadorPartes.formatToParts(d);
  let horas = 0;
  let minutos = 0;

  for (const p of partes) {
    if (p.type === "hour") horas = parseInt(p.value, 10);
    if (p.type === "minute") minutos = parseInt(p.value, 10);
  }

  // Ajuste en caso de formato 24
  if (horas === 24) horas = 0;
  return horas * 60 + minutos;
}

/**
 * Compara dos fechas en formato calendario YYYY-MM-DD.
 * Devuelve:
 *   < 0 si fechaA es anterior a fechaB
 *   0 si son iguales
 *   > 0 si fechaA es posterior a fechaB
 */
export function compararFechasCalendario(fechaA: string, fechaB: string): number {
  return fechaA.localeCompare(fechaB);
}

/**
 * Verifica si una fecha calendario YYYY-MM-DD es anterior al día de hoy en America/Merida.
 */
export function esFechaPasadaMerida(fechaStr: string, fechaReferencia?: string): boolean {
  const hoy = fechaReferencia || obtenerFechaHoyMerida();
  return compararFechasCalendario(fechaStr, hoy) < 0;
}

/**
 * Calcula la diferencia en días naturales entre dos fechas YYYY-MM-DD (ambas inclusive o exclusivas).
 */
export function calcularDiasEntreFechas(fechaInicio: string, fechaFin: string): number {
  // Parsing seguro sin desplazamiento horario: Año, Mes (0-indexed), Día
  const [y1, m1, d1] = fechaInicio.split("-").map(Number);
  const [y2, m2, d2] = fechaFin.split("-").map(Number);

  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);

  const diffMs = t2 - t1;
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Suma o resta días a una fecha calendario YYYY-MM-DD.
 */
export function sumarDiasAFecha(fechaStr: string, dias: number): string {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const dateUtc = new Date(Date.UTC(y, m - 1, d + dias));
  return dateUtc.toISOString().slice(0, 10);
}

/**
 * Obtiene el rango exacto de inicio y fin del día en UTC correspondiente a las 00:00:00 y 23:59:59 de America/Merida.
 * Mérida es UTC-6 (sin horario de verano desde 2022).
 * Por ende:
 *   00:00:00 Mérida = 06:00:00 UTC del mismo día.
 *   23:59:59 Mérida = 05:59:59.999 UTC del día siguiente.
 */
export function obtenerRangoDiaMeridaEnUtc(fechaYmd?: string): { inicioUtc: string; finUtc: string } {
  const dia = fechaYmd || obtenerFechaHoyMerida();
  const siguienteDia = sumarDiasAFecha(dia, 1);
  return {
    inicioUtc: `${dia}T06:00:00.000Z`,
    finUtc: `${siguienteDia}T05:59:59.999Z`,
  };
}

