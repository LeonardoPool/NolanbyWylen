"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import {
  procesarJornadaDiaria,
  convertirHoraAMinutos,
  evaluarConfiguracionPorDiaSemana,
  type EventoAsistenciaSimple,
  type HorarioLaboralConfig,
} from "@/lib/lft/calculo-horas";
import { obtenerFechaHoyMerida } from "@/lib/utils/fechas-laborales";
import { obtenerHorarioLaboralConfig } from "@/features/configuracion/actions";

export interface MetricasDashboard {
  resumenPersonal: {
    totalActivos: number;
    presentesHoy: number;
    enDescansoHoy: number;
    salieronHoy: number;
    sinMarcajeHoy: number;
    enViajeHoy: number;
    tasaPuntualidad: number; // Porcentaje 0-100
  };
  metricasHorasHoy: {
    horasOrdinariasHoy: number;
    horasExtraHoy: number;
    retardosHoy: number;
  };
  distribucionPersonal: {
    etiqueta: string;
    cantidad: number;
    porcentaje: number;
    color: string;
  }[];
  tendenciaSemanal: {
    diaNombre: string;
    fecha: string;
    aTiempo: number;
    retardos: number;
    ausentes: number;
    horasTotales: number;
  }[];
  ultimosMarcajes: {
    id: string;
    empleadoId: string;
    nombreCompleto: string;
    numeroEmpleado: string;
    puesto: string;
    tipoEvento: "ENTRADA" | "INICIO_DESCANSO" | "FIN_DESCANSO" | "SALIDA";
    fechaHora: string;
    metodoRegistro: string;
    fotoUrl: string | null;
    lugarNombre: string | null;
    distanciaMetros: number | null;
  }[];
  configuracionTaller: {
    nombreTaller: string;
    direccion: string;
    checadoWebHabilitado: boolean;
    radioTolerancia: number;
    latitud: number;
    longitud: number;
  };
  horarioLaboralConfig?: HorarioLaboralConfig;
}

/**
 * Obtiene métricas en vivo, cálculo de asistencias del día, tendencia semanal y últimos eventos
 */
