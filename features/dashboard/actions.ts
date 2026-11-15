"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import { procesarJornadaDiaria, type EventoAsistenciaSimple } from "@/lib/lft/calculo-horas";

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

    // Separar asistencias de hoy vs semana
    const asistenciasHoy = todasAsistencias.filter((a) => a.fecha_hora.startsWith(hoyStr));

    // Determinar estado actual de cada empleado hoy según su último marcaje
    const ultimoEventoPorEmpleado = new Map<string, any>();
    for (const a of asistenciasHoy) {
      if (!ultimoEventoPorEmpleado.has(a.empleado_id)) {
        ultimoEventoPorEmpleado.set(a.empleado_id, a);
      }
    }

    let presentesHoy = 0;
    let enDescansoHoy = 0;
    let salieronHoy = 0;
    let enViajeHoy = 0;
    let entradasATiempo = 0;
    let retardosHoy = 0;

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
    }

    // Evaluar retardos en las entradas de hoy (Límite: 09:15 AM)
    const entradasHoy = asistenciasHoy.filter((a) => a.tipo_evento_original === "ENTRADA");
    for (const ent of entradasHoy) {
      const d = new Date(ent.fecha_hora);
      const minutos = d.getHours() * 60 + d.getMinutes();
      if (minutos <= 9 * 60 + 15) {
        entradasATiempo += 1;
      } else {
        retardosHoy += 1;
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

    // 5. Construir tendencia semanal (Últimos 7 días)
    const diasSemanaNombres = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const tendenciaSemanal: MetricasDashboard["tendenciaSemanal"] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(ahora.getDate() - i);
      const fStr = d.toISOString().slice(0, 10);
      const diaNom = diasSemanaNombres[d.getDay()];

      const asisDia = todasAsistencias.filter((a) => a.fecha_hora.startsWith(fStr));
      const entradasDia = asisDia.filter((a) => a.tipo_evento_original === "ENTRADA");

      let aTiempo = 0;
      let retardos = 0;
      for (const ent of entradasDia) {
        const h = new Date(ent.fecha_hora);
        if (h.getHours() * 60 + h.getMinutes() <= 9 * 60 + 15) {
          aTiempo += 1;
        } else {
          retardos += 1;
        }
      }

      const presentesTotales = entradasDia.length;
      const ausentes = Math.max(0, totalActivos - presentesTotales);

      tendenciaSemanal.push({
        diaNombre: diaNom,
        fecha: fStr,
        aTiempo,
        retardos,
        ausentes,
        horasTotales: parseFloat((presentesTotales * 8).toFixed(1)), // Estimación de horas
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
          horasOrdinariasHoy: parseFloat((presentesHoy * 8).toFixed(1)),
          horasExtraHoy: 0,
          retardosHoy,
        },
        distribucionPersonal,
        tendenciaSemanal,
        ultimosMarcajes,
        configuracionTaller: configTaller,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al consultar métricas del dashboard.",
    };
  }
}
