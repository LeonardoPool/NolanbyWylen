import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerBitacoraEventos } from "@/features/bitacora/actions";
import { BitacoraVista } from "@/features/bitacora/components/bitacora-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Bitácora de Auditoría | NOLAN",
  description: "Registro cronológico inmutable de movimientos administrativos, altas de empleados, horarios y resoluciones LFT.",
};

function BitacoraSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
        ))}
      </div>
      <Card className="rounded-2xl border-zinc-200">
        <CardContent className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-400">Cargando bitácora de movimientos...</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function BitacoraContenido() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const res = await obtenerBitacoraEventos({ rangoDias: 30 });

  return (
    <BitacoraVista
      registrosIniciales={res.registros}
      metricasIniciales={res.metricas}
    />
  );
}

export default function BitacoraPage() {
  return (
    <Suspense fallback={<BitacoraSkeleton />}>
      <BitacoraContenido />
    </Suspense>
  );
}
