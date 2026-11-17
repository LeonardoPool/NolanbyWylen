import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  obtenerIncidenciasAdmin,
  obtenerMonitoreoBucketJustificantes,
} from "@/features/incidencias/actions";
import { IncidenciasVista } from "@/features/incidencias/components/incidencias-vista";

export const metadata: Metadata = {
  title: "Incidencias y Justificantes",
  description: "Control administrativo de vacaciones, permisos y justificaciones médicas.",
};

export const revalidate = 0; // Dinámico para reflejar cambios inmediatos

export default async function IncidenciasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();

  // 1. Cargar incidencias
  const { incidencias } = await obtenerIncidenciasAdmin();

  // 2. Cargar catálogo de empleados para selector de filtros
  const { data: empleados } = await adminClient
    .from("empleados")
    .select("id, nombre, apellidos, numero_empleado")
    .eq("activo", true)
    .order("nombre");

  // 3. Monitoreo de cuota gratuita de Storage
  const monitoreo = await obtenerMonitoreoBucketJustificantes();

  return (
    <div className="py-2">
      <IncidenciasVista
        incidenciasIniciales={incidencias}
        empleados={empleados || []}
        monitoreoStorage={monitoreo}
      />
    </div>
  );
}