export async function obtenerMetricasDashboard(): Promise<{
  success: boolean;
  metricas?: MetricasDashboard;
  error?: string;
}> {
  const adminClient = createAdminClient();

  try {
    const ahora = new Date();
    const hoyStr = ahora.toISOString().slice(0, 10);

    // Calcular fecha de hace 6 días (para la semana completa de 7 días)
    const hace7Dias = new Date(ahora);
    hace7Dias.setDate(ahora.getDate() - 6);
    const hace7DiasStr = hace7Dias.toISOString().slice(0, 10);

    // 1. Obtener empleados activos
    const { data: empleados, error: empError } = await adminClient
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (empError) throw empError;
    const listaEmpleados = empleados || [];
    const totalActivos = listaEmpleados.length;

    // 2. Obtener configuración del taller
    const { data: config } = await adminClient
      .from("configuracion_taller")
      .select("*")
      .limit(1)
      .maybeSingle();

    const configTaller = {
      nombreTaller: config?.nombre_taller || "Servicio Mecánico López",
      direccion: config?.direccion_taller || "Av. Principal del Taller",
      checadoWebHabilitado: config?.checado_web_habilitado ?? true,
      radioTolerancia: config?.radio_tolerancia_metros || 150,
      latitud: Number(config?.latitud) || 19.432608,
      longitud: Number(config?.longitud) || -99.133209,
    };

    // 3. Obtener permisos de viaje extraordinarios vigentes hoy
    const { data: permisosViaje } = await adminClient
      .from("ubicaciones_extraordinarias")
      .select("empleado_id")
      .eq("activo", true)
      .lte("fecha_inicio", hoyStr)
      .gte("fecha_fin", hoyStr);

    const empleadosEnViajeIds = new Set((permisosViaje || []).map((p) => p.empleado_id));

    // 4. Obtener asistencias de los últimos 7 días
    const { data: asistenciasSemana, error: asisError } = await adminClient
      .from("asistencias")
      .select(`
        id,
        empleado_id,
        fecha_hora,
        tipo_evento_original,
        metodo_registro,
        metadatos_origen,
        empleados (
          id,
          numero_empleado,
          nombre,
          apellidos,
          puesto
        )
      `)
      .gte("fecha_hora", `${hace7DiasStr}T00:00:00.000Z`)
      .order("fecha_hora", { ascending: false });

    if (asisError) throw asisError;
    const todasAsistencias = asistenciasSemana || [];

    // 4.5. Obtener configuración dinámica del horario laboral del taller
    const horarioConfig = await obtenerHorarioLaboralConfig();

    // Separar asistencias de hoy vs semana
    const asistenciasHoy = todasAsistencias.filter((a) => a.fecha_hora.startsWith(hoyStr));

    // Agrupar eventos de hoy por empleado
    const ultimoEventoPorEmpleado = new Map<string, any>();
    const eventosHoyPorEmpleado = new Map<string, EventoAsistenciaSimple[]>();

    for (const a of asistenciasHoy) {
      if (!ultimoEventoPorEmpleado.has(a.empleado_id)) {
        ultimoEventoPorEmpleado.set(a.empleado_id, a);
      }
      if (!eventosHoyPorEmpleado.has(a.empleado_id)) {
        eventosHoyPorEmpleado.set(a.empleado_id, []);
      }
      const meta = a.metadatos_origen as any;
      const tipoEv: EventoAsistenciaSimple["tipoEvento"] =
        a.tipo_evento_original === "MARCAJE" ? "ENTRADA" : (a.tipo_evento_original as any);
      eventosHoyPorEmpleado.get(a.empleado_id)!.push({
        tipoEvento: tipoEv,
        fechaHora: a.fecha_hora,
        metodoRegistro: a.metodo_registro,
        fotoUrl: meta?.foto_verificacion || null,
      });
    }

    let presentesHoy = 0;
    let enDescansoHoy = 0;
    let salieronHoy = 0;
    let enViajeHoy = 0;
    let entradasATiempo = 0;
    let retardosHoy = 0;
    let horasOrdinariasHoyTotal = 0;
    let horasExtraHoyTotal = 0;

    // Analizar empleados activos
    for (const emp of listaEmpleados) {
      const ultimo = ultimoEventoPorEmpleado.get(emp.id);

      if (ultimo) {
        const ev = ultimo.tipo_evento_original;
        if (ev === "ENTRADA" || ev === "FIN_DESCANSO") {
          presentesHoy += 1;
        } else if (ev === "INICIO_DESCANSO") {
          enDescansoHoy += 1;
        } else if (ev === "SALIDA") {
          salieronHoy += 1;
        }

        if (empleadosEnViajeIds.has(emp.id)) {
          enViajeHoy += 1;
        }
      }

      // Procesar jornada con motor LFT y configuración dinámica de horario laboral
      const eventosEmp = eventosHoyPorEmpleado.get(emp.id);
      if (eventosEmp && eventosEmp.length > 0) {
        const jornada = procesarJornadaDiaria(eventosEmp, hoyStr, horarioConfig);
        horasOrdinariasHoyTotal += jornada.horasOrdinarias;
        horasExtraHoyTotal += (jornada.horasExtraDobles + jornada.horasExtraTriples);
        if (jornada.esRetardo) {
          retardosHoy += 1;
        } else if (jornada.entrada) {
          entradasATiempo += 1;
        }
      }
    }

    const sinMarcajeHoy = Math.max(0, totalActivos - (presentesHoy + enDescansoHoy + salieronHoy));
    const totalEntradas = entradasATiempo + retardosHoy;
    const tasaPuntualidad =
      totalEntradas > 0 ? Math.round((entradasATiempo / totalEntradas) * 100) : 100;

    // Calcular distribución para gráfica Donut
    const totalConsiderado = totalActivos || 1;
    const distribucionPersonal = [
      {
        etiqueta: "En Taller",
        cantidad: presentesHoy,
        porcentaje: Math.round((presentesHoy / totalConsiderado) * 100),
        color: "#10B981", // Emerald 500
      },
      {
        etiqueta: "En Descanso",
        cantidad: enDescansoHoy,
        porcentaje: Math.round((enDescansoHoy / totalConsiderado) * 100),
        color: "#F59E0B", // Amber 500
      },
      {
        etiqueta: "En Viaje",
        cantidad: enViajeHoy,
        porcentaje: Math.round((enViajeHoy / totalConsiderado) * 100),
        color: "#8B5CF6", // Purple 500
      },
      {
        etiqueta: "Salida Finalizada",
        cantidad: salieronHoy,
        porcentaje: Math.round((salieronHoy / totalConsiderado) * 100),
        color: "#3B82F6", // Blue 500
      },
      {
        etiqueta: "Sin Marcaje",
        cantidad: sinMarcajeHoy,
        porcentaje: Math.round((sinMarcajeHoy / totalConsiderado) * 100),
        color: "#D4D4D8", // Zinc 300
      },
    ];

    // 5. Construir tendencia semanal dinámica (Últimos 7 días con Horario Laboral Configurado)
    const diasSemanaNombres = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const tendenciaSemanal: MetricasDashboard["tendenciaSemanal"] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(ahora.getDate() - i);
      const fStr = d.toISOString().slice(0, 10);
      const diaNumSemana = d.getDay(); // 0 = Dom, 6 = Sáb
      const diaNom = diasSemanaNombres[diaNumSemana];

      const asisDia = todasAsistencias.filter((a) => a.fecha_hora.startsWith(fStr));

      // Agrupar eventos por empleado en este día
      const eventosPorEmpDia = new Map<string, EventoAsistenciaSimple[]>();
      for (const a of asisDia) {
        if (!eventosPorEmpDia.has(a.empleado_id)) {
          eventosPorEmpDia.set(a.empleado_id, []);
        }
        const meta = a.metadatos_origen as any;
        const tipoEv: EventoAsistenciaSimple["tipoEvento"] =
          a.tipo_evento_original === "MARCAJE" ? "ENTRADA" : (a.tipo_evento_original as any);
        eventosPorEmpDia.get(a.empleado_id)!.push({
          tipoEvento: tipoEv,
          fechaHora: a.fecha_hora,
          metodoRegistro: a.metodo_registro,
          fotoUrl: meta?.foto_verificacion || null,
        });
      }

      let aTiempo = 0;
      let retardos = 0;
      let horasTotalesDia = 0;

      for (const [_, evs] of eventosPorEmpDia.entries()) {
        const j = procesarJornadaDiaria(evs, fStr, horarioConfig);
        if (j.esRetardo) retardos += 1;
        else if (j.entrada) aTiempo += 1;
        horasTotalesDia += (j.horasOrdinarias + j.horasExtraDobles + j.horasExtraTriples);
      }

      const presentesTotales = eventosPorEmpDia.size;
      const ausentes = Math.max(0, totalActivos - presentesTotales);

      tendenciaSemanal.push({
        diaNombre: diaNom,
        fecha: fStr,
        aTiempo,
        retardos,
        ausentes,
        horasTotales: parseFloat(horasTotalesDia.toFixed(1)),
      });
    }

    // 6. Últimos marcajes formateados
    const ultimosMarcajes: MetricasDashboard["ultimosMarcajes"] = todasAsistencias.slice(0, 10).map((a: any) => {
      const emp = a.empleados;
      const meta = a.metadatos_origen as any;
      return {
        id: a.id,
        empleadoId: a.empleado_id,
        nombreCompleto: emp ? `${emp.nombre} ${emp.apellidos}` : "Empleado",
        numeroEmpleado: emp?.numero_empleado || "EMP",
        puesto: emp?.puesto || "Taller",
        tipoEvento: a.tipo_evento_original,
        fechaHora: a.fecha_hora,
        metodoRegistro: a.metodo_registro,
        fotoUrl: meta?.foto_verificacion || null,
        lugarNombre: meta?.lugar_autorizado || null,
        distanciaMetros: meta?.distancia_metros || null,
      };
    });

    return {
      success: true,
      metricas: {
        resumenPersonal: {
          totalActivos,
          presentesHoy,
          enDescansoHoy,
          salieronHoy,
          sinMarcajeHoy,
          enViajeHoy,
          tasaPuntualidad,
        },
        metricasHorasHoy: {
          horasOrdinariasHoy: parseFloat(horasOrdinariasHoyTotal.toFixed(1)),
          horasExtraHoy: parseFloat(horasExtraHoyTotal.toFixed(1)),
          retardosHoy,
        },
        distribucionPersonal,
        tendenciaSemanal,
        ultimosMarcajes,
        configuracionTaller: configTaller,
        horarioLaboralConfig: horarioConfig,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al consultar métricas del dashboard.",
    };
  }
}

