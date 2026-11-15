"use client";

import * as React from "react";
import { useState, useTransition, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { crearEmpleado, actualizarEmpleado, type EmpleadoRow } from "../actions";

interface EmpleadoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empleadoAEditar?: EmpleadoRow | null;
  onSaved: (empleado: EmpleadoRow, esNuevo: boolean) => void;
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
  const [pestañaActiva, setPestañaActiva] = useState<"general" | "fiscal" | "acceso">("general");

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

  const esEdicion = Boolean(empleadoAEditar);

  useEffect(() => {
    if (empleadoAEditar) {
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
    } else {
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
    }
    setErrorLocal(null);
    setPestañaActiva("general");
  }, [empleadoAEditar, isOpen]);

  if (!isOpen) return null;

  function generarPinAleatorio() {
    const pinRandom = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(pinRandom);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorLocal(null);

    const formData = new FormData();
    formData.append("numero_empleado", numeroEmpleado.trim().toUpperCase());
    formData.append("codigo_biometrico", codigoBiometrico.trim());
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

        notify.success(
          esEdicion ? "Empleado actualizado" : "Empleado registrado",
          res.message || "Los datos se guardaron con éxito en la base de datos."
        );
        onSaved(res.empleado, !esEdicion);
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
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-zinc-200/90 shadow-2xl overflow-hidden my-6"
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
                  : "Registra al trabajador con vinculación biométrica y acceso para checado web."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-50"
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
            onClick={() => setPestañaActiva("acceso")}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              pestañaActiva === "acceso"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <KeyRound className="h-3 w-3 text-zinc-400" />
            Acceso Online (PIN)
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"
                  >
                    <Fingerprint className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                    ID en Checador Físico (ZKTeco) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="codigo_biometrico"
                    type="text"
                    required
                    value={codigoBiometrico}
                    onChange={(e) => setCodigoBiometrico(e.target.value)}
                    placeholder="Ej. 1, 102"
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 font-mono placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                  />
                  <p className="text-[10px] text-zinc-400">ID de usuario en el checador físico.</p>
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

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <div className="flex gap-1.5">
              {pestañaActiva !== "general" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPestañaActiva(pestañaActiva === "acceso" ? "fiscal" : "general")
                  }
                  className="rounded-xl text-xs"
                >
                  Anterior
                </Button>
              )}
              {pestañaActiva !== "acceso" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPestañaActiva(pestañaActiva === "general" ? "fiscal" : "acceso")
                  }
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
                onClick={onClose}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="rounded-xl text-xs shadow-xs"
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
      </div>
    </div>
  );
}
