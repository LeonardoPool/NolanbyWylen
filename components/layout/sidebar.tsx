"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  Settings,
  Radio,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { cerrarSesion } from "@/features/auth/actions";
import { notify } from "@/lib/feedback/toast";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Empleados",
    href: "/empleados",
    icon: Users,
  },
  {
    name: "Asistencias",
    href: "/asistencias",
    icon: Clock,
  },
  {
    name: "Reportes",
    href: "/reportes",
    icon: FileText,
  },
  {
    name: "Configuración",
    href: "/configuracion",
    icon: Settings,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    notify.info("Cerrando sesión", "Hasta pronto");
    // Pequeña pausa para que el toast sea visible antes de la navegación
    await new Promise((r) => setTimeout(r, 600));
    await cerrarSesion();
    router.push("/login");
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-200/80 bg-white text-zinc-900 select-none">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-4">
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7 shrink-0">
            <Image
              src="/isotipo-nolan.png"
              alt="Isotipo NOLAN"
              fill
              sizes="28px"
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-tight text-zinc-900 leading-none">
                NOLAN
              </span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide">
                v1.0
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-normal truncate max-w-[130px] mt-0.5">
              Servicio Mecánico López
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors shrink-0",
                  isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"
                )}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Device Status Box */}
      <div className="p-3 border-t border-zinc-100">
        <div className="rounded-lg border border-zinc-200/70 bg-[#FAF9F6] p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-700">Checador ZK</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500 flex items-center gap-1">
            <Radio className="h-3 w-3 text-zinc-400" strokeWidth={1.5} />
            MB10V &middot; En espera
          </p>
        </div>
      </div>

      {/* Logout & Footer */}
      <div className="border-t border-zinc-100 p-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
