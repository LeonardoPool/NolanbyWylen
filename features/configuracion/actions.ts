"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";
import {
  HorarioLaboralConfig,
  HORARIO_LABORAL_DEFAULT,
} from "@/lib/lft/calculo-horas";

export type ConfiguracionTallerRow = Database["public"]["Tables"]["configuracion_taller"]["Row"];

export interface ConfiguracionActionResult {
  success: boolean;
  message?: string;
  error?: string;
  configuracion?: ConfiguracionTallerRow;
}

const CONFIG_DEFAULT: ConfiguracionTallerRow = {
  id: "00000000-0000-0000-0000-000000000001",
  nombre_taller: "Servicio Mecánico López",
  direccion_taller: "Av. Principal del Taller",
  checado_web_habilitado: true,
  latitud: 19.432608,
  longitud: -99.133209,
  radio_tolerancia_metros: 150,
  dia_descanso_semanal: 0,
  fecha_actualizacion: new Date().toISOString(),
};

/**
 * Obtiene los parámetros operativos del taller y geocerca para checado web.
 */
export async function obtenerConfiguracionTaller(): Promise<{
  configuracion: ConfiguracionTallerRow;
  esAdmin: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let esAdmin = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfil?.rol === "ADMINISTRADOR") {
      esAdmin = true;
    }
  }

  try {
    const { data, error } = await supabase
      .from("configuracion_taller")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        configuracion: CONFIG_DEFAULT,
        esAdmin,
      };
    }

    return {
      configuracion: data,
      esAdmin,
    };
  } catch {
    return {
      configuracion: CONFIG_DEFAULT,
      esAdmin,
    };
  }
}

/**
 * Actualiza los parámetros del taller, geocerca GPS y switch de checado online.
 */
