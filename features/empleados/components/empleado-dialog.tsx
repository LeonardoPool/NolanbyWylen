"use client";

import * as React from "react";
import { useState, useTransition, useEffect, useMemo } from "react";
import {
  X,
  Loader2,
  UserPlus,
  Pencil,
  Fingerprint,
  Calendar,
  Phone,
  Briefcase,
  IdCard,
  User,
  ShieldCheck,
  KeyRound,
  Mail,
  FileBadge,
  Sparkles,
  Palmtree,
  CalendarCheck,
  Info,
  Camera,
  CameraOff,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/feedback/toast";
import {
  calcularAniversariosCumplidos,
  calcularDiasPorAnioServicioLFT,
} from "@/lib/lft/vacaciones-lft";
import {
  crearEmpleado,
  actualizarEmpleado,
  guardarBiometriaFacialEmpleado,
  obtenerBiometriaFacialEmpleado,
  type EmpleadoRow,
  type EmpleadoConBiometria,
} from "../actions";
import { generarDescriptorFacialDesdeCanvas } from "@/lib/biometria/face-id-engine";

interface EmpleadoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empleadoAEditar?: EmpleadoConBiometria | null;
  onSaved: (empleado: EmpleadoConBiometria, esNuevo: boolean) => void;
}

const PUESTOS_SUGERIDOS = [
  "Mecánico General",
  "Mecánico Diésel",
  "Técnico en Frenos y Suspensión",
  "Hojalatero y Pintor",
  "Electricista Automotriz",
  "Ayudante de Taller",
  "Jefe de Taller",
  "Administrador",
];

