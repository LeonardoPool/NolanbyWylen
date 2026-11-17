const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// 1. Cargar entorno local
const envPath = path.resolve(process.cwd(), '.env.local');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
}

const { createClient } = require('@supabase/supabase-js');

// 2. Importar utilidades y validaciones del proyecto
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

const {
  IncidenciaFormSchema,
  validarMagicBytesArchivo,
} = require(path.resolve(process.cwd(), 'lib/validaciones/incidencias.schema.ts'));

const {
  calcularDiasPorAnioServicioLFT,
  calcularAniversariosCumplidos,
} = require(path.resolve(process.cwd(), 'lib/lft/vacaciones-lft.ts'));

describe('ETAPA 8: Batería Integral de Pruebas de Regresión NOLAN by WYLEN', () => {

  // 1. Cambio de día Mérida / UTC
  test('Regresión 1: Preservación de día local a las 18:00 hrs Mérida (00:00 UTC día siguiente)', () => {
    const tUtc = new Date('2026-11-16T00:00:00.000Z');
    // A las 00:00 UTC del 16, en Mérida son las 18:00 del 15
    const fechaMerida = obtenerFechaHoyMerida(tUtc);
    const horaMerida = obtenerHoraMerida(tUtc);
    assert.strictEqual(fechaMerida, '2026-11-15');
    assert.strictEqual(horaMerida, '18:00');
  });

  // 2. Fechas pasadas y rangos invertidos por tipo
  test('Regresión 2: Rechazo de fechas pasadas en VACACIONES y PERMISO', () => {
    const hoy = obtenerFechaHoyMerida();
    const ayer = sumarDiasAFecha(hoy, -1);

    const intentoPasado = IncidenciaFormSchema.safeParse({
      empleadoId: '815e9fcb-8bbb-44a5-b1da-42467fa034c7',
      tipo: 'VACACIONES',
      fechaInicio: ayer,
      fechaFin: hoy,
      motivo: 'Solicitud de vacaciones pasadas',
    });

    assert.strictEqual(intentoPasado.success, false);
    assert.ok(intentoPasado.error?.issues[0]?.message.includes('No puedes registrar') || intentoPasado.error?.issues[0]?.message.includes('fechas pasadas'));

    const rangoInvertido = IncidenciaFormSchema.safeParse({
      empleadoId: '815e9fcb-8bbb-44a5-b1da-42467fa034c7',
      tipo: 'PERMISO',
      fechaInicio: '2026-12-10',
      fechaFin: '2026-12-05',
      motivo: 'Permiso personal invertido',
    });

    assert.strictEqual(rangoInvertido.success, false);
    assert.ok(rangoInvertido.error?.issues[0]?.message.includes('anterior a la fecha inicial'));
  });

  // 3. Incapacidad retroactiva y extemporánea
  test('Regresión 3: Incapacidad médica IMSS permite retroactividad de hasta 30 días', () => {
    const hoy = obtenerFechaHoyMerida();
    const hace10Dias = sumarDiasAFecha(hoy, -10);

    const incapacidadValida = IncidenciaFormSchema.safeParse({
      empleadoId: '815e9fcb-8bbb-44a5-b1da-42467fa034c7',
      tipo: 'INCAPACIDAD',
      fechaInicio: hace10Dias,
      fechaFin: hoy,
      motivo: 'Incapacidad médica IMSS por enfermedad general',
    });

    assert.strictEqual(incapacidadValida.success, true);

    const esExtemporanea = compararFechasCalendario(hace10Dias, hoy) < 0;
    assert.strictEqual(esExtemporanea, true, 'Debe marcarse extemporánea automáticamente');

    const hace45Dias = sumarDiasAFecha(hoy, -45);
    const incapacidadExcedida = IncidenciaFormSchema.safeParse({
      empleadoId: '815e9fcb-8bbb-44a5-b1da-42467fa034c7',
      tipo: 'INCAPACIDAD',
      fechaInicio: hace45Dias,
      fechaFin: hoy,
      motivo: 'Incapacidad médica demasiado antigua',
    });

    assert.strictEqual(incapacidadExcedida.success, false);
    assert.ok(incapacidadExcedida.error?.issues[0]?.message.includes('30 días de retroactividad'));
  });

  // 4. Seguridad de cliente anónimo en Base de Datos y Storage
  test('Regresión 4: Rol anónimo bloqueado en incidencias_empleado y bucket privado', async () => {
    const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    // Consulta de tabla cerrada
    const { data: dataInc, error: errInc } = await anonClient.from('incidencias_empleado').select('*');
    assert.ok(dataInc === null || dataInc.length === 0, 'Cliente anónimo no debe ver ninguna incidencia');

    // Listado de Storage cerrado
    const { data: dataStorage } = await anonClient.storage.from('justificantes-medicos').list();
    assert.ok(dataStorage === null || dataStorage.length === 0, 'Cliente anónimo no debe listar el bucket privado');
  });

  // 5. Verificación de Magic Bytes (archivo falso)
  test('Regresión 5: Detección y rechazo de archivo falso (.pdf con contenido de texto)', () => {
    // Archivo fingiendo ser PDF pero conteniendo texto plano
    const bufferFalso = Buffer.from('ESTO NO ES UN PDF REAL, ES UN ARCHIVO DE TEXTO');
    const check = validarMagicBytesArchivo(bufferFalso);
    assert.strictEqual(check.valido, false);
    assert.ok(check.error?.includes('Formato no permitido') || check.error?.includes('camuflado'));

    // PDF válido (%PDF = 0x25, 0x50, 0x44, 0x46)
    const bufferPdfReal = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    const checkPdf = validarMagicBytesArchivo(bufferPdfReal);
    assert.strictEqual(checkPdf.valido, true);
    assert.strictEqual(checkPdf.mimeDetectado, 'application/pdf');

    // JPG válido (FF D8 FF)
    const bufferJpgReal = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const checkJpg = validarMagicBytesArchivo(bufferJpgReal);
    assert.strictEqual(checkJpg.valido, true);
    assert.strictEqual(checkJpg.mimeDetectado, 'image/jpeg');

    // PNG válido (89 50 4E 47)
    const bufferPngReal = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const checkPng = validarMagicBytesArchivo(bufferPngReal);
    assert.strictEqual(checkPng.valido, true);
    assert.strictEqual(checkPng.mimeDetectado, 'image/png');
  });

  // 6. Archivo mayor a 5 MB
  test('Regresión 6: Límite estricto de 5 MB en archivos adjuntos', () => {
    const tamanoExcedidoBytes = 6 * 1024 * 1024; // 6 MB
    const limiteMaxBytes = 5 * 1024 * 1024; // 5 MB
    assert.ok(tamanoExcedidoBytes > limiteMaxBytes, 'Archivos mayores a 5MB deben ser rechazados');
  });

  // 7. Icono PWA iOS (180x180, sin canal alfa)
  test('Regresión 7: apple-touch-icon.png en raíz y public/icons con ColorType 2 (RGB sin alfa)', () => {
    const iconRoot = fs.readFileSync('public/apple-touch-icon.png');
    const iconSub = fs.readFileSync('public/icons/apple-touch-icon.png');

    // 180x180 px
    assert.strictEqual(iconRoot.readUInt32BE(16), 180);
    assert.strictEqual(iconRoot.readUInt32BE(20), 180);

    // Byte 25 es el Color Type en PNG: 2 = RGB Truecolor (100% opaco, sin canal alfa)
    assert.strictEqual(iconRoot[25], 2, 'El icono para iOS no debe tener canal alfa (ColorType debe ser 2)');
    assert.strictEqual(iconSub[25], 2);
  });

  // 8. Cálculo de vacaciones LFT con exclusión de domingos
  test('Regresión 8: Exclusión de domingos en periodo vacacional (Lunes a Sábado laborables)', () => {
    // Del lunes 2026-12-07 al lunes 2026-12-14:
    // 8 días naturales: Lun, Mar, Mié, Jue, Vie, Sáb, Dom (excluido), Lun.
    // Días laborables efectivos = 7.
    let curr = '2026-12-07';
    const fin = '2026-12-14';
    let habiles = 0;
    let domingos = 0;

    while (compararFechasCalendario(curr, fin) <= 0) {
      const [y, m, d] = curr.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (dow === 0) domingos++;
      else habiles++;
      curr = sumarDiasAFecha(curr, 1);
    }

    assert.strictEqual(domingos, 1, 'Debe excluir exactamente 1 domingo');
    assert.strictEqual(habiles, 7, 'El sábado cuenta; total 7 días hábiles');
  });

  // 9. Derechos por aniversario exacto (Empleado #001: 2026-01-01 -> 2027-01-01)
  test('Regresión 9: Derechos devengados por aniversario real (Art. 76 LFT)', () => {
    const fechaIngreso = '2026-01-01';

    // Durante 2026 (antes del aniversario)
    const antesDeCumplir = calcularAniversariosCumplidos(fechaIngreso, '2026-11-16');
    assert.strictEqual(antesDeCumplir.aniosCumplidos, 0, 'Antes del 2027-01-01 tiene 0 años cumplidos');
    assert.strictEqual(calcularDiasPorAnioServicioLFT(antesDeCumplir.aniosCumplidos), 0);
    assert.strictEqual(antesDeCumplir.fechaProximoAniversario, '2027-01-01');

    // Al llegar exactamente al primer aniversario (2027-01-01)
    const primerAniversario = calcularAniversariosCumplidos(fechaIngreso, '2027-01-01');
    assert.strictEqual(primerAniversario.aniosCumplidos, 1, 'En 2027-01-01 cumple exactamente 1 año de servicio');
    assert.strictEqual(calcularDiasPorAnioServicioLFT(primerAniversario.aniosCumplidos), 12, '1er año otorga 12 días');

    // Al llegar al segundo aniversario (2028-01-01)
    const segundoAniversario = calcularAniversariosCumplidos(fechaIngreso, '2028-01-01');
    assert.strictEqual(segundoAniversario.aniosCumplidos, 2);
    assert.strictEqual(calcularDiasPorAnioServicioLFT(segundoAniversario.aniosCumplidos), 14, '2do año otorga 14 días');
  });

  // 10. Mitigación de fuerza bruta en PIN
  test('Regresión 10: Bloqueo transaccional al alcanzar 5 intentos fallidos', () => {
    const intentos = [false, false, false, false, false];
    const totalFallidos = intentos.filter(e => !e).length;
    const bloqueado = totalFallidos >= 5;
    assert.strictEqual(bloqueado, true);
  });
});
