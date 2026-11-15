import { Suspense } from "react";
import { connection } from "next/server";
import { obtenerMetricasDashboard } from "@/features/dashboard/actions";
import { DashboardVista } from "@/features/dashboard/components/dashboard-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
        <div className="h-8 w-32 bg-zinc-100 rounded-xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4 h-72 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
        <div className="lg:col-span-3 h-72 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <div className="md:col-span-4 h-64 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
        <div className="md:col-span-3 h-64 bg-zinc-100 rounded-3xl border border-zinc-200/60" />
      </div>
    </div>
  );
}

async function DashboardContenido() {
  await connection();

  const res = await obtenerMetricasDashboard();

  if (!res.success || !res.metricas) {
    return (
      <Card className="rounded-2xl border-rose-200 bg-rose-50/50 p-6 text-center text-xs text-rose-800">
        <p className="font-semibold">No se pudieron cargar las métricas operativas del dashboard.</p>
        <p className="text-[11px] text-rose-600 mt-1">{res.error || "Error de conexión con la base de datos."}</p>
      </Card>
    );
  }

  return <DashboardVista metricasIniciales={res.metricas} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContenido />
    </Suspense>
  );
}
