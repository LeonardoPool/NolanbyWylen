import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerFichasVacacionalesAdmin } from "@/features/vacaciones/actions";
import { VacacionesVista } from "@/features/vacaciones/components/vacaciones-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Vacaciones LFT",
  description: "Control integral de vacaciones, saldos por aniversario y descansos de la Ley Federal del Trabajo.",
};

function VacacionesSkeleton() {
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
          <p className="text-xs text-zinc-400">Cargando fichas vacacionales LFT...</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function VacacionesContenido() {
  await connection();
  const { fichas, esAdmin, error } = await obtenerFichasVacacionalesAdmin();

  if (error === "Sesión no válida o expirada.") {
    redirect("/login");
  }

  return (
    <div className="py-2">
      <VacacionesVista
        fichasIniciales={fichas || []}
        esAdmin={esAdmin ?? false}
        errorInicial={error}
      />
    </div>
  );
}

export default function VacacionesPage() {
  return (
    <Suspense fallback={<VacacionesSkeleton />}>
      <VacacionesContenido />
    </Suspense>
  );
}
