"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";
import { registrarBitacora, type AccionBitacora } from "@/lib/auditoria/logger";

export type CategoriaBitacora =
  | "TODOS"
  | "EMPLEADOS"
  | "HORARIO"
  | "ZONAS_VIAJE"
  | "VACACIONES"
  | "JUSTIFICACIONES"
  | "SISTEMA";

export interface RegistroBitacoraItem {
  id: string;
  perfilId: string | null;
  usuarioNombre: string;
  usuarioRol: string;
  accion: string;
  categoria: CategoriaBitacora;
  descripcion: string;
  tablaAfectada: string;
  registroAfectadoId: string | null;
  valoresPrevios: Json | null;
  valoresNuevos: Json | null;
  direccionIp: string | null;
  fechaCreacion: string;
}

export interface MetricasBitacora {
  totalMovimientos: number;
  totalEmpleados: number;
  totalHorarios: number;
  totalZonasViaje: number;
  totalVacacionesJustificaciones: number;
}

export interface FiltrosBitacora {
  categoria?: CategoriaBitacora;
  busqueda?: string;
  rangoDias?: number; // 7, 30, 90, 0 (todos)
}

/**
 * Determina la categoría y descripción amigable según la acción y los datos registrados.
 */
function clasificarYDescribirRegistro(
  accion: string,
  tabla: string,
  valoresPrevios: any,
  valoresNuevos: any
): { categoria: CategoriaBitacora; descripcion: string } {
  const nuevos = valoresNuevos || {};
  const prev = valoresPrevios || {};

  switch (accion) {
    case "ALTA_EMPLEADO": {
      const nombre = nuevos.nombre ? `${nuevos.nombre} ${nuevos.apellidos || ""}`.trim() : "Empleado";
      const puesto = nuevos.puesto ? ` (${nuevos.puesto})` : "";
      return {
        categoria: "EMPLEADOS",
        descripcion: `Alta de nuevo empleado: ${nombre}${puesto}`,
      };
    }
    case "EDICION_EMPLEADO": {
      const nombre = nuevos.nombre ? `${nuevos.nombre} ${nuevos.apellidos || ""}`.trim() : "Empleado";
      return {
        categoria: "EMPLEADOS",
        descripcion: `Actualización de expediente y datos de ${nombre}`,
      };
    }
    case "BAJA_EMPLEADO": {
      const nombre = nuevos.nombre ? `${nuevos.nombre} ${nuevos.apellidos || ""}`.trim() : "Empleado";
      return {
        categoria: "EMPLEADOS",
        descripcion: `Baja administrativa de empleado: ${nombre}`,
      };
    }
    case "REACTIVACION_EMPLEADO": {
      const nombre = nuevos.nombre ? `${nuevos.nombre} ${nuevos.apellidos || ""}`.trim() : "Empleado";
      return {
        categoria: "EMPLEADOS",
        descripcion: `Reactivación de cuenta de empleado: ${nombre}`,
      };
    }
    case "CAMBIO_HORARIO_LABORAL": {
      const entrada = nuevos.lunesAViernes?.horaEntrada || "08:00";
      const salida = nuevos.lunesAViernes?.horaSalida || "18:00";
      return {
        categoria: "HORARIO",
        descripcion: `Modificación de jornada laboral semanal (${entrada} a ${salida}) y horas extras`,
      };
    }
    case "ACTUALIZACION_CONFIGURACION_TALLER": {
      const nombreTaller = nuevos.nombre_taller || "Servicio Mecánico López";
      return {
        categoria: "HORARIO",
        descripcion: `Actualización de parámetros operativos de sede y geocerca para ${nombreTaller}`,
      };
    }
    case "ALTA_UBICACION_EXTRAORDINARIA": {
      const lugar = nuevos.nombre_lugar || "Nueva sede";
      const vigencia = nuevos.fecha_fin ? ` con vigencia al ${nuevos.fecha_fin}` : "";
      return {
        categoria: "ZONAS_VIAJE",
        descripcion: `Alta de zona geográfica por viaje: "${lugar}"${vigencia}`,
      };
    }
    case "ELIMINACION_UBICACION_EXTRAORDINARIA": {
      return {
        categoria: "ZONAS_VIAJE",
        descripcion: "Revocación / eliminación anticipada de zona geográfica por viaje",
      };
    }
    case "AUTORIZACION_VACACIONES": {
      const inicio = nuevos.fecha_inicio || nuevos.inicio || "";
      const fin = nuevos.fecha_fin || nuevos.fin || "";
      const periodo = inicio && fin ? ` (Del ${inicio} al ${fin})` : "";
      return {
        categoria: "VACACIONES",
        descripcion: `Autorización oficial de periodo vacacional${periodo}`,
      };
    }
    case "RECHAZO_VACACIONES": {
      const motivo = nuevos.comentario ? `: "${nuevos.comentario}"` : "";
      return {
        categoria: "VACACIONES",
        descripcion: `Negación de solicitud de vacaciones${motivo}`,
      };
    }
    case "APROBACION_JUSTIFICANTE": {
      const inicio = nuevos.fecha_inicio || "";
      const periodo = inicio ? ` del día ${inicio}` : "";
      return {
        categoria: "JUSTIFICACIONES",
        descripcion: `Aceptación de justificante de inasistencia${periodo}`,
      };
    }
    case "RECHAZO_JUSTIFICANTE": {
      const motivo = nuevos.comentario ? `: "${nuevos.comentario}"` : "";
      return {
        categoria: "JUSTIFICACIONES",
        descripcion: `Rechazo de justificante de inasistencia${motivo}`,
      };
    }
    case "RESOLUCION_INCIDENCIA_APROBADA": {
      const estadoDoc = nuevos.documento_estado ? ` - Documento ${nuevos.documento_estado}` : "";
      return {
        categoria: "JUSTIFICACIONES",
        descripcion: `Solicitud de incidencia aprobada por administración${estadoDoc}`,
      };
    }
    case "RESOLUCION_INCIDENCIA_RECHAZADA": {
      return {
        categoria: "JUSTIFICACIONES",
        descripcion: "Solicitud de incidencia rechazada por administración",
      };
    }
    case "AJUSTE_DIAS_VACACIONES": {
      const dias = nuevos.dias ? ` (${nuevos.dias > 0 ? "+" : ""}${nuevos.dias} días)` : "";
      return {
        categoria: "VACACIONES",
        descripcion: `Ajuste manual de saldo de vacaciones LFT${dias}`,
      };
    }
    default: {
      if (tabla === "empleados") {
        return { categoria: "EMPLEADOS", descripcion: `Operación sobre expediente de empleado (${accion})` };
      }
      if (tabla === "ubicaciones_extraordinarias") {
        return { categoria: "ZONAS_VIAJE", descripcion: `Modificación en zonas de viaje (${accion})` };
      }
      if (tabla === "configuracion_taller") {
        return { categoria: "HORARIO", descripcion: `Ajuste de configuración y horarios (${accion})` };
      }
      if (tabla === "incidencias_empleado") {
        return { categoria: "JUSTIFICACIONES", descripcion: `Resolución de incidencia laboral (${accion})` };
      }
      return { categoria: "SISTEMA", descripcion: `Movimiento administrativo registrado: ${accion}` };
    }
  }
}