export function EmpleadoDialog({
  isOpen,
  onClose,
  empleadoAEditar,
  onSaved,
}: EmpleadoDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [pestañaActiva, setPestañaActiva] = useState<"general" | "fiscal" | "acceso" | "biometria">("general");

  const STORAGE_KEY_BORRADOR_ALTA = "nolan_borrador_alta_empleado";
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const [mostrarConfirmacionSalida, setMostrarConfirmacionSalida] = useState(false);

  // Form states
  const [numeroEmpleado, setNumeroEmpleado] = useState("");
  const [codigoBiometrico, setCodigoBiometrico] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [puesto, setPuesto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");

  // Fiscales & Identidad
  const [nss, setNss] = useState("");
  const [rfc, setRfc] = useState("");
  const [curp, setCurp] = useState("");

  // Acceso Online / Web Checador
  const [correo, setCorreo] = useState("");
  const [pin, setPin] = useState("");
  const [permiteChecadoWeb, setPermiteChecadoWeb] = useState(true);

  // Biometría Facial Face ID
  const [biometriaEnroladaPrevia, setBiometriaEnroladaPrevia] = useState(false);
  const [fotoThumbnailPrevia, setFotoThumbnailPrevia] = useState<string | null>(null);
  const [fechaEnrolamientoPrevia, setFechaEnrolamientoPrevia] = useState<string | null>(null);
  const [nuevoDescriptorFacial, setNuevoDescriptorFacial] = useState<number[] | null>(null);
  const [nuevaFotoFacial, setNuevaFotoFacial] = useState<string | null>(null);
  const [camaraBiometriaActiva, setCamaraBiometriaActiva] = useState(false);
  const [camaraBiometriaError, setCamaraBiometriaError] = useState<string | null>(null);
  const [iniciandoCamara, setIniciandoCamara] = useState(false);
  const videoBiometriaRef = React.useRef<HTMLVideoElement | null>(null);
  const streamBiometriaRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Callback ref para vincular el stream al nodo de video inmediatamente al montarse en el DOM
  const conectarVideoRef = React.useCallback((nodo: HTMLVideoElement | null) => {
    videoBiometriaRef.current = nodo;
    if (nodo && streamBiometriaRef.current) {
      nodo.srcObject = streamBiometriaRef.current;
      nodo.play().catch((err) => {
        console.warn("[Biometría] Autoplay del video:", err);
      });
    }
  }, []);

  // Control de Vacaciones Previas (para colaboradores con antigüedad acumulada)
  const [haTomadoVacaciones, setHaTomadoVacaciones] = useState<boolean | null>(null);
  const [diasTomadosVacaciones, setDiasTomadosVacaciones] = useState<number>(0);

  // Cálculo dinámico de derechos devengados por aniversario LFT
  const datosVacaciones = useMemo(() => {
    if (!fechaIngreso || fechaIngreso.length !== 10) return null;
    try {
      const info = calcularAniversariosCumplidos(fechaIngreso);
      let devengados = 0;
      for (let i = 1; i <= info.aniosCumplidos; i++) {
        devengados += calcularDiasPorAnioServicioLFT(i);
      }
      return {
        aniosCumplidos: info.aniosCumplidos,
        devengados,
        fechaUltimoAniversario: info.fechaUltimoAniversario,
        fechaProximoAniversario: info.fechaProximoAniversario,
        diasParaProximoAniversario: info.diasParaProximoAniversario,
      };
    } catch {
      return null;
    }
  }, [fechaIngreso]);

  const esEdicion = Boolean(empleadoAEditar);

  useEffect(() => {
    setNuevoDescriptorFacial(null);
    setNuevaFotoFacial(null);
    setCamaraBiometriaActiva(false);
    setCamaraBiometriaError(null);
    setMostrarConfirmacionSalida(false);

    if (empleadoAEditar) {
      setBorradorRestaurado(false);
      setNumeroEmpleado(empleadoAEditar.numero_empleado || "");
      setCodigoBiometrico(empleadoAEditar.codigo_biometrico || "");
      setNombre(empleadoAEditar.nombre || "");
      setApellidos(empleadoAEditar.apellidos || "");
      setPuesto(empleadoAEditar.puesto || "");
      setTelefono(empleadoAEditar.telefono || "");
      setFechaIngreso(
        empleadoAEditar.fecha_ingreso
          ? empleadoAEditar.fecha_ingreso.slice(0, 10)
          : ""
      );
      setNss(empleadoAEditar.nss || "");
      setRfc(empleadoAEditar.rfc || "");
      setCurp(empleadoAEditar.curp || "");
      setCorreo(empleadoAEditar.correo || "");
      setPin(empleadoAEditar.pin || "");
      setPermiteChecadoWeb(empleadoAEditar.permite_checado_web ?? true);

      obtenerBiometriaFacialEmpleado(empleadoAEditar.id).then((res) => {
        setBiometriaEnroladaPrevia(res.enrolado);
        setFotoThumbnailPrevia(res.fotoThumbnail || null);
        setFechaEnrolamientoPrevia(res.fechaEnrolamiento || null);
      });
    } else {
      // Si es un alta nueva, verificar si existe un borrador guardado en localStorage
      try {
        const borradorGuardado = typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY_BORRADOR_ALTA)
          : null;

        if (borradorGuardado) {
          const b = JSON.parse(borradorGuardado);
          if (
            b &&
            (b.numeroEmpleado ||
              b.nombre ||
              b.apellidos ||
              b.puesto ||
              b.telefono ||
              b.curp ||
              b.correo)
          ) {
            setNumeroEmpleado(b.numeroEmpleado || "");
            setCodigoBiometrico(b.codigoBiometrico || "");
            setNombre(b.nombre || "");
            setApellidos(b.apellidos || "");
            setPuesto(b.puesto || "");
            setTelefono(b.telefono || "");
            setFechaIngreso(b.fechaIngreso || new Date().toISOString().slice(0, 10));
            setNss(b.nss || "");
            setRfc(b.rfc || "");
            setCurp(b.curp || "");
            setCorreo(b.correo || "");
            setPin(b.pin || "");
            setPermiteChecadoWeb(b.permiteChecadoWeb ?? true);
            setHaTomadoVacaciones(b.haTomadoVacaciones ?? null);
            setDiasTomadosVacaciones(b.diasTomadosVacaciones ?? 0);
            setBorradorRestaurado(true);
            setErrorLocal(null);
            setPestañaActiva(b.pestañaActiva || "general");
            return;
          }
        }
      } catch (errDraft) {
        console.warn("[Borrador] Error al leer borrador local:", errDraft);
      }

      setBorradorRestaurado(false);
      setNumeroEmpleado("");
      setCodigoBiometrico("");
      setNombre("");
      setApellidos("");
      setPuesto("");
      setTelefono("");
      setFechaIngreso(new Date().toISOString().slice(0, 10));
      setNss("");
      setRfc("");
      setCurp("");
      setCorreo("");
      setPin("");
      setPermiteChecadoWeb(true);
      setHaTomadoVacaciones(null);
      setDiasTomadosVacaciones(0);
      setBiometriaEnroladaPrevia(false);
      setFotoThumbnailPrevia(null);
      setFechaEnrolamientoPrevia(null);
    }
    setErrorLocal(null);
    setPestañaActiva("general");
  }, [empleadoAEditar, isOpen]);

  // Autoguardado continuo de borrador en localStorage durante la creación
  useEffect(() => {
    if (!isOpen || esEdicion || typeof window === "undefined") return;

    const tieneDatos = Boolean(
      numeroEmpleado ||
      codigoBiometrico ||
      nombre ||
      apellidos ||
      puesto ||
      telefono ||
      nss ||
      rfc ||
      curp ||
      correo ||
      pin
    );

    if (tieneDatos) {
      try {
        const payloadBorrador = {
          numeroEmpleado,
          codigoBiometrico,
          nombre,
          apellidos,
          puesto,
          telefono,
          fechaIngreso,
          nss,
          rfc,
          curp,
          correo,
          pin,
          permiteChecadoWeb,
          haTomadoVacaciones,
          diasTomadosVacaciones,
          pestañaActiva,
          fechaActualizacion: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY_BORRADOR_ALTA, JSON.stringify(payloadBorrador));
      } catch (errSave) {
        console.warn("[Borrador] Error al guardar borrador local:", errSave);
      }
    }
  }, [
    isOpen,
    esEdicion,
    numeroEmpleado,
    codigoBiometrico,
    nombre,
    apellidos,
    puesto,
    telefono,
    fechaIngreso,
    nss,
    rfc,
    curp,
    correo,
    pin,
    permiteChecadoWeb,
    haTomadoVacaciones,
    diasTomadosVacaciones,
    pestañaActiva,
  ]);

  // Detección de cambios sin guardar
  const hayCambiosSinGuardar = useMemo(() => {
    if (esEdicion && empleadoAEditar) {
      return (
        numeroEmpleado !== (empleadoAEditar.numero_empleado || "") ||
        codigoBiometrico !== (empleadoAEditar.codigo_biometrico || "") ||
        nombre !== (empleadoAEditar.nombre || "") ||
        apellidos !== (empleadoAEditar.apellidos || "") ||
        puesto !== (empleadoAEditar.puesto || "") ||
        telefono !== (empleadoAEditar.telefono || "") ||
        nss !== (empleadoAEditar.nss || "") ||
        rfc !== (empleadoAEditar.rfc || "") ||
        curp !== (empleadoAEditar.curp || "") ||
        correo !== (empleadoAEditar.correo || "") ||
        pin !== (empleadoAEditar.pin || "") ||
        Boolean(nuevoDescriptorFacial)
      );
    }
    return Boolean(
      numeroEmpleado ||
      codigoBiometrico ||
      nombre ||
      apellidos ||
      puesto ||
      telefono ||
      nss ||
      rfc ||
      curp ||
      correo ||
      pin ||
      nuevoDescriptorFacial
    );
  }, [
    esEdicion,
    empleadoAEditar,
    numeroEmpleado,
    codigoBiometrico,
    nombre,
    apellidos,
    puesto,
    telefono,
    nss,
    rfc,
    curp,
    correo,
    pin,
    nuevoDescriptorFacial,
  ]);

  // Advertencia de navegador al intentar salir de la app o recargar si hay cambios sin guardar
  useEffect(() => {
    if (!isOpen || !hayCambiosSinGuardar) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Tienes cambios sin guardar en el formulario.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isOpen, hayCambiosSinGuardar]);

  function intentarCerrar() {
    if (isPending) return;
    if (hayCambiosSinGuardar) {
      setMostrarConfirmacionSalida(true);
    } else {
      detenerCamaraBiometria();
      onClose();
    }
  }

  function descartarBorradorYSalir() {
    try {
      localStorage.removeItem(STORAGE_KEY_BORRADOR_ALTA);
    } catch {}
    setBorradorRestaurado(false);
    setMostrarConfirmacionSalida(false);
    detenerCamaraBiometria();
    onClose();
  }

  function salirConservandoBorrador() {
    setMostrarConfirmacionSalida(false);
    detenerCamaraBiometria();
    notify.info(
      "Borrador conservado",
      "Tus datos pendientes quedaron guardados localmente para cuando vuelvas a abrir el formulario."
    );
    onClose();
  }

  // Limpieza de cámara al cerrar componente
  useEffect(() => {
    return () => {
      if (streamBiometriaRef.current) {
        streamBiometriaRef.current.getTracks().forEach((track) => track.stop());
        streamBiometriaRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  function generarPinAleatorio() {
    const pinRandom = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(pinRandom);
  }

  async function iniciarCamaraBiometria() {
    setCamaraBiometriaError(null);
    setIniciandoCamara(true);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamaraBiometriaError("Tu navegador o dispositivo no soporta captura de video en vivo.");
      setIniciandoCamara(false);
      return;
    }

    try {
      if (streamBiometriaRef.current) {
        streamBiometriaRef.current.getTracks().forEach((t) => t.stop());
        streamBiometriaRef.current = null;
      }

      let stream: MediaStream;
      try {
        // Intento 1: frontal con resolución ideal
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
      } catch {
        // Intento 2: fallback para webcams USB / laptops sin soporte del constraint facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamBiometriaRef.current = stream;

      // Si el elemento video ya existe en el DOM, enlazarlo inmediatamente
      if (videoBiometriaRef.current) {
        videoBiometriaRef.current.srcObject = stream;
        try {
          await videoBiometriaRef.current.play();
        } catch {
          // Ignorar si autoplay requiere interacción
        }
      }

      setCamaraBiometriaActiva(true);
    } catch (err: any) {
      console.error("[Biometría] Error al iniciar cámara:", err);
      let mensaje = "No se pudo iniciar la cámara. Verifica los permisos del navegador.";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        mensaje = "Permiso de cámara denegado. Permite el acceso a la cámara en los permisos de tu navegador.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        mensaje = "No se detectó ninguna cámara web conectada en tu equipo.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        mensaje = "La cámara está siendo utilizada por otra aplicación. Ciérrala e intenta de nuevo.";
      }
      setCamaraBiometriaError(mensaje);
      setCamaraBiometriaActiva(false);
    } finally {
      setIniciandoCamara(false);
    }
  }

  function detenerCamaraBiometria() {
    if (streamBiometriaRef.current) {
      streamBiometriaRef.current.getTracks().forEach((t) => t.stop());
      streamBiometriaRef.current = null;
    }
    setCamaraBiometriaActiva(false);
  }

  function capturarMuestraFacial() {
    if (!videoBiometriaRef.current || !camaraBiometriaActiva) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const vWidth = videoBiometriaRef.current.videoWidth || 300;
        const vHeight = videoBiometriaRef.current.videoHeight || 300;
        const size = Math.min(vWidth, vHeight);
        const startX = (vWidth - size) / 2;
        const startY = (vHeight - size) / 2;
        ctx.drawImage(videoBiometriaRef.current, startX, startY, size, size, 0, 0, 300, 300);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const resExtraccion = generarDescriptorFacialDesdeCanvas(canvas);

        if (resExtraccion.exito && resExtraccion.descriptor) {
          setNuevaFotoFacial(resExtraccion.fotoThumbnail || dataUrl);
          setNuevoDescriptorFacial(resExtraccion.descriptor);
          detenerCamaraBiometria();
          notify.success(
            "Rostro Enrolado",
            "Se generó el vector biométrico Face ID de 128 dimensiones con éxito."
          );
        } else {
          notify.error("Error al capturar rostro", resExtraccion.error || "Rostro no detectado con suficiente claridad.");
        }
      }
    } catch {
      notify.error("Error al capturar muestra", "No se pudo procesar la imagen de la cámara.");
    }
  }

  function procesarArchivoFacial(file: File) {
    if (!file.type.startsWith("image/")) {
      notify.error("Formato no válido", "Solo se admiten fotografías en JPG o PNG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const resExtraccion = generarDescriptorFacialDesdeCanvas(canvas);

          if (resExtraccion.exito && resExtraccion.descriptor) {
            setNuevaFotoFacial(resExtraccion.fotoThumbnail || dataUrl);
            setNuevoDescriptorFacial(resExtraccion.descriptor);
            notify.success(
              "Fotografía Procesada",
              "Muestra biométrica extraída (vector de 128 dimensiones)."
            );
          } else {
            notify.error("Foto no adecuada", resExtraccion.error || "No se detectó un rostro centrado.");
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorLocal(null);

    // Validaciones preventivas de campos esenciales
    if (!numeroEmpleado.trim()) {
      setPestañaActiva("general");
      setErrorLocal("El número de empleado es obligatorio.");
      notify.error("Campo requerido", "Ingresa el número de empleado.");
      return;
    }
    if (!nombre.trim()) {
      setPestañaActiva("general");
      setErrorLocal("El nombre del empleado es obligatorio.");
      notify.error("Campo requerido", "Ingresa el nombre del empleado.");
      return;
    }
    if (!apellidos.trim()) {
      setPestañaActiva("general");
      setErrorLocal("Los apellidos del empleado son obligatorios.");
      notify.error("Campo requerido", "Ingresa los apellidos del empleado.");
      return;
    }
    if (!puesto.trim()) {
      setPestañaActiva("general");
      setErrorLocal("El puesto u oficio es obligatorio.");
      notify.error("Campo requerido", "Ingresa o selecciona el puesto del empleado.");
      return;
    }

    const formData = new FormData();
    formData.append("numero_empleado", numeroEmpleado.trim().toUpperCase());
    if (codigoBiometrico.trim()) {
      formData.append("codigo_biometrico", codigoBiometrico.trim());
    }
    formData.append("nombre", nombre.trim());
    formData.append("apellidos", apellidos.trim());
    formData.append("puesto", puesto.trim());

    if (telefono.trim()) formData.append("telefono", telefono.trim());
    if (fechaIngreso) formData.append("fecha_ingreso", fechaIngreso);
    if (nss.trim()) formData.append("nss", nss.trim());
    if (rfc.trim()) formData.append("rfc", rfc.trim().toUpperCase());
    if (curp.trim()) formData.append("curp", curp.trim().toUpperCase());
    if (correo.trim()) formData.append("correo", correo.trim().toLowerCase());
    if (pin.trim()) formData.append("pin", pin.trim());
    formData.append("permite_checado_web", permiteChecadoWeb ? "true" : "false");

    // Si tiene antigüedad de 1+ años y ya tomó vacaciones, enviar los días disfrutados previos
    if (
      !esEdicion &&
      datosVacaciones &&
      datosVacaciones.aniosCumplidos >= 1 &&
      haTomadoVacaciones === true &&
      diasTomadosVacaciones > 0
    ) {
      formData.append("dias_vacaciones_tomados_previos", diasTomadosVacaciones.toString());
    }

    startTransition(async () => {
      try {
        const res = esEdicion && empleadoAEditar
          ? await actualizarEmpleado(empleadoAEditar.id, formData)
          : await crearEmpleado(formData);

        if (!res.success || !res.empleado) {
          const mensaje = res.error || "Ocurrió un error al procesar el registro.";
          setErrorLocal(mensaje);
          notify.error("Error al guardar", mensaje);
          return;
        }

        const empId = res.empleado.id;

        // Si se capturó o actualizó muestra biométrica Face ID, guardarla en storage
        if (nuevoDescriptorFacial && nuevaFotoFacial) {
          try {
            await guardarBiometriaFacialEmpleado({
              empleadoId: empId,
              descriptor: nuevoDescriptorFacial,
              fotoThumbnail: nuevaFotoFacial,
            });
          } catch (biomErr) {
            console.error("Aviso al guardar Face ID:", biomErr);
          }
        }

        // Limpiar borrador local al guardar exitosamente
        try {
          localStorage.removeItem(STORAGE_KEY_BORRADOR_ALTA);
        } catch {}
        setBorradorRestaurado(false);

        detenerCamaraBiometria();
        notify.success(
          esEdicion ? "Empleado actualizado" : "Empleado registrado",
          res.message || "Los datos se guardaron con éxito en la base de datos."
        );
        const tieneBiometriaResult = Boolean(
          (nuevoDescriptorFacial && nuevaFotoFacial) || biometriaEnroladaPrevia
        );
        onSaved({ ...res.empleado, tieneBiometria: tieneBiometriaResult }, !esEdicion);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error de comunicación con el servidor.";
        setErrorLocal(msg);
        notify.error("Error inesperado", msg);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) intentarCerrar();
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-zinc-200/90 shadow-2xl overflow-hidden my-6 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              {esEdicion ? (
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <UserPlus className="h-4 w-4" strokeWidth={1.75} />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                {esEdicion ? "Editar Ficha de Empleado" : "Alta de Nuevo Empleado"}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {esEdicion
                  ? "Modifica datos laborales, fiscales y credenciales de acceso online."
                  : "Registra al trabajador. La fotografía biométrica es opcional y puede configurarse después."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={intentarCerrar}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex border-b border-zinc-100 bg-zinc-50/70 px-6 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPestañaActiva("general")}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              pestañaActiva === "general"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Datos Laborales
          </button>
          <button
            type="button"
            onClick={() => setPestañaActiva("fiscal")}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              pestañaActiva === "fiscal"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Identidad & Fiscal (NSS, RFC, CURP)
          </button>
          <button
            type="button"
            onClick={() => {
              detenerCamaraBiometria();
              setPestañaActiva("acceso");
            }}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              pestañaActiva === "acceso"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <KeyRound className="h-3 w-3 text-zinc-400" />
            Acceso Online (PIN)
          </button>
          <button
            type="button"
            onClick={() => {
              detenerCamaraBiometria();
              setPestañaActiva("biometria");
            }}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              pestañaActiva === "biometria"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <ScanFace className="h-3.5 w-3.5 text-emerald-600" />
            Face ID & Biometría
            {biometriaEnroladaPrevia || nuevoDescriptorFacial ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-800 font-medium border border-amber-300">
                Pendiente
              </span>
            )}
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {borradorRestaurado && !esEdicion && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-xs text-blue-900 flex items-center justify-between shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-semibold block">Borrador local recuperado</span>
                  <span className="text-[11px] text-blue-700">
                    Se restauraron los datos que dejaste pendientes para que no tengas que capturarlos de nuevo.
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    localStorage.removeItem(STORAGE_KEY_BORRADOR_ALTA);
                  } catch {}
                  setBorradorRestaurado(false);
                  setNumeroEmpleado("");
                  setCodigoBiometrico("");
                  setNombre("");
                  setApellidos("");
                  setPuesto("");
                  setTelefono("");
                  setFechaIngreso(new Date().toISOString().slice(0, 10));
                  setNss("");
                  setRfc("");
                  setCurp("");
                  setCorreo("");
                  setPin("");
                  setHaTomadoVacaciones(null);
                  setDiasTomadosVacaciones(0);
                  notify.info("Formulario limpiado", "Se descartó el borrador local.");
                }}
                className="h-7 text-[11px] text-blue-800 border-blue-300 hover:bg-blue-100 shrink-0 ml-2 cursor-pointer"
              >
                Descartar borrador
              </Button>
            </div>
          )}

          {errorLocal && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <span className="font-semibold">Atención:</span> {errorLocal}
            </div>
          )}

          {/* PESTAÑA 1: DATOS LABORALES & GENERALES */}
          {pestañaActiva === "general" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Clave interna y ZKTeco */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="numero_empleado"
                    className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                  >
                    <IdCard className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                    Núm. de Empleado <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="numero_empleado"
                    type="text"
                    required
                    value={numeroEmpleado}
                    onChange={(e) => setNumeroEmpleado(e.target.value.toUpperCase())}
                    placeholder="Ej. EMP-001"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 font-mono uppercase placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                  <p className="text-[10px] text-zinc-400">Identificador interno en taller.</p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="codigo_biometrico"
                    className="text-xs font-medium text-zinc-700 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Fingerprint className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                      ID en Checador Físico (ZKTeco)
                    </span>
                    <span className="text-[10px] text-zinc-400">Opcional</span>
                  </label>
                  <input
                    id="codigo_biometrico"
                    type="text"
                    value={codigoBiometrico}
                    onChange={(e) => setCodigoBiometrico(e.target.value)}
                    placeholder="Ej. 1, 102 (o vacío para auto-asignar)"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 font-mono placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                  <p className="text-[10px] text-zinc-400">Opcional. Si se deja vacío, se auto-asigna para permitir el alta.</p>
                </div>
              </div>

              {/* Nombre y Apellidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="nombre"
                    className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                  >
                    <User className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                    Nombre(s) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Juan Carlos"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="apellidos"
                    className="text-xs font-medium text-zinc-700"
                  >
                    Apellidos <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="apellidos"
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej. López Martínez"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
              </div>

              {/* Puesto */}
              <div className="space-y-1.5">
                <label
                  htmlFor="puesto"
                  className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                >
                  <Briefcase className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                  Puesto u Oficio <span className="text-rose-500">*</span>
                </label>
                <input
                  id="puesto"
                  type="text"
                  list="sugerencias-puestos"
                  required
                  value={puesto}
                  onChange={(e) => setPuesto(e.target.value)}
                  placeholder="Ej. Mecánico General, Hojalatero..."
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                />
                <datalist id="sugerencias-puestos">
                  {PUESTOS_SUGERIDOS.map((sug) => (
                    <option key={sug} value={sug} />
                  ))}
                </datalist>
              </div>

              {/* Teléfono y Fecha de Ingreso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="telefono"
                    className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                    Teléfono celular <span className="text-[10px] text-zinc-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 55 1234 5678"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="fecha_ingreso"
                    className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                    Fecha de ingreso
                  </label>
                  <input
                    id="fecha_ingreso"
                    type="date"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
              </div>

              {/* CONTROL DINÁMICO DE VACACIONES SEGÚN FECHA DE INGRESO (LFT) */}
              {!esEdicion && datosVacaciones && (
                <div className="pt-2">
                  {datosVacaciones.aniosCumplidos === 0 ? (
                    <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-3.5 text-xs space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 font-bold text-blue-900">
                        <CalendarCheck className="h-4 w-4 text-blue-600" />
                        <span>Control Vacacional LFT: Nuevo Ingreso</span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        El colaborador ingresó recientemente (&lt; 1 año de antigüedad). Conforme al Art. 76 de la LFT, su derecho inicial a vacaciones (<strong>12 días</strong>) se generará al cumplir su primer aniversario el <strong>{datosVacaciones.fechaProximoAniversario}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-3.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                            <Palmtree className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-zinc-900 block text-xs">
                              Control de Vacaciones Previas (Antigüedad Reconocida)
                            </span>
                            <span className="text-[11px] text-zinc-600">
                              {datosVacaciones.aniosCumplidos} año{datosVacaciones.aniosCumplidos > 1 ? "s" : ""} de servicio cumplido{datosVacaciones.aniosCumplidos > 1 ? "s" : ""} · {datosVacaciones.devengados} días generados por ley
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-white border-amber-300 text-amber-800 font-mono shrink-0">
                          {datosVacaciones.devengados} días LFT
                        </Badge>
                      </div>

                      <p className="text-[11px] text-zinc-700 leading-snug">
                        Por su fecha de ingreso ({fechaIngreso}), este trabajador ya acumuló <strong>{datosVacaciones.devengados} días</strong> de vacaciones de sus periodos de aniversario anteriores.
                      </p>

                      {/* Pregunta interactiva obligatoria */}
                      <div className="pt-2.5 border-t border-amber-200/80 space-y-2">
                        <label className="font-bold text-zinc-900 block text-xs">
                          ¿El trabajador ya tomó días de vacaciones de sus periodos anteriores?
                        </label>
                        <div className="grid grid-cols-2 gap-2.5 sm:w-80">
                          <button
                            type="button"
                            onClick={() => {
                              setHaTomadoVacaciones(false);
                              setDiasTomadosVacaciones(0);
                            }}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              haTomadoVacaciones === false
                                ? "bg-zinc-900 border-zinc-900 text-white shadow-xs"
                                : "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            No, aún no las toma
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHaTomadoVacaciones(true);
                              if (diasTomadosVacaciones <= 0) {
                                setDiasTomadosVacaciones(datosVacaciones.devengados);
                              }
                            }}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              haTomadoVacaciones === true
                                ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                                : "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            Sí, ya tomó vacaciones
                          </button>
                        </div>
                      </div>

                      {/* Si ya tomó vacaciones, preguntar cuántos días */}
                      {haTomadoVacaciones === true && (
                        <div className="pt-2.5 border-t border-amber-200/80 space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <label htmlFor="dias_tomados_vacaciones" className="font-semibold text-zinc-800 text-xs">
                              ¿Cuántos días de vacaciones ya disfrutó?
                            </label>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Máximo {datosVacaciones.devengados} días
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              id="dias_tomados_vacaciones"
                              type="number"
                              min={1}
                              max={datosVacaciones.devengados}
                              value={diasTomadosVacaciones}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(datosVacaciones.devengados, Number(e.target.value)));
                                setDiasTomadosVacaciones(val);
                              }}
                              className="w-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 font-bold font-mono focus:border-zinc-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setDiasTomadosVacaciones(datosVacaciones.devengados)}
                              className="px-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-[11px] text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer"
                            >
                              Tomó todas ({datosVacaciones.devengados}d)
                            </button>
                          </div>

                          {/* Cuadro de cálculo y saldo resultante en tiempo real */}
                          <div className="p-3 rounded-xl bg-white/95 border border-amber-200 text-xs space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between text-zinc-600">
                              <span>Días acumulados por ley:</span>
                              <span className="font-mono font-bold text-zinc-900">+{datosVacaciones.devengados} días</span>
                            </div>
                            <div className="flex items-center justify-between text-zinc-600">
                              <span>Días ya disfrutados (descuento inicial):</span>
                              <span className="font-mono font-bold text-rose-600">-{diasTomadosVacaciones} días</span>
                            </div>
                            <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between font-bold">
                              <span className="text-zinc-900">Saldo inicial disponible en NOLAN:</span>
                              <span className={`font-mono text-sm ${datosVacaciones.devengados - diasTomadosVacaciones > 0 ? "text-emerald-600" : "text-zinc-600"}`}>
                                {Math.max(0, datosVacaciones.devengados - diasTomadosVacaciones)} días disponibles
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Si no ha tomado vacaciones, saldo completo disponible */}
                      {haTomadoVacaciones === false && (
                        <div className="p-3 rounded-xl bg-white/95 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between shadow-2xs animate-in fade-in duration-150">
                          <div>
                            <span className="font-semibold block">Saldo inicial disponible en NOLAN:</span>
                            <span className="text-[10px] text-emerald-700">El trabajador podrá solicitar sus días acumulados de inmediato.</span>
                          </div>
                          <span className="font-bold font-mono text-sm text-emerald-600 shrink-0">
                            +{datosVacaciones.devengados} días
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 2: IDENTIDAD FISCAL MEXICANA (NSS, RFC, CURP) */}
          {pestañaActiva === "fiscal" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="rounded-xl border border-zinc-200/80 bg-[#FAF9F6] p-3 text-xs text-zinc-600 space-y-1">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <FileBadge className="h-3.5 w-3.5 text-zinc-600" />
                  Identidad Oficial para Nómina y Seguro
                </div>
                <p className="text-[11px] text-zinc-500">
                  La CURP también puede ser utilizada por el empleado para acceder a su portal de checado web desde su celular.
                </p>
              </div>

              {/* CURP */}
              <div className="space-y-1.5">
                <label
                  htmlFor="curp"
                  className="text-xs font-medium text-zinc-700 flex items-center justify-between"
                >
                  <span>CURP (Clave Única de Registro de Población)</span>
                  <span className="text-[10px] text-zinc-400 font-mono">18 caracteres</span>
                </label>
                <input
                  id="curp"
                  type="text"
                  maxLength={18}
                  value={curp}
                  onChange={(e) => setCurp(e.target.value.toUpperCase())}
                  placeholder="Ej. LOMJ880214HDFPRN03"
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 font-mono uppercase placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                />
              </div>

              {/* RFC y NSS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="rfc"
                    className="text-xs font-medium text-zinc-700 flex items-center justify-between"
                  >
                    <span>RFC con homoclave</span>
                    <span className="text-[10px] text-zinc-400 font-mono">12-13 carac.</span>
                  </label>
                  <input
                    id="rfc"
                    type="text"
                    maxLength={13}
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    placeholder="Ej. LOMJ8802141A2"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 font-mono uppercase placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="nss"
                    className="text-xs font-medium text-zinc-700 flex items-center justify-between"
                  >
                    <span>NSS (Número de Seguro Social)</span>
                    <span className="text-[10px] text-zinc-400 font-mono">11 dígitos</span>
                  </label>
                  <input
                    id="nss"
                    type="text"
                    maxLength={11}
                    value={nss}
                    onChange={(e) => setNss(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ej. 12345678901"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 font-mono placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: ACCESO ONLINE Y PIN PARA CHECADO MÓVIL */}
          {pestañaActiva === "acceso" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-blue-900">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Credenciales de Portal de Asistencia Online
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  El trabajador podrá ingresar a <strong>/checador</strong> desde el navegador de su celular ingresando su <strong>CURP o Correo</strong> y este <strong>PIN de 4 dígitos</strong>. Solo podrá registrar asistencia si se encuentra dentro de la geocerca GPS del taller.
                </p>
              </div>

              {/* Correo para acceso */}
              <div className="space-y-1.5">
                <label
                  htmlFor="correo"
                  className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                  Correo electrónico para acceso online <span className="text-[10px] text-zinc-400 font-normal">(Opcional si usa CURP)</span>
                </label>
                <input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                />
              </div>

              {/* PIN de 4 dígitos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="pin"
                    className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                    PIN numérico de 4 dígitos
                  </label>
                  <button
                    type="button"
                    onClick={generarPinAleatorio}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    Generar PIN aleatorio
                  </button>
                </div>
                <input
                  id="pin"
                  type="text"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ej. 1234"
                  disabled={isPending}
                  className="w-full max-w-[160px] tracking-widest text-center text-sm font-bold font-mono rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                />
                <p className="text-[10px] text-zinc-400">
                  Clave secreta personal para checar entrada, descansos, salidas y solicitar vacaciones.
                </p>
              </div>

              {/* Switch Checado Web Habilitado para este empleado */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <label htmlFor="permite_checado_web" className="text-xs font-semibold text-zinc-800 block cursor-pointer">
                    Habilitar checado móvil para este empleado
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Si se desactiva, el empleado solo podrá checar a través del checador físico ZKTeco.
                  </p>
                </div>
                <input
                  id="permite_checado_web"
                  type="checkbox"
                  checked={permiteChecadoWeb}
                  onChange={(e) => setPermiteChecadoWeb(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* PESTAÑA 4: FACE ID & BIOMETRÍA FACIAL */}
          {pestañaActiva === "biometria" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Alerta de Biometría Pendiente o Explicación */}
              {!nuevaFotoFacial && !biometriaEnroladaPrevia ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Configuración Biométrica Face ID</span>
                    <Badge variant="outline" className="text-[10px] bg-white text-amber-800 border-amber-300 ml-auto">
                      Biometría Pendiente
                    </Badge>
                  </div>
                  <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                    Hace falta configurar el dato biométrico para que pueda checar su entrada y salida.
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Puedes dar de alta o guardar al empleado sin foto ahora. El colaborador aparecerá con la etiqueta <strong>Biometría Pendiente</strong> y podrá enrolar su Face ID directamente desde su celular en su primer acceso al checador web, o puedes tomarle la foto aquí en cualquier momento.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                    <ScanFace className="h-4 w-4 text-emerald-600" />
                    <span>Control Biométrico Anti-Fraude (Face ID)</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 ml-auto">
                      Face ID Activo
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                    Plantilla biométrica de 128 dimensiones basada en rasgos faciales e inmune al color de ropa o iluminación. Cotejo 1:1 estricto cada vez que el trabajador marque asistencia en el checador móvil.
                  </p>
                </div>
              )}

              {/* Estado actual de biometría */}
              <div className="rounded-xl border border-zinc-200 bg-[#F9F9FB] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {nuevaFotoFacial || fotoThumbnailPrevia ? (
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={nuevaFotoFacial || fotoThumbnailPrevia || ""}
                          alt="Muestra Facial"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center shrink-0">
                        <ScanFace className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-zinc-900">
                          {nuevaFotoFacial
                            ? "Nueva Muestra Capturada (Sin Guardar)"
                            : biometriaEnroladaPrevia
                            ? "Face ID Enrolado Activo"
                            : "Sin Biometría Facial Registrada"}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            nuevaFotoFacial
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : biometriaEnroladaPrevia
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {nuevaFotoFacial
                            ? "Vector 128D Generado"
                            : biometriaEnroladaPrevia
                            ? "Activo 1:1"
                            : "Biometría Pendiente"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {nuevaFotoFacial
                          ? "Haz clic en 'Guardar Cambios' para persistir el vector en el servidor seguro."
                          : fechaEnrolamientoPrevia
                          ? `Enrolado el ${new Date(fechaEnrolamientoPrevia).toLocaleDateString("es-MX")}`
                          : "Hace falta configurar el dato biométrico para que pueda checar su entrada y salida."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visor de cámara en vivo si está activa */}
                {camaraBiometriaActiva && (
                  <div className="pt-2 border-t border-zinc-200 space-y-3">
                    <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500 bg-zinc-950 flex items-center justify-center shadow-lg">
                      <video
                        ref={conectarVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      {/* Retícula de escaneo */}
                      <div className="absolute inset-2 rounded-xl border border-dashed border-emerald-400/60 pointer-events-none flex flex-col justify-between p-1.5">
                        <div className="flex justify-between text-[8px] text-emerald-400 font-mono">
                          <span>[ENROLL]</span>
                          <span>[128D]</span>
                        </div>
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                        <div className="text-center text-[8px] text-emerald-400 font-mono">
                          CENTRADO_FACIAL
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={capturarMuestraFacial}
                        className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                      >
                        <ScanFace className="h-3.5 w-3.5 mr-1.5" />
                        Capturar Muestra Facial
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={detenerCamaraBiometria}
                        className="rounded-xl text-xs"
                      >
                        Cancelar Cámara
                      </Button>
                    </div>
                  </div>
                )}

                {camaraBiometriaError && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{camaraBiometriaError}</span>
                  </div>
                )}

                {/* Acciones para iniciar captura o carga */}
                {!camaraBiometriaActiva && (
                  <div className="pt-2 border-t border-zinc-200 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={iniciarCamaraBiometria}
                      disabled={iniciandoCamara}
                      className="rounded-xl text-xs flex items-center gap-1.5 hover:bg-zinc-100 cursor-pointer"
                    >
                      {iniciandoCamara ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600" />
                          <span>Iniciando Cámara...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="h-3.5 w-3.5 text-zinc-600" />
                          <span>
                            {biometriaEnroladaPrevia || nuevaFotoFacial
                              ? "Re-capturar con Cámara"
                              : "Abrir Cámara Web"}
                          </span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl text-xs flex items-center gap-1.5 hover:bg-zinc-100"
                    >
                      <UploadCloud className="h-3.5 w-3.5 text-zinc-600" />
                      Cargar Foto Facial (JPG/PNG)
                    </Button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) procesarArchivoFacial(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <div className="flex gap-1.5">
              {pestañaActiva !== "general" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    detenerCamaraBiometria();
                    if (pestañaActiva === "biometria") setPestañaActiva("acceso");
                    else if (pestañaActiva === "acceso") setPestañaActiva("fiscal");
                    else setPestañaActiva("general");
                  }}
                  className="rounded-xl text-xs"
                >
                  Anterior
                </Button>
              )}
              {pestañaActiva !== "biometria" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    detenerCamaraBiometria();
                    if (pestañaActiva === "general") setPestañaActiva("fiscal");
                    else if (pestañaActiva === "fiscal") setPestañaActiva("acceso");
                    else setPestañaActiva("biometria");
                  }}
                  className="rounded-xl text-xs"
                >
                  Siguiente
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={intentarCerrar}
                className="rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="rounded-xl text-xs shadow-xs cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" strokeWidth={2} />
                    Guardando...
                  </>
                ) : esEdicion ? (
                  "Guardar Cambios"
                ) : (
                  "Registrar Empleado"
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Modal de confirmación para datos sin guardar */}
        {mostrarConfirmacionSalida && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-zinc-200 space-y-3.5">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">¿Salir del formulario?</h3>
                  <p className="text-[11px] text-zinc-500">Tienes datos en edición sin guardar</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {esEdicion
                  ? "Si sales ahora, los cambios realizados en esta ficha se perderán."
                  : "Los datos ingresados están respaldados en tu borrador local de este navegador para no perder tu avance."}
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => setMostrarConfirmacionSalida(false)}
                  className="w-full text-xs cursor-pointer shadow-xs"
                >
                  Continuar editando
                </Button>
                {!esEdicion && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={salirConservandoBorrador}
                    className="w-full text-xs text-blue-700 hover:bg-blue-50 border-blue-200 cursor-pointer"
                  >
                    Salir y conservar borrador
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={descartarBorradorYSalir}
                  className="w-full text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  Descartar datos y salir
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
