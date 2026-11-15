import { z } from "zod";

export const empleadoSchema = z.object({
  numero_empleado: z
    .string()
    .trim()
    .min(2, "El número de empleado debe tener al menos 2 caracteres.")
    .max(30, "El número de empleado no puede exceder 30 caracteres.")
    .transform((val) => val.toUpperCase()),
  codigo_biometrico: z
    .string()
    .trim()
    .min(1, "El código biométrico del checador es obligatorio.")
    .max(50, "El código biométrico no puede exceder 50 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(100, "El nombre no puede exceder 100 caracteres."),
  apellidos: z
    .string()
    .trim()
    .min(2, "Los apellidos deben tener al menos 2 caracteres.")
    .max(120, "Los apellidos no pueden exceder 120 caracteres."),
  puesto: z
    .string()
    .trim()
    .min(2, "El puesto u oficio es obligatorio.")
    .max(100, "El puesto no puede exceder 100 caracteres."),
  telefono: z
    .string()
    .trim()
    .max(30, "El teléfono no puede exceder 30 caracteres.")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  nss: z
    .string()
    .trim()
    .regex(/^(\d{11})?$/, "El NSS debe tener 11 dígitos numéricos.")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A])?$/, "El RFC debe tener un formato válido (12 o 13 caracteres).")
    .optional()
    .transform((val) => (val && val.length > 0 ? val.toUpperCase() : null)),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d)?$/, "El CURP debe tener un formato oficial válido de 18 caracteres.")
    .optional()
    .transform((val) => (val && val.length > 0 ? val.toUpperCase() : null)),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .email("El formato de correo electrónico no es válido.")
    .or(z.literal(""))
    .optional()
    .transform((val) => (val && val.length > 0 ? val.toLowerCase() : null)),
  pin: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/, "El PIN de acceso debe ser de exactamente 4 dígitos numéricos.")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  permite_checado_web: z.boolean().default(true),
  fecha_ingreso: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de ingreso debe tener formato YYYY-MM-DD.")
    .optional(),
});

export type EmpleadoInput = z.infer<typeof empleadoSchema>;
