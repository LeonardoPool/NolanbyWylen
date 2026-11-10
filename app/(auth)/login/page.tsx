import Image from "next/image";
import { obtenerVideoEstrellas } from "@/lib/services/pexels";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Iniciar Sesión | NOLAN",
  description: "Acceso a la consola administrativa de Servicio Mecánico López.",
};

export default async function LoginPage() {
  const { videoUrl, posterUrl } = await obtenerVideoEstrellas();

  return (
    <div className="flex min-h-screen w-full bg-white text-zinc-900">
      {/* ==================================================================== */}
      {/* PANEL IZQUIERDO: Video protagonista — solo marca + frase editorial  */}
      {/* ==================================================================== */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-zinc-950 text-white select-none">
        {/* Video Vertical de Fondo (Pexels API - Stars) — protagonista total */}
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={posterUrl}
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        {/* Overlay sutil: solo para contraste de texto, sin opacar el video */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />

        {/* Isotipo + Wordmark — esquina superior izquierda */}
        <div className="relative z-10 flex items-center gap-3 p-10">
          <div className="relative h-9 w-9 shrink-0 drop-shadow-md">
            <Image
              src="/isotipo-nolan.png"
              alt="Isotipo NOLAN"
              fill
              sizes="36px"
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white leading-none">
              NOLAN
            </span>
            <span className="text-[10px] text-white/60 font-medium tracking-widest mt-0.5 uppercase">
              por WYLEN
            </span>
          </div>
        </div>

        {/* Frase editorial — centrada verticalmente, protagonista tipográfico */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 pb-16 text-center">
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight text-white leading-[1.12] drop-shadow-sm">
            Sabe siempre quién llegó primero.
          </h2>
          <p className="mt-4 text-sm text-white/60 font-normal tracking-wide">
            El control de asistencia que tu taller mecánico merecía.
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* PANEL DERECHO: Formulario de Acceso Minimalista con SILEO Toaster   */}
      {/* ==================================================================== */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24 py-12 bg-white">
        <LoginForm />
      </div>
    </div>
  );
}
