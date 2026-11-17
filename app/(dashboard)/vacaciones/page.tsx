import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerFichasVacacionalesAdmin } from "@/features/vacaciones/actions";
import { VacacionesVista } from "@/features/vacaciones/components/vacaciones-vista";

export const metadata: Metadata = {
  title: "Vacaciones LFT",
  description: "Control integral de vacaciones, saldos por aniversario y descansos de la Ley Federal del Trabajo.",
};

export const revalidate = 0;

export default async function VacacionesPage() {
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

  const { fichas, error } = await obtenerFichasVacacionalesAdmin();

  return (
    <div className="py-2">
      <VacacionesVista fichasIniciales={fichas || []} />
    </div>
  );
}
