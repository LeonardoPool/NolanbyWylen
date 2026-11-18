import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import {
  obtenerConfiguracionTaller,
  obtenerHorarioLaboralConfig,
} from "@/features/configuracion/actions";
import { obtenerCatalogoEmpleados } from "@/features/empleados/actions";
import { obtenerPermisosExtraordinarios } from "@/features/permisos-viaje/actions";
import { ConfiguracionVista } from "@/features/configuracion/components/configuracion-vista";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Configuración del Sistema",
  description:
    "Parámetros operativos de NOLAN, sistema inteligente de horario laboral, Google Maps y permisos extraordinarios de viaje.",
};

async function ConfiguracionContenido() {
  await connection();
  const [{ configuracion, esAdmin }, { empleados }, { permisos }, horario] = await Promise.all([
    obtenerConfiguracionTaller(),
    obtenerCatalogoEmpleados(),
    obtenerPermisosExtraordinarios(),
    obtenerHorarioLaboralConfig(),
  ]);

  return (
    <ConfiguracionVista
      configuracionInicial={configuracion}
      empleados={empleados}
      permisosIniciales={permisos}
      horarioInicial={horario}
      esAdmin={esAdmin}
    />
  );
}

function ConfiguracionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-5xl">
      <div className="h-10 w-72 bg-zinc-200 rounded-lg" />
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-xs">Cargando parámetros de configuración y geocercas...</span>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<ConfiguracionSkeleton />}>
      <ConfiguracionContenido />
    </Suspense>
  );
}
