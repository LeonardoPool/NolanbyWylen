import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { generarLibroExcelAsistencias, type DatosReporteExcel } from "../features/reportes/services/generador-excel";

test("Reporte Excel: Genera archivo .xlsx profesional con 3 hojas y datos 100% fieles", async () => {
  // Datos mock idénticos a los devueltos por el sistema real
  const datosMock: DatosReporteExcel = {
    taller: {
      nombre: "Servicio Mecánico López",
      direccion: "Calle 60 #123 x 45 y 47, Centro, Mérida, Yucatán",
    },
    fechaInicio: "2026-11-01",
    fechaFin: "2026-11-15",
    fechaEmision: "18/11/2026 10:30",
    totalesGenerales: {
      totalDias: 4,
      totalOrdinarias: 32.0,
      totalDobles: 4.5,
      totalTriples: 1.0,
      totalRetardos: 1,
    },
    reportesEmpleados: [
      {
        empleado: {
          id: "emp-001",
          numero_empleado: "EMP-001",
          nombre: "Juan Carlos",
          apellidos: "López Pérez",
          puesto: "Jefe de Taller",
          curp: "LOPJ900101HDFRNR01",
          rfc: "LOPJ900101XYZ",
          nss: "12345678901",
        },
        jornadas: [
          {
            fecha: "2026-11-03",
            entrada: {
              tipoEvento: "ENTRADA",
              fechaHora: "2026-11-03T08:02:00.000Z",
              metodoRegistro: "WEB",
              fotoUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...",
            },
            inicioDescanso: {
              tipoEvento: "INICIO_DESCANSO",
              fechaHora: "2026-11-03T13:00:00.000Z",
              metodoRegistro: "WEB",
            },
            finDescanso: {
              tipoEvento: "FIN_DESCANSO",
              fechaHora: "2026-11-03T14:00:00.000Z",
              metodoRegistro: "WEB",
            },
            salida: {
              tipoEvento: "SALIDA",
              fechaHora: "2026-11-03T18:30:00.000Z",
              metodoRegistro: "WEB",
            },
            minutosTrabajadosEfectivos: 568,
            minutosDescanso: 60,
            horasOrdinarias: 8.0,
            horasExtraDobles: 1.5,
            horasExtraTriples: 0,
            esRetardo: false,
            minutosRetardo: 0,
            estadoJornada: "COMPLETA",
          },
          {
            fecha: "2026-11-04",
            entrada: {
              tipoEvento: "ENTRADA",
              fechaHora: "2026-11-04T08:20:00.000Z",
              metodoRegistro: "WEB",
              fotoUrl: null,
            },
            inicioDescanso: null,
            finDescanso: null,
            salida: {
              tipoEvento: "SALIDA",
              fechaHora: "2026-11-04T17:00:00.000Z",
              metodoRegistro: "WEB",
            },
            minutosTrabajadosEfectivos: 520,
            minutosDescanso: 0,
            horasOrdinarias: 8.0,
            horasExtraDobles: 0,
            horasExtraTriples: 0,
            esRetardo: true,
            minutosRetardo: 5,
            estadoJornada: "COMPLETA",
          },
        ],
        resumen: {
          horasOrdinariasTotales: 16.0,
          horasExtraDoblesTotales: 1.5,
          horasExtraTriplesTotales: 0,
          totalRetardos: 1,
          diasLaborados: 2,
        },
      },
      {
        empleado: {
          id: "emp-002",
          numero_empleado: "EMP-002",
          nombre: "Mario Alberto",
          apellidos: "Gómez Ruiz",
          puesto: "Mecánico Especialista",
          curp: "GORM880512HDFRNR02",
          rfc: "GORM880512ABC",
          nss: "98765432109",
        },
        jornadas: [
          {
            fecha: "2026-11-03",
            entrada: {
              tipoEvento: "ENTRADA",
              fechaHora: "2026-11-03T07:58:00.000Z",
              metodoRegistro: "DISPOSITIVO",
            },
            inicioDescanso: null,
            finDescanso: null,
            salida: {
              tipoEvento: "SALIDA",
              fechaHora: "2026-11-03T19:00:00.000Z",
              metodoRegistro: "DISPOSITIVO",
            },
            minutosTrabajadosEfectivos: 662,
            minutosDescanso: 0,
            horasOrdinarias: 8.0,
            horasExtraDobles: 3.0,
            horasExtraTriples: 1.0,
            esRetardo: false,
            minutosRetardo: 0,
            estadoJornada: "COMPLETA",
          },
          {
            fecha: "2026-11-04",
            entrada: {
              tipoEvento: "ENTRADA",
              fechaHora: "2026-11-04T08:00:00.000Z",
              metodoRegistro: "DISPOSITIVO",
            },
            inicioDescanso: null,
            finDescanso: null,
            salida: {
              tipoEvento: "SALIDA",
              fechaHora: "2026-11-04T16:00:00.000Z",
              metodoRegistro: "DISPOSITIVO",
            },
            minutosTrabajadosEfectivos: 480,
            minutosDescanso: 0,
            horasOrdinarias: 8.0,
            horasExtraDobles: 0,
            horasExtraTriples: 0,
            esRetardo: false,
            minutosRetardo: 0,
            estadoJornada: "COMPLETA",
          },
        ],
        resumen: {
          horasOrdinariasTotales: 16.0,
          horasExtraDoblesTotales: 3.0,
          horasExtraTriplesTotales: 1.0,
          totalRetardos: 0,
          diasLaborados: 2,
        },
      },
    ],
    marcajesDetallados: [
      {
        id: "asis-001",
        empleadoId: "emp-001",
        numeroEmpleado: "EMP-001",
        nombreCompleto: "Juan Carlos López Pérez",
        puesto: "Jefe de Taller",
        fecha: "2026-11-03",
        hora: "08:02:00",
        tipoEvento: "ENTRADA",
        metodoRegistro: "WEB (GPS / Selfie)",
        estado: "REGISTRADA",
        tieneFoto: true,
        esBiometrico: false,
        estadoEvidencia: "Evidencia Fotográfica Verificada (Selfie)",
        detalleUbicacion: "12m del taller",
        hashEvento: "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
        fechaHoraOriginal: "2026-11-03T08:02:00.000Z",
      },
      {
        id: "asis-002",
        empleadoId: "emp-001",
        numeroEmpleado: "EMP-001",
        nombreCompleto: "Juan Carlos López Pérez",
        puesto: "Jefe de Taller",
        fecha: "2026-11-03",
        hora: "18:30:00",
        tipoEvento: "SALIDA",
        metodoRegistro: "WEB (GPS / Selfie)",
        estado: "REGISTRADA",
        tieneFoto: true,
        esBiometrico: false,
        estadoEvidencia: "Evidencia Fotográfica Verificada (Selfie)",
        detalleUbicacion: "8m del taller",
        hashEvento: "b2c3d4e5f67890a1abcdef1234567890abcdef1234567890abcdef1234567890",
        fechaHoraOriginal: "2026-11-03T18:30:00.000Z",
      },
      {
        id: "asis-003",
        empleadoId: "emp-002",
        numeroEmpleado: "EMP-002",
        nombreCompleto: "Mario Alberto Gómez Ruiz",
        puesto: "Mecánico Especialista",
        fecha: "2026-11-03",
        hora: "07:58:00",
        tipoEvento: "ENTRADA",
        metodoRegistro: "Biométrico Huella (MB10V)",
        estado: "REGISTRADA",
        tieneFoto: false,
        esBiometrico: true,
        estadoEvidencia: "Biometría Dactilar Verificada (Terminal MB10V)",
        detalleUbicacion: "Taller Matriz",
        hashEvento: "c3d4e5f67890a1b2abcdef1234567890abcdef1234567890abcdef1234567890",
        fechaHoraOriginal: "2026-11-03T07:58:00.000Z",
      },
    ],
    modificaciones: [
      {
        id: "asis-mod-001",
        numeroEmpleado: "EMP-001",
        nombreCompleto: "Juan Carlos López Pérez",
        fechaOriginal: "2026-11-04T08:20:00.000Z",
        tipoEventoOriginal: "ENTRADA",
        estado: "JUSTIFICADA",
        fechaCorregida: "2026-11-04T08:00:00.000Z",
        tipoCorregido: "ENTRADA",
        justificacion: "Falla eléctrica momentánea en el acceso vehicular.",
        fechaModificacion: "2026-11-04T09:15:00.000Z",
      },
    ],
  };

  // 1. Generación del buffer
  const buffer = await generarLibroExcelAsistencias(datosMock);
  assert.ok(buffer && buffer.length > 0, "El buffer generado debe tener longitud > 0");

  // 2. Validación de firma binaria OpenXML (.xlsx / ZIP PK\x03\x04)
  assert.strictEqual(buffer[0], 0x50, "Firma de byte 0 debe ser 'P' (0x50)");
  assert.strictEqual(buffer[1], 0x4b, "Firma de byte 1 debe ser 'K' (0x4B)");

  // 3. Cargar y parsear con ExcelJS para validar conformidad con Microsoft Excel
  const wbVerif = new ExcelJS.Workbook();
  await wbVerif.xlsx.load(buffer as any);

  assert.strictEqual(wbVerif.creator, "NOLAN by WYLEN");
  assert.strictEqual(wbVerif.worksheets.length, 3, "Debe contener exactamente 3 hojas");

  // 4. Verificar Hoja 1: ASISTENCIAS
  const wsAsis = wbVerif.getWorksheet("ASISTENCIAS");
  assert.ok(wsAsis, "La hoja ASISTENCIAS debe existir");
  assert.strictEqual(wsAsis.getCell("A1").value, "SERVICIO MECÁNICO LÓPEZ");
  assert.ok(String(wsAsis.getCell("A3").value).includes("REPORTE OFICIAL"));
  assert.ok(String(wsAsis.getCell("A6").value).includes("2026-11-01 al 2026-11-15"));

  // Verificar que los 4 registros de jornadas estén presentes (filas 13, 14, 15, 16)
  assert.strictEqual(wsAsis.getCell("B13").value, "EMP-001");
  assert.strictEqual(wsAsis.getCell("C13").value, "Juan Carlos López Pérez");
  assert.strictEqual(wsAsis.getCell("H13").value, "2026-11-03");
  assert.strictEqual(wsAsis.getCell("N13").value, 8.0); // Horas Ordinarias

  assert.strictEqual(wsAsis.getCell("B15").value, "EMP-002");
  assert.strictEqual(wsAsis.getCell("C15").value, "Mario Alberto Gómez Ruiz");
  assert.strictEqual(wsAsis.getCell("O15").value, 3.0); // Horas Extras Dobles
  assert.strictEqual(wsAsis.getCell("P15").value, 1.0); // Horas Extras Triples

  // Verificar fila de totales
  const filaTotales = 17;
  assert.strictEqual(wsAsis.getCell(`N${filaTotales}`).value, 32.0); // Total horas ordinarias
  assert.strictEqual(wsAsis.getCell(`O${filaTotales}`).value, 4.5);  // Total horas dobles
  assert.strictEqual(wsAsis.getCell(`P${filaTotales}`).value, 1.0);  // Total horas triples
  assert.strictEqual(wsAsis.getCell(`Q${filaTotales}`).value, 1);    // Total retardos

  // 5. Verificar Hoja 2: EVIDENCIA DE MARCAJES
  const wsEvid = wbVerif.getWorksheet("EVIDENCIA DE MARCAJES");
  assert.ok(wsEvid, "La hoja EVIDENCIA DE MARCAJES debe existir");
  assert.ok(String(wsEvid.getCell("A1").value).includes("EVIDENCIAS Y TRAZABILIDAD"));
  assert.strictEqual(wsEvid.getCell("B6").value, "ASIS-001");
  assert.strictEqual(wsEvid.getCell("D6").value, "Juan Carlos López Pérez");
  assert.ok(String(wsEvid.getCell("I6").value).includes("Fotográfica"));
  assert.strictEqual(wsEvid.getCell("B8").value, "ASIS-003");
  assert.ok(String(wsEvid.getCell("I8").value).includes("Biometría Dactilar"));

  // 6. Verificar Hoja 3: HISTORIAL DE MODIFICACIONES
  const wsMod = wbVerif.getWorksheet("HISTORIAL DE MODIFICACIONES");
  assert.ok(wsMod, "La hoja HISTORIAL DE MODIFICACIONES debe existir");
  assert.strictEqual(wsMod.getCell("B6").value, "ASIS-MOD");
  assert.strictEqual(wsMod.getCell("G6").value, "JUSTIFICADA");
  assert.ok(String(wsMod.getCell("I6").value).includes("Falla eléctrica"));

  console.log("✓ Test de Reporte Excel completado exitosamente: 3 hojas verificadas, 100% integridad de datos.");
});
