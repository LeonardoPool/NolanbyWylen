import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] p-6 text-zinc-900">
      <main className="w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-xs text-center">
        <div className="mb-6 flex flex-col items-center">
          <div className="relative h-12 w-12 mb-3">
            <Image
              src="/isotipo-nolan.png"
              alt="Isotipo NOLAN"
              fill
              sizes="48px"
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
              NOLAN
            </span>
            <span className="text-zinc-300">&middot;</span>
            <span className="text-[11px] text-zinc-400 font-medium">
              por WYLEN
            </span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            Control de Asistencia
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Servicio Mecánico López
          </p>
        </div>

        <div className="space-y-2.5">
          <Link
            href="/login"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white transition hover:bg-zinc-800 shadow-xs"
          >
            <span>Acceder a la Consola</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
          <Link
            href="/dashboard"
            className="flex h-9 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            Ir directo al Panel
          </Link>
        </div>

        <div className="mt-8 border-t border-zinc-100 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
          <span>Acceso administrativo protegido</span>
        </div>
      </main>
    </div>
  );
}
