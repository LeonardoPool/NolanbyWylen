import { Suspense } from "react";
import { connection } from "next/server";
import { obtenerAsistenciasPeriodo } from "@/features/asistencias/actions";
import { obtenerCatalogoEmpleados } from "@/features/empleados/actions";
import { AsistenciasVista } from "@/features/asistencias/components/asistencias-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function AsistenciasSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
        ))}
      </div>
      <div className="h-24 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
      <Card className="rounded-2xl border-zinc-200">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-400">Cargando control de asistencias...</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function AsistenciasContenido() {
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

  const [asistenciasRes, empleadosRes] = await Promise.all([
    obtenerAsistenciasPeriodo({
      fechaInicio: iniStr,
      fechaFin: finStr,
    }),
    obtenerCatalogoEmpleados(),
  ]);

  return (
    <AsistenciasVista
      jornadasIniciales={asistenciasRes.jornadas}
      resumenInicial={asistenciasRes.resumen}
      empleados={empleadosRes.empleados}
      fechaInicioDefault={iniStr}
      fechaFinDefault={finStr}
    />
  );
}

export default function AsistenciasPage() {
  return (
    <Suspense fallback={<AsistenciasSkeleton />}>
      <AsistenciasContenido />
    </Suspense>
  );
}
