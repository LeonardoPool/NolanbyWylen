"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  Pencil,
  UserX,
  UserCheck,
  Fingerprint,
  Phone,
  Calendar,
  Briefcase,
  IdCard,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X,
  UserCheck2,
  Users2,
  ScanFace,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmpleadoDialog } from "./empleado-dialog";
import { CambiarEstadoDialog } from "./cambiar-estado-dialog";
import type { EmpleadoRow, EmpleadoConBiometria, RolUsuario } from "../actions";

interface EmpleadosVistaProps {
  empleadosIniciales: EmpleadoConBiometria[];
  rolUsuario: RolUsuario;
  errorInicial?: string;
}

type FiltroEstado = "todos" | "activos" | "inactivos";

const ELEMENTOS_POR_PAGINA = 8;

export function EmpleadosVista({
  empleadosIniciales,
  rolUsuario,
  errorInicial,
}: EmpleadosVistaProps) {
  const [empleados, setEmpleados] = useState<EmpleadoConBiometria[]>(empleadosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("activos");
  const [paginaActual, setPaginaActual] = useState(1);

  // Modals state
  const [modalFormAbierto, setModalFormAbierto] = useState(false);
  const [empleadoAEditar, setEmpleadoAEditar] = useState<EmpleadoConBiometria | null>(null);

  const [modalBajaAbierto, setModalBajaAbierto] = useState(false);
  const [empleadoACambiarEstado, setEmpleadoACambiarEstado] = useState<EmpleadoConBiometria | null>(null);

  const esAdmin = rolUsuario === "ADMINISTRADOR";

  // Estadísticas métricas
  const totalEmpleados = empleados.length;
  const totalActivos = useMemo(
    () => empleados.filter((e) => e.activo).length,
    [empleados]
  );
  const totalInactivos = totalEmpleados - totalActivos;

  // Filtrado y búsqueda
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter((emp) => {
      // Filtro de estado
      if (filtroEstado === "activos" && !emp.activo) return false;
      if (filtroEstado === "inactivos" && emp.activo) return false;

      // Filtro de texto libre
      if (!busqueda.trim()) return true;

      const q = busqueda.toLowerCase().trim();
      const matchNombre = emp.nombre.toLowerCase().includes(q);
      const matchApellidos = emp.apellidos.toLowerCase().includes(q);
      const matchNumero = emp.numero_empleado.toLowerCase().includes(q);
      const matchBiometrico = emp.codigo_biometrico.toLowerCase().includes(q);
      const matchPuesto = emp.puesto.toLowerCase().includes(q);
      const matchTelefono = emp.telefono ? emp.telefono.toLowerCase().includes(q) : false;
      const matchCurp = emp.curp ? emp.curp.toLowerCase().includes(q) : false;
      const matchRfc = emp.rfc ? emp.rfc.toLowerCase().includes(q) : false;
      const matchCorreo = emp.correo ? emp.correo.toLowerCase().includes(q) : false;

      return (
        matchNombre ||
        matchApellidos ||
        matchNumero ||
        matchBiometrico ||
        matchPuesto ||
        matchTelefono ||
        matchCurp ||
        matchRfc ||
        matchCorreo
      );
    });
  }, [empleados, filtroEstado, busqueda]);

  // Paginación
  const totalPaginas = Math.ceil(empleadosFiltrados.length / ELEMENTOS_POR_PAGINA) || 1;
  const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
  const empleadosPaginados = useMemo(() => {
    return empleadosFiltrados.slice(
      indiceInicio,
      indiceInicio + ELEMENTOS_POR_PAGINA
    );
  }, [empleadosFiltrados, indiceInicio]);

  // Handlers para actualizar el estado local reactivamente
  function handleGuardado(empleadoGuardado: EmpleadoConBiometria, esNuevo: boolean) {
    if (esNuevo) {
      setEmpleados((prev) => [empleadoGuardado, ...prev]);
    } else {
      setEmpleados((prev) =>
        prev.map((e) => (e.id === empleadoGuardado.id ? empleadoGuardado : e))
      );
    }
  }

  function handleEstadoCambiado(empleadoActualizado: EmpleadoRow) {
    setEmpleados((prev) =>
      prev.map((e) =>
        e.id === empleadoActualizado.id
          ? { ...e, ...empleadoActualizado }
          : e
      )
    );
  }

  function abrirCrear() {
    setEmpleadoAEditar(null);
    setModalFormAbierto(true);
  }

  function abrirEditar(emp: EmpleadoConBiometria) {
    setEmpleadoAEditar(emp);
    setModalFormAbierto(true);
  }

  function abrirCambiarEstado(emp: EmpleadoConBiometria) {
    setEmpleadoACambiarEstado(emp);
    setModalBajaAbierto(true);
  }

  return (
    <div className="space-y-6">
      {/* Mensaje de error inicial del servidor si hubo */}
      {errorInicial && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" strokeWidth={1.75} />
            <span>{errorInicial}</span>
          </div>
        </div>
      )}

      {/* Header y Acción Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Catálogo de Empleados
            </h1>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {rolUsuario}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Personal de Servicio Mecánico López y clave de enlace con el checador biométrico ZKTeco MB10V.
          </p>
        </div>

        {esAdmin && (
          <Button size="sm" onClick={abrirCrear} className="w-full sm:w-auto shadow-xs">
            <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={1.75} />
            Nuevo Empleado
          </Button>
        )}
      </div>

      {/* Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-zinc-400">Total Registrados</p>
            <p className="text-lg font-bold text-zinc-900 mt-0.5">{totalEmpleados}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
            <Users2 className="h-4 w-4" strokeWidth={1.75} />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-emerald-700">Trabajadores Activos</p>
            <p className="text-lg font-bold text-emerald-900 mt-0.5">{totalActivos}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700">
            <UserCheck2 className="h-4 w-4" strokeWidth={1.75} />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-zinc-400">En Baja Lógica</p>
            <p className="text-lg font-bold text-zinc-600 mt-0.5">{totalInactivos}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
            <UserX className="h-4 w-4" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                placeholder="Buscar por nombre, puesto, clave o ID biométrico..."
                className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/10 transition-all"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("");
                    setPaginaActual(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Pestañas de Estado */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setFiltroEstado("activos");
                  setPaginaActual(1);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  filtroEstado === "activos"
                    ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Activos ({totalActivos})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroEstado("inactivos");
                  setPaginaActual(1);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  filtroEstado === "inactivos"
                    ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Bajas ({totalInactivos})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroEstado("todos");
                  setPaginaActual(1);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  filtroEstado === "todos"
                    ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Todos ({totalEmpleados})
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenedor Principal: Tabla y Cards Responsivas */}
      <Card>
        <CardHeader className="border-b border-zinc-100 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Personal Registrado</CardTitle>
              <CardDescription>
                Listado oficial de trabajadores vinculados con el checador biométrico.
              </CardDescription>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {empleadosFiltrados.length} resultado{empleadosFiltrados.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {empleadosFiltrados.length === 0 ? (
            /* Estado Vacío */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="h-11 w-11 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-200/60">
                <Users className="h-5 w-5" strokeWidth={1.5} />
              </div>
              {totalEmpleados === 0 ? (
                <>
                  <h3 className="text-xs font-semibold text-zinc-800">
                    No hay empleados registrados en la base de datos
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
                    Registra a los trabajadores del taller para que puedan registrar sus asistencias con el checador biométrico.
                  </p>
                  {esAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={abrirCrear}
                      className="mt-4 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" strokeWidth={1.5} />
                      Registrar Primer Empleado
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-xs font-semibold text-zinc-800">
                    No se encontraron coincidencias
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed">
                    Ningún empleado coincide con el filtro o término de búsqueda ingresado.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBusqueda("");
                      setFiltroEstado("todos");
                    }}
                    className="mt-4 text-xs"
                  >
                    Restablecer filtros
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Vista Tabla Desktop (md en adelante) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-[#FAFAFC] text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Trabajador</th>
                      <th className="py-3 px-4">Clave Interna</th>
                      <th className="py-3 px-4">Puesto / Oficio</th>
                      <th className="py-3 px-4">ID Checador</th>
                      <th className="py-3 px-4">Face ID & Biometría</th>
                      <th className="py-3 px-4">Fecha Ingreso</th>
                      <th className="py-3 px-4">Estatus</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {empleadosPaginados.map((emp) => (
                      <tr
                        key={emp.id}
                        className="hover:bg-zinc-50/60 transition-colors"
                      >
                        {/* Columna Nombre & Contacto */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                              {emp.nombre.charAt(0)}
                              {emp.apellidos.charAt(0)}
                            </div>
                              <div>
                              <p className="font-semibold text-zinc-900 leading-tight">
                                {emp.nombre} {emp.apellidos}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {emp.telefono ? (
                                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-zinc-400" strokeWidth={1.5} />
                                    {emp.telefono}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-zinc-400 italic">
                                    Sin teléfono
                                  </span>
                                )}
                                {emp.curp && (
                                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                                    {emp.curp.slice(0, 10)}...
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Clave interna */}
                        <td className="py-3.5 px-4 font-mono font-medium text-zinc-600">
                          <span className="bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded text-[11px]">
                            {emp.numero_empleado}
                          </span>
                        </td>

                        {/* Puesto */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-zinc-800 font-medium">
                            <Briefcase className="h-3.5 w-3.5 text-zinc-400 shrink-0" strokeWidth={1.5} />
                            <span>{emp.puesto}</span>
                          </div>
                        </td>

                        {/* Código biométrico */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200/70 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold">
                            <Fingerprint className="h-3 w-3 text-blue-600" strokeWidth={1.75} />
                            ID: {emp.codigo_biometrico}
                          </span>
                        </td>

                        {/* Estado Face ID / Biometría */}
                        <td className="py-3.5 px-4">
                          {emp.tieneBiometria ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] inline-flex items-center gap-1 font-medium"
                            >
                              <ScanFace className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>Face ID Activo</span>
                            </Badge>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] inline-flex items-center gap-1 font-medium"
                                title="Hace falta configurar el dato biométrico para que pueda checar su entrada y salida"
                              >
                                <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                                <span>Biometría Pendiente</span>
                              </Badge>
                              <span className="text-[9px] text-amber-700 block leading-tight">
                                Falta Face ID para checar
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Fecha de ingreso */}
                        <td className="py-3.5 px-4 text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-zinc-400" strokeWidth={1.5} />
                            <span>
                              {emp.fecha_ingreso
                                ? new Date(emp.fecha_ingreso + "T00:00:00").toLocaleDateString(
                                    "es-MX",
                                    { year: "numeric", month: "short", day: "numeric" }
                                  )
                                : "N/D"}
                            </span>
                          </div>
                        </td>

                        {/* Estatus */}
                        <td className="py-3.5 px-4">
                          {emp.activo ? (
                            <Badge variant="success">Activo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-zinc-500 border-zinc-300">
                              Baja lógica
                            </Badge>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          {esAdmin ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirEditar(emp)}
                                className="h-7 px-2 text-[11px] text-zinc-600 hover:text-zinc-900"
                                title="Editar datos del empleado"
                              >
                                <Pencil className="h-3 w-3 mr-1 text-zinc-500" strokeWidth={1.5} />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirCambiarEstado(emp)}
                                className={`h-7 px-2 text-[11px] ${
                                  emp.activo
                                    ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                    : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                                }`}
                                title={emp.activo ? "Dar de baja lógica" : "Reactivar empleado"}
                              >
                                {emp.activo ? (
                                  <>
                                    <UserX className="h-3 w-3 mr-1 text-rose-500" strokeWidth={1.5} />
                                    Baja
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3 w-3 mr-1 text-emerald-600" strokeWidth={1.5} />
                                    Reactivar
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-400 italic">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista Cards Móvil (< md) */}
              <div className="block md:hidden divide-y divide-zinc-100">
                {empleadosPaginados.map((emp) => (
                  <div key={emp.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {emp.nombre.charAt(0)}
                          {emp.apellidos.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-zinc-900">
                            {emp.nombre} {emp.apellidos}
                          </p>
                          <p className="text-[11px] text-zinc-500">{emp.puesto}</p>
                          <div className="mt-1">
                            {emp.tieneBiometria ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] inline-flex items-center gap-1 font-medium"
                              >
                                <ScanFace className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                                <span>Face ID Activo</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] inline-flex items-center gap-1 font-medium"
                              >
                                <AlertCircle className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                                <span>Biometría Pendiente (Falta configurar para checar)</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        {emp.activo ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-zinc-500">
                            Baja lógica
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F9F9FB] p-2.5 rounded-lg border border-zinc-100">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Núm. Empleado</span>
                        <span className="font-mono font-medium text-zinc-700">
                          {emp.numero_empleado}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">ID ZKTeco</span>
                        <span className="font-mono font-semibold text-blue-700">
                          {emp.codigo_biometrico}
                        </span>
                      </div>
                      {emp.telefono && (
                        <div className="col-span-2">
                          <span className="text-zinc-400 block text-[10px]">Teléfono</span>
                          <span className="text-zinc-700">{emp.telefono}</span>
                        </div>
                      )}
                    </div>

                    {esAdmin && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirEditar(emp)}
                          className="h-8 px-2.5 text-xs text-zinc-600 flex-1"
                        >
                          <Pencil className="h-3 w-3 mr-1" strokeWidth={1.5} />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirCambiarEstado(emp)}
                          className={`h-8 px-2.5 text-xs flex-1 ${
                            emp.activo
                              ? "text-rose-600 border-rose-200"
                              : "text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {emp.activo ? (
                            <>
                              <UserX className="h-3 w-3 mr-1" strokeWidth={1.5} />
                              Dar de baja
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" strokeWidth={1.5} />
                              Reactivar
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Controles de Paginación */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 border-t border-zinc-100 gap-3 text-xs text-zinc-500 bg-[#FAFAFC]">
                <div>
                  Mostrando{" "}
                  <span className="font-semibold text-zinc-800">
                    {empleadosFiltrados.length === 0 ? 0 : indiceInicio + 1}
                  </span>{" "}
                  a{" "}
                  <span className="font-semibold text-zinc-800">
                    {Math.min(indiceInicio + ELEMENTOS_POR_PAGINA, empleadosFiltrados.length)}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-zinc-800">
                    {empleadosFiltrados.length}
                  </span>{" "}
                  empleados
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaActual <= 1}
                    onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                    className="h-8 px-2.5 text-xs"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-0.5" strokeWidth={1.75} />
                    Anterior
                  </Button>
                  <span className="text-[11px] font-medium text-zinc-600 px-2">
                    {paginaActual} / {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaActual >= totalPaginas}
                    onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                    className="h-8 px-2.5 text-xs"
                    aria-label="Página siguiente"
                  >
                    Siguiente
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Diálogos modales */}
      <EmpleadoDialog
        isOpen={modalFormAbierto}
        onClose={() => setModalFormAbierto(false)}
        empleadoAEditar={empleadoAEditar}
        onSaved={handleGuardado}
      />

      <CambiarEstadoDialog
        isOpen={modalBajaAbierto}
        onClose={() => setModalBajaAbierto(false)}
        empleado={empleadoACambiarEstado}
        onChanged={handleEstadoCambiado}
      />
    </div>
  );
}
