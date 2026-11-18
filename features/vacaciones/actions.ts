"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  obtenerFechaHoyMerida,
  compararFechasCalendario,
  calcularDiasEntreFechas,
  sumarDiasAFecha,
} from "@/lib/utils/fechas-laborales";
import {
  calcularDiasPorAnioServicioLFT,
  calcularAniversariosCumplidos,
} from "@/lib/lft/vacaciones-lft";
import type { Database, Json } from "@/types/database.types";

export {
  calcularDiasPorAnioServicioLFT,
  calcularAniversariosCumplidos,
};

export type AjusteVacacionesRow = Database["public"]["Tables"]["ajustes_vacaciones"]["Row"];

export interface FichaVacacionalEmpleado {
  empleadoId: string;
  nombreCompleto: string;
  numeroEmpleado: string;
  puesto: string;
  fechaIngreso: string;
  aniosServicioCumplidos: number;
  diasDevengadosLey: number;
  ajustesSaldo: number;
  diasDisfrutados: number;
  diasReservadosPendientes: number;
  saldoDisponible: number;
  fechaProximoAniversario: string;
  diasParaProximoAniversario: number;
  alertaPlazoArt81: boolean; // 6 meses después de aniversario sin goce
  motivoAlertaArt81?: string;
  ajustes: AjusteVacacionesRow[];
}

/**
 * Consulta el estado vacacional completo de un empleado.
 */
export async function obtenerEstadoVacacionalEmpleado(
  empleadoId: string
): Promise<{
  ficha?: FichaVacacionalEmpleado;
  error?: string;
}> {
  const adminClient = createAdminClient();

  // 1. Obtener empleado
  const { data: emp, error: empErr } = await adminClient
    .from("empleados")
    .select("*")
    .eq("id", empleadoId)
    .single();

  if (empErr || !emp) {
    return { error: "No se encontró el trabajador especificado." };
  }

  const hoy = obtenerFechaHoyMerida();
  const infoAniversario = calcularAniversariosCumplidos(emp.fecha_ingreso, hoy);

  // 2. Calcular días devengados acumulados por aniversarios
  // (Para 1 año = 12 días; para 2 años = 12 + 14 = 26 días si se analiza histórico acumulado,
  // pero el derecho del periodo vigente es el del último año cumplido)
  let diasDevengados = 0;
  for (let a = 1; a <= infoAniversario.aniosCumplidos; a++) {
    diasDevengados += calcularDiasPorAnioServicioLFT(a);
  }

  // 3. Ajustes de saldo (Carga histórica + correcciones auditadas) y 4. Vacaciones disfrutadas en PARALELO
  let ajustesSaldo = 0;
  let listaAjustes: AjusteVacacionesRow[] = [];
  let diasDisfrutados = 0;
  let diasReservados = 0;

  try {
    const [ajustesRes, incsRes] = await Promise.all([
      adminClient
        .from("ajustes_vacaciones")
        .select("*")
        .eq("empleado_id", emp.id)
        .order("fecha_creacion", { ascending: false }),
      adminClient
        .from("incidencias_empleado")
        .select("dias_solicitados_efectivos, estado")
        .eq("empleado_id", emp.id)
        .eq("tipo", "VACACIONES"),
    ]);

    if (ajustesRes.data) {
      listaAjustes = ajustesRes.data;
      ajustesSaldo = ajustesRes.data.reduce((sum, item) => {
        if (item.tipo === "CARGA_HISTORICA" || item.tipo === "AJUSTE_POSITIVO") {
          return sum + item.dias;
        }
        return sum - item.dias;
      }, 0);
    }

    if (incsRes.data) {
      for (const i of incsRes.data) {
        const d = i.dias_solicitados_efectivos || 1;
        if (i.estado === "APROBADA") {
          diasDisfrutados += d;
        } else if (i.estado === "PENDIENTE") {
          diasReservados += d;
        }
      }
    }
  } catch {
    // Tolerante si la migración de ajustes está en proceso
  }

  // 5. Saldo disponible real
  const saldoDisponible = Math.max(
    0,
    diasDevengados + ajustesSaldo - diasDisfrutados - diasReservados
  );

  // 6. Alerta Art. 81 LFT (6 meses posteriores al aniversario sin concederse)
  let alertaPlazoArt81 = false;
  let motivoAlertaArt81: string | undefined;

  if (infoAniversario.fechaUltimoAniversario && saldoDisponible > 0) {
    const fechaLimiteConcesion = sumarDiasAFecha(infoAniversario.fechaUltimoAniversario, 182); // ~6 meses
    if (compararFechasCalendario(hoy, fechaLimiteConcesion) > 0) {
      alertaPlazoArt81 = true;
      motivoAlertaArt81 = `El plazo legal de 6 meses posteriores al aniversario (${infoAniversario.fechaUltimoAniversario}) venció el ${fechaLimiteConcesion} conforme al Art. 81 de la LFT. Los días no se pierden pero deben programarse a la brevedad.`;
    }
  }

  const ficha: FichaVacacionalEmpleado = {
    empleadoId: emp.id,
    nombreCompleto: `${emp.nombre} ${emp.apellidos}`.trim(),
    numeroEmpleado: emp.numero_empleado,
    puesto: emp.puesto,
    fechaIngreso: emp.fecha_ingreso,
    aniosServicioCumplidos: infoAniversario.aniosCumplidos,
    diasDevengadosLey: diasDevengados,
    ajustesSaldo,
    diasDisfrutados,
    diasReservadosPendientes: diasReservados,
    saldoDisponible,
    fechaProximoAniversario: infoAniversario.fechaProximoAniversario,
    diasParaProximoAniversario: infoAniversario.diasParaProximoAniversario,
    alertaPlazoArt81,
    motivoAlertaArt81,
    ajustes: listaAjustes,
  };

  return { ficha };
}

