import { Users, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function EmpleadosPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Catálogo de Empleados
          </h1>
          <p className="text-xs text-zinc-500">
            Personal de Servicio Mecánico López y clave de enlace con el checador biométrico.
          </p>
        </div>
        <Button size="sm" className="w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
          Nuevo Empleado
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar por nombre, puesto o número de empleado..."
                className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs text-zinc-600">
                <Filter className="h-3 w-3 mr-1 text-zinc-400" strokeWidth={1.5} />
                Filtrar: Activos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table / Empty State Card */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Registrado</CardTitle>
          <CardDescription>
            Listado con código biométrico asignado en el ZKTeco MB10V.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-200/60">
              <Users className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-xs font-semibold text-zinc-800">
              No hay empleados registrados en la base de datos
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
              Registra a los trabajadores del taller para vincularlos con el checador biométrico.
            </p>
            <Button variant="outline" size="sm" className="mt-4 text-xs">
              <Plus className="h-3 w-3 mr-1 text-zinc-400" strokeWidth={1.5} />
              Registrar Primer Empleado
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
