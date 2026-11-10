export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Definición de tipos de base de datos para NOLAN by WYLEN (PostgreSQL / Supabase) v2.0.
 * Refleja exactamente la migración: 20261109000002_estructura_definitiva_nolan_v2.sql
 */
export interface Database {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre: string;
          apellidos: string;
          rol: "ADMINISTRADOR" | "SUPERVISOR";
          activo: boolean;
          fecha_creacion: string;
          fecha_actualizacion: string;
        };
        Insert: {
          id: string;
          nombre: string;
          apellidos: string;
          rol?: "ADMINISTRADOR" | "SUPERVISOR";
          activo?: boolean;
          fecha_creacion?: string;
          fecha_actualizacion?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          apellidos?: string;
          rol?: "ADMINISTRADOR" | "SUPERVISOR";
          activo?: boolean;
          fecha_creacion?: string;
          fecha_actualizacion?: string;
        };
      };
      empleados: {
        Row: {
          id: string;
          numero_empleado: string;
          codigo_biometrico: string;
          nombre: string;
          apellidos: string;
          puesto: string;
          telefono: string | null;
          activo: boolean;
          fecha_ingreso: string;
          fecha_creacion: string;
          fecha_actualizacion: string;
        };
        Insert: {
          id?: string;
          numero_empleado: string;
          codigo_biometrico: string;
          nombre: string;
          apellidos: string;
          puesto: string;
          telefono?: string | null;
          activo?: boolean;
          fecha_ingreso?: string;
          fecha_creacion?: string;
          fecha_actualizacion?: string;
        };
        Update: {
          id?: string;
          numero_empleado?: string;
          codigo_biometrico?: string;
          nombre?: string;
          apellidos?: string;
          puesto?: string;
          telefono?: string | null;
          activo?: boolean;
          fecha_ingreso?: string;
          fecha_creacion?: string;
          fecha_actualizacion?: string;
        };
      };
      dispositivos: {
        Row: {
          id: string;
          identificador_serie: string;
          nombre: string;
          modelo: string;
          direccion_ip: string | null;
          token_hash: string;
          activo: boolean;
          fecha_baja: string | null;
          ultimo_contacto: string | null;
          fecha_creacion: string;
        };
        Insert: {
          id?: string;
          identificador_serie: string;
          nombre: string;
          modelo?: string;
          direccion_ip?: string | null;
          token_hash: string;
          activo?: boolean;
          fecha_baja?: string | null;
          ultimo_contacto?: string | null;
          fecha_creacion?: string;
        };
        Update: {
          id?: string;
          identificador_serie?: string;
          nombre?: string;
          modelo?: string;
          direccion_ip?: string | null;
          token_hash?: string;
          activo?: boolean;
          fecha_baja?: string | null;
          ultimo_contacto?: string | null;
          fecha_creacion?: string;
        };
      };
      asistencias: {
        Row: {
          id: string;
          empleado_id: string;
          dispositivo_id: string | null;
          identificador_evento_dispositivo: string | null;
          hash_evento: string;
          fecha_hora: string;
          tipo_evento_original: "ENTRADA" | "SALIDA" | "MARCAJE";
          metodo_registro: "DISPOSITIVO" | "MANUAL" | "SISTEMA";
          metadatos_origen: Json | null;
          estado: "REGISTRADA" | "JUSTIFICADA" | "CORREGIDA" | "ANULADA";
          fecha_hora_corregida: string | null;
          tipo_evento_corregido: "ENTRADA" | "SALIDA" | null;
          justificacion: string | null;
          perfil_auditor_id: string | null;
          fecha_modificacion: string | null;
          fecha_creacion: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          dispositivo_id?: string | null;
          identificador_evento_dispositivo?: string | null;
          hash_evento: string;
          fecha_hora: string;
          tipo_evento_original?: "ENTRADA" | "SALIDA" | "MARCAJE";
          metodo_registro?: "DISPOSITIVO" | "MANUAL" | "SISTEMA";
          metadatos_origen?: Json | null;
          estado?: "REGISTRADA" | "JUSTIFICADA" | "CORREGIDA" | "ANULADA";
          fecha_hora_corregida?: string | null;
          tipo_evento_corregido?: "ENTRADA" | "SALIDA" | null;
          justificacion?: string | null;
          perfil_auditor_id?: string | null;
          fecha_modificacion?: string | null;
          fecha_creacion?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          dispositivo_id?: string | null;
          identificador_evento_dispositivo?: string | null;
          hash_evento?: string;
          fecha_hora?: string;
          tipo_evento_original?: "ENTRADA" | "SALIDA" | "MARCAJE";
          metodo_registro?: "DISPOSITIVO" | "MANUAL" | "SISTEMA";
          metadatos_origen?: Json | null;
          estado?: "REGISTRADA" | "JUSTIFICADA" | "CORREGIDA" | "ANULADA";
          fecha_hora_corregida?: string | null;
          tipo_evento_corregido?: "ENTRADA" | "SALIDA" | null;
          justificacion?: string | null;
          perfil_auditor_id?: string | null;
          fecha_modificacion?: string | null;
          fecha_creacion?: string;
        };
      };
      registros_auditoria: {
        Row: {
          id: string;
          perfil_id: string | null;
          accion: string;
          tabla_afectada: string;
          registro_afectado_id: string | null;
          valores_previos: Json | null;
          valores_nuevos: Json | null;
          direccion_ip: string | null;
          fecha_creacion: string;
        };
        Insert: {
          id?: string;
          perfil_id?: string | null;
          accion: string;
          tabla_afectada: string;
          registro_afectado_id?: string | null;
          valores_previos?: Json | null;
          valores_nuevos?: Json | null;
          direccion_ip?: string | null;
          fecha_creacion?: string;
        };
        Update: {
          id?: string;
          perfil_id?: string | null;
          accion?: string;
          tabla_afectada?: string;
          registro_afectado_id?: string | null;
          valores_previos?: Json | null;
          valores_nuevos?: Json | null;
          direccion_ip?: string | null;
          fecha_creacion?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      es_administrador: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
