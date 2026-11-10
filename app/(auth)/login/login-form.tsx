"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { iniciarSesion, type AuthState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<AuthState | null, FormData>(
    iniciarSesion,
    null
  );

  useEffect(() => {
    if (state?.error) {
      notify.error("Acceso denegado", state.error);
    }
    if (state?.success) {
      notify.success("Sesión iniciada", "Bienvenido al panel de NOLAN");
      router.push("/dashboard");
    }
  }, [state, router]);

  return (
    <div className="mx-auto w-full max-w-[390px]">
      {/* Isotipo & Marca */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/isotipo-nolan.png"
              alt="Isotipo NOLAN"
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-zinc-900 leading-none">
              NOLAN
            </span>
            <span className="text-[11px] text-zinc-400 font-medium tracking-wide mt-0.5">
              por WYLEN
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Iniciar sesión
        </h1>
        <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
          Ingresa tus credenciales para acceder a la consola administrativa de Servicio Mecánico López.
        </p>
      </div>

      {/* Formulario */}
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-xs font-medium text-zinc-700 block"
          >
            Correo electrónico
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="admin@nolan.wylen.com"
              className="w-full rounded-xl border border-zinc-200/90 bg-[#F9F9FB] px-3.5 py-2.5 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
            />
            <Mail
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-xs font-medium text-zinc-700 block"
            >
              Contraseña
            </label>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-zinc-200/90 bg-[#F9F9FB] px-3.5 py-2.5 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
            />
            <Lock
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full mt-3 h-11 text-sm font-medium rounded-xl shadow-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-zinc-400" strokeWidth={1.75} />
              Verificando acceso...
            </>
          ) : (
            <>
              <span>Ingresar a la consola</span>
              <ArrowRight className="h-4 w-4 ml-1.5" strokeWidth={1.75} />
            </>
          )}
        </Button>
      </form>

      {/* Garantías de seguridad */}
      <div className="mt-8 border-t border-zinc-100 pt-5 space-y-2">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.75} />
          <span>Conexión cifrada de extremo a extremo</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.75} />
          <span>Sesiones protegidas con expiración automática</span>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Acceso exclusivo para personal administrativo de Servicio Mecánico López.
        </p>
      </div>
    </div>
  );
}

