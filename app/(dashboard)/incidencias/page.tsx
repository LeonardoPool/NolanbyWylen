import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  obtenerIncidenciasAdmin,
  obtenerMonitoreoBucketJustificantes,
} from "@/features/incidencias/actions";
import { IncidenciasVista } from "@/features/incidencias/components/incidencias-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Incidencias y Justificantes",
  description: "Control administrativo de vacaciones, permisos y justificaciones médicas.",
};

function IncidenciasSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
        ))}
      </div>
      <Card className="rounded-2xl border-zinc-200">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-400">Cargando incidencias y solicitudes...</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function IncidenciasContenido() {
  await connection();
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

export default function IncidenciasPage() {
  return (
    <Suspense fallback={<IncidenciasSkeleton />}>
      <IncidenciasContenido />
    </Suspense>
  );
}
