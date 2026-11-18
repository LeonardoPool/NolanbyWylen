/**
 * Motor de Cálculo Laboral conforme a la Ley Federal del Trabajo (LFT) de México
 * Cumplimiento del Art. 132 fr. XXXIV, Arts. 60, 61, 66, 67 y 68.
 */

import { obtenerMinutosDelDiaMerida } from "../utils/fechas-laborales";

export interface EventoAsistenciaSimple {
  tipoEvento: "ENTRADA" | "INICIO_DESCANSO" | "FIN_DESCANSO" | "SALIDA";
  fechaHora: string; // ISO string
  metodoRegistro: string;
  fotoUrl?: string | null;
  motivoAjuste?: string | null;
}

export interface JornadaDiariaCalculada {
  fecha: string; // YYYY-MM-DD
  entrada: EventoAsistenciaSimple | null;
  inicioDescanso: EventoAsistenciaSimple | null;
  finDescanso: EventoAsistenciaSimple | null;
  salida: EventoAsistenciaSimple | null;
  minutosTrabajadosEfectivos: number;
  minutosDescanso: number;
  horasOrdinarias: number;
  horasExtraDobles: number;
  horasExtraTriples: number;
  esRetardo: boolean;
  minutosRetardo: number;
  estadoJornada: "COMPLETA" | "EN_CURSO" | "INCOMPLETA" | "SIN_REGISTROS";
}

export interface ResumenSemanalLFT {
  horasOrdinariasTotales: number;
  horasExtraDoblesTotales: number;
  horasExtraTriplesTotales: number;
  totalRetardos: number;
  diasLaborados: number;
}

export interface HorarioLaboralConfig {
  semanal: {
    dias: number[]; // Ej. [1, 2, 3, 4, 5] (0=Domingo, 1=Lunes .. 6=Sábado)
    horaEntrada: string; // e.g. "08:00"
    horaSalida: string; // e.g. "18:00"
    toleranciaEntradaMinutos: number; // e.g. 15
  };
  finDeSemana: {
    sabadoLaborable: boolean; // true si el bloque secundario/fin de semana está activo
    dias?: number[]; // Días asignados al horario secundario/fin de semana (ej. [6])
    horaEntradaSabado: string; // e.g. "09:00"
    horaSalidaSabado: string; // e.g. "14:00"
    toleranciaSabadoMinutos: number; // e.g. 15
    diaDescansoSemanal: number; // Día principal de descanso LFT (ej. 0 = Domingo)
    diasDescanso?: number[]; // Todos los días de descanso seleccionados (ej. [0] o [6, 0])
  };
  horasExtras: {
    minutosMinimosToleranciaSalida: number; // 15 minutos de umbral para activar horas extras
  };
}

export const HORARIO_LABORAL_DEFAULT: HorarioLaboralConfig = {
  semanal: {
    dias: [1, 2, 3, 4, 5], // Lunes a Viernes
    horaEntrada: "08:00",
    horaSalida: "18:00",
    toleranciaEntradaMinutos: 15,
  },
  finDeSemana: {
    sabadoLaborable: true,
    dias: [6], // Sábado
    horaEntradaSabado: "09:00",
    horaSalidaSabado: "14:00",
    toleranciaSabadoMinutos: 15,
    diaDescansoSemanal: 0, // Domingo
    diasDescanso: [0],
  },
  horasExtras: {
    minutosMinimosToleranciaSalida: 15,
  },
};

export function convertirHoraAMinutos(horaStr: string): number {
  if (!horaStr || !horaStr.includes(":")) return 9 * 60;
  const [h, m] = horaStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Obtiene los días asignados al segundo horario (fin de semana / turno reducido).
 */
export function obtenerDiasSegundoHorario(config: HorarioLaboralConfig): number[] {
  if (!config.finDeSemana.sabadoLaborable) return [];
  if (Array.isArray(config.finDeSemana.dias)) {
    return config.finDeSemana.dias;
  }
  return [6]; // Por compatibilidad con configuraciones previas, Sábado (6)
}

/**
 * Obtiene todos los días de la semana (0..6) que fungen como descanso / inhábiles.
 */
export function obtenerDiasDescanso(config: HorarioLaboralConfig): number[] {
  const diasSemanal = Array.isArray(config.semanal.dias) ? config.semanal.dias : [1, 2, 3, 4, 5];
  const diasEspecial = obtenerDiasSegundoHorario(config);
  const activos = new Set([...diasSemanal, ...diasEspecial]);
  const descansos: number[] = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    if (!activos.has(d)) descansos.push(d);
  }
  return descansos;
}