/**
 * Consulta las fichas vacacionales de todos los empleados activos para el Administrador.
 * Optimizado: 1 sola verificación de permisos + 1 tanda paralela de consultas (batch) con indexación en memoria.
 */
export async function obtenerFichasVacacionalesAdmin(): Promise<{
  fichas: FichaVacacionalEmpleado[];
  error?: string;
}> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Ejecutar autenticación, verificación de perfil y consultas de datos en 1 sola tanda paralela (1 round-trip)
  const [authRes, perfilesRes, empleadosRes, ajustesRes, incidenciasRes] = await Promise.all([
    supabase.auth.getUser(),
    adminClient.from("perfiles").select("id, rol, activo").eq("activo", true),
    adminClient
      .from("empleados")
      .select("id, nombre, apellidos, numero_empleado, puesto, fecha_ingreso")
      .eq("activo", true)
      .order("numero_empleado"),
    adminClient
      .from("ajustes_vacaciones")
      .select("*")
      .order("fecha_creacion", { ascending: false }),
    adminClient
      .from("incidencias_empleado")
      .select("empleado_id, dias_solicitados_efectivos, estado")
      .eq("tipo", "VACACIONES"),
  ]);

  const user = authRes.data?.user;
  if (!user) {
    return { fichas: [], error: "Sesión no válida o expirada." };
  }

  const perfil = (perfilesRes.data || []).find((p) => p.id === user.id);
  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    return { fichas: [], error: "Acceso exclusivo para administradores." };
  }

  if (empleadosRes.error || !empleadosRes.data) {
    return { fichas: [], error: "No se pudo consultar el catálogo de empleados." };
  }

  // Indexar ajustes por empleado en memoria
  const ajustesMap = new Map<string, { lista: AjusteVacacionesRow[]; saldo: number }>();
  if (ajustesRes.data) {
    for (const aj of ajustesRes.data) {
      const item = ajustesMap.get(aj.empleado_id) || { lista: [], saldo: 0 };
      item.lista.push(aj);
      if (aj.tipo === "CARGA_HISTORICA" || aj.tipo === "AJUSTE_POSITIVO") {
        item.saldo += aj.dias;
      } else {
        item.saldo -= aj.dias;
      }
      ajustesMap.set(aj.empleado_id, item);
    }
  }

  // Indexar incidencias de vacaciones por empleado en memoria
  const incidenciasMap = new Map<string, { disfrutados: number; reservados: number }>();
  if (incidenciasRes.data) {
    for (const inc of incidenciasRes.data) {
      const item = incidenciasMap.get(inc.empleado_id) || { disfrutados: 0, reservados: 0 };
      const d = inc.dias_solicitados_efectivos || 1;
      if (inc.estado === "APROBADA") {
        item.disfrutados += d;
      } else if (inc.estado === "PENDIENTE") {
        item.reservados += d;
      }
      incidenciasMap.set(inc.empleado_id, item);
    }
  }

  const hoy = obtenerFechaHoyMerida();

  // Cálculo en memoria determinista sin consultas SQL adicionales (O(N) CPU pura)
  const fichas: FichaVacacionalEmpleado[] = empleadosRes.data.map((emp) => {
    const infoAniversario = calcularAniversariosCumplidos(emp.fecha_ingreso, hoy);

    let diasDevengados = 0;
    for (let a = 1; a <= infoAniversario.aniosCumplidos; a++) {
      diasDevengados += calcularDiasPorAnioServicioLFT(a);
    }

    const ajInfo = ajustesMap.get(emp.id) || { lista: [], saldo: 0 };
    const incInfo = incidenciasMap.get(emp.id) || { disfrutados: 0, reservados: 0 };

    const saldoDisponible = Math.max(
      0,
      diasDevengados + ajInfo.saldo - incInfo.disfrutados - incInfo.reservados
    );

    let alertaPlazoArt81 = false;
    let motivoAlertaArt81: string | undefined;

    if (infoAniversario.fechaUltimoAniversario && saldoDisponible > 0) {
      const fechaLimiteConcesion = sumarDiasAFecha(infoAniversario.fechaUltimoAniversario, 182);
      if (compararFechasCalendario(hoy, fechaLimiteConcesion) > 0) {
        alertaPlazoArt81 = true;
        motivoAlertaArt81 = `El plazo legal de 6 meses posteriores al aniversario (${infoAniversario.fechaUltimoAniversario}) venció el ${fechaLimiteConcesion} conforme al Art. 81 de la LFT. Los días no se pierden pero deben programarse a la brevedad.`;
      }
    }

    return {
      empleadoId: emp.id,
      nombreCompleto: `${emp.nombre} ${emp.apellidos}`.trim(),
      numeroEmpleado: emp.numero_empleado,
      puesto: emp.puesto,
      fechaIngreso: emp.fecha_ingreso,
      aniosServicioCumplidos: infoAniversario.aniosCumplidos,
      diasDevengadosLey: diasDevengados,
      ajustesSaldo: ajInfo.saldo,
      diasDisfrutados: incInfo.disfrutados,
      diasReservadosPendientes: incInfo.reservados,
      saldoDisponible,
      fechaProximoAniversario: infoAniversario.fechaProximoAniversario,
      diasParaProximoAniversario: infoAniversario.diasParaProximoAniversario,
      alertaPlazoArt81,
      motivoAlertaArt81,
      ajustes: ajInfo.lista,
    };
  });

  return { fichas };
}