export async function actualizarConfiguracionTaller(
  formData: FormData
): Promise<ConfiguracionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sesión no válida o expirada." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    return {
      success: false,
      error: "Solo un usuario con rol ADMINISTRADOR puede modificar estos parámetros.",
    };
  }

  const nombre_taller = String(formData.get("nombre_taller") || "Servicio Mecánico López").trim();
  const direccion_taller = String(formData.get("direccion_taller") || "").trim();
  const checado_web_habilitado = formData.get("checado_web_habilitado") === "true";
  const latitud = parseFloat(String(formData.get("latitud") || "19.432608"));
  const longitud = parseFloat(String(formData.get("longitud") || "-99.133209"));
  const radio_tolerancia_metros = parseInt(String(formData.get("radio_tolerancia_metros") || "150"), 10);

  if (isNaN(latitud) || isNaN(longitud)) {
    return { success: false, error: "Las coordenadas de latitud o longitud no son válidas." };
  }

  if (isNaN(radio_tolerancia_metros) || radio_tolerancia_metros < 2 || radio_tolerancia_metros > 150) {
    return {
      success: false,
      error: "El radio de tolerancia debe ser un valor entre 2 y 150 metros.",
    };
  }

  try {
    const adminClient = createAdminClient();

    // Verificamos si existe registro previo
    const { data: existente } = await adminClient
      .from("configuracion_taller")
      .select("*")
      .limit(1)
      .maybeSingle();

    let resultado: ConfiguracionTallerRow | null = null;

    if (existente) {
      const { data: updated, error } = await adminClient
        .from("configuracion_taller")
        .update({
          nombre_taller,
          direccion_taller,
          checado_web_habilitado,
          latitud,
          longitud,
          radio_tolerancia_metros,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", existente.id)
        .select("*")
        .single();

      if (error || !updated) {
        return { success: false, error: "No se pudo actualizar la configuración en base de datos." };
      }
      resultado = updated;
    } else {
      const { data: inserted, error } = await adminClient
        .from("configuracion_taller")
        .insert({
          nombre_taller,
          direccion_taller,
          checado_web_habilitado,
          latitud,
          longitud,
          radio_tolerancia_metros,
        })
        .select("*")
        .single();

      if (error || !inserted) {
        return { success: false, error: "No se pudo registrar la configuración inicial." };
      }
      resultado = inserted;
    }

    // Auditoría
    await adminClient.from("registros_auditoria").insert({
      perfil_id: user.id,
      accion: "ACTUALIZACION_CONFIGURACION_TALLER",
      tabla_afectada: "configuracion_taller",
      registro_afectado_id: resultado.id,
      valores_previos: (existente as unknown as Json) ?? null,
      valores_nuevos: resultado as unknown as Json,
    });

    revalidatePath("/configuracion");
    revalidatePath("/checador");

    return {
      success: true,
      message: "Configuración del taller y geocerca actualizada correctamente.",
      configuracion: resultado,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al conectar con la base de datos.";
    return { success: false, error: msg };
  }
}

export interface SugerenciaLugarGoogle {
  placeId: string;
  nombre: string;
  textoPrincipal: string;
  textoSecundario: string;
}

export interface RespuestaLugaresGoogle {
  success: boolean;
  sugerencias: SugerenciaLugarGoogle[];
  placesApiHabilitado: boolean;
  error?: string;
  enlaceActivacion?: string;
}

/**
 * Consulta sugerencias de lugares y direcciones directamente a Google Places API (New)
 */
export async function buscarLugaresGoogle(
  query: string
): Promise<RespuestaLugaresGoogle> {
  const q = (query || "").trim();
  if (!q) {
    return { success: true, sugerencias: [], placesApiHabilitado: true };
  }

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "AIzaSyDTWIUl2XbrZmEbxu3TC6Js_LwfLmSZ_mo";

  const url = "https://places.googleapis.com/v1/places:autocomplete";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: ["mx"],
        languageCode: "es",
      }),
    });

    const data = await res.json();

    if (res.status === 403 || data?.error?.status === "PERMISSION_DENIED") {
      return {
        success: false,
        sugerencias: [],
        placesApiHabilitado: false,
        error:
          data?.error?.message ||
          "La API Places API (New) no está habilitada en tu proyecto de Google Cloud.",
        enlaceActivacion:
          "https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=443063301097",
      };
    }

    if (!res.ok) {
      return {
        success: false,
        sugerencias: [],
        placesApiHabilitado: true,
        error: data?.error?.message || `Error HTTP ${res.status}`,
      };
    }

    const suggestions = data.suggestions || [];
    const lista: SugerenciaLugarGoogle[] = suggestions
      .filter((s: any) => s.placePrediction)
      .map((s: any) => {
        const p = s.placePrediction;
        return {
          placeId: p.placeId || p.place?.replace("places/", "") || "",
          nombre: p.text?.text || "Lugar sin nombre",
          textoPrincipal: p.structuredFormat?.mainText?.text || p.text?.text || "",
          textoSecundario: p.structuredFormat?.secondaryText?.text || "",
        };
      });

    return {
      success: true,
      sugerencias: lista,
      placesApiHabilitado: true,
    };
  } catch (err) {
    return {
      success: false,
      sugerencias: [],
      placesApiHabilitado: true,
      error:
        err instanceof Error
          ? err.message
          : "Error al conectar con Google Places API",
    };
  }
}

/**
 * Obtiene las coordenadas y dirección formateada de un lugar seleccionado en Google Places
 */