export interface EventoMarcajeDetalle {
  numero: number;
  tipo: "ENTRADA" | "INICIO_DESCANSO" | "FIN_DESCANSO" | "SALIDA";
  hora: string;
  horaConSegundos?: string;
  descripcion: string;
  subtexto?: string;
  esRetardo?: boolean;
  minutosRetardo?: number;
  enGeocerca: boolean;
  distanciaMetros?: number;
  lugarAutorizado?: string;
  latitud?: number;
  longitud?: number;
  fotoUrl?: string | null;
  metodoRegistro: string;
  validacionIdentidad?: string;
  similitudFacial?: number;
  hashEvento?: string;
}

export interface DiaCalendarioInfo {
  fecha: string; // YYYY-MM-DD
  numeroDia: number;
  diaSemana: number; // 0..6 (0=domingo)
  diaNombreCorto: string; // L, M, M, J, V, S, D
  esHoy: boolean;
  esFuturo: boolean;
  esDescanso: boolean;
  estado: "A_TIEMPO" | "RETARDO" | "EN_CURSO" | "INCOMPLETA" | "FALTA" | "VACACIONES" | "PERMISO" | "DESCANSO" | "SIN_DATOS";
  badgeTexto: string;
  horasTrabajadasStr: string;
  minutosTrabajados: number;
  minutosRetardo: number;
  horasExtras: number;
  entradaHora?: string;
  salidaHora?: string;
  eventos: EventoMarcajeDetalle[];
}

