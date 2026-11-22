import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import type { Json } from "@/types/database.types";

export type AccionBitacora =
  | "ALTA_EMPLEADO"
  | "EDICION_EMPLEADO"
  | "BAJA_EMPLEADO"
  | "REACTIVACION_EMPLEADO"
  | "ALTA_UBICACION_EXTRAORDINARIA"
  | "ELIMINACION_UBICACION_EXTRAORDINARIA"
  | "CAMBIO_HORARIO_LABORAL"
  | "ACTUALIZACION_CONFIGURACION_TALLER"
  | "AUTORIZACION_VACACIONES"
  | "RECHAZO_VACACIONES"
  | "APROBACION_JUSTIFICANTE"
  | "RECHAZO_JUSTIFICANTE"
  | "APROBACION_INCIDENCIA"
  | "RECHAZO_INCIDENCIA"
  | "AJUSTE_DIAS_VACACIONES";

export interface LogBitacoraParams {
  perfilId?: string | null;
  accion: AccionBitacora | string;
  tablaAfectada: string;
  registroAfectadoId?: string | null;
  valoresPrevios?: unknown;
  valoresNuevos?: unknown;
  ip?: string;
}

/**
 * Registra un movimiento administrativo en la bitácora inmutable del sistema (registros_auditoria).
 * Protegido con try/catch para garantizar que nunca bloquee la transacción principal.
 */
export async function registrarBitacora(params: LogBitacoraParams): Promise<void> {
  try {
    const adminClient = createAdminClient();

    let clientIp = params.ip;
    if (!clientIp) {
      try {
        const h = await headers();
        clientIp =
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          h.get("x-real-ip")?.trim() ||
          "127.0.0.1";
      } catch {
        clientIp = "127.0.0.1";
      }
    }

    await adminClient.from("registros_auditoria").insert({
      perfil_id: params.perfilId || null,
      accion: params.accion,
      tabla_afectada: params.tablaAfectada,
      registro_afectado_id: params.registroAfectadoId || null,
      valores_previos: (params.valoresPrevios as Json) ?? null,
      valores_nuevos: (params.valoresNuevos as Json) ?? null,
      direccion_ip: clientIp || null,
    });
  } catch (err) {
    console.error("[Bitácora] Error al guardar registro de auditoría:", err);
  }
}