export async function obtenerDetalleLugarGoogle(placeId: string): Promise<{
  success: boolean;
  lat?: number;
  lng?: number;
  nombre?: string;
  direccion?: string;
  error?: string;
}> {
  if (!placeId) {
    return { success: false, error: "ID de lugar no proporcionado" };
  }

  const cleanId = placeId.replace("places/", "");
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "AIzaSyDTWIUl2XbrZmEbxu3TC6Js_LwfLmSZ_mo";

  const url = `https://places.googleapis.com/v1/places/${cleanId}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "location,displayName,formattedAddress",
      },
    });

    const data = await res.json();

    if (!res.ok || !data?.location) {
      return {
        success: false,
        error:
          data?.error?.message ||
          "No se pudo obtener la ubicación geográfica de Google Maps.",
      };
    }

    return {
      success: true,
      lat: data.location.latitude,
      lng: data.location.longitude,
      nombre: data.displayName?.text || data.formattedAddress,
      direccion: data.formattedAddress,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error al conectar con el servicio de detalles de Google Maps",
    };
  }
}

const BUCKET_CONFIG = "configuracion-sistema";
const ARCHIVO_HORARIOS = "horario-laboral.json";

/**
 * Consulta la configuración de horario laboral del taller y regla de horas extras.
 * Aplica para todos los empleados registrados.
 */
export async function obtenerHorarioLaboralConfig(): Promise<HorarioLaboralConfig> {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient.storage
      .from(BUCKET_CONFIG)
      .download(ARCHIVO_HORARIOS);

    if (error || !data) {
      return HORARIO_LABORAL_DEFAULT;
    }

    const text = await data.text();
    const parsed = JSON.parse(text);

    return {
      semanal: {
        dias: Array.isArray(parsed.semanal?.dias)
          ? parsed.semanal.dias
          : HORARIO_LABORAL_DEFAULT.semanal.dias,
        horaEntrada: parsed.semanal?.horaEntrada || HORARIO_LABORAL_DEFAULT.semanal.horaEntrada,
        horaSalida: parsed.semanal?.horaSalida || HORARIO_LABORAL_DEFAULT.semanal.horaSalida,
        toleranciaEntradaMinutos:
          parsed.semanal?.toleranciaEntradaMinutos ??
          HORARIO_LABORAL_DEFAULT.semanal.toleranciaEntradaMinutos,
      },
      finDeSemana: {
        sabadoLaborable:
          parsed.finDeSemana?.sabadoLaborable ??
          HORARIO_LABORAL_DEFAULT.finDeSemana.sabadoLaborable,
        dias: Array.isArray(parsed.finDeSemana?.dias)
          ? parsed.finDeSemana.dias
          : parsed.finDeSemana?.sabadoLaborable === false
          ? []
          : [6],
        horaEntradaSabado:
          parsed.finDeSemana?.horaEntradaSabado ||
          HORARIO_LABORAL_DEFAULT.finDeSemana.horaEntradaSabado,
        horaSalidaSabado:
          parsed.finDeSemana?.horaSalidaSabado ||
          HORARIO_LABORAL_DEFAULT.finDeSemana.horaSalidaSabado,
        toleranciaSabadoMinutos:
          parsed.finDeSemana?.toleranciaSabadoMinutos ??
          HORARIO_LABORAL_DEFAULT.finDeSemana.toleranciaSabadoMinutos,
        diaDescansoSemanal:
          parsed.finDeSemana?.diaDescansoSemanal ??
          HORARIO_LABORAL_DEFAULT.finDeSemana.diaDescansoSemanal,
        diasDescanso: Array.isArray(parsed.finDeSemana?.diasDescanso)
          ? parsed.finDeSemana.diasDescanso
          : undefined,
      },
      horasExtras: {
        minutosMinimosToleranciaSalida:
          parsed.horasExtras?.minutosMinimosToleranciaSalida ??
          HORARIO_LABORAL_DEFAULT.horasExtras.minutosMinimosToleranciaSalida,
      },
    };
  } catch {
    return HORARIO_LABORAL_DEFAULT;
  }
}

/**
 * Actualiza el horario laboral del taller y regla de horas extras.
 * Aplica de forma global a todos los empleados del sistema.
 */
export async function actualizarHorarioLaboralConfig(
  nuevaConfig: HorarioLaboralConfig
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesión no válida o expirada." };
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
      return {
        success: false,
        error: "Solo un usuario con rol ADMINISTRADOR puede modificar el horario laboral.",
      };
    }

    const adminClient = createAdminClient();

    // Asegurar que el bucket privado exista
    await adminClient.storage.createBucket(BUCKET_CONFIG, { public: false }).catch(() => {});

    const payload = JSON.stringify({
      ...nuevaConfig,
      fechaActualizacion: new Date().toISOString(),
      actualizadoPor: user.id,
    });

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET_CONFIG)
      .upload(ARCHIVO_HORARIOS, payload, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Error al almacenar horario: ${uploadError.message}` };
    }

    // Sincronizar día de descanso semanal con configuracion_taller
    await adminClient
      .from("configuracion_taller")
      .update({
        dia_descanso_semanal: nuevaConfig.finDeSemana.diaDescansoSemanal,
        fecha_actualizacion: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    revalidatePath("/configuracion");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    revalidatePath("/reportes");

    return {
      success: true,
      message: "Horario laboral semanal, fines de semana y regla de horas extras actualizados para todos los empleados.",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al guardar horario laboral.",
    };
  }
}
