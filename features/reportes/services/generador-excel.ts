import ExcelJS from "exceljs";
import type { ReporteEmpleadoLFT } from "../actions";

export interface MarcajeDetalladoExcel {
  id: string;
  empleadoId: string;
  numeroEmpleado: string;
  nombreCompleto: string;
  puesto: string;
  fecha: string;
  hora: string;
  tipoEvento: string;
  metodoRegistro: string;
  estado: string;
  tieneFoto: boolean;
  esBiometrico: boolean;
  estadoEvidencia: string;
  detalleUbicacion: string;
  hashEvento: string;
  fechaHoraOriginal: string;
  fechaHoraCorregida?: string | null;
  tipoEventoCorregido?: string | null;
  justificacion?: string | null;
  fechaModificacion?: string | null;
}

export interface ModificacionAuditoriaExcel {
  id: string;
  numeroEmpleado: string;
  nombreCompleto: string;
  fechaOriginal: string;
  tipoEventoOriginal: string;
  estado: string;
  fechaCorregida: string | null;
  tipoCorregido: string | null;
  justificacion: string;
  fechaModificacion: string;
}

export interface DatosReporteExcel {
  taller: {
    nombre: string;
    direccion: string;
  };
  fechaInicio: string;
  fechaFin: string;
  fechaEmision: string;
  reportesEmpleados: ReporteEmpleadoLFT[];
  totalesGenerales: {
    totalDias: number;
    totalOrdinarias: number;
    totalDobles: number;
    totalTriples: number;
    totalRetardos: number;
  };
  marcajesDetallados: MarcajeDetalladoExcel[];
  modificaciones?: ModificacionAuditoriaExcel[];
}

const PALETA = {
  headerFill: "FF18181B", // Zinc 900
  headerText: "FFFFFFFF",
  zebraEven: "FFFFFFFF",  // Blanco
  zebraOdd: "FFF8FAFC",   // Slate 50
  borderThin: "FFE2E8F0", // Slate 200
  borderDark: "FF0F172A", // Slate 900
  cardFill: "FFF8FAFC",
  totalFill: "FFF1F5F9",  // Slate 100
  textMuted: "FF71717A",  // Zinc 500
  textDark: "FF18181B",   // Zinc 900
  accentBlue: "FF1E3A8A", // Blue 900
  accentAmber: "FFB45309",// Amber 700
  accentRose: "FFBE123C", // Rose 700
  accentGreen: "FF047857",// Emerald 700
  accentSky: "FF0369A1",  // Sky 700
  accentRed: "FFDC2626",  // Red 600
};

const BORDE_FINO: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: PALETA.borderThin } },
  left: { style: "thin", color: { argb: PALETA.borderThin } },
  bottom: { style: "thin", color: { argb: PALETA.borderThin } },
  right: { style: "thin", color: { argb: PALETA.borderThin } },
};

function obtenerNombreDia(fechaStr: string): string {
  if (!fechaStr) return "";
  const [y, m, d] = fechaStr.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dias[fecha.getUTCDay()] || "";
}

