import { Radio, Server, KeyRound, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Configuración del Sistema
          </h1>
          <p className="text-xs text-zinc-500">
            Parámetros operativos de NOLAN, seguridad de acceso y enlace con el checador biométrico.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Hardware Status & Token */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
                  Checador Biométrico
                </CardTitle>
                <CardDescription>
                  Dispositivo físico asignado en Servicio Mecánico López.
                </CardDescription>
              </div>
              <Badge variant="warning">En espera</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-zinc-200/70 bg-[#FAF9F6] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Modelo previsto:</span>
                <span className="font-medium text-zinc-900">ZKTeco MB10V</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Autenticación de tramas:</span>
                <span className="text-zinc-800 font-mono text-[11px]">Token SHA-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Biometría en la nube:</span>
                <span className="text-zinc-700">Desactivada (100% local en hardware)</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
              <AlertCircle className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" strokeWidth={1.5} />
              <p className="text-[11px] leading-relaxed">
                El token precompartido para el dispositivo se encuentra configurado en la variable de entorno <code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded font-mono">CHECADOR_DEVICE_TOKEN</code> en el servidor. Nunca se expone en el cliente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Database & Infrastructure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
              Base de Datos y Backend
            </CardTitle>
            <CardDescription>
              Plataforma en la nube y almacenamiento relacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-zinc-200/70 bg-[#FAF9F6] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Motor relacional:</span>
                <span className="font-medium text-zinc-900">PostgreSQL (Supabase)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Políticas de seguridad:</span>
                <span className="text-emerald-700 font-medium">Row Level Security (RLS) v2.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Idempotencia de marcajes:</span>
                <span className="text-zinc-700">Hash criptográfico determinista</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Control de acceso:</span>
                <span className="text-zinc-700">RBAC (ADMINISTRADOR / SUPERVISOR)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200/80 bg-white text-xs">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                <span className="text-zinc-700 font-medium text-[11px]">Tablas e Índices v2.0</span>
              </div>
              <Badge variant="success">Desplegado</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
