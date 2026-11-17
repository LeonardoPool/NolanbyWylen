import { NextResponse } from "next/server";

export function GET() {
  const manifest = {
    id: "/checador",
    name: "NOLAN Checador",
    short_name: "Checador",
    description: "Portal de Asistencia del Empleado — Servicio Mecánico López",
    start_url: "/checador",
    scope: "/checador",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF9F6",
    theme_color: "#18181B",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/checador-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/checador-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/checador-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/checador-apple-touch-icon.png",
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
