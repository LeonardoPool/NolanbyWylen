import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sileo";
import { PwaRegistrar } from "@/components/pwa-registrar";
import "sileo/styles.css";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#18181B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    template: "%s | NOLAN",
    default: "NOLAN | Control de Asistencia",
  },
  description:
    "Sistema de Control de Asistencia para Servicio Mecánico López. Diseñado por WYLEN.",
  applicationName: "NOLAN Administrador",
  manifest: "/manifest-admin.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NOLAN",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/isotipo-nolan.png", type: "image/png" },
      { url: "/icons/admin-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/admin-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/admin-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#FAF9F6] text-zinc-900">
        <Toaster position="top-right" theme="light" />
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
