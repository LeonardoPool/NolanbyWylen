/**
 * Motor de Cálculo Laboral conforme a la Ley Federal del Trabajo (LFT) de México
 * Cumplimiento del Art. 132 fr. XXXIV, Arts. 60, 61, 66, 67 y 68.
 */

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

const HORA_ENTRADA_TURNO_DEFAULT = 9 * 60; // 09:00 AM en minutos
const TOLERANCIA_RETARDO_MINUTOS = 15; // 15 minutos de tolerancia
const MINUTOS_JORNADA_ORDINARIA_DIARIA = 8 * 60; // 8 horas = 480 minutos (Jornada diurna LFT Art. 61)
const TOPE_HORAS_DOBLES_SEMANAL = 9; // LFT Art. 66 y 68: Máximo 9 horas extras a la semana al 200%

/**
 * Agrupa una lista cronológica de eventos de asistencia por día para un empleado
 */
export function procesarJornadaDiaria(
  eventosDelDia: EventoAsistenciaSimple[],
  fechaDiaStr: string
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

  // Evaluar retardo
  const dEntrada = new Date(entrada.fechaHora);
  const minutosEntrada = dEntrada.getHours() * 60 + dEntrada.getMinutes();
  const limiteTolerancia = HORA_ENTRADA_TURNO_DEFAULT + TOLERANCIA_RETARDO_MINUTOS;
  const esRetardo = minutosEntrada > limiteTolerancia;
  const minutosRetardo = esRetardo ? minutosEntrada - HORA_ENTRADA_TURNO_DEFAULT : 0;

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

  // Desglose de horas conforme a la LFT
  // Ordinarias: hasta 8 horas (480 minutos)
  const minutosOrdinarios = Math.min(minutosEfectivos, MINUTOS_JORNADA_ORDINARIA_DIARIA);
  const horasOrdinarias = parseFloat((minutosOrdinarios / 60).toFixed(2));

  // Horas extras del día (excedentes de 8 horas)
  const minutosExtraDia = Math.max(0, minutosEfectivos - MINUTOS_JORNADA_ORDINARIA_DIARIA);
  const horasExtraDia = parseFloat((minutosExtraDia / 60).toFixed(2));

  // LFT Art. 66: Las primeras 3 horas extras de un día son dobles; cualquier exceso diario de 3 horas pasa a triple
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