function formatearHoraCorta(isoStr?: string | null): string {
  if (!isoStr) return "--:--";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("es-MX", {
      timeZone: "America/Merida",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

/**
 * Genera el libro Excel (.xlsx) institucional para el reporte de asistencias conforme a la LFT.
 */
export async function generarLibroExcelAsistencias(datos: DatosReporteExcel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOLAN by WYLEN";
  wb.lastModifiedBy = "NOLAN Attendance System";
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  // Conteo de evidencias
  const totalConFoto = datos.marcajesDetallados.filter((m) => m.tieneFoto).length;
  const totalBiometricos = datos.marcajesDetallados.filter((m) => m.esBiometrico).length;
  const totalSinFoto = datos.marcajesDetallados.length - totalConFoto - totalBiometricos;

  // =========================================================================
  // HOJA 1: ASISTENCIAS
  // =========================================================================
  const wsAsis = wb.addWorksheet("ASISTENCIAS", {
    views: [{ state: "frozen", ySplit: 12 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9 as unknown as ExcelJS.PaperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: "12:12",
    },
    headerFooter: {
      oddHeader: `&L&B${datos.taller.nombre}&R&INOLAN by WYLEN`,
      oddFooter: `&LReporte Oficial de Asistencias LFT&C&PPágina &P de &N&RPeríodo: ${datos.fechaInicio} al ${datos.fechaFin}`,
    },
  });

  // Fila 1: Nombre de la Empresa
  wsAsis.mergeCells("A1:T1");
  const c1 = wsAsis.getCell("A1");
  c1.value = datos.taller.nombre.toUpperCase() || "SERVICIO MECÁNICO LÓPEZ";
  c1.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: PALETA.textDark } };
  c1.alignment = { vertical: "middle", horizontal: "left" };
  wsAsis.getRow(1).height = 24;

  // Fila 2: Subtítulo Institucional
  wsAsis.mergeCells("A2:T2");
  const c2 = wsAsis.getCell("A2");
  c2.value = "NOLAN by WYLEN — SISTEMA INTEGRAL DE CONTROL LABORAL Y ASISTENCIA";
  c2.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: PALETA.textMuted } };
  c2.alignment = { vertical: "middle", horizontal: "left" };
  wsAsis.getRow(2).height = 16;

  // Fila 3: Título del Documento
  wsAsis.mergeCells("A3:T3");
  const c3 = wsAsis.getCell("A3");
  c3.value = "REPORTE OFICIAL DE ASISTENCIAS Y CONTROL DE JORNADA";
  c3.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: PALETA.textDark } };
  c3.alignment = { vertical: "middle", horizontal: "left" };
  wsAsis.getRow(3).height = 20;

  // Fila 4: Fundamento Legal
  wsAsis.mergeCells("A4:T4");
  const c4 = wsAsis.getCell("A4");
  c4.value = "Expediente de Inspección Laboral conforme al Art. 132 Fracción XXXIV de la Ley Federal del Trabajo";
  c4.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: PALETA.accentBlue } };
  c4.alignment = { vertical: "middle", horizontal: "left" };
  wsAsis.getRow(4).height = 16;

  // Fila 5: Espaciador
  wsAsis.getRow(5).height = 8;

  // Fila 6: Metadatos del Documento
  wsAsis.mergeCells("A6:T6");
  const c6 = wsAsis.getCell("A6");
  c6.value = `PERÍODO AUDITADO: ${datos.fechaInicio} al ${datos.fechaFin}   |   EMISIÓN: ${datos.fechaEmision}   |   TRABAJADORES INCLUIDOS: ${datos.reportesEmpleados.length}   |   JORNADAS REGISTRADAS: ${datos.totalesGenerales.totalDias}   |   DOMICILIO: ${datos.taller.direccion || "Mérida, Yucatán"}`;
  c6.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: PALETA.textDark } };
  c6.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
  c6.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsAsis.getRow(6).height = 20;

  // Fila 7: Espaciador
  wsAsis.getRow(7).height = 8;

  // Filas 8-10: Tarjetas de Resumen Ejecutivo (KPIs)
  interface KpiCard {
    rango: string;
    titulo: string;
    valor: string;
    colorValor: string;
  }

  const kpis: KpiCard[] = [
    { rango: "A8:C9", titulo: "TOTAL JORNADAS", valor: `${datos.totalesGenerales.totalDias}`, colorValor: PALETA.textDark },
    { rango: "D8:F9", titulo: "HORAS ORDINARIAS", valor: `${datos.totalesGenerales.totalOrdinarias.toFixed(2)}h`, colorValor: PALETA.accentBlue },
    { rango: "G8:I9", titulo: "HRS. EXTRAS DOBLES (LFT)", valor: `${datos.totalesGenerales.totalDobles.toFixed(2)}h`, colorValor: PALETA.accentAmber },
    { rango: "J8:L9", titulo: "HRS. EXTRAS TRIPLES (LFT)", valor: `${datos.totalesGenerales.totalTriples.toFixed(2)}h`, colorValor: PALETA.accentRose },
    { rango: "M8:O9", titulo: "RETARDOS EN PERÍODO", valor: `${datos.totalesGenerales.totalRetardos}`, colorValor: PALETA.accentRed },
    { rango: "P8:R9", titulo: "EVIDENCIA FOTO (SELFIE)", valor: `${totalConFoto}`, colorValor: PALETA.accentGreen },
    { rango: "S8:T9", titulo: "BIOMÉTRICO (HUELLA)", valor: `${totalBiometricos}`, colorValor: PALETA.accentSky },
  ];

  for (const kpi of kpis) {
    wsAsis.mergeCells(kpi.rango);
    const cell = wsAsis.getCell(kpi.rango.split(":")[0]);
    cell.value = {
      richText: [
        { text: `${kpi.titulo}\n`, font: { name: "Segoe UI", size: 7.5, bold: true, color: { argb: PALETA.textMuted } } },
        { text: kpi.valor, font: { name: "Segoe UI", size: 13, bold: true, color: { argb: kpi.colorValor } } },
      ],
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.cardFill } };
    cell.border = BORDE_FINO;
  }
  wsAsis.getRow(8).height = 20;
  wsAsis.getRow(9).height = 20;

  // Fila 11: Espaciador
  wsAsis.getRow(11).height = 10;

  // Fila 12: Encabezados de la Tabla Principal
  const encabezados = [
    { key: "num", header: "#", width: 5, align: "center" },
    { key: "no_emp", header: "No. Empleado", width: 14, align: "center" },
    { key: "nombre", header: "Nombre del Trabajador", width: 28, align: "left" },
    { key: "puesto", header: "Puesto / Rol", width: 20, align: "left" },
    { key: "curp", header: "CURP", width: 20, align: "center" },
    { key: "rfc", header: "RFC", width: 15, align: "center" },
    { key: "nss", header: "NSS", width: 14, align: "center" },
    { key: "fecha", header: "Fecha", width: 13, align: "center" },
    { key: "dia", header: "Día", width: 11, align: "center" },
    { key: "ent", header: "1. Entrada", width: 11, align: "center" },
    { key: "sc", header: "2. Sal. Comida", width: 12, align: "center" },
    { key: "rc", header: "3. Reg. Comida", width: 12, align: "center" },
    { key: "sal", header: "4. Salida Final", width: 12, align: "center" },
    { key: "ord", header: "Horas Ord.", width: 12, align: "right" },
    { key: "dob", header: "Ext. Dobles", width: 12, align: "right" },
    { key: "tri", header: "Ext. Triples", width: 12, align: "right" },
    { key: "ret", header: "Retardo (m)", width: 12, align: "right" },
    { key: "estado", header: "Estado Jornada", width: 15, align: "center" },
    { key: "metodo", header: "Método Registro", width: 18, align: "left" },
    { key: "evidencia", header: "Evidencia Fotográfica", width: 20, align: "center" },
  ];

  const headerRow = wsAsis.getRow(12);
  headerRow.height = 28;

  encabezados.forEach((col, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: PALETA.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.headerFill } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium", color: { argb: PALETA.headerFill } },
      bottom: { style: "medium", color: { argb: PALETA.headerFill } },
      left: { style: "thin", color: { argb: "FF3F3F46" } },
      right: { style: "thin", color: { argb: "FF3F3F46" } },
    };
    wsAsis.getColumn(colNumber).width = col.width;
  });

  // Habilitar autofiltro en la tabla principal
  wsAsis.autoFilter = { from: "A12", to: "T12" };

  // Filas de datos
  let filaActual = 13;
  let correlativo = 1;

  for (const empReporte of datos.reportesEmpleados) {
    const { empleado, jornadas } = empReporte;

    for (const j of jornadas) {
      const row = wsAsis.getRow(filaActual);
      row.height = 20;

      const esPar = correlativo % 2 === 0;
      const bgArgb = esPar ? PALETA.zebraEven : PALETA.zebraOdd;

      const entHora = formatearHoraCorta(j.entrada?.fechaHora);
      const scHora = formatearHoraCorta(j.inicioDescanso?.fechaHora);
      const rcHora = formatearHoraCorta(j.finDescanso?.fechaHora);
      const salHora = formatearHoraCorta(j.salida?.fechaHora);

      let metodoNombre = "—";
      if (j.entrada?.metodoRegistro === "WEB") metodoNombre = "WEB (GPS / Selfie)";
      else if (j.entrada?.metodoRegistro === "DISPOSITIVO") metodoNombre = "Biométrico Huella";
      else if (j.entrada?.metodoRegistro === "MANUAL") metodoNombre = "Ajuste Manual";
      else if (j.entrada?.metodoRegistro) metodoNombre = j.entrada.metodoRegistro;

      let evidenciaTexto = "Sin Evidencia";
      let evidenciaColor = PALETA.textMuted;
      if (j.entrada?.fotoUrl) {
        evidenciaTexto = "Disponible (Selfie)";
        evidenciaColor = PALETA.accentGreen;
      } else if (j.entrada?.metodoRegistro === "DISPOSITIVO") {
        evidenciaTexto = "Biometría Huella";
        evidenciaColor = PALETA.accentSky;
      }

      const valoresFila: { [col: number]: any } = {
        1: correlativo,
        2: empleado.numero_empleado,
        3: `${empleado.nombre} ${empleado.apellidos}`,
        4: empleado.puesto || "—",
        5: empleado.curp || "—",
        6: empleado.rfc || "—",
        7: empleado.nss || "—",
        8: j.fecha,
        9: obtenerNombreDia(j.fecha),
        10: entHora,
        11: scHora,
        12: rcHora,
        13: salHora,
        14: j.horasOrdinarias,
        15: j.horasExtraDobles,
        16: j.horasExtraTriples,
        17: j.minutosRetardo,
        18: j.estadoJornada,
        19: metodoNombre,
        20: evidenciaTexto,
      };

      encabezados.forEach((col, idx) => {
        const colNum = idx + 1;
        const cell = row.getCell(colNum);
        cell.value = valoresFila[colNum];
        cell.font = { name: "Segoe UI", size: 9, color: { argb: PALETA.textDark } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.border = BORDE_FINO;

        // Alineación específica
        if (col.align === "right") {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          if (colNum === 14 || colNum === 15 || colNum === 16) {
            cell.numFmt = "0.00";
            if (colNum === 14 && j.horasOrdinarias > 0) {
              cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.accentBlue } };
            }
            if (colNum === 15 && j.horasExtraDobles > 0) {
              cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.accentAmber } };
            }
            if (colNum === 16 && j.horasExtraTriples > 0) {
              cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.accentRose } };
            }
          } else if (colNum === 17) {
            cell.numFmt = "#,##0";
            if (j.minutosRetardo > 0) {
              cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.accentRed } };
            }
          }
        } else if (col.align === "center") {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (colNum === 20) {
            cell.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: evidenciaColor } };
          }
          if (colNum === 18 && j.estadoJornada === "INCOMPLETA") {
            cell.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: PALETA.accentRed } };
          }
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });

      filaActual++;
      correlativo++;
    }
  }

  // Fila de Totales Generales
  const filaTotales = filaActual;
  wsAsis.mergeCells(`A${filaTotales}:M${filaTotales}`);
  const labelTotales = wsAsis.getCell(`A${filaTotales}`);
  labelTotales.value = "TOTALES DEL PERÍODO AUDITADO:";
  labelTotales.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: PALETA.textDark } };
  labelTotales.alignment = { vertical: "middle", horizontal: "right" };

  const colsTotales = [
    { col: 14, val: datos.totalesGenerales.totalOrdinarias, fmt: "0.00", color: PALETA.accentBlue },
    { col: 15, val: datos.totalesGenerales.totalDobles, fmt: "0.00", color: PALETA.accentAmber },
    { col: 16, val: datos.totalesGenerales.totalTriples, fmt: "0.00", color: PALETA.accentRose },
    { col: 17, val: datos.totalesGenerales.totalRetardos, fmt: "#,##0", color: PALETA.accentRed },
  ];

  const rowTot = wsAsis.getRow(filaTotales);
  rowTot.height = 24;

  for (let c = 1; c <= 20; c++) {
    const cell = rowTot.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.totalFill } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "double", color: { argb: PALETA.borderDark } },
      left: { style: "thin", color: { argb: PALETA.borderThin } },
      right: { style: "thin", color: { argb: PALETA.borderThin } },
    };
  }

  for (const ct of colsTotales) {
    const cell = rowTot.getCell(ct.col);
    cell.value = ct.val;
    cell.numFmt = ct.fmt;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: ct.color } };
    cell.alignment = { vertical: "middle", horizontal: "right" };
  }

  // Bloque Legal de Firmas (Solo si se eligen 1 o 2 empleados; si son más de 2 se omite conforme a la regla ejecutiva)
  const totalEmpleados = datos.reportesEmpleados.length;
  const incluirFirmas = totalEmpleados > 0 && totalEmpleados <= 2;

  if (incluirFirmas) {
    const filaFirma = filaTotales + 3;
    wsAsis.mergeCells(`C${filaFirma}:G${filaFirma}`);
    const f1 = wsAsis.getCell(`C${filaFirma}`);
    f1.value = "_____________________________________________";
    f1.alignment = { vertical: "bottom", horizontal: "center" };

    wsAsis.mergeCells(`L${filaFirma}:P${filaFirma}`);
    const f2 = wsAsis.getCell(`L${filaFirma}`);
    f2.value = "_____________________________________________";
    f2.alignment = { vertical: "bottom", horizontal: "center" };

    const filaTextoFirma = filaFirma + 1;
    wsAsis.mergeCells(`C${filaTextoFirma}:G${filaTextoFirma}`);
    const tf1 = wsAsis.getCell(`C${filaTextoFirma}`);
    const etiquetaFirma =
      totalEmpleados === 1
        ? `Firma: ${datos.reportesEmpleados[0].empleado.nombre} ${datos.reportesEmpleados[0].empleado.apellidos}`
        : "Firma de Conformidad del Trabajador";
    tf1.value = etiquetaFirma;
    tf1.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: PALETA.textDark } };
    tf1.alignment = { vertical: "top", horizontal: "center" };

    wsAsis.mergeCells(`L${filaTextoFirma}:P${filaTextoFirma}`);
    const tf2 = wsAsis.getCell(`L${filaTextoFirma}`);
    tf2.value = `Firma y Sello del Patrón (${datos.taller.nombre})`;
    tf2.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: PALETA.textDark } };
    tf2.alignment = { vertical: "top", horizontal: "center" };
  }

  // =========================================================================
  // HOJA 2: EVIDENCIA DE MARCAJES
  // =========================================================================
  const wsEvid = wb.addWorksheet("EVIDENCIA DE MARCAJES", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9 as unknown as ExcelJS.PaperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: "5:5",
    },
    headerFooter: {
      oddHeader: `&L&B${datos.taller.nombre}&R&ITrazabilidad Biometría y Evidencias`,
      oddFooter: `&LEvidencia de Marcajes NOLAN&C&PPágina &P de &N&RPeríodo: ${datos.fechaInicio} al ${datos.fechaFin}`,
    },
  });

  // Títulos Hoja 2
  wsEvid.mergeCells("A1:J1");
  const ev1 = wsEvid.getCell("A1");
  ev1.value = `${datos.taller.nombre.toUpperCase()} — EXPEDIENTE DE EVIDENCIAS Y TRAZABILIDAD`;
  ev1.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: PALETA.textDark } };
  ev1.alignment = { vertical: "middle", horizontal: "left" };
  wsEvid.getRow(1).height = 22;

  wsEvid.mergeCells("A2:J2");
  const ev2 = wsEvid.getCell("A2");
  ev2.value = "NOLAN by WYLEN — Respaldo Biométrico Facial, Huella Dactilar y Criptográfico (SHA-256)";
  ev2.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.textMuted } };
  ev2.alignment = { vertical: "middle", horizontal: "left" };
  wsEvid.getRow(2).height = 16;

  wsEvid.mergeCells("A3:J3");
  const ev3 = wsEvid.getCell("A3");
  ev3.value = `PERÍODO AUDITADO: ${datos.fechaInicio} al ${datos.fechaFin}   |   TOTAL MARCAJES: ${datos.marcajesDetallados.length}   |   CON FOTOGRAFÍA: ${totalConFoto}   |   BIOMÉTRICO HUELLA: ${totalBiometricos}`;
  ev3.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: PALETA.accentBlue } };
  ev3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
  ev3.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsEvid.getRow(3).height = 18;

  wsEvid.getRow(4).height = 8;

  const encEvid = [
    { header: "#", width: 5, align: "center" },
    { header: "ID Marcaje", width: 14, align: "center" },
    { header: "No. Empleado", width: 14, align: "center" },
    { header: "Nombre del Trabajador", width: 28, align: "left" },
    { header: "Fecha", width: 12, align: "center" },
    { header: "Hora Evento", width: 12, align: "center" },
    { header: "Tipo de Marcaje", width: 16, align: "center" },
    { header: "Método de Registro", width: 20, align: "left" },
    { header: "Disponibilidad de Evidencia", width: 26, align: "center" },
    { header: "Hash de Integridad (SHA-256)", width: 34, align: "center" },
  ];

  const headerEvRow = wsEvid.getRow(5);
  headerEvRow.height = 26;

  encEvid.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = headerEvRow.getCell(colNum);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.headerFill } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDE_FINO;
    wsEvid.getColumn(colNum).width = col.width;
  });

  wsEvid.autoFilter = { from: "A5", to: "J5" };

  let evRowIdx = 6;
  datos.marcajesDetallados.forEach((m, idx) => {
    const row = wsEvid.getRow(evRowIdx);
    row.height = 19;
    const esPar = idx % 2 === 0;
    const bgArgb = esPar ? PALETA.zebraEven : PALETA.zebraOdd;

    let evBadgeColor = PALETA.textMuted;
    if (m.tieneFoto) evBadgeColor = PALETA.accentGreen;
    else if (m.esBiometrico) evBadgeColor = PALETA.accentSky;

    const rowValues = [
      idx + 1,
      m.id.slice(0, 8).toUpperCase(),
      m.numeroEmpleado,
      m.nombreCompleto,
      m.fecha,
      m.hora,
      m.tipoEvento,
      m.metodoRegistro,
      m.estadoEvidencia,
      m.hashEvento || "—",
    ];

    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      cell.border = BORDE_FINO;
      cell.font = { name: "Segoe UI", size: 8.5, color: { argb: PALETA.textDark } };

      if (cIdx === 0 || cIdx === 1 || cIdx === 2 || cIdx === 4 || cIdx === 5 || cIdx === 6) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (cIdx === 8) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: evBadgeColor } };
      } else if (cIdx === 9) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: "Courier New", size: 7.5, color: { argb: "FF475569" } };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });

    evRowIdx++;
  });

  // =========================================================================
  // HOJA 3: HISTORIAL DE MODIFICACIONES
  // =========================================================================
  const wsMod = wb.addWorksheet("HISTORIAL DE MODIFICACIONES", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9 as unknown as ExcelJS.PaperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: "5:5",
    },
    headerFooter: {
      oddHeader: `&L&B${datos.taller.nombre}&R&IAuditoría y Modificaciones LFT`,
      oddFooter: `&LHistorial de Modificaciones NOLAN&C&PPágina &P de &N&RPeríodo: ${datos.fechaInicio} al ${datos.fechaFin}`,
    },
  });

  // Título Hoja 3
  wsMod.mergeCells("A1:I1");
  const mod1 = wsMod.getCell("A1");
  mod1.value = `${datos.taller.nombre.toUpperCase()} — HISTORIAL DE MODIFICACIONES Y JUSTIFICACIONES`;
  mod1.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: PALETA.textDark } };
  mod1.alignment = { vertical: "middle", horizontal: "left" };
  wsMod.getRow(1).height = 22;

  wsMod.mergeCells("A2:I2");
  const mod2 = wsMod.getCell("A2");
  mod2.value = "NOLAN by WYLEN — Trazabilidad de Ajustes Administrativos conforme al Art. 132 Fr. XXXIV LFT";
  mod2.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.textMuted } };
  mod2.alignment = { vertical: "middle", horizontal: "left" };
  wsMod.getRow(2).height = 16;

  wsMod.mergeCells("A3:I3");
  const mod3 = wsMod.getCell("A3");
  const mods = datos.modificaciones || [];
  mod3.value = `PERÍODO AUDITADO: ${datos.fechaInicio} al ${datos.fechaFin}   |   TOTAL AJUSTES REGISTRADOS: ${mods.length}`;
  mod3.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: PALETA.accentBlue } };
  mod3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
  mod3.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsMod.getRow(3).height = 18;

  wsMod.getRow(4).height = 8;

  const encMod = [
    { header: "#", width: 5, align: "center" },
    { header: "ID Asistencia", width: 14, align: "center" },
    { header: "No. Empleado", width: 14, align: "center" },
    { header: "Nombre del Trabajador", width: 26, align: "left" },
    { header: "Fecha / Hora Original", width: 18, align: "center" },
    { header: "Tipo Evento", width: 14, align: "center" },
    { header: "Estado Administrativo", width: 18, align: "center" },
    { header: "Fecha / Hora Corregida", width: 18, align: "center" },
    { header: "Motivo / Justificación Registrada", width: 36, align: "left" },
  ];

  const headerModRow = wsMod.getRow(5);
  headerModRow.height = 26;

  encMod.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = headerModRow.getCell(colNum);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: PALETA.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETA.headerFill } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDE_FINO;
    wsMod.getColumn(colNum).width = col.width;
  });

  wsMod.autoFilter = { from: "A5", to: "I5" };

  if (mods.length === 0) {
    wsMod.mergeCells("A6:I8");
    const emptyCell = wsMod.getCell("A6");
    emptyCell.value =
      "NO SE REGISTRARON MODIFICACIONES MANUALES NI JUSTIFICACIONES EXTRAORDINARIAS DURANTE EL PERÍODO AUDITADO.\nTodos los registros de jornada corresponden al 100% a marcajes originales registrados por el personal.";
    emptyCell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF047857" } };
    emptyCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    emptyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
    emptyCell.border = BORDE_FINO;
  } else {
    let modRowIdx = 6;
    mods.forEach((m, idx) => {
      const row = wsMod.getRow(modRowIdx);
      row.height = 20;
      const esPar = idx % 2 === 0;
      const bgArgb = esPar ? PALETA.zebraEven : PALETA.zebraOdd;

      const rowValues = [
        idx + 1,
        m.id.slice(0, 8).toUpperCase(),
        m.numeroEmpleado,
        m.nombreCompleto,
        m.fechaOriginal,
        m.tipoEventoOriginal,
        m.estado,
        m.fechaCorregida || "—",
        m.justificacion || "Sin justificación registrada",
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = val;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.border = BORDE_FINO;
        cell.font = { name: "Segoe UI", size: 8.5, color: { argb: PALETA.textDark } };

        if (cIdx === 0 || cIdx === 1 || cIdx === 2 || cIdx === 4 || cIdx === 5 || cIdx === 6 || cIdx === 7) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });
      modRowIdx++;
    });
  }

  // Generar buffer XLSX OpenXML
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