/**
 * Consulta los registros de bitácora con filtros dinámicos y métricas operativas.
 */
export async function obtenerBitacoraEventos(
  filtros?: FiltrosBitacora
): Promise<{
  success: boolean;
  registros: RegistroBitacoraItem[];
  metricas: MetricasBitacora;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        registros: [],
        metricas: {
          totalMovimientos: 0,
          totalEmpleados: 0,
          totalHorarios: 0,
          totalZonasViaje: 0,
          totalVacacionesJustificaciones: 0,
        },
        error: "Sesión no autenticada para consultar la bitácora.",
      };
    }

    const adminClient = createAdminClient();

    // 1. Obtener los perfiles para asociar el nombre del autor
    const { data: perfilesData } = await adminClient
      .from("perfiles")
      .select("id, nombre, apellidos, rol");

    const mapaPerfiles = new Map<string, { nombre: string; rol: string }>();
    if (perfilesData) {
      for (const p of perfilesData) {
        mapaPerfiles.set(p.id, {
          nombre: `${p.nombre} ${p.apellidos}`.trim(),
          rol: p.rol,
        });
      }
    }

    // 2. Armar consulta con filtros
    let query = adminClient
      .from("registros_auditoria")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    // Rango de fechas
    const rangoDias = filtros?.rangoDias !== undefined ? filtros.rangoDias : 30;
    if (rangoDias > 0) {
      const fechaCorte = new Date(Date.now() - rangoDias * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("fecha_creacion", fechaCorte);
    }

    // Límite razonable para rendimiento impecable
    query = query.limit(300);

    const { data: rawRows, error } = await query;

    if (error) {
      return {
        success: false,
        registros: [],
        metricas: {
          totalMovimientos: 0,
          totalEmpleados: 0,
          totalHorarios: 0,
          totalZonasViaje: 0,
          totalVacacionesJustificaciones: 0,
        },
        error: `Error al leer bitácora: ${error.message}`,
      };
    }

    // 3. Procesar y enriquecer registros
    const items: RegistroBitacoraItem[] = (rawRows || []).map((row) => {
      const infoPerfil = row.perfil_id ? mapaPerfiles.get(row.perfil_id) : null;
      const usuarioNombre = infoPerfil?.nombre || "Sistema / Administrador";
      const usuarioRol = infoPerfil?.rol || "SISTEMA";

      const { categoria, descripcion } = clasificarYDescribirRegistro(
        row.accion,
        row.tabla_afectada,
        row.valores_previos,
        row.valores_nuevos
      );

      return {
        id: row.id,
        perfilId: row.perfil_id,
        usuarioNombre,
        usuarioRol,
        accion: row.accion,
        categoria,
        descripcion,
        tablaAfectada: row.tabla_afectada,
        registroAfectadoId: row.registro_afectado_id,
        valoresPrevios: row.valores_previos,
        valoresNuevos: row.valores_nuevos,
        direccionIp: row.direccion_ip,
        fechaCreacion: row.fecha_creacion,
      };
    });

    // 4. Calcular métricas globales sobre el conjunto consultado
    let totalEmpleados = 0;
    let totalHorarios = 0;
    let totalZonasViaje = 0;
    let totalVacacionesJustificaciones = 0;

    for (const item of items) {
      if (item.categoria === "EMPLEADOS") totalEmpleados++;
      else if (item.categoria === "HORARIO") totalHorarios++;
      else if (item.categoria === "ZONAS_VIAJE") totalZonasViaje++;
      else if (item.categoria === "VACACIONES" || item.categoria === "JUSTIFICACIONES") {
        totalVacacionesJustificaciones++;
      }
    }

    // 5. Aplicar filtros de categoría y texto en memoria
    let filtrados = items;

    if (filtros?.categoria && filtros.categoria !== "TODOS") {
      filtrados = filtrados.filter((it) => it.categoria === filtros.categoria);
    }

    if (filtros?.busqueda && filtros.busqueda.trim()) {
      const q = filtros.busqueda.trim().toLowerCase();
      filtrados = filtrados.filter(
        (it) =>
          it.descripcion.toLowerCase().includes(q) ||
          it.accion.toLowerCase().includes(q) ||
          it.usuarioNombre.toLowerCase().includes(q) ||
          it.tablaAfectada.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      registros: filtrados,
      metricas: {
        totalMovimientos: items.length,
        totalEmpleados,
        totalHorarios,
        totalZonasViaje,
        totalVacacionesJustificaciones,
      },
    };
  } catch (err) {
    return {
      success: false,
      registros: [],
      metricas: {
        totalMovimientos: 0,
        totalEmpleados: 0,
        totalHorarios: 0,
        totalZonasViaje: 0,
        totalVacacionesJustificaciones: 0,
      },
      error: err instanceof Error ? err.message : "Error desconocido al consultar la bitácora.",
    };
  }
}