/**
 * Registra un ajuste de vacaciones o carga histórica inicial en la bitácora append-only.
 */
export async function registrarAjusteVacacionalAdmin(params: {
  empleadoId: string;
  tipo: "CARGA_HISTORICA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  dias: number;
  motivo: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const { empleadoId, tipo, dias, motivo } = params;

  if (!empleadoId || !tipo || !dias || dias <= 0 || !motivo.trim()) {
    return {
      success: false,
      error: "Todos los campos son obligatorios y los días deben ser mayores a 0.",
    };
  }

  if (motivo.trim().length < 5) {
    return {
      success: false,
      error: "Debes ingresar una justificación detallada de al menos 5 caracteres.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sesión no autorizada." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo, nombre, apellidos")
    .eq("id", user.id)
    .single();

  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    return { success: false, error: "Solo administradores pueden registrar ajustes de saldo." };
  }

  const adminClient = createAdminClient();

  const { data: nuevoAjuste, error } = await adminClient
    .from("ajustes_vacaciones")
    .insert({
      empleado_id: empleadoId,
      tipo,
      dias: Math.round(dias),
      motivo: motivo.trim(),
      autor_perfil_id: user.id,
    })
    .select("*")
    .single();

  if (error || !nuevoAjuste) {
    return {
      success: false,
      error: "No se pudo guardar el ajuste en la base de datos.",
    };
  }

  // Trazabilidad inmutable
  await adminClient.from("registros_auditoria").insert({
    perfil_id: user.id,
    accion: `AJUSTE_VACACIONES_${tipo}`,
    tabla_afectada: "ajustes_vacaciones",
    registro_afectado_id: nuevoAjuste.id,
    valores_nuevos: {
      empleado_id: empleadoId,
      tipo,
      dias,
      motivo: motivo.trim(),
      admin: `${perfil.nombre} ${perfil.apellidos}`.trim(),
      fecha: new Date().toISOString(),
    } as unknown as Json,
  });

  revalidatePath("/vacaciones");
  revalidatePath("/incidencias");

  return {
    success: true,
    message: `Ajuste de vacaciones (${dias} días) registrado exitosamente.`,
  };
}

/**
 * Simulador de días hábiles de vacaciones: invoca la función determinista en la BD.
 */
export async function simularDiasHabilesVacaciones(
  fechaInicio: string,
  fechaFin: string
): Promise<{
  diasHabiles: number;
  diasNaturales: number;
  domingosExcluidos: number;
}> {
  const diasNaturales = Math.max(0, calcularDiasEntreFechas(fechaInicio, fechaFin));
  const adminClient = createAdminClient();

  try {
    const { data: rpcDias, error } = await adminClient.rpc("dias_habiles_vacaciones", {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    });

    if (!error && typeof rpcDias === "number") {
      return {
        diasHabiles: rpcDias,
        diasNaturales,
        domingosExcluidos: Math.max(0, diasNaturales - rpcDias),
      };
    }
  } catch {
    // Fallback local determinista si la función RPC aún no está compilada en BD
  }

  // Fallback TypeScript con exclusión de domingos (0)
  let curr = fechaInicio;
  let habiles = 0;
  let domingos = 0;

  while (compararFechasCalendario(curr, fechaFin) <= 0) {
    const [y, m, d] = curr.split("-").map(Number);
    const dateUtc = new Date(Date.UTC(y, m - 1, d));
    const dow = dateUtc.getUTCDay();

    if (dow === 0) {
      domingos++;
    } else {
      habiles++;
    }
    curr = sumarDiasAFecha(curr, 1);
  }

  return {
    diasHabiles: habiles,
    diasNaturales,
    domingosExcluidos: domingos,
  };
}
