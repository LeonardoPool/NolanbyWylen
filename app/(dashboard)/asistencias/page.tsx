import { Clock, Calendar, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AsistenciasPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Control de Asistencias
          </h1>
          <p className="text-xs text-zinc-500">
            Historial inmutable de marcajes de entrada y salida de Servicio Mecánico López.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs text-zinc-700">
            <Download className="h-3.5 w-3.5 mr-1 text-zinc-400" strokeWidth={1.5} />
            Exportar Vista
          </Button>
          <Button size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            Marcaje Manual
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
              <span className="font-medium text-zinc-800">Período:</span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700 border border-zinc-200/60 font-medium">
                Hoy (En curso)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs text-zinc-600 h-8">Esta semana</Button>
              <Button variant="ghost" size="sm" className="text-xs text-zinc-600 h-8">Quincena actual</Button>
              <Button variant="ghost" size="sm" className="text-xs text-zinc-600 h-8">Mes actual</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Empty State */}
      <Card>
        <CardHeader>
          <CardTitle>Marcajes del Período</CardTitle>
          <CardDescription>
            Trazabilidad con método de registro y dispositivo de origen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-200/60">
              <Clock className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-xs font-semibold text-zinc-800">
              No hay marcajes para el rango seleccionado
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
              Las checadas transmitidas por el checador o registradas manualmente quedarán asentadas aquí.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