/**
 * Evalúa de forma inteligente qué régimen horario aplica para un día de la semana (0=Domingo .. 6=Sábado).
 */
export function evaluarConfiguracionPorDiaSemana(
  diaSemana: number,
  config: HorarioLaboralConfig = HORARIO_LABORAL_DEFAULT
): {
  tipo: "SEMANAL" | "FIN_DE_SEMANA" | "DESCANSO";
  esDescanso: boolean;
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
} {
  const diasSemanal = Array.isArray(config.semanal.dias) ? config.semanal.dias : [1, 2, 3, 4, 5];
  const diasEspecial = obtenerDiasSegundoHorario(config);

  if (diasSemanal.includes(diaSemana)) {
    return {
      tipo: "SEMANAL",
      esDescanso: false,
      horaEntrada: config.semanal.horaEntrada,
      horaSalida: config.semanal.horaSalida,
      toleranciaMinutos: config.semanal.toleranciaEntradaMinutos,
    };
  }

  if (diasEspecial.includes(diaSemana)) {
    return {
      tipo: "FIN_DE_SEMANA",
      esDescanso: false,
      horaEntrada: config.finDeSemana.horaEntradaSabado,
      horaSalida: config.finDeSemana.horaSalidaSabado,
      toleranciaMinutos: config.finDeSemana.toleranciaSabadoMinutos,
    };
  }

  return {
    tipo: "DESCANSO",
    esDescanso: true,
    horaEntrada: config.semanal.horaEntrada,
    horaSalida: config.semanal.horaSalida,
    toleranciaMinutos: config.semanal.toleranciaEntradaMinutos,
  };
}

/**
 * Formatea un arreglo de días (0=Dom..6=Sáb) a texto legible en español (ej. "Lun a Vie", "Sáb", "Dom").
 */
export function formatearResumenDias(dias: number[]): string {
  if (!dias || dias.length === 0) return "Ninguno";
  const ordenLaboral = [1, 2, 3, 4, 5, 6, 0];
  const nombresCortos: Record<number, string> = {
    1: "Lun",
    2: "Mar",
    3: "Mié",
    4: "Jue",
    5: "Vie",
    6: "Sáb",
    0: "Dom",
  };
  const nombresLargos: Record<number, string> = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    0: "Domingo",
  };

  const ordenados = ordenLaboral.filter((d) => dias.includes(d));
  if (ordenados.length === 1) return nombresLargos[ordenados[0]];

  const clave = ordenados.join(",");
  if (clave === "1,2,3,4,5") return "Lun a Vie";
  if (clave === "1,2,3,4,5,6") return "Lun a Sáb";
  if (clave === "1,2,3,4,5,6,0") return "Lun a Dom";
  if (clave === "6,0") return "Sáb y Dom";

  if (ordenados.length === 2) {
    return `${nombresCortos[ordenados[0]]} y ${nombresCortos[ordenados[1]]}`;
  }

  return ordenados.map((d) => nombresCortos[d]).join(", ");
}

const TOPE_HORAS_DOBLES_SEMANAL = 9; // LFT Art. 66 y 68: Máximo 9 horas extras a la semana al 200%

/**
 * Agrupa una lista cronológica de eventos de asistencia por día para un empleado
 * y aplica las reglas oficiales de horario semanal, fin de semana y horas extras (15 min umbral).
 */
