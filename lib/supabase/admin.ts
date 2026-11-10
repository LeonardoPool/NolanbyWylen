import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente con rol de servicio (Service Role).
 * EXCLUSIVO para uso del lado del servidor (Server Actions administrativas o ingesta de hardware).
 * Omite las políticas RLS de PostgreSQL. NUNCA se ejecuta en el navegador.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "ERROR CRÍTICO DE SEGURIDAD: Intentando invocar createAdminClient() en el navegador."
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno para el cliente administrativo de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
