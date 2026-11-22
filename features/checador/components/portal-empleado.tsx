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
  enrolarFaceIdInicial,
  obtenerFaltasDetectadasEmpleado,
  type FaltaDetectada,
  type EmpleadoRow,
  type ConfiguracionTallerRow,
  type AsistenciaRow,
  type IncidenciaRow,
  type UbicacionExtraordinariaRow,
  type TipoEventoChecador,
} from "../actions";
import {
  generarDescriptorFacialDesdeCanvas,
  verificarPruebaDeVida,
} from "@/lib/biometria/face-id-engine";

export function PortalEmpleado() {
  // Sesión persistida del empleado
  const [empleado, setEmpleado] = useState<EmpleadoRow | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionTallerRow | null>(null);
  const [permisosViaje, setPermisosViaje] = useState<UbicacionExtraordinariaRow[]>([]);
  const [tieneBiometriaFacial, setTieneBiometriaFacial] = useState(false);
  const [modalEnrolamientoFacial, setModalEnrolamientoFacial] = useState(false);
  const [enrolandoFaceId, setEnrolandoFaceId] = useState(false);

  // Recuperar sesión persistente de forma segura al montar el componente
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("nolan_empleado_session");
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (parsed.empleado?.id) {
          setEmpleado(parsed.empleado);
          if (parsed.configuracion) setConfiguracion(parsed.configuracion);
          if (Array.isArray(parsed.permisosViaje)) setPermisosViaje(parsed.permisosViaje);
          if (typeof parsed.tieneBiometriaFacial === "boolean") {
            setTieneBiometriaFacial(parsed.tieneBiometriaFacial);
          }
        }
      }
    } catch {
      // Continuar silenciosamente si localStorage no está disponible
    }
  }, []);

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

  // Inasistencias detectadas para facilitar justificación
  const [faltasDetectadas, setFaltasDetectadas] = useState<FaltaDetectada[]>([]);
  const [cargandoFaltas, setCargandoFaltas] = useState(false);
  const [faltaSeleccionada, setFaltaSeleccionada] = useState<string | null>(null);

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
  const [hoyMerida, setHoyMerida] = useState("");

  useEffect(() => {
    try {
      const formateador = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Merida",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      setHoyMerida(formateador.format(new Date()));
    } catch {
      setHoyMerida(new Date().toISOString().slice(0, 10));
    }
  }, []);

  // Consultar faltas detectadas automáticamente al abrir modal de incidencias
  useEffect(() => {
    if (empleado && modalIncidencia && tipoIncidencia === "FALTA_JUSTIFICADA") {
      setCargandoFaltas(true);
      obtenerFaltasDetectadasEmpleado(empleado.id)
        .then((faltas) => {
          setFaltasDetectadas(faltas);
        })
        .finally(() => setCargandoFaltas(false));
    }
  }, [empleado, modalIncidencia, tipoIncidencia]);

  const seleccionarFaltaParaJustificar = (falta: FaltaDetectada) => {
    setFaltaSeleccionada(falta.fecha);
    setFechaInicio(falta.fecha);
    setFechaFin(falta.fecha);
    setMotivo(falta.motivoSugerido);
  };

  const minFechaInicio = React.useMemo(() => {
    if (!hoyMerida) return undefined;
    if (tipoIncidencia === "INCAPACIDAD" || tipoIncidencia === "FALTA_JUSTIFICADA") {
      const [y, m, d] = hoyMerida.split("-").map(Number);
      const retro = new Date(Date.UTC(y, m - 1, d - 30));
      return retro.toISOString().slice(0, 10);
    }
    return hoyMerida;
  }, [tipoIncidencia, hoyMerida]);

  const maxFechaInicio = React.useMemo(() => {
    if (!hoyMerida) return undefined;
    if (tipoIncidencia === "FALTA_JUSTIFICADA") {
      return hoyMerida;
    }
    return undefined;
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

      const tieneBio = Boolean(res.tieneBiometriaFacial);
      setTieneBiometriaFacial(tieneBio);

      // Persistir sesión de manera segura para evitar que recargas o diálogos de permisos expulsen al empleado
      try {
        localStorage.setItem(
          "nolan_empleado_session",
          JSON.stringify({
            empleado: res.empleado,
            configuracion: res.configuracion,
            permisosViaje: res.permisosViaje || [],
            tieneBiometriaFacial: tieneBio,
          })
        );
      } catch {
        // Continuar si storage está deshabilitado
      }

      if (!tieneBio) {
        notify.warning(
          "Face ID Requerido",
          "Tu cuenta aún no tiene registrado su modelo facial. Debes registrarlo por primera vez para proteger tus asistencias."
        );
        setModalEnrolamientoFacial(true);
        iniciarCamara();
      } else {
        notify.success("Bienvenido", `Hola, ${res.empleado.nombre}`);
      }
    });
  }

  // Cerrar sesión del empleado y limpiar caché local
  function handleCerrarSesion() {
    try {
      localStorage.removeItem("nolan_empleado_session");
    } catch {}
    setEmpleado(null);
    setConfiguracion(null);
    setPermisosViaje([]);
    setAsistenciasHoy([]);
    setIncidencias([]);
    setCoords(null);
    detenerCamara();
  }

  // Capturar y enrolar Face ID inicial para cuentas sin modelo registrado
  async function capturarYEnrolarFaceId() {
    if (!empleado) return;
    setEnrolandoFaceId(true);

    try {
      if (!videoRef.current || !camaraActiva) {
        notify.error("Cámara no activa", "Inicia la cámara para registrar tu rostro.");
        setEnrolandoFaceId(false);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setEnrolandoFaceId(false);
        return;
      }

      const vWidth = videoRef.current.videoWidth || 320;
      const vHeight = videoRef.current.videoHeight || 320;
      const size = Math.min(vWidth, vHeight);
      const startX = (vWidth - size) / 2;
      const startY = (vHeight - size) / 2;

      ctx.drawImage(videoRef.current, startX, startY, size, size, 0, 0, 320, 320);
      const fotoBase64 = canvas.toDataURL("image/jpeg", 0.75);

      const resultado = generarDescriptorFacialDesdeCanvas(canvas);
      if (!resultado.exito || !resultado.descriptor || resultado.descriptor.length !== 128) {
        notify.error(
          "Rostro no detectado",
          "No se detectó un rostro claro. Centra tu rostro en buena iluminación e intenta de nuevo."
        );
        setEnrolandoFaceId(false);
        return;
      }

      const res = await enrolarFaceIdInicial({
        empleadoId: empleado.id,
        descriptor: resultado.descriptor,
        fotoBase64,
      });

      if (!res.success) {
        notify.error("Error al enrolar", res.error || "No se pudo guardar el modelo facial.");
        setEnrolandoFaceId(false);
        return;
      }

      setTieneBiometriaFacial(true);
      try {
        const guardado = localStorage.getItem("nolan_empleado_session");
        if (guardado) {
          const parsed = JSON.parse(guardado);
          parsed.tieneBiometriaFacial = true;
          localStorage.setItem("nolan_empleado_session", JSON.stringify(parsed));
        }
      } catch {}
      detenerCamara();
      setModalEnrolamientoFacial(false);
      notify.success(
        "¡Face ID Enrolado con Éxito!",
        "Tu modelo facial ha sido registrado. A partir de ahora tus asistencias contarán con autenticación biométrica."
      );
    } catch {
      notify.error("Error inesperado", "Ocurrió un error al procesar el enrolamiento facial.");
    } finally {
      setEnrolandoFaceId(false);
    }
  }

  // Iniciar flujo de marcaje con verificación facial
  function handleMarcaje(tipoEvento: TipoEventoChecador) {
    if (!empleado) return;

    if (!tieneBiometriaFacial) {
      notify.warning(
        "Face ID Requerido",
        "Debes enrolar tu modelo facial Face ID antes de poder marcar asistencia."
      );
      setModalEnrolamientoFacial(true);
      iniciarCamara();
      return;
    }

    if (!coords) {
      notify.warning("GPS Requerido", "Debes permitir el acceso a tu ubicación GPS para registrar asistencia.");
      obtenerPosicionGps();
      return;
    }

    setEventoPendiente(tipoEvento);
    setModalCamara(true);
    iniciarCamara();
  }

  // Tomar foto instantánea, extraer vector Face ID y enviar marcaje
  async function capturarFotoYRegistrar() {
    if (!empleado || !coords || !eventoPendiente) return;
    setCapturandoFoto(true);

    let fotoDataUrl: string | undefined = undefined;
    let descriptorFacial: number[] | undefined = undefined;
    let pruebaDeVidaOk = true;

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
          fotoDataUrl = canvas.toDataURL("image/jpeg", 0.70);

          // 1. Extraer vector biométrico Face ID (128 dimensiones normalizadas)
          const resultadoExtraccion = generarDescriptorFacialDesdeCanvas(canvas);
          if (resultadoExtraccion.exito && resultadoExtraccion.descriptor) {
            descriptorFacial = resultadoExtraccion.descriptor;
          }

          // 2. Comprobar prueba de vida (anti-pantalla estática / anti-spoofing)
          const f1 = ctx.getImageData(0, 0, 320, 320);
          await new Promise((r) => setTimeout(r, 90));
          if (videoRef.current) {
            const canvas2 = document.createElement("canvas");
            canvas2.width = 320;
            canvas2.height = 320;
            const ctx2 = canvas2.getContext("2d", { willReadFrequently: true });
            if (ctx2) {
              ctx2.drawImage(videoRef.current, startX, startY, size, size, 0, 0, 320, 320);
              const f2 = ctx2.getImageData(0, 0, 320, 320);
              const testVida = verificarPruebaDeVida([f1, f2]);
              pruebaDeVidaOk = testVida.aprobada;
            }
          }
        }
      } catch {
        // Fallback si falla captura
      }
    }

    detenerCamara();
    setModalCamara(false);

    await ejecutarMarcajeFinal(eventoPendiente, fotoDataUrl, descriptorFacial, pruebaDeVidaOk);
    setCapturandoFoto(false);
  }

  // Ejecutar marcaje sin foto en caso de falla de hardware
  async function omitirFotoYRegistrar() {
    if (!eventoPendiente) return;
    detenerCamara();
    setModalCamara(false);
    await ejecutarMarcajeFinal(eventoPendiente, undefined, undefined, false);
  }

  // Llamada final al servidor con coordenadas, selfie y vector biométrico Face ID
  async function ejecutarMarcajeFinal(
    tipoEvento: TipoEventoChecador,
    fotoBase64?: string,
    descriptorEnVivo?: number[],
    pruebaDeVidaExitosa?: boolean
  ) {
    if (!empleado || !coords) return;

    startMarkingTransition(async () => {
      const res = await registrarMarcajeOnline({
        empleadoId: empleado.id,
        tipoEvento,
        latitud: coords.lat,
        longitud: coords.lng,
        fotoBase64,
        descriptorEnVivo,
        pruebaDeVidaExitosa,
      });

      if (!res.success) {
        if (res.fraudeFacial) {
          notify.error(
            "Alerta de Seguridad Face ID",
            res.error || "El rostro escaneado no coincide con el Face ID registrado."
          );
        } else {
          notify.error("Marcaje no permitido", res.error);
        }
        if (res.fueraDeRango && res.distanciaMetros) {
          setDistanciaMetros(res.distanciaMetros);
        }
        return;
      }

      notify.success(
        res.esViaje ? "Marcaje en viaje registrado" : "Marcaje Registrado",
        res.message
      );
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
                    className="w-full min-h-[46px] rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3.5 py-2.5 text-base sm:text-xs text-zinc-900 uppercase placeholder:normal-case placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
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
    <div className="min-h-screen bg-[#FAF9F6] pb-12 pb-safe">
      {/* Barra Superior Móvil con Safe Area */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-4 py-3 pt-safe">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {(empleado.nombre || "E").charAt(0)}
              {(empleado.apellidos || "").charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 leading-tight">
                {empleado.nombre} {empleado.apellidos || ""}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-zinc-500 font-medium">{empleado.puesto || "Personal"}</span>
                {tieneBiometriaFacial ? (
                  <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-0.5 font-medium">
                    <ScanFace className="h-2.5 w-2.5 text-emerald-600" /> Face ID Activo
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setModalEnrolamientoFacial(true);
                      iniciarCamara();
                    }}
                    className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded px-1.5 py-0.5 flex items-center gap-1 font-bold cursor-pointer transition-colors"
                  >
                    <ScanFace className="h-2.5 w-2.5" /> Enrolar Face ID
                  </button>
                )}
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
            onClick={handleCerrarSesion}
            className="h-7 px-2.5 text-[11px] text-zinc-600 rounded-lg cursor-pointer"
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
          <CardHeader className="pb-3 pt-4 px-4 sm:px-5 border-b border-zinc-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <CardTitle className="text-xs font-bold text-zinc-900">
                  Incidencias y Solicitud de Vacaciones
                </CardTitle>
                <CardDescription className="text-[11px] mt-0.5">
                  Solicita vacaciones, permisos personales o envía justificantes a administración.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModalIncidencia(true)}
                className="min-h-[38px] text-xs px-3 rounded-xl shrink-0 font-semibold self-start sm:self-auto"
              >
                Nueva Solicitud
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {incidencias.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 text-xs">
                No tienes solicitudes recientes registradas.
              </div>
            ) : (
              <div className="space-y-2.5">
                {incidencias.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3.5 rounded-2xl border border-zinc-200/70 bg-[#F9F9FB] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-zinc-900">
                        {inc.tipo.replace(/_/g, " ")}
                      </span>
                      <Badge
                        variant={
                          inc.estado === "APROBADA"
                            ? "success"
                            : inc.estado === "RECHAZADA"
                            ? "danger"
                            : "warning"
                        }
                        className="text-[10px] shrink-0 font-medium"
                      >
                        {inc.estado}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[11px] text-zinc-600 font-mono font-medium">
                        Del {inc.fecha_inicio} al {inc.fecha_fin}
                      </p>
                      {inc.extemporanea && (
                        <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 bg-amber-50/50">
                          Retroactiva
                        </Badge>
                      )}
                      {inc.documento_path && (
                        <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-300 bg-blue-50/50">
                          Con Justificante
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-700 italic pt-0.5">&ldquo;{inc.motivo}&rdquo;</p>
                    {inc.respuesta_administrador && (
                      <div className="text-[10px] text-zinc-700 bg-white p-2.5 rounded-xl border border-zinc-200/90 mt-1.5 space-y-0.5">
                        <strong className="text-zinc-900">Respuesta del Administrador:</strong>
                        <p>{inc.respuesta_administrador}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODAL SOLICITUD DE INCIDENCIAS (Optimizado Responsive Mobile/Desktop) */}
      {modalIncidencia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/65 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSendingIncidencia) setModalIncidencia(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-3xl bg-white border border-zinc-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Encabezado Fijo */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 bg-[#FAFAFC] shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Nueva Solicitud</h3>
                <p className="text-[11px] text-zinc-500">Completa el formulario para enviar tu solicitud</p>
              </div>
              <button
                type="button"
                onClick={() => setModalIncidencia(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                aria-label="Cerrar ventana"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario con Scroll Táctil */}
            <form onSubmit={handleEnviarIncidencia} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 text-xs">
                {/* 1. Tipo de Incidencia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-800 block">
                    Tipo de Solicitud
                  </label>
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
                    className="w-full min-h-[46px] rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3.5 py-2.5 text-base sm:text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all cursor-pointer"
                  >
                    <option value="VACACIONES">🏖️ Solicitud de Vacaciones</option>
                    <option value="FALTA_JUSTIFICADA">📄 Justificante de Falta</option>
                    <option value="PERMISO">⏱️ Permiso Laboral / Asunto Personal</option>
                    <option value="INCAPACIDAD">🏥 Incapacidad Médica (IMSS)</option>
                  </select>
                </div>

                {/* Detector Inteligente de Faltas (Facilita elegir inasistencias automáticamente) */}
                {tipoIncidencia === "FALTA_JUSTIFICADA" && (
                  <div className="space-y-2.5 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/90 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Inasistencias Detectadas en tus Turnos</span>
                      </div>
                      {cargandoFaltas ? (
                        <div className="flex items-center gap-1 text-[10px] text-amber-700">
                          <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                          <span>Analizando...</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">
                          {faltasDetectadas.length} encontrada{faltasDetectadas.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-amber-800 leading-snug">
                      El sistema detectó los siguientes turnos oficiales sin registro de asistencia. Toca uno para llenar la justificación con un solo toque:
                    </p>

                    {cargandoFaltas ? (
                      <div className="py-3 text-center text-zinc-400 text-xs">
                        Consultando calendario oficial de asistencia...
                      </div>
                    ) : faltasDetectadas.length === 0 ? (
                      <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 text-[11px] text-zinc-600 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>No tienes inasistencias pendientes en tus últimos 30 días laborables. Si deseas justificar otra fecha, selecciónala abajo.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {faltasDetectadas.map((falta) => {
                          const seleccionada = faltaSeleccionada === falta.fecha;
                          return (
                            <button
                              key={falta.fecha}
                              type="button"
                              onClick={() => seleccionarFaltaParaJustificar(falta)}
                              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                seleccionada
                                  ? "bg-amber-100/90 border-amber-400 text-amber-950 ring-2 ring-amber-400/30 font-semibold"
                                  : "bg-white hover:bg-amber-50/80 border-amber-200 text-zinc-800"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-zinc-900 leading-tight">
                                  {falta.fechaFormateada}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                  Horario oficial: {falta.turno}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {seleccionada ? (
                                  <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                                    Seleccionada
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-amber-700 font-medium">Elegir</span>
                                )}
                                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Selectores de Fechas (En móvil vertical espaciado, en tablet/escritorio 2 columnas) */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    {/* Fecha Inicio */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-800 block">
                          Fecha Inicio
                        </label>
                        {tipoIncidencia === "INCAPACIDAD" && (
                          <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Retroactivo máx 30d
                          </span>
                        )}
                        {tipoIncidencia === "FALTA_JUSTIFICADA" && (
                          <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Inasistencia previa
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        required
                        min={minFechaInicio}
                        max={maxFechaInicio}
                        value={fechaInicio}
                        onChange={(e) => {
                          setFechaInicio(e.target.value);
                          if (fechaFin && e.target.value > fechaFin) {
                            setFechaFin(e.target.value);
                          }
                        }}
                        className="w-full min-h-[46px] rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3.5 py-2.5 text-base sm:text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all font-mono"
                      />
                    </div>

                    {/* Fecha Fin */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-800 block">
                        Fecha Fin
                      </label>
                      <input
                        type="date"
                        required
                        min={minFechaFin}
                        max={maxFechaInicio}
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="w-full min-h-[46px] rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3.5 py-2.5 text-base sm:text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Resumen dinámico del rango seleccionado */}
                  {fechaInicio && fechaFin && fechaFin >= fechaInicio && (
                    <div className="mt-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">Duración calculada:</span>
                      <span className="font-bold text-zinc-900 font-mono">
                        {(() => {
                          const d1 = new Date(fechaInicio + "T12:00:00");
                          const d2 = new Date(fechaFin + "T12:00:00");
                          const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          return `${diff} día${diff === 1 ? "" : "s"} (${fechaInicio} al ${fechaFin})`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Justificante médico para Incapacidad o voluntario en Falta */}
                {(tipoIncidencia === "INCAPACIDAD" || tipoIncidencia === "FALTA_JUSTIFICADA") && (
                  <div className="space-y-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/60">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span>Comprobante / Justificante</span>
                      </label>
                      {tipoIncidencia === "INCAPACIDAD" ? (
                        <Badge variant="danger" className="text-[10px]">Obligatorio (IMSS)</Badge>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-medium">Opcional</span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-600 leading-snug">
                      Sube tu incapacidad oficial del IMSS o receta médica (JPG, PNG o PDF, máx. 5 MB).
                    </p>

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

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <label
                        htmlFor="justificante-upload"
                        className="cursor-pointer min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-zinc-800 text-xs font-semibold hover:bg-blue-50/50 shadow-2xs active:bg-blue-100 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-blue-600" />
                        {procesandoArchivo ? "Comprimiendo..." : archivoNombre ? "Cambiar archivo" : "Seleccionar archivo"}
                      </label>
                      {archivoNombre && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-blue-200/80 text-[11px] text-zinc-700">
                          <span className="truncate max-w-[200px] font-medium">{archivoNombre}</span>
                          <span className="text-zinc-500 ml-2 font-mono">({archivoTamanoKb} KB)</span>
                        </div>
                      )}
                    </div>

                    {/* Aviso de Privacidad y Consentimiento de Salud LFT */}
                    {tipoIncidencia === "INCAPACIDAD" && (
                      <div className="pt-3 border-t border-blue-100 text-[10px] text-zinc-600 space-y-2">
                        <p className="leading-tight">
                          <strong>Aviso de Confidencialidad LFT:</strong> Los datos de salud y NSS contenidos en tu justificante médico serán tratados con reserva absoluta y exclusivamente con fines de justificación de inasistencia laboral por Servicio Mecánico López.
                        </p>
                        <label className="flex items-start gap-2.5 cursor-pointer font-medium text-xs text-zinc-900 pt-0.5">
                          <input
                            type="checkbox"
                            required
                            checked={consentimientoSalud}
                            onChange={(e) => setConsentimientoSalud(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-[11px] leading-snug">
                            Autorizo el tratamiento confidencial de mi justificante de salud conforme a la legislación laboral aplicable.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Motivo / Explicación */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-800 block">
                    Motivo / Explicación Detallada
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Detalla claramente la razón de tu solicitud o justificación..."
                    className="w-full min-h-[88px] rounded-xl border border-zinc-200 bg-[#F9F9FB] p-3 text-base sm:text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all placeholder:text-zinc-400 resize-none"
                  />
                </div>
              </div>

              {/* Botonera Fija */}
              <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 p-4 sm:px-5 border-t border-zinc-100 bg-[#FAFAFC] shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalIncidencia(false)}
                  disabled={isSendingIncidencia}
                  className="min-h-[44px] rounded-xl text-xs font-semibold text-zinc-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingIncidencia}
                  className="min-h-[44px] rounded-xl text-xs font-semibold shadow-xs"
                >
                  {isSendingIncidencia ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Solicitud"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Validación Facial (Face ID Biométrico Anti-Fraude) */}
      {modalCamara && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-zinc-200 text-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <ScanFace className="h-4 w-4 text-emerald-600" />
                <span>Face ID Biométrico Anti-Fraude</span>
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
              Ubica tu rostro al centro del visor. El sistema cotejará tus vectores faciales y registrará la evidencia fotográfica inalterable del marcaje:
            </p>

            {/* Visor de Cámara con escaneo biométrico */}
            <div className="relative w-56 h-56 mx-auto rounded-3xl overflow-hidden border-2 border-emerald-500/80 shadow-2xl bg-zinc-950 flex items-center justify-center">
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
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <span className="text-[10px]">Iniciando sensor biométrico...</span>
                </div>
              )}
              {camaraError && (
                <div className="p-4 text-center text-zinc-300 space-y-2">
                  <CameraOff className="h-6 w-6 mx-auto text-amber-400" />
                  <p className="text-[10px] leading-tight">{camaraError}</p>
                </div>
              )}
              {/* Retícula de escaneo biométrico Face ID */}
              <div className="absolute inset-4 rounded-2xl border border-dashed border-emerald-400/50 pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between text-[9px] text-emerald-400 font-mono tracking-widest opacity-80">
                  <span>[FACE_ID]</span>
                  <span>[128D]</span>
                </div>
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                <div className="flex justify-between text-[9px] text-emerald-400 font-mono tracking-widest opacity-80">
                  <span>TARGET_LOCK</span>
                  <span>LIVE_OK</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={capturarFotoYRegistrar}
                disabled={capturandoFoto || isMarking}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md"
              >
                {capturandoFoto || isMarking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Verificando Face ID y Guardando...
                  </>
                ) : (
                  <>
                    <ScanFace className="h-4 w-4 mr-1.5" />
                    Validar Face ID y Registrar {eventoPendiente?.replace("_", " ")}
                  </>
                )}
              </Button>

              {!tieneBiometriaFacial && (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Enrolamiento Facial Inicial Obligatorio */}
      {modalEnrolamientoFacial && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-zinc-200 text-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <ScanFace className="h-4 w-4 text-blue-600" />
                <span>Registro Oficial de Face ID</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  detenerCamara();
                  setModalEnrolamientoFacial(false);
                }}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-100 text-left space-y-1">
              <span className="text-[11px] font-bold text-blue-900 block">
                Paso Único: Enrolamiento Biométrico
              </span>
              <p className="text-[10px] text-blue-700 leading-relaxed">
                Tu cuenta no tiene registrado tu modelo facial oficial. Captura tu rostro ahora para activar el Face ID y proteger tus asistencias contra fraude o suplantación.
              </p>
            </div>

            {/* Visor de Cámara con Marco de Guía Ovalado */}
            <div className="relative w-56 h-56 mx-auto rounded-3xl overflow-hidden border-2 border-blue-500/80 shadow-2xl bg-zinc-950 flex items-center justify-center">
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
                  <span className="text-[10px]">Iniciando cámara frontal...</span>
                </div>
              )}
              {camaraError && (
                <div className="p-4 text-center text-zinc-300 space-y-2">
                  <CameraOff className="h-6 w-6 mx-auto text-amber-400" />
                  <p className="text-[10px] leading-tight">{camaraError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={iniciarCamara}
                    className="text-[10px] h-7 bg-white/10 text-white border-zinc-700"
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              {/* Guía Facial Biométrica */}
              <div className="absolute inset-4 rounded-[40%] border-2 border-dashed border-blue-400/70 pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between text-[9px] text-blue-400 font-mono tracking-widest opacity-90">
                  <span>[ENROLAR]</span>
                  <span>[128D]</span>
                </div>
                <div className="text-center text-[9px] text-blue-300 font-mono">
                  CENTRA TU ROSTRO
                </div>
                <div className="flex justify-between text-[9px] text-blue-400 font-mono tracking-widest opacity-90">
                  <span>BUENA LUZ</span>
                  <span>MIRA AL FRENTE</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={capturarYEnrolarFaceId}
                disabled={enrolandoFaceId || !camaraActiva}
                className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md cursor-pointer"
              >
                {enrolandoFaceId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Procesando Modelo Facial...
                  </>
                ) : (
                  <>
                    <ScanFace className="h-4 w-4 mr-1.5" />
                    Capturar y Guardar mi Face ID
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
