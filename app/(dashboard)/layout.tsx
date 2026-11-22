"use client";

import * as React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

const RUTAS_PREFETCH_MOVIL = [
  "/dashboard",
  "/analytics",
  "/empleados",
  "/asistencias",
  "/incidencias",
  "/vacaciones",
  "/reportes",
  "/bitacora",
  "/configuracion",
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const router = useRouter();

  // Pre-cargar rutas principales en dispositivos móviles (donde el sidebar fijo está oculto)
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const ruta of RUTAS_PREFETCH_MOVIL) {
        try {
          router.prefetch(ruta);
        } catch {
          // Ignorar si no aplica
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#FAF9F6] text-zinc-900 overflow-x-hidden">
      {/* Sidebar Desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col">
        <Sidebar />
      </div>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-64 max-w-[80vw] flex-1 flex-col bg-white shadow-2xl">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-60 min-w-0 max-w-full overflow-x-hidden">
        <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 p-3.5 sm:p-5 md:p-8 max-w-7xl w-full mx-auto min-w-0 pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}
