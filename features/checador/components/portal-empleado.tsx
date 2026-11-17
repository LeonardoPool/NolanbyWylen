"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import Image from "next/image";
import {
  MapPin,
  LocateFixed,
  LogIn,
  LogOut,
  Coffee,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Calendar,
  FileText,
  User,
  KeyRound,
  Loader2,
  Send,
  X,
  ChevronRight,
  ExternalLink,
  Plane,
  Camera,
  CameraOff,
  ScanFace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  autenticarEmpleado,
  registrarMarcajeOnline,
  obtenerMarcajesDelDia,
  registrarIncidencia,
  obtenerIncidenciasEmpleado,
  type EmpleadoRow,
  type ConfiguracionTallerRow,
  type AsistenciaRow,
  type IncidenciaRow,
  type UbicacionExtraordinariaRow,
  type TipoEventoChecador,
} from "../actions";

export function PortalEmpleado() {
  // Sesión local del empleado
  const [empleado, setEmpleado] = useState<EmpleadoRow | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionTallerRow | null>(null);
  const [permisosViaje, setPermisosViaje] = useState<UbicacionExtraordinariaRow[]>([]);

  // Form login
  const [identificador, setIdentificador] = useState("");
  const [pin, setPin] = useState("");
  const [isLoggingIn, startLoginTransition] = useTransition();
  const [errorLogin, setErrorLogin] = useState<string | null>(null);

  // Estado del reloj en tiempo real
  const [horaActual, setHoraActual] = useState<string>("");
  const [fechaActual, setFechaActual] = useState<string>("");

  // Estado del GPS
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanciaMetros, setDistanciaMetros] = useState<number | null>(null);
  const [lugarValidoNombre, setLugarValidoNombre] = useState<string | null>(null);
  const [esUbicacionViaje, setEsUbicacionViaje] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [solicitandoGps, setSolicitandoGps] = useState(false);

  // Marcajes e Incidencias
  const [asistenciasHoy, setAsistenciasHoy] = useState<AsistenciaRow[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([]);
  const [isMarking, startMarkingTransition] = useTransition();

  // Modal Incidencias
  const [modalIncidencia, setModalIncidencia] = useState(false);
  const [tipoIncidencia, setTipoIncidencia] = useState<
    "VACACIONES" | "FALTA_JUSTIFICADA" | "PERMISO" | "INCAPACIDAD"
  >("VACACIONES");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [archivoBase64, setArchivoBase64] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [archivoTamanoKb, setArchivoTamanoKb] = useState<number | null>(null);
  const [consentimientoSalud, setConsentimientoSalud] = useState(false);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [isSendingIncidencia, startIncidenciaTransition] = useTransition();

  // Fecha actual en America/Merida para restringir selectores
  const hoyMerida = React.useMemo(() => {
    try {
      const formateador = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Merida",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formateador.format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  const minFechaInicio = React.useMemo(() => {
    if (tipoIncidencia === "INCAPACIDAD") {
      const [y, m, d] = hoyMerida.split("-").map(Number);
      const retro = new Date(Date.UTC(y, m - 1, d - 30));
      return retro.toISOString().slice(0, 10);
    }
    return hoyMerida;
  }, [tipoIncidencia, hoyMerida]);

  const minFechaFin = fechaInicio || minFechaInicio;

  // Compresión en cliente con Canvas (Ahorro de espacio gratuito)
  async function procesarArchivoAdjunto(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      notify.error("Archivo demasiado grande", "El límite máximo permitido es de 5 MB.");
      return;
    }

    setProcesandoArchivo(true);
    try {
      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        const url = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const base64 = canvas.toDataURL(mimeType, 0.82);
        URL.revokeObjectURL(url);

        setArchivoBase64(base64);
        setArchivoNombre(file.name);
        setArchivoTamanoKb(Math.round((base64.length * 0.75) / 1024));
        notify.success("Documento adjuntado", `${file.name} comprimido con éxito.`);
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setArchivoBase64(result);
          setArchivoNombre(file.name);
          setArchivoTamanoKb(Math.round(file.size / 1024));
          notify.success("Documento adjuntado", `${file.name} listo para enviar.`);
        };
        reader.readAsDataURL(file);
      } else {
        notify.error("Formato no admitido", "Solo se aceptan archivos en formato JPG, PNG o PDF.");
      }
    } catch {
      notify.error("Error al leer archivo", "No se pudo procesar el archivo seleccionado.");
    } finally {
      setProcesandoArchivo(false);
    }
  }

  // Modal Verificación Facial (LFT Identidad Inequívoca)
  const [modalCamara, setModalCamara] = useState(false);
  const [eventoPendiente, setEventoPendiente] = useState<TipoEventoChecador | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaraError, setCamaraError] = useState<string | null>(null);
  const [capturandoFoto, setCapturandoFoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Iniciar cámara frontal
  async function iniciarCamara() {
    setCamaraError(null);
    setCamaraActiva(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamaraError("Tu navegador no soporta captura de video en vivo.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamaraActiva(true);
    } catch {
      setCamaraError("Permiso de cámara denegado. Puedes registrar sin foto si es necesario.");
    }
  }

  // Detener cámara
  function detenerCamara() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  }

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Reloj en vivo
  useEffect(() => {
    function actualizarReloj() {
      const ahora = new Date();
      setHoraActual(
        ahora.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setFechaActual(
        ahora.toLocaleDateString("es-MX", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    }
    actualizarReloj();
    const interval = setInterval(actualizarReloj, 1000);
    return () => clearInterval(interval);
  }, []);

  // Función para calcular distancia cliente (taller y viajes)
  const evaluarGeocercas = useCallback(
    (lat: number, lng: number, config: ConfiguracionTallerRow, viajes: UbicacionExtraordinariaRow[]) => {
      function calc(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
      }

      // 1. Evaluar taller principal
      const distTaller = calc(lat, lng, Number(config.latitud), Number(config.longitud));
      const radioTaller = config.radio_tolerancia_metros || 150;

      if (distTaller <= radioTaller) {
        setDistanciaMetros(distTaller);
        setLugarValidoNombre(config.nombre_taller);
        setEsUbicacionViaje(false);
        return;
      }

      // 2. Evaluar viajes extraordinarios activos
      for (const v of viajes) {
        const distViaje = calc(lat, lng, Number(v.latitud), Number(v.longitud));
        const radioViaje = v.radio_tolerancia_metros || 200;
        if (distViaje <= radioViaje) {
          setDistanciaMetros(distViaje);
          setLugarValidoNombre(`${v.nombre_lugar} (${v.motivo})`);
          setEsUbicacionViaje(true);
          return;
        }
      }

      // Si no coincide con ninguno, reportar la distancia al taller
      setDistanciaMetros(distTaller);
      setLugarValidoNombre(null);
      setEsUbicacionViaje(false);
    },
    []
  );

  // Solicitar posición GPS
  const obtenerPosicionGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización GPS.");
      return;
    }

    setSolicitandoGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setSolicitandoGps(false);
        if (configuracion) {
          evaluarGeocercas(lat, lng, configuracion, permisosViaje);
        }
      },
      (err) => {
        setSolicitandoGps(false);
        let msg = "No se pudo obtener la señal GPS.";
        if (err.code === 1) {
          msg = "Permiso de ubicación denegado. Permite el acceso a tu ubicación en tu navegador para poder checar.";
        } else if (err.code === 2) {
          msg = "Señal GPS no disponible. Verifica que la ubicación de tu celular esté encendida.";
        } else if (err.code === 3) {
          msg = "Tiempo de espera de GPS agotado. Intenta de nuevo.";
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [configuracion, permisosViaje, evaluarGeocercas]);

  // Al autenticar al empleado, cargar sus datos y posición
  useEffect(() => {
    if (empleado) {
      obtenerMarcajesDelDia(empleado.id).then(setAsistenciasHoy);
      obtenerIncidenciasEmpleado(empleado.id).then(setIncidencias);
      obtenerPosicionGps();
    }
  }, [empleado, obtenerPosicionGps]);

  // Acceso del Empleado
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorLogin(null);

    startLoginTransition(async () => {
      const res = await autenticarEmpleado(identificador, pin);
      if (!res.success || !res.empleado || !res.configuracion) {
        setErrorLogin(res.error || "No se pudo verificar tu acceso.");
        notify.error("Acceso denegado", res.error);
        return;
      }

      setEmpleado(res.empleado);
      setConfiguracion(res.configuracion);
      setPermisosViaje(res.permisosViaje || []);
      notify.success("Bienvenido", `Hola, ${res.empleado.nombre}`);
    });
  }

  // Iniciar flujo de marcaje con verificación facial
  function handleMarcaje(tipoEvento: TipoEventoChecador) {
    if (!empleado) return;

    if (!coords) {
      notify.warning("GPS Requerido", "Debes permitir el acceso a tu ubicación GPS para registrar asistencia.");
      obtenerPosicionGps();
      return;
    }

    setEventoPendiente(tipoEvento);
    setModalCamara(true);
    iniciarCamara();
  }

  // Tomar foto instantánea y enviar marcaje
  async function capturarFotoYRegistrar() {
    if (!empleado || !coords || !eventoPendiente) return;
    setCapturandoFoto(true);

    let fotoDataUrl: string | undefined = undefined;

    if (videoRef.current && camaraActiva) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Centrar y recortar cuadrado
          const vWidth = videoRef.current.videoWidth || 320;
          const vHeight = videoRef.current.videoHeight || 320;
          const size = Math.min(vWidth, vHeight);
          const startX = (vWidth - size) / 2;
          const startY = (vHeight - size) / 2;

          ctx.drawImage(videoRef.current, startX, startY, size, size, 0, 0, 320, 320);
          fotoDataUrl = canvas.toDataURL("image/jpeg", 0.65);
        }
      } catch {
        // Fallback si falla captura
      }
    }

    detenerCamara();
    setModalCamara(false);

    await ejecutarMarcajeFinal(eventoPendiente, fotoDataUrl);
    setCapturandoFoto(false);
  }

  // Ejecutar marcaje sin foto en caso de falla de hardware
  async function omitirFotoYRegistrar() {
    if (!eventoPendiente) return;
    detenerCamara();
    setModalCamara(false);
    await ejecutarMarcajeFinal(eventoPendiente, undefined);
  }

  // Llamada final al servidor con coordenadas y selfie
  async function ejecutarMarcajeFinal(tipoEvento: TipoEventoChecador, fotoBase64?: string) {
    if (!empleado || !coords) return;

    startMarkingTransition(async () => {
      const res = await registrarMarcajeOnline({
        empleadoId: empleado.id,
        tipoEvento,
        latitud: coords.lat,
        longitud: coords.lng,
        fotoBase64,
      });

      if (!res.success) {
        notify.error("Marcaje no permitido", res.error);
        if (res.fueraDeRango && res.distanciaMetros) {
          setDistanciaMetros(res.distanciaMetros);
        }
        return;
      }

      notify.success(res.esViaje ? "Marcaje en viaje registrado" : "Marcaje Registrado", res.message);
      const marcajesActualizados = await obtenerMarcajesDelDia(empleado.id);
      setAsistenciasHoy(marcajesActualizados);
    });
  }

  // Enviar Solicitud de Incidencia / Vacaciones
  function handleEnviarIncidencia(e: React.FormEvent) {
    e.preventDefault();
    if (!empleado) return;

    if (tipoIncidencia === "INCAPACIDAD" && !archivoBase64) {
      notify.error("Comprobante obligatorio", "Debes adjuntar tu justificante médico del IMSS.");
      return;
    }

    if (tipoIncidencia === "INCAPACIDAD" && !consentimientoSalud) {
      notify.error("Aviso de consentimiento", "Debes aceptar la casilla de tratamiento de datos de salud.");
      return;
    }

    startIncidenciaTransition(async () => {
      const res = await registrarIncidencia({
        empleadoId: empleado.id,
        tipo: tipoIncidencia,
        fechaInicio,
        fechaFin,
        motivo,
        archivoBase64: archivoBase64 || undefined,
        archivoNombre: archivoNombre || undefined,
        consentimientoSalud,
      });

      if (!res.success) {
        notify.error("Error al enviar", res.error);
        return;
      }

      notify.success("Solicitud Enviada", res.message);
      setModalIncidencia(false);
      setMotivo("");
      setFechaInicio("");
      setFechaFin("");
      setArchivoBase64(null);
      setArchivoNombre(null);
      setArchivoTamanoKb(null);
      setConsentimientoSalud(false);

      const list = await obtenerIncidenciasEmpleado(empleado.id);
      setIncidencias(list);
    });
  }

  // Si no está autenticado, mostrar formulario de acceso móvil
  if (!empleado) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo y Encabezado */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative h-12 w-12 mb-3">
              <Image
                src="/isotipo-nolan.png"
                alt="Isotipo NOLAN"
                fill
                sizes="48px"
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 text-center">
              Portal del Empleado
            </h1>
            <p className="text-xs text-zinc-500 text-center mt-1">
              Servicio Mecánico López • Control de Asistencia Online
            </p>
          </div>

          <Card className="rounded-2xl border-zinc-200/90 shadow-lg">
            <CardContent className="pt-6 pb-6 px-6">
              {errorLogin && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 mb-4 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{errorLogin}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="identificador"
                    className="text-xs font-semibold text-zinc-800 block"
                  >
                    CURP o Correo Electrónico
                  </label>
                  <input
                    id="identificador"
                    type="text"
                    required
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="Ej. CURP o tu correo"
                    disabled={isLoggingIn}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3.5 py-2.5 text-xs text-zinc-900 uppercase placeholder:normal-case placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Ingresa los 18 caracteres de tu CURP o tu correo personal.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pin"
                    className="text-xs font-semibold text-zinc-800 flex items-center justify-between"
                  >
                    <span>PIN de Acceso (4 dígitos)</span>
                    <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                  </label>
                  <input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    disabled={isLoggingIn}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3.5 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                  <p className="text-[10px] text-zinc-400 text-center">
                    PIN numérico asignado por tu administrador.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-11 rounded-xl text-xs font-semibold mt-2 shadow-xs"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verificando credenciales...
                    </>
                  ) : (
                    "Ingresar a mi Checador"
                  )}
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t border-zinc-100 text-center">
                <p className="text-[11px] text-zinc-400">
                  Para registrar tu asistencia debes encontrarte físicamente en las instalaciones del taller o en tu sede de viaje autorizada.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Estado dentro de la geocerca (taller o viaje)
  const dentroDeGeocerca = Boolean(lugarValidoNombre);

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-12">
      {/* Barra Superior Móvil */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {empleado.nombre.charAt(0)}
              {empleado.apellidos.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 leading-tight">
                {empleado.nombre} {empleado.apellidos}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-zinc-500 font-medium">{empleado.puesto}</span>
                {permisosViaje.length > 0 && (
                  <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-0.5">
                    <Plane className="h-2.5 w-2.5" /> Viaje Activo
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmpleado(null)}
            className="h-7 px-2.5 text-[11px] text-zinc-600 rounded-lg"
          >
            Salir
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Reloj y Fecha en Vivo */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-xs bg-white text-center py-5 px-4">
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest font-semibold capitalize">
            {fechaActual}
          </p>
          <div className="text-3xl font-extrabold tracking-tight text-zinc-900 font-mono mt-1">
            {horaActual || "--:--:--"}
          </div>
          <p className="text-[10px] text-zinc-400 mt-1 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3 text-zinc-400" />
            Hora sincronizada del taller
          </p>
        </Card>

        {/* Estado GPS y Geocerca (Taller o Viaje) */}
        <div
          className={`rounded-2xl border p-4 transition-all shadow-xs ${
            dentroDeGeocerca
              ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
              : gpsError
              ? "border-rose-200 bg-rose-50/70 text-rose-950"
              : "border-amber-200 bg-amber-50/70 text-amber-950"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 font-bold text-xs">
              {esUbicacionViaje ? (
                <Plane className="h-4 w-4 text-blue-600 shrink-0" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0" />
              )}
              <span>
                {dentroDeGeocerca
                  ? esUbicacionViaje
                    ? "Ubicación de Viaje Autorizada"
                    : "Ubicación GPS Autorizada"
                  : gpsError
                  ? "Atención con el GPS"
                  : "Fuera de la Zona Autorizada"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={solicitandoGps}
              onClick={obtenerPosicionGps}
              className="h-6 px-2 text-[10px] rounded-md bg-white border-zinc-200"
            >
              {solicitandoGps ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LocateFixed className="h-3 w-3 text-zinc-700" />
              )}
            </Button>
          </div>

          <div className="mt-2 text-[11px] leading-relaxed">
            {gpsError ? (
              <p className="text-rose-800">{gpsError}</p>
            ) : dentroDeGeocerca ? (
              <p className="text-emerald-800">
                Te encuentras a <strong>{distanciaMetros}m</strong> de <strong>{lugarValidoNombre}</strong>. Puedes registrar tu asistencia con normalidad.
              </p>
            ) : distanciaMetros !== null ? (
              <p className="text-amber-900">
                Te encuentras a <strong>{distanciaMetros} metros</strong> de la sede central y fuera de cualquier geocerca de viaje autorizada.
              </p>
            ) : (
              <p className="text-zinc-600">Determinando tu distancia respecto al taller o viaje...</p>
            )}
          </div>
        </div>

        {/* Botonera de Marcaje (2x2) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Botón Entrada */}
          <button
            type="button"
            disabled={!dentroDeGeocerca || isMarking}
            onClick={() => handleMarcaje("ENTRADA")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border border-emerald-300 bg-white hover:bg-emerald-50/50 active:bg-emerald-100/50 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
          >
            <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <LogIn className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-zinc-900">Registrar Entrada</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Inicio de turno</span>
          </button>

          {/* Botón Iniciar Descanso */}
          <button
            type="button"
            disabled={!dentroDeGeocerca || isMarking}
            onClick={() => handleMarcaje("INICIO_DESCANSO")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border border-amber-300 bg-white hover:bg-amber-50/50 active:bg-amber-100/50 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
          >
            <div className="h-11 w-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Coffee className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-zinc-900">Iniciar Descanso</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Comida / Pausa</span>
          </button>

          {/* Botón Terminar Descanso */}
          <button
            type="button"
            disabled={!dentroDeGeocerca || isMarking}
            onClick={() => handleMarcaje("FIN_DESCANSO")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border border-blue-300 bg-white hover:bg-blue-50/50 active:bg-blue-100/50 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
          >
            <div className="h-11 w-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <RotateCcw className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-zinc-900">Fin de Descanso</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Reanudar labores</span>
          </button>

          {/* Botón Salida */}
          <button
            type="button"
            disabled={!dentroDeGeocerca || isMarking}
            onClick={() => handleMarcaje("SALIDA")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl border border-rose-300 bg-white hover:bg-rose-50/50 active:bg-rose-100/50 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
          >
            <div className="h-11 w-11 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <LogOut className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-zinc-900">Registrar Salida</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Fin de jornada</span>
          </button>
        </div>

        {/* Resumen de Asistencias del Día */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-xs">
          <CardHeader className="pb-2.5 pt-4 px-4 border-b border-zinc-100">
            <CardTitle className="text-xs font-bold text-zinc-900 flex items-center justify-between">
              <span>Marcajes Realizados Hoy</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {asistenciasHoy.length} evento{asistenciasHoy.length === 1 ? "" : "s"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {asistenciasHoy.length === 0 ? (
              <div className="py-5 text-center text-zinc-400 text-xs">
                Aún no has registrado ningún evento de asistencia hoy.
              </div>
            ) : (
              <div className="space-y-2">
                {asistenciasHoy.map((a) => {
                  const hora = new Date(a.fecha_hora).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 bg-[#F9F9FB] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-zinc-900">
                          {a.tipo_evento_original}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-600 font-medium">{hora}</span>
                        <Badge variant="outline" className="text-[9px] uppercase font-mono">
                          {a.metodo_registro}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sección de Incidencias / Solicitud de Vacaciones y Faltas */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-xs">
          <CardHeader className="pb-2.5 pt-4 px-4 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-zinc-900">
                  Incidencias y Solicitud de Vacaciones
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Envía solicitudes de descanso, permisos o reporta faltas a la administración.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModalIncidencia(true)}
                className="h-7 text-xs px-2.5 rounded-lg shrink-0"
              >
                Nueva Solicitud
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {incidencias.length === 0 ? (
              <div className="py-5 text-center text-zinc-400 text-xs">
                No tienes solicitudes recientes registradas.
              </div>
            ) : (
              <div className="space-y-2">
                {incidencias.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3 rounded-xl border border-zinc-100 bg-[#F9F9FB] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900">{inc.tipo}</span>
                      <Badge
                        variant={
                          inc.estado === "APROBADA"
                            ? "success"
                            : inc.estado === "RECHAZADA"
                            ? "danger"
                            : "warning"
                        }
                        className="text-[10px]"
                      >
                        {inc.estado}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[11px] text-zinc-500">
                        Del {inc.fecha_inicio} al {inc.fecha_fin}
                      </p>
                      {inc.extemporanea && (
                        <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                          Retroactiva
                        </Badge>
                      )}
                      {inc.documento_path && (
                        <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-300">
                          Con Justificante
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-700 italic">&ldquo;{inc.motivo}&rdquo;</p>
                    {inc.respuesta_administrador && (
                      <div className="text-[10px] text-zinc-600 bg-white p-2 rounded border border-zinc-200 mt-1">
                        <strong>Respuesta:</strong> {inc.respuesta_administrador}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODAL SOLICITUD DE INCIDENCIAS */}
      {modalIncidencia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSendingIncidencia) setModalIncidencia(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 bg-[#FAFAFC]">
              <h3 className="text-xs font-bold text-zinc-900">Nueva Solicitud</h3>
              <button
                type="button"
                onClick={() => setModalIncidencia(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEnviarIncidencia} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Tipo de Incidencia</label>
                <select
                  value={tipoIncidencia}
                  onChange={(e) =>
                    setTipoIncidencia(
                      e.target.value as
                        | "VACACIONES"
                        | "FALTA_JUSTIFICADA"
                        | "PERMISO"
                        | "INCAPACIDAD"
                    )
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                >
                  <option value="VACACIONES">Solicitud de Vacaciones</option>
                  <option value="FALTA_JUSTIFICADA">Justificante de Falta</option>
                  <option value="PERMISO">Permiso Laboral / Asunto Personal</option>
                  <option value="INCAPACIDAD">Incapacidad Médica (IMSS)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-zinc-700 block">Fecha Inicio</label>
                    {tipoIncidencia === "INCAPACIDAD" && (
                      <span className="text-[9px] text-amber-600 font-medium">Retroactivo máx 30d</span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    min={minFechaInicio}
                    value={fechaInicio}
                    onChange={(e) => {
                      setFechaInicio(e.target.value);
                      if (fechaFin && e.target.value > fechaFin) {
                        setFechaFin(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-2.5 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-700 block">Fecha Fin</label>
                  <input
                    type="date"
                    required
                    min={minFechaFin}
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-2.5 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Justificante médico para Incapacidad o justificación voluntaria */}
              {(tipoIncidencia === "INCAPACIDAD" || tipoIncidencia === "FALTA_JUSTIFICADA") && (
                <div className="space-y-2 p-3 rounded-xl border border-blue-100 bg-blue-50/50">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      <span>Comprobante / Justificante (JPG, PNG, PDF)</span>
                    </label>
                    {tipoIncidencia === "INCAPACIDAD" && (
                      <Badge variant="danger" className="text-[9px]">Obligatorio</Badge>
                    )}
                  </div>

                  <input
                    type="file"
                    id="justificante-upload"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) procesarArchivoAdjunto(file);
                    }}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="justificante-upload"
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-800 text-[11px] font-semibold hover:bg-zinc-50 shadow-2xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {procesandoArchivo ? "Procesando..." : archivoNombre ? "Cambiar archivo" : "Adjuntar archivo"}
                    </label>
                    {archivoNombre && (
                      <span className="text-[10px] text-zinc-600 truncate max-w-[160px]">
                        {archivoNombre} ({archivoTamanoKb} KB)
                      </span>
                    )}
                  </div>

                  {/* Aviso de Privacidad y Consentimiento de Salud */}
                  {tipoIncidencia === "INCAPACIDAD" && (
                    <div className="pt-2 border-t border-blue-100 text-[10px] text-zinc-600 space-y-1.5">
                      <p className="leading-tight">
                        <strong>Aviso de Confidencialidad LFT:</strong> Los datos de salud y NSS contenidos en tu justificante médico serán tratados con reserva absoluta y exclusivamente con fines de justificación de inasistencia laboral por Servicio Mecánico López.
                      </p>
                      <label className="flex items-start gap-1.5 cursor-pointer font-medium text-zinc-900">
                        <input
                          type="checkbox"
                          required
                          checked={consentimientoSalud}
                          onChange={(e) => setConsentimientoSalud(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Autorizo el tratamiento confidencial de mi justificante de salud conforme a la legislación aplicable.</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Motivo / Explicación</label>
                <textarea
                  required
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Detalla la razón de tu solicitud o justificación..."
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] p-2.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalIncidencia(false)}
                  disabled={isSendingIncidencia}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSendingIncidencia}
                  className="rounded-xl text-xs shadow-xs"
                >
                  {isSendingIncidencia ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar a Administrador"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Validación Facial (LFT Art. 132 fr. XXXIV - Identidad Inequívoca) */}
      {modalCamara && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-zinc-200 text-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <ScanFace className="h-4 w-4 text-blue-600" />
                <span>Verificación Facial LFT</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  detenerCamara();
                  setModalCamara(false);
                }}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Para garantizar tu <strong>identidad inalterable</strong> según la normativa laboral, coloca tu rostro frente a la cámara:
            </p>

            {/* Visor de Cámara */}
            <div className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-4 border-blue-600 shadow-inner bg-zinc-900 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${
                  camaraActiva ? "block" : "hidden"
                }`}
              />
              {!camaraActiva && !camaraError && (
                <div className="flex flex-col items-center justify-center text-zinc-400 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="text-[10px]">Activando cámara...</span>
                </div>
              )}
              {camaraError && (
                <div className="p-4 text-center text-zinc-300 space-y-2">
                  <CameraOff className="h-6 w-6 mx-auto text-amber-400" />
                  <p className="text-[10px] leading-tight">{camaraError}</p>
                </div>
              )}
              {/* Guía facial */}
              <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/60 pointer-events-none" />
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={capturarFotoYRegistrar}
                disabled={capturandoFoto || isMarking}
                className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
              >
                {capturandoFoto || isMarking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Validando y Guardando...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-1.5" />
                    Tomar Foto y Registrar {eventoPendiente?.replace("_", " ")}
                  </>
                )}
              </Button>

              <div>
                <button
                  type="button"
                  onClick={omitirFotoYRegistrar}
                  disabled={capturandoFoto || isMarking}
                  className="text-[11px] text-zinc-500 hover:text-zinc-800 underline decoration-zinc-300 hover:decoration-zinc-600 cursor-pointer"
                >
                  Omitir foto y registrar solo con GPS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
