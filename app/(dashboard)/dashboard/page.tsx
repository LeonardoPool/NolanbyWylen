import { Users, UserCheck, UserX, Radio, Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Top Welcome & Subtitle */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Resumen Operativo
          </h1>
          <p className="text-xs text-zinc-500">
            Control de asistencia y estado del personal en Servicio Mecánico López.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-zinc-600 bg-white">
            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" strokeWidth={1.5} />
            Sistema en línea
          </Badge>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Empleados */}
        <Card className="hover:border-zinc-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Personal Activo
            </CardTitle>
            <Users className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900 tracking-tight">--</div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Registrados en catálogo
            </p>
          </CardContent>
        </Card>

        {/* Presentes Hoy */}
        <Card className="hover:border-zinc-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Presentes Hoy
            </CardTitle>
            <UserCheck className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900 tracking-tight">--</div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Marcajes de entrada registrados
            </p>
          </CardContent>
        </Card>

        {/* Ausentes */}
        <Card className="hover:border-zinc-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Sin Marcaje
            </CardTitle>
            <UserX className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900 tracking-tight">--</div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Pendientes de checar hoy
            </p>
          </CardContent>
        </Card>

        {/* Estado del Checador */}
        <Card className="hover:border-zinc-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Checador Biométrico
            </CardTitle>
            <Radio className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-sm font-semibold text-zinc-900">En espera</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              ZKTeco MB10V (Taller)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Actividad Reciente + Info Rápida */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Monitor en Vivo */}
        <Card className="md:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>
                  Últimos marcajes sincronizados en tiempo real.
                </CardDescription>
              </div>
              <Clock className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-200/60">
                <Clock className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <p className="text-xs font-medium text-zinc-700">
                Sin marcajes registrados el día de hoy
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Los eventos de entrada y salida aparecerán aquí de forma automática al momento de checar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Estado de Sincronización */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Canal de Sincronización</CardTitle>
            <CardDescription>
              Hardware biométrico e infraestructura cloud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-zinc-200/70 bg-[#FAF9F6] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Dispositivo:</span>
                <span className="font-medium text-zinc-900">ZKTeco MB10V</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ubicación:</span>
                <span className="font-medium text-zinc-900">Servicio Mecánico López</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Base de datos:</span>
                <span className="font-medium text-zinc-900">PostgreSQL (Supabase)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Seguridad:</span>
                <span className="text-emerald-700 font-medium">RLS v2.0 Activo</span>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-white p-3 text-[11px] text-zinc-500 leading-relaxed">
              La base de datos relacional y sus 5 tablas operativas se encuentran vinculadas. Las credenciales de acceso están configuradas de forma segura.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
