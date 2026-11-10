import { FileText, Download, Calendar, Users, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ReportesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Generador de Reportes
          </h1>
          <p className="text-xs text-zinc-500">
            Consolidación y exportación de asistencias para el control interno de Servicio Mecánico López.
          </p>
        </div>
      </div>

      {/* Filter and Criteria Card */}
      <Card>
        <CardHeader>
          <CardTitle>Criterios de Exportación</CardTitle>
          <CardDescription>
            Configura el rango de fechas y los empleados a incluir en el reporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Periodo */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                Rango de Fechas
              </label>
              <select className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none">
                <option value="quincena_actual">Quincena en curso</option>
                <option value="mes_actual">Mes en curso</option>
                <option value="quincena_anterior">Quincena anterior</option>
                <option value="mes_anterior">Mes anterior</option>
                <option value="personalizado">Rango personalizado...</option>
              </select>
            </div>

            {/* Empleado */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                Personal Incluido
              </label>
              <select className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none">
                <option value="todos">Todo el personal activo</option>
                <option value="taller">Solo mecánicos de taller</option>
                <option value="individual">Seleccionar empleado individual...</option>
              </select>
            </div>

            {/* Formato */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                Formato de Salida
              </label>
              <div className="flex gap-2 pt-0.5">
                <Button variant="outline" size="sm" className="flex-1 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1 text-zinc-400" strokeWidth={1.5} />
                  Excel / CSV
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs">
                  <Printer className="h-3.5 w-3.5 mr-1 text-zinc-400" strokeWidth={1.5} />
                  PDF Imprimible
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Vista Previa del Resumen</CardTitle>
          <CardDescription>
            Los datos calculados se mostrarán aquí una vez que existan registros de asistencia en la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-200/60">
              <FileText className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-xs font-semibold text-zinc-800">
              Sin datos para generar reporte
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
              Selecciona los criterios deseados y haz clic en exportar cuando comiencen a registrarse las checadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
