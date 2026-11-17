import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#18181B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "NOLAN Checador | Portal del Empleado",
  description:
    "Registro de asistencia móvil con geocerca GPS e incidencias para Servicio Mecánico López.",
  applicationName: "NOLAN Checador",
  manifest: "/manifest-checador.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Checador",
  },
  icons: {
    icon: [
      { url: "/icons/checador-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/checador-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/checador-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function ChecadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="manifest" href="/manifest-checador.webmanifest" />
      <link rel="apple-touch-icon" href="/icons/checador-apple-touch-icon.png" />
      {children}
    </>
  );
}