export interface ResumenMesEmpleado {
  mesNombre: string;
  mesNumero: number;
  anio: number;
  diasTrabajados: number;
  horasTrabajadasTotalStr: string;
  totalHorasDecimal: number;
  totalRetardos: number;
  totalFaltas: number;
  totalHorasExtraStr: string;
  totalMinutosRetardo: number;
  porcentajePuntualidad: number;
}

export interface DatosRegistroJornadaDashboard {
  empleados: Array<{
    id: string;
    nombre: string;
    apellidos: string;
    numero_empleado: string;
    puesto: string;
    codigo_biometrico: string;
  }>;
  empleadoSeleccionado: {
    id: string;
    nombreCompleto: string;
    numeroEmpleado: string;
    puesto: string;
    curp?: string | null;
  };
  hoy: {
    fechaStr: string;
    fechaLegible: string;
    enJornada: boolean;
    estadoTexto: string;
    minutosTrabajados: number;
    horasTrabajadasStr: string;
    porcentajeJornada: number;
    entradaReal?: string;
    salidaProgramada: string;
    horarioProgramado: string;
  };
  resumenMes: ResumenMesEmpleado;
  diasCalendario: DiaCalendarioInfo[];
  diaSeleccionadoInicial?: DiaCalendarioInfo;
  configuracionTaller: {
    nombreTaller: string;
    direccion: string;
    latitud: number;
    longitud: number;
    radioToleranciaMetros: number;
  };
  horarioLaboralConfig?: HorarioLaboralConfig;
}

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIAS_SEMANA_LETRAS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Consulta la información consolidada para la vista interactiva de Registro Electrónico de Jornada (Fase 2)
 */
