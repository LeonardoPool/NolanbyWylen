"use client";

import { Menu, User, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/features/auth/actions";
import { notify } from "@/lib/feedback/toast";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    notify.info("Cerrando sesión", "Hasta pronto");
    await new Promise((r) => setTimeout(r, 600));
    await cerrarSesion();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-zinc-200/80 bg-white/90 px-4 md:px-6 backdrop-blur-xs select-none">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="md:hidden text-zinc-600 hover:text-zinc-900"
          aria-label="Abrir menú"
        >
          <Menu className="h-4 w-4" strokeWidth={1.5} />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-900 tracking-tight">
            Panel de Asistencias
          </span>
          <span className="text-zinc-300 text-xs hidden sm:inline">&middot;</span>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            Servicio Mecánico López
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 border-l border-zinc-100 pl-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/60">
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-medium text-zinc-800 leading-tight">
              Administración
            </span>
            <span className="text-[10px] text-zinc-400">
              Operador
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-xs text-zinc-500 hover:text-zinc-900 h-8 px-2"
        >
          <LogOut className="h-3.5 w-3.5 mr-1 text-zinc-400" strokeWidth={1.5} />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  );
}
