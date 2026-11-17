import { NextResponse } from "next/server";

export function GET() {
  const manifest = {
    id: "/admin",
    name: "NOLAN Administrador",
    short_name: "NOLAN",
    description: "Panel Administrativo y Control de Asistencia — Servicio Mecánico López",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF9F6",
    theme_color: "#18181B",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/admin-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/admin-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/admin-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/admin-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
