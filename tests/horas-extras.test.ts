import { test } from "node:test";
import assert from "node:assert/strict";
import {
  procesarJornadaDiaria,
  evaluarConfiguracionPorDiaSemana,
  obtenerDiasDescanso,
  formatearResumenDias,
  EventoAsistenciaSimple,
  HORARIO_LABORAL_DEFAULT,
  HorarioLaboralConfig,
} from "../lib/lft/calculo-horas";

test("Horas Extras: Menor a 15 min después de la salida no califica como tiempo extra", () => {
  // Turno oficial: 08:00 a 18:00. Salida a las 18:14 (14 min después)
  const eventos: EventoAsistenciaSimple[] = [
    { tipoEvento: "ENTRADA", fechaHora: "2026-11-18T08:00:00-06:00", metodoRegistro: "WEB" },
    { tipoEvento: "SALIDA", fechaHora: "2026-11-18T18:14:00-06:00", metodoRegistro: "WEB" },
  ];

  const jornada = procesarJornadaDiaria(eventos, "2026-11-18", HORARIO_LABORAL_DEFAULT);
  assert.equal(jornada.horasExtraDobles, 0, "No debe computar horas extras dobles");
  assert.equal(jornada.horasExtraTriples, 0, "No debe computar horas extras triples");
});

test("Horas Extras: 15 min o más después de la salida computa desde la hora oficial (18:00)", () => {
  // Turno oficial: 08:00 a 18:00. Salida a las 18:30 (30 min después)
  const eventos: EventoAsistenciaSimple[] = [
    { tipoEvento: "ENTRADA", fechaHora: "2026-11-18T08:00:00-06:00", metodoRegistro: "WEB" },
    { tipoEvento: "SALIDA", fechaHora: "2026-11-18T18:30:00-06:00", metodoRegistro: "WEB" },
  ];

  const jornada = procesarJornadaDiaria(eventos, "2026-11-18", HORARIO_LABORAL_DEFAULT);
  assert.equal(jornada.horasExtraDobles, 0.5, "Debe computar 0.5 horas (30 minutos) extras");
});

test("Horas Extras: Salida a las 19:30 computa 1.5 horas extras (90 min)", () => {
  const eventos: EventoAsistenciaSimple[] = [
    { tipoEvento: "ENTRADA", fechaHora: "2026-11-18T08:00:00-06:00", metodoRegistro: "WEB" },
    { tipoEvento: "SALIDA", fechaHora: "2026-11-18T19:30:00-06:00", metodoRegistro: "WEB" },
  ];

  const jornada = procesarJornadaDiaria(eventos, "2026-11-18", HORARIO_LABORAL_DEFAULT);
  assert.equal(jornada.horasExtraDobles, 1.5, "Debe computar 1.5 horas extras");
});

test("Fin de Semana: Sábado oficial 09:00 a 14:00, salida a las 14:14 no computa extras", () => {
  // Sábado 21 de noviembre de 2026
  const eventos: EventoAsistenciaSimple[] = [
    { tipoEvento: "ENTRADA", fechaHora: "2026-11-21T09:00:00-06:00", metodoRegistro: "WEB" },
    { tipoEvento: "SALIDA", fechaHora: "2026-11-21T14:14:00-06:00", metodoRegistro: "WEB" },
  ];

  const jornada = procesarJornadaDiaria(eventos, "2026-11-21", HORARIO_LABORAL_DEFAULT);
  assert.equal(jornada.horasExtraDobles, 0, "No debe computar horas extras antes de los 15 min");
});

test("Fin de Semana: Sábado oficial 09:00 a 14:00, salida a las 15:00 computa 1 hora extra", () => {
  // Sábado 21 de noviembre de 2026
  const eventos: EventoAsistenciaSimple[] = [
    { tipoEvento: "ENTRADA", fechaHora: "2026-11-21T09:00:00-06:00", metodoRegistro: "WEB" },
    { tipoEvento: "SALIDA", fechaHora: "2026-11-21T15:00:00-06:00", metodoRegistro: "WEB" },
  ];

  const jornada = procesarJornadaDiaria(eventos, "2026-11-21", HORARIO_LABORAL_DEFAULT);
  assert.equal(jornada.horasExtraDobles, 1, "Debe computar 1 hora extra en sábado");
});

test("Sistema Inteligente de Días: Permite personalizar días laborables, segundo horario y descansos dinámicos", () => {
  // Configuración personalizada: Mar a Vie horario principal (08:00-18:00), Sáb y Dom segundo horario (09:00-15:00), Lunes descanso
  const configPersonalizada: HorarioLaboralConfig = {
    semanal: {
      dias: [2, 3, 4, 5], // Martes a Viernes
      horaEntrada: "08:00",
      horaSalida: "18:00",
      toleranciaEntradaMinutos: 15,
    },
    finDeSemana: {
      sabadoLaborable: true,
      dias: [6, 0], // Sábado y Domingo en segundo horario
      horaEntradaSabado: "09:00",
      horaSalidaSabado: "15:00",
      toleranciaSabadoMinutos: 10,
      diaDescansoSemanal: 1, // Lunes descanso
      diasDescanso: [1],
    },
    horasExtras: {
      minutosMinimosToleranciaSalida: 15,
    },
  };

  // Lunes (1) debe detectarse como DESCANSO
  const regLunes = evaluarConfiguracionPorDiaSemana(1, configPersonalizada);
  assert.equal(regLunes.tipo, "DESCANSO");
  assert.equal(regLunes.esDescanso, true);

  // Domingo (0) debe detectarse como FIN_DE_SEMANA con salida a las 15:00
  const regDomingo = evaluarConfiguracionPorDiaSemana(0, configPersonalizada);
  assert.equal(regDomingo.tipo, "FIN_DE_SEMANA");
  assert.equal(regDomingo.esDescanso, false);
  assert.equal(regDomingo.horaSalida, "15:00");

  // Verificar detección automática de descanso y formateo legible
  const descansos = obtenerDiasDescanso(configPersonalizada);
  assert.deepEqual(descansos, [1]);
  assert.equal(formatearResumenDias(descansos), "Lunes");
});
