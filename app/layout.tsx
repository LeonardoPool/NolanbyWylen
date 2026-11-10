import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sileo";
import "sileo/styles.css";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | NOLAN",
    default: "NOLAN | Control de Asistencia",
  },
  description:
    "Sistema de Control de Asistencia para Servicio Mecánico López. Diseñado por WYLEN.",
  icons: {
    icon: "/isotipo-nolan.png",
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
        {children}
      </body>
    </html>
  );
}
