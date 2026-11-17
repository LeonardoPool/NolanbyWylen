import { z } from "zod";
import {
  obtenerFechaHoyMerida,
  compararFechasCalendario,
  calcularDiasEntreFechas,
  sumarDiasAFecha,
} from "../utils/fechas-laborales";

export const TipoIncidenciaEnum = z.enum([
  "VACACIONES",
  "FALTA_JUSTIFICADA",
  "PERMISO",
  "INCAPACIDAD",
]);

export type TipoIncidencia = z.infer<typeof TipoIncidenciaEnum>;

export const IncidenciaFormSchema = z
  .object({
    empleadoId: z.string().uuid({ message: "Identificador de empleado no válido" }),
    tipo: TipoIncidenciaEnum,
    fechaInicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Formato de fecha de inicio inválido (debe ser YYYY-MM-DD)" }),
    fechaFin: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Formato de fecha fin inválido (debe ser YYYY-MM-DD)" }),
    motivo: z
      .string()
      .trim()
      .min(5, { message: "El motivo debe contener al menos 5 caracteres descriptivos." })
      .max(500, { message: "El motivo no puede exceder los 500 caracteres." }),
    consentimientoSalud: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hoy = obtenerFechaHoyMerida();

    // 1. Validar que fechaFin no sea anterior a fechaInicio
    if (compararFechasCalendario(data.fechaFin, data.fechaInicio) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaFin"],
        message: "La fecha final no puede ser anterior a la fecha inicial.",
      });
      return;
    }

    // 2. Límite máximo razonable de solicitud (60 días continuos)
    const duracionDias = calcularDiasEntreFechas(data.fechaInicio, data.fechaFin);
    if (duracionDias > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaFin"],
        message: `El periodo solicitado (${duracionDias} días) excede el máximo permitido de 60 días continuos.`,
      });
    }

    // 3. Reglas temporales por tipo de incidencia
    if (data.tipo === "INCAPACIDAD") {
      // Para incapacidad médica IMSS, se permiten fechas retroactivas de hasta 30 días
      const limiteRetroactivo = sumarDiasAFecha(hoy, -30);
      if (compararFechasCalendario(data.fechaInicio, limiteRetroactivo) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechaInicio"],
          message: "Las solicitudes de incapacidad médica no pueden exceder 30 días de retroactividad.",
        });
      }
    } else {
      // Para Vacaciones, Permisos y Faltas justificadas: la fecha inicial debe ser hoy o futura
      if (compararFechasCalendario(data.fechaInicio, hoy) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechaInicio"],
          message: "Para este tipo de solicitud no se permiten fechas pasadas. La fecha mínima es hoy.",
        });
      }
    }
  });

/**
 * Valida los magic numbers del archivo en buffer para prevenir malware y suplantación de extensiones.
 */
export function validarMagicBytesArchivo(buffer: Buffer): {
  valido: boolean;
  mimeDetectado?: string;
  extensionSugerida?: string;
  error?: string;
} {
  if (!buffer || buffer.length < 4) {
    return { valido: false, error: "El archivo está vacío o dañado." };
  }

  // 1. JPG / JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valido: true, mimeDetectado: "image/jpeg", extensionSugerida: "jpg" };
  }

  // 2. PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { valido: true, mimeDetectado: "image/png", extensionSugerida: "png" };
  }

  // 3. PDF: 25 50 44 46 (%PDF)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valido: true, mimeDetectado: "application/pdf", extensionSugerida: "pdf" };
  }

  return {
    valido: false,
    error: "Formato no permitido o archivo camuflado. Solo se admiten JPG, PNG y PDF válidos.",
  };
}
