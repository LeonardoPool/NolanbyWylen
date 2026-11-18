import { Suspense } from "react";
import { connection } from "next/server";
import { obtenerDatosRegistroJornadaDashboard } from "@/features/dashboard/actions";
import { DashboardJornadaVista } from "@/features/dashboard/components/dashboard-jornada-vista";
import { Card } from "@/components/ui/card";

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-16 w-full bg-zinc-100 rounded-3xl border border-zinc-200/60" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 h-96 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
        <div className="lg:col-span-5 h-96 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
        <div className="lg:col-span-4 h-96 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
      </div>
    </div>
  );
}

async function DashboardContenido() {
  await connection();

  const res = await obtenerDatosRegistroJornadaDashboard();

  if (!res.success || !res.datos) {
    return (
      <Card className="rounded-3xl border-rose-200 bg-rose-50/50 p-6 text-center text-xs text-rose-800">
        <p className="font-semibold">No se pudieron cargar los datos del registro electrónico de jornada.</p>
        <p className="text-[11px] text-rose-600 mt-1">{res.error || "Error de conexión con la base de datos."}</p>
      </Card>
    );
  }

  return <DashboardJornadaVista datosIniciales={res.datos} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContenido />
    </Suspense>
  );
}
