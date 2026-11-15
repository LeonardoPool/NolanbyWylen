import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { obtenerCatalogoEmpleados } from "@/features/empleados/actions";
import { EmpleadosVista } from "@/features/empleados/components/empleados-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Catálogo de Empleados",
  description: "Administración del personal de Servicio Mecánico López y enlace con el checador biométrico.",
};

async function EmpleadosContenido() {
  await connection();
  const { empleados, rol, error } = await obtenerCatalogoEmpleados();

  return (
    <EmpleadosVista
      empleadosIniciales={empleados}
      rolUsuario={rol}
      errorInicial={error}
    />
  );
}

function EmpleadosSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-56 bg-zinc-200 rounded-lg" />
          <div className="h-3 w-80 bg-zinc-100 rounded" />
        </div>
        <div className="h-9 w-36 bg-zinc-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-zinc-100 border border-zinc-200/60 rounded-xl" />
        ))}
      </div>
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin mb-2 text-zinc-400" />
          <span className="text-xs">Cargando catálogo de empleados...</span>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EmpleadosPage() {
  return (
    <Suspense fallback={<EmpleadosSkeleton />}>
      <EmpleadosContenido />
    </Suspense>
  );
}