export function procesarJornadaDiaria(
  eventosDelDia: EventoAsistenciaSimple[],
  fechaDiaStr: string,
  configHorario: HorarioLaboralConfig = HORARIO_LABORAL_DEFAULT
): JornadaDiariaCalculada {
  let entrada: EventoAsistenciaSimple | null = null;
  let inicioDescanso: EventoAsistenciaSimple | null = null;
  let finDescanso: EventoAsistenciaSimple | null = null;
  let salida: EventoAsistenciaSimple | null = null;

  // Ordenar cronológicamente
  const ordenados = [...eventosDelDia].sort(
    (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()
  );

  for (const ev of ordenados) {
    if (ev.tipoEvento === "ENTRADA" && !entrada) entrada = ev;
    else if (ev.tipoEvento === "INICIO_DESCANSO" && !inicioDescanso) inicioDescanso = ev;
    else if (ev.tipoEvento === "FIN_DESCANSO" && !finDescanso) finDescanso = ev;
    else if (ev.tipoEvento === "SALIDA") salida = ev; // Si hay varias salidas, toma la última
  }

  // Evaluar de forma inteligente qué régimen aplica para el día de la semana
  const [anio, mes, dia] = fechaDiaStr.split("-").map(Number);
  const diaObj = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
  const diaSemana = diaObj.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

  const infoRegimenDia = evaluarConfiguracionPorDiaSemana(diaSemana, configHorario);
  const horaEntradaProgramadaMin = convertirHoraAMinutos(infoRegimenDia.horaEntrada);
  const horaSalidaProgramadaMin = convertirHoraAMinutos(infoRegimenDia.horaSalida);
  const toleranciaEntradaMin = infoRegimenDia.toleranciaMinutos;
  const esDiaDescanso = infoRegimenDia.esDescanso;

  // Si no hay entrada
  if (!entrada) {
    return {
      fecha: fechaDiaStr,
      entrada: null,
      inicioDescanso: null,
      finDescanso: null,
      salida: null,
      minutosTrabajadosEfectivos: 0,
      minutosDescanso: 0,
      horasOrdinarias: 0,
      horasExtraDobles: 0,
      horasExtraTriples: 0,
      esRetardo: false,
      minutosRetardo: 0,
      estadoJornada: "SIN_REGISTROS",
    };
  }

  // Evaluar retardo en zona horaria America/Merida frente al horario programado
  const minutosEntrada = obtenerMinutosDelDiaMerida(entrada.fechaHora);
  const limiteTolerancia = horaEntradaProgramadaMin + toleranciaEntradaMin;
  const esRetardo = !esDiaDescanso && minutosEntrada > limiteTolerancia;
  const minutosRetardo = esRetardo ? minutosEntrada - horaEntradaProgramadaMin : 0;

  // Si aún no hay salida
  if (!salida) {
    return {
      fecha: fechaDiaStr,
      entrada,
      inicioDescanso,
      finDescanso,
      salida: null,
      minutosTrabajadosEfectivos: 0,
      minutosDescanso: 0,
      horasOrdinarias: 0,
      horasExtraDobles: 0,
      horasExtraTriples: 0,
      esRetardo,
      minutosRetardo,
      estadoJornada: "EN_CURSO",
    };
  }

  // Calcular tiempo bruto entre entrada y salida
  const msBrutos = new Date(salida.fechaHora).getTime() - new Date(entrada.fechaHora).getTime();
  const minutosBrutos = Math.max(0, Math.floor(msBrutos / (1000 * 60)));

  // Calcular tiempo de descanso/comida
  let minutosDescanso = 0;
  if (inicioDescanso && finDescanso) {
    const msDescanso =
      new Date(finDescanso.fechaHora).getTime() - new Date(inicioDescanso.fechaHora).getTime();
    minutosDescanso = Math.max(0, Math.floor(msDescanso / (1000 * 60)));
  }

  // Tiempo efectivo trabajado
  const minutosEfectivos = Math.max(0, minutosBrutos - minutosDescanso);

  // EVALUACIÓN DE HORAS EXTRAS SEGÚN REGLA DE SALIDA:
  // "del horario final laboral el empleado puede marcar horas extras solo y siempre que esté
  // al menos 15 minutos después de la hora de salida y ahí corre el tiempo en minutos y horas del tiempo extra."
  let minutosExtraDia = 0;

  if (esDiaDescanso) {
    // Si laboró en su día de descanso oficial, todas las horas son extraordinarias / descanso laborado
    minutosExtraDia = minutosEfectivos;
  } else {
    const minutosSalida = obtenerMinutosDelDiaMerida(salida.fechaHora);
    const diferenciaSobreSalida = minutosSalida - horaSalidaProgramadaMin;
    const umbralMinutos = configHorario.horasExtras.minutosMinimosToleranciaSalida || 15;

    // Solo corre tiempo extra si superó el umbral de al menos 15 minutos
    if (diferenciaSobreSalida >= umbralMinutos) {
      minutosExtraDia = Math.min(minutosEfectivos, Math.max(0, diferenciaSobreSalida));
    } else {
      minutosExtraDia = 0;
    }
  }

  // Minutos ordinarios: el tiempo efectivo restante que no es tiempo extra
  const minutosOrdinarios = Math.max(0, minutosEfectivos - minutosExtraDia);
  const horasOrdinarias = parseFloat((minutosOrdinarios / 60).toFixed(2));
  const horasExtraDia = parseFloat((minutosExtraDia / 60).toFixed(2));

  // LFT Art. 66: Las primeras 3 horas extras de un día son dobles; cualquier exceso diario pasa a triple
  const horasExtraDoblesDia = Math.min(horasExtraDia, 3);
  const horasExtraTriplesDia = parseFloat(Math.max(0, horasExtraDia - 3).toFixed(2));

  const tieneDescansosCompletos = (inicioDescanso && finDescanso) || (!inicioDescanso && !finDescanso);
  const estadoJornada: "COMPLETA" | "INCOMPLETA" =
    entrada && salida && tieneDescansosCompletos ? "COMPLETA" : "INCOMPLETA";

  return {
    fecha: fechaDiaStr,
    entrada,
    inicioDescanso,
    finDescanso,
    salida,
    minutosTrabajadosEfectivos: minutosEfectivos,
    minutosDescanso,
    horasOrdinarias,
    horasExtraDobles: horasExtraDoblesDia,
    horasExtraTriples: horasExtraTriplesDia,
    esRetardo,
    minutosRetardo,
    estadoJornada,
  };
}

/**
 * Consolida jornadas de un período y aplica el tope semanal de 9 horas extras dobles (LFT Art. 68)
 */
export function consolidarPeriodoLFT(
  jornadas: JornadaDiariaCalculada[]
): {
  jornadasAjustadas: JornadaDiariaCalculada[];
  resumen: ResumenSemanalLFT;
} {
  let acumuladorHorasDoblesSemana = 0;
  let totalOrdinarias = 0;
  let totalDobles = 0;
  let totalTriples = 0;
  let totalRetardos = 0;
  let diasLaborados = 0;

  const jornadasAjustadas = jornadas.map((j) => {
    if (j.estadoJornada === "SIN_REGISTROS") return j;

    diasLaborados += 1;
    totalOrdinarias += j.horasOrdinarias;
    if (j.esRetardo) totalRetardos += 1;

    let doblesFinal = j.horasExtraDobles;
    let triplesFinal = j.horasExtraTriples;

    // Verificar si se rebasa el tope semanal de 9 horas extras dobles
    if (acumuladorHorasDoblesSemana + doblesFinal > TOPE_HORAS_DOBLES_SEMANAL) {
      const espacioDisponible = Math.max(0, TOPE_HORAS_DOBLES_SEMANAL - acumuladorHorasDoblesSemana);
      const excedenteATriples = doblesFinal - espacioDisponible;
      doblesFinal = espacioDisponible;
      triplesFinal = parseFloat((triplesFinal + excedenteATriples).toFixed(2));
      acumuladorHorasDoblesSemana = TOPE_HORAS_DOBLES_SEMANAL;
    } else {
      acumuladorHorasDoblesSemana += doblesFinal;
    }

    totalDobles += doblesFinal;
    totalTriples += triplesFinal;

    return {
      ...j,
      horasExtraDobles: parseFloat(doblesFinal.toFixed(2)),
      horasExtraTriples: parseFloat(triplesFinal.toFixed(2)),
    };
  });

  return {
    jornadasAjustadas,
    resumen: {
      horasOrdinariasTotales: parseFloat(totalOrdinarias.toFixed(2)),
      horasExtraDoblesTotales: parseFloat(totalDobles.toFixed(2)),
      horasExtraTriplesTotales: parseFloat(totalTriples.toFixed(2)),
      totalRetardos,
      diasLaborados,
    },
  };
}
