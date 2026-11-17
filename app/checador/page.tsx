import { Suspense } from "react";
import type { Metadata } from "next";
import { PortalEmpleado } from "@/features/checador/components/portal-empleado";

export const metadata: Metadata = {
  title: "Portal de Asistencia del Empleado | NOLAN",
  description: "Registro de asistencia móvil con geocerca GPS para Servicio Mecánico López.",
};

export default function ChecadorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-xs">Cargando checador...</div>}>
      <PortalEmpleado />
    </Suspense>
  );
}
