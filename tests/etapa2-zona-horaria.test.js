const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  obtenerFechaHoyMerida,
  obtenerHoraMerida,
  obtenerMinutosDelDiaMerida,
  compararFechasCalendario,
  esFechaPasadaMerida,
  calcularDiasEntreFechas,
  sumarDiasAFecha,
  obtenerRangoDiaMeridaEnUtc,
} = require(path.resolve(process.cwd(), 'lib/utils/fechas-laborales.ts'));

describe('ETAPA 2: Zona Horaria America/Merida (UTC-6) y Simulación Temporal', () => {
  test('Caso 1: 17:59 hrs Mérida (23:59 UTC) -> Mismo día calendario', () => {
    // 2026-11-16 17:59:00 en Mérida = 2026-11-16T23:59:00.000Z
    const fechaUtc = new Date('2026-11-16T23:59:00.000Z');
    const fechaMerida = obtenerFechaHoyMerida(fechaUtc);
    const horaMerida = obtenerHoraMerida(fechaUtc);
    const minutos = obtenerMinutosDelDiaMerida(fechaUtc);

    assert.strictEqual(fechaMerida, '2026-11-16');
    assert.strictEqual(horaMerida, '17:59');
    assert.strictEqual(minutos, 17 * 60 + 59);
  });

  test('Caso 2: 18:00 hrs Mérida (00:00 UTC día siguiente) -> DEBE PERMANECER EN EL DÍA LOCAL', () => {
    // A las 18:00 en Mérida, en UTC ya es 2026-11-17T00:00:00.000Z!
    // Un simple new Date().toISOString().slice(0, 10) fallaría diciendo '2026-11-17'.
    const fechaUtc = new Date('2026-11-17T00:00:00.000Z');
    const fechaMerida = obtenerFechaHoyMerida(fechaUtc);
    const horaMerida = obtenerHoraMerida(fechaUtc);
    const minutos = obtenerMinutosDelDiaMerida(fechaUtc);

    assert.strictEqual(fechaMerida, '2026-11-16', 'A las 18:00 en Mérida sigue siendo 16 de noviembre');
    assert.strictEqual(horaMerida, '18:00');
    assert.strictEqual(minutos, 18 * 60);
  });

  test('Caso 3: 23:59 hrs Mérida (05:59 UTC día siguiente) -> DEBE PERMANECER EN EL DÍA LOCAL', () => {
    // A las 23:59 en Mérida, en UTC ya son las 05:59 del día 17.
    const fechaUtc = new Date('2026-11-17T05:59:00.000Z');
    const fechaMerida = obtenerFechaHoyMerida(fechaUtc);
    const horaMerida = obtenerHoraMerida(fechaUtc);
    const minutos = obtenerMinutosDelDiaMerida(fechaUtc);

    assert.strictEqual(fechaMerida, '2026-11-16', 'A las 23:59 en Mérida sigue siendo 16 de noviembre');
    assert.strictEqual(horaMerida, '23:59');
    assert.strictEqual(minutos, 23 * 60 + 59);
  });

  test('Caso 4: 00:01 hrs Mérida (06:01 UTC) -> CAMBIO DE DÍA EXACTO EN MÉRIDA', () => {
    // A las 00:01 en Mérida, en UTC son las 06:01 del día 17.
    const fechaUtc = new Date('2026-11-17T06:01:00.000Z');
    const fechaMerida = obtenerFechaHoyMerida(fechaUtc);
    const horaMerida = obtenerHoraMerida(fechaUtc);
    const minutos = obtenerMinutosDelDiaMerida(fechaUtc);

    assert.strictEqual(fechaMerida, '2026-11-17', 'A las 00:01 en Mérida ya es 17 de noviembre');
    assert.strictEqual(horaMerida, '00:01');
    assert.strictEqual(minutos, 1);
  });

  test('Rango del día en UTC para consulta en base de datos', () => {
    const rango = obtenerRangoDiaMeridaEnUtc('2026-11-16');
    assert.strictEqual(rango.inicioUtc, '2026-11-16T06:00:00.000Z');
    assert.strictEqual(rango.finUtc, '2026-11-17T05:59:59.999Z');
  });

  test('Comparaciones de fechas calendario y cálculo de días naturales', () => {
    assert.strictEqual(compararFechasCalendario('2026-11-16', '2026-11-17') < 0, true);
    assert.strictEqual(compararFechasCalendario('2026-11-17', '2026-11-16') > 0, true);
    assert.strictEqual(compararFechasCalendario('2026-11-16', '2026-11-16'), 0);

    assert.strictEqual(esFechaPasadaMerida('2026-11-15', '2026-11-16'), true);
    assert.strictEqual(esFechaPasadaMerida('2026-11-16', '2026-11-16'), false);
    assert.strictEqual(esFechaPasadaMerida('2026-11-17', '2026-11-16'), false);

    assert.strictEqual(calcularDiasEntreFechas('2026-11-16', '2026-11-16'), 1);
    assert.strictEqual(calcularDiasEntreFechas('2026-11-16', '2026-11-20'), 5);
  });
});
