import { Suspense } from "react";
import { connection } from "next/server";
import { obtenerReporteInspeccionSTPS } from "@/features/reportes/actions";
import { obtenerCatalogoEmpleados } from "@/features/empleados/actions";
import { ReportesVista } from "@/features/reportes/components/reportes-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function ReportesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
      <div className="h-32 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
        ))}
      </div>
      <Card className="rounded-2xl border-zinc-200">
        <CardContent className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-400">Generando reporte de inspección laboral...</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function ReportesContenido() {
  await connection();

  const ahora = new Date();
  const dia = ahora.getDate();
  let inicio = new Date(ahora);
  let fin = new Date(ahora);

  // Quincena actual por defecto
  if (dia <= 15) {
    inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    fin = new Date(ahora.getFullYear(), ahora.getMonth(), 15);
  } else {
    inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 16);
    fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
  }

  const iniStr = inicio.toISOString().slice(0, 10);
  const finStr = fin.toISOString().slice(0, 10);

  const [reporteRes, empleadosRes] = await Promise.all([
    obtenerReporteInspeccionSTPS({
      fechaInicio: iniStr,
      fechaFin: finStr,
      empleadoId: "todos",
    }),
    obtenerCatalogoEmpleados(),
  ]);

  return (
    <ReportesVista
      reporteInicial={reporteRes}
      empleados={empleadosRes.empleados}
      fechaInicioDefault={iniStr}
      fechaFinDefault={finStr}
    />
  );
}

export default function ReportesPage() {
  return (
    <Suspense fallback={<ReportesSkeleton />}>
      <ReportesContenido />
    </Suspense>
  );
}