export async function obtenerDatosRegistroJornadaDashboard(params?: {
  empleadoId?: string;
  mes?: number; // 1..12
  anio?: number;
}): Promise<{
  success: boolean;
  datos?: DatosRegistroJornadaDashboard;
  error?: string;
}> {
  const adminClient = createAdminClient();

  try {
    const hoyStr = obtenerFechaHoyMerida();
    const [hoyAnio, hoyMesNum, hoyDiaNum] = hoyStr.split("-").map(Number);

    const anio = params?.anio || hoyAnio;
    const mes = params?.mes || hoyMesNum; // 1-indexed

    // 1. Obtener empleados activos
    const { data: empleados, error: empError } = await adminClient
      .from("empleados")
      .select("id, nombre, apellidos, numero_empleado, puesto, codigo_biometrico, curp")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (empError || !empleados || empleados.length === 0) {
      return { success: false, error: "No se encontraron empleados activos." };
    }

    // Empleado seleccionado (o el primero de la lista)
    const empTarget = (params?.empleadoId && empleados.find((e) => e.id === params.empleadoId)) || empleados[0];

    // 2. Obtener configuración del taller
    const { data: config } = await adminClient
      .from("configuracion_taller")
      .select("*")
      .limit(1)
      .maybeSingle();

    const configTaller = {
      nombreTaller: config?.nombre_taller || "Servicio Mecánico López",
      direccion: config?.direccion_taller || "Av. Principal del Taller",
      latitud: Number(config?.latitud || 19.432608),
      longitud: Number(config?.longitud || -99.133209),
      radioToleranciaMetros: config?.radio_tolerancia_metros || 150,
    };

    // 3. Rango del mes
    const primerDiaMes = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const ultimoDiaMes = `${anio}-${String(mes).padStart(2, "0")}-${String(diasEnMes).padStart(2, "0")}`;

    // 4. Consultar asistencias del empleado en el mes
    const { data: asistenciasRaw, error: asisError } = await adminClient
      .from("asistencias")
      .select("*")
      .eq("empleado_id", empTarget.id)
      .gte("fecha_hora", `${primerDiaMes}T00:00:00.000Z`)
      .lte("fecha_hora", `${ultimoDiaMes}T23:59:59.999Z`)
      .order("fecha_hora", { ascending: true });

    if (asisError) throw asisError;

    // 5. Consultar incidencias aprobadas (vacaciones, permisos, incapacidades)
    const { data: incidenciasRaw } = await adminClient
      .from("incidencias_empleado")
      .select("*")
      .eq("empleado_id", empTarget.id)
      .eq("estado", "APROBADA")
      .lte("fecha_inicio", ultimoDiaMes)
      .gte("fecha_fin", primerDiaMes);

    // Mapear incidencias por fecha
    const mapaIncidencias = new Map<string, string>();
    for (const inc of incidenciasRaw || []) {
      const ini = inc.fecha_inicio.slice(0, 10);
      const fin = inc.fecha_fin.slice(0, 10);
      let cur = new Date(ini + "T12:00:00.000Z");
      const finDate = new Date(fin + "T12:00:00.000Z");
      while (cur <= finDate) {
        const dStr = cur.toISOString().slice(0, 10);
        mapaIncidencias.set(dStr, inc.tipo);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // Mapear eventos por fecha
    const mapaEventosDia = new Map<string, any[]>();
    for (const a of asistenciasRaw || []) {
      const dStr = a.fecha_hora.slice(0, 10);
      if (!mapaEventosDia.has(dStr)) {
        mapaEventosDia.set(dStr, []);
      }
      mapaEventosDia.get(dStr)!.push(a);
    }

    // 5.5 Obtener configuración de horario laboral del taller y regla de horas extras
    const horarioConfig = await obtenerHorarioLaboralConfig();

    // 6. Construir los días del calendario
    const diasCalendario: DiaCalendarioInfo[] = [];
    let diasTrabajadosContador = 0;
    let minutosTotalesMes = 0;
    let totalRetardosMes = 0;
    let totalFaltasMes = 0;
    let totalMinutosRetardoMes = 0;
    let totalHorasExtrasMes = 0;

    for (let d = 1; d <= diasEnMes; d++) {
      const diaFechaStr = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const fechaObj = new Date(Date.UTC(anio, mes - 1, d, 12, 0, 0));
      const diaSemana = fechaObj.getUTCDay(); // 0 = Domingo
      const diaLetra = DIAS_SEMANA_LETRAS[diaSemana];

      const esHoy = diaFechaStr === hoyStr;
      const esFuturo = diaFechaStr > hoyStr;
      const infoRegimenDia = evaluarConfiguracionPorDiaSemana(diaSemana, horarioConfig);
      const esDescanso = infoRegimenDia.esDescanso;

      const eventosRaw = mapaEventosDia.get(diaFechaStr) || [];
      const eventosSimples: EventoAsistenciaSimple[] = eventosRaw.map((a) => {
        const meta = a.metadatos_origen as any;
        return {
          tipoEvento: (a.tipo_evento_original === "MARCAJE"
            ? "ENTRADA"
            : a.tipo_evento_original) as EventoAsistenciaSimple["tipoEvento"],
          fechaHora: a.fecha_hora,
          metodoRegistro: a.metodo_registro,
          fotoUrl: meta?.foto_verificacion || null,
        };
      });

      const jornadaCalculada = procesarJornadaDiaria(eventosSimples, diaFechaStr, horarioConfig);

      // Mapear eventos detallados con geocerca y número de marcaje 1..4
      const eventosDetalle: EventoMarcajeDetalle[] = eventosRaw.map((a, idx) => {
        const meta = a.metadatos_origen as any;
        const dMetros = meta?.distancia_metros !== undefined ? Number(meta.distancia_metros) : undefined;
        const enZona = dMetros !== undefined ? dMetros <= configTaller.radioToleranciaMetros : true;

        let desc = "Marcaje registrado";
        let subtexto = enZona ? "Dentro de tu zona" : `Fuera de zona (${dMetros}m)`;
        let esRet = false;
        let minRet = 0;

        if (a.tipo_evento_original === "ENTRADA") {
          desc = "Entraste a laborar";
          if (jornadaCalculada.esRetardo) {
            esRet = true;
            minRet = jornadaCalculada.minutosRetardo;
            subtexto = `Llegaste ${minRet} min tarde • ${subtexto}`;
          }
        } else if (a.tipo_evento_original === "INICIO_DESCANSO") {
          desc = "Saliste a comer / descanso";
        } else if (a.tipo_evento_original === "FIN_DESCANSO") {
          desc = "Regresaste del descanso";
        } else if (a.tipo_evento_original === "SALIDA") {
          desc = "Saliste de jornada";
        }

        const horaTexto = new Date(a.fecha_hora).toLocaleTimeString("es-MX", {
          timeZone: "America/Merida",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const horaSegundos = new Date(a.fecha_hora).toLocaleTimeString("es-MX", {
          timeZone: "America/Merida",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        return {
          numero: idx + 1,
          tipo: a.tipo_evento_original,
          hora: horaTexto,
          horaConSegundos: horaSegundos,
          descripcion: desc,
          subtexto,
          esRetardo: esRet,
          minutosRetardo: minRet,
          enGeocerca: enZona,
          distanciaMetros: dMetros,
          lugarAutorizado: meta?.lugar_autorizado || configTaller.nombreTaller,
          latitud: meta?.latitud ? Number(meta.latitud) : undefined,
          longitud: meta?.longitud ? Number(meta.longitud) : undefined,
          fotoUrl: meta?.foto_verificacion || null,
          metodoRegistro: a.metodo_registro,
          validacionIdentidad: meta?.validacion_identidad,
          similitudFacial: meta?.similitud_facial ? Number(meta.similitud_facial) : undefined,
          hashEvento: a.hash_evento || undefined,
        };
      });

      // Determinar estado del día
      let estadoDia: DiaCalendarioInfo["estado"] = "SIN_DATOS";
      let badgeTexto = "Sin registros";

      if (esDescanso) {
        estadoDia = "DESCANSO";
        badgeTexto = "Descanso semanal";
      } else if (mapaIncidencias.has(diaFechaStr)) {
        const tipoInc = mapaIncidencias.get(diaFechaStr);
        if (tipoInc === "VACACIONES") {
          estadoDia = "VACACIONES";
          badgeTexto = "Vacaciones aprobadas";
        } else {
          estadoDia = "PERMISO";
          badgeTexto = "Permiso autorizado";
        }
      } else if (jornadaCalculada.estadoJornada === "COMPLETA") {
        if (jornadaCalculada.esRetardo) {
          estadoDia = "RETARDO";
          badgeTexto = `Retardo ${jornadaCalculada.minutosRetardo} min`;
          totalRetardosMes++;
          totalMinutosRetardoMes += jornadaCalculada.minutosRetardo;
        } else {
          estadoDia = "A_TIEMPO";
          badgeTexto = "Asistió en tiempo";
        }
        diasTrabajadosContador++;
        minutosTotalesMes += jornadaCalculada.minutosTrabajadosEfectivos;
        totalHorasExtrasMes += jornadaCalculada.horasExtraDobles + jornadaCalculada.horasExtraTriples;
      } else if (jornadaCalculada.estadoJornada === "EN_CURSO") {
        estadoDia = "EN_CURSO";
        badgeTexto = "En jornada activa";
        if (jornadaCalculada.esRetardo) {
          totalRetardosMes++;
          totalMinutosRetardoMes += jornadaCalculada.minutosRetardo;
        }
        diasTrabajadosContador++;
        minutosTotalesMes += jornadaCalculada.minutosTrabajadosEfectivos;
      } else if (jornadaCalculada.estadoJornada === "INCOMPLETA") {
        estadoDia = "INCOMPLETA";
        badgeTexto = "Jornada incompleta";
        diasTrabajadosContador++;
        minutosTotalesMes += jornadaCalculada.minutosTrabajadosEfectivos;
      } else if (!esFuturo && !esDescanso) {
        estadoDia = "FALTA";
        badgeTexto = "Inasistencia";
        totalFaltasMes++;
      }

      const hrs = Math.floor(jornadaCalculada.minutosTrabajadosEfectivos / 60);
      const mins = jornadaCalculada.minutosTrabajadosEfectivos % 60;
      const horasStr = hrs > 0 || mins > 0 ? `${hrs} h ${mins} min` : "0 h";

      const entradaHoraStr = jornadaCalculada.entrada
        ? new Date(jornadaCalculada.entrada.fechaHora).toLocaleTimeString("es-MX", {
            timeZone: "America/Merida",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : undefined;

      const salidaHoraStr = jornadaCalculada.salida
        ? new Date(jornadaCalculada.salida.fechaHora).toLocaleTimeString("es-MX", {
            timeZone: "America/Merida",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : undefined;

      diasCalendario.push({
        fecha: diaFechaStr,
        numeroDia: d,
        diaSemana,
        diaNombreCorto: diaLetra,
        esHoy,
        esFuturo,
        esDescanso,
        estado: estadoDia,
        badgeTexto,
        horasTrabajadasStr: horasStr,
        minutosTrabajados: jornadaCalculada.minutosTrabajadosEfectivos,
        minutosRetardo: jornadaCalculada.minutosRetardo,
        horasExtras: jornadaCalculada.horasExtraDobles + jornadaCalculada.horasExtraTriples,
        entradaHora: entradaHoraStr,
        salidaHora: salidaHoraStr,
        eventos: eventosDetalle,
      });
    }

    // 7. Datos de HOY
    const diaHoyInfo = diasCalendario.find((d) => d.esHoy);
    const hrsHoy = diaHoyInfo ? Math.floor(diaHoyInfo.minutosTrabajados / 60) : 0;
    const minsHoy = diaHoyInfo ? diaHoyInfo.minutosTrabajados % 60 : 0;
    const porcentajeJornadaHoy = diaHoyInfo
      ? Math.min(100, Math.round((diaHoyInfo.minutosTrabajados / 480) * 100))
      : 0;

    const fechaHoyLegible = new Date().toLocaleDateString("es-MX", {
      timeZone: "America/Merida",
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const diaSemanaHoy = new Date(`${hoyStr}T12:00:00.000Z`).getUTCDay();
    const regimenHoy = evaluarConfiguracionPorDiaSemana(diaSemanaHoy, horarioConfig);
    const horarioProgramadoHoy = regimenHoy.esDescanso
      ? "Día de descanso oficial"
      : `${regimenHoy.horaEntrada} a ${regimenHoy.horaSalida}`;
    const salidaProgramadaHoy = regimenHoy.esDescanso ? "--:--" : regimenHoy.horaSalida;

    const hoyDatos = {
      fechaStr: hoyStr,
      fechaLegible: fechaHoyLegible.charAt(0).toUpperCase() + fechaHoyLegible.slice(1),
      enJornada: diaHoyInfo?.estado === "EN_CURSO" || diaHoyInfo?.estado === "A_TIEMPO",
      estadoTexto: diaHoyInfo?.badgeTexto || "Sin marcaje hoy",
      minutosTrabajados: diaHoyInfo?.minutosTrabajados || 0,
      horasTrabajadasStr: `${hrsHoy} h ${minsHoy > 0 ? `${minsHoy} min` : ""}`.trim(),
      porcentajeJornada: porcentajeJornadaHoy,
      entradaReal: diaHoyInfo?.entradaHora || "--:--",
      salidaProgramada: salidaProgramadaHoy,
      horarioProgramado: horarioProgramadoHoy,
    };

    // 8. Resumen del mes
    const hrsTotales = Math.floor(minutosTotalesMes / 60);
    const minsTotales = minutosTotalesMes % 60;
    const porcentajePuntualidad = diasTrabajadosContador > 0
      ? Math.max(0, Math.min(100, Math.round(((diasTrabajadosContador - totalRetardosMes) / diasTrabajadosContador) * 100)))
      : 100;

    const resumenMes: ResumenMesEmpleado = {
      mesNombre: NOMBRES_MESES[mes - 1] || "Mes actual",
      mesNumero: mes,
      anio,
      diasTrabajados: diasTrabajadosContador,
      horasTrabajadasTotalStr: `${hrsTotales} h ${minsTotales > 0 ? `${minsTotales} m` : ""}`.trim(),
      totalHorasDecimal: parseFloat((minutosTotalesMes / 60).toFixed(2)),
      totalRetardos: totalRetardosMes,
      totalFaltas: totalFaltasMes,
      totalHorasExtraStr: `${totalHorasExtrasMes} h`,
      totalMinutosRetardo: totalMinutosRetardoMes,
      porcentajePuntualidad,
    };

    // Día seleccionado por defecto: HOY si está en el mes, o el último día con marcajes
    const diaSeleccionadoInicial =
      diaHoyInfo ||
      [...diasCalendario].reverse().find((d) => d.eventos.length > 0) ||
      diasCalendario[0];

    return {
      success: true,
      datos: {
        empleados: empleados.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          apellidos: e.apellidos,
          numero_empleado: e.numero_empleado,
          puesto: e.puesto,
          codigo_biometrico: e.codigo_biometrico,
        })),
        empleadoSeleccionado: {
          id: empTarget.id,
          nombreCompleto: `${empTarget.nombre} ${empTarget.apellidos}`,
          numeroEmpleado: empTarget.numero_empleado,
          puesto: empTarget.puesto,
          curp: empTarget.curp,
        },
        hoy: hoyDatos,
        resumenMes,
        diasCalendario,
        diaSeleccionadoInicial,
        configuracionTaller: configTaller,
        horarioLaboralConfig: horarioConfig,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al consultar datos de jornada.",
    };
  }
}
