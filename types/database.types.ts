export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Definición de tipos de base de datos para NOLAN by WYLEN (PostgreSQL / Supabase) v2.1.
 * Refleja migraciones:
 * - 20261109000002_estructura_definitiva_nolan_v2.sql
 * - 20261114000003_checado_online_e_identidad.sql
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
        Relationships: [];
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
          nss: string | null;
          rfc: string | null;
          curp: string | null;
          correo: string | null;
          pin: string | null;
          permite_checado_web: boolean;
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
          nss?: string | null;
          rfc?: string | null;
          curp?: string | null;
          correo?: string | null;
          pin?: string | null;
          permite_checado_web?: boolean;
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
          nss?: string | null;
          rfc?: string | null;
          curp?: string | null;
          correo?: string | null;
          pin?: string | null;
          permite_checado_web?: boolean;
          activo?: boolean;
          fecha_ingreso?: string;
          fecha_creacion?: string;
          fecha_actualizacion?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      asistencias: {
        Row: {
          id: string;
          empleado_id: string;
          dispositivo_id: string | null;
          identificador_evento_dispositivo: string | null;
          hash_evento: string;
          fecha_hora: string;
          tipo_evento_original:
            | "ENTRADA"
            | "SALIDA"
            | "MARCAJE"
            | "INICIO_DESCANSO"
            | "FIN_DESCANSO";
          metodo_registro: "DISPOSITIVO" | "MANUAL" | "SISTEMA" | "WEB";
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
          tipo_evento_original?:
            | "ENTRADA"
            | "SALIDA"
            | "MARCAJE"
            | "INICIO_DESCANSO"
            | "FIN_DESCANSO";
          metodo_registro?: "DISPOSITIVO" | "MANUAL" | "SISTEMA" | "WEB";
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
          tipo_evento_original?:
            | "ENTRADA"
            | "SALIDA"
            | "MARCAJE"
            | "INICIO_DESCANSO"
            | "FIN_DESCANSO";
          metodo_registro?: "DISPOSITIVO" | "MANUAL" | "SISTEMA" | "WEB";
          metadatos_origen?: Json | null;
          estado?: "REGISTRADA" | "JUSTIFICADA" | "CORREGIDA" | "ANULADA";
          fecha_hora_corregida?: string | null;
          tipo_evento_corregido?: "ENTRADA" | "SALIDA" | null;
          justificacion?: string | null;
          perfil_auditor_id?: string | null;
          fecha_modificacion?: string | null;
          fecha_creacion?: string;
        };
        Relationships: [];
      };
      configuracion_taller: {
        Row: {
          id: string;
          nombre_taller: string;
          direccion_taller: string;
          checado_web_habilitado: boolean;
          latitud: number;
          longitud: number;
          radio_tolerancia_metros: number;
          dia_descanso_semanal: number;
          fecha_actualizacion: string;
        };
        Insert: {
          id?: string;
          nombre_taller?: string;
          direccion_taller?: string;
          checado_web_habilitado?: boolean;
          latitud?: number;
          longitud?: number;
          radio_tolerancia_metros?: number;
          dia_descanso_semanal?: number;
          fecha_actualizacion?: string;
        };
        Update: {
          id?: string;
          nombre_taller?: string;
          direccion_taller?: string;
          checado_web_habilitado?: boolean;
          latitud?: number;
          longitud?: number;
          radio_tolerancia_metros?: number;
          dia_descanso_semanal?: number;
          fecha_actualizacion?: string;
        };
        Relationships: [];
      };
      incidencias_empleado: {
        Row: {
          id: string;
          empleado_id: string;
          tipo: "FALTA_JUSTIFICADA" | "VACACIONES" | "PERMISO" | "INCAPACIDAD";
          fecha_inicio: string;
          fecha_fin: string;
          motivo: string;
          estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
          respuesta_administrador: string | null;
          perfil_revisor_id: string | null;
          fecha_creacion: string;
          fecha_resolucion: string | null;
          extemporanea: boolean;
          dias_solicitados_efectivos: number;
          documento_path: string | null;
          documento_nombre_original: string | null;
          documento_hash_sha256: string | null;
          documento_tamano_bytes: number | null;
          documento_mime: string | null;
          documento_estado: "SIN_DOCUMENTO" | "PENDIENTE_REVISION" | "ACEPTADO" | "RECHAZADO";
          documento_revisado_por: string | null;
          documento_revisado_en: string | null;
          documento_comentario: string | null;
          consentimiento_salud_aceptado: boolean;
          consentimiento_salud_fecha: string | null;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          tipo: "FALTA_JUSTIFICADA" | "VACACIONES" | "PERMISO" | "INCAPACIDAD";
          fecha_inicio: string;
          fecha_fin: string;
          motivo: string;
          estado?: "PENDIENTE" | "APROBADA" | "RECHAZADA";
          respuesta_administrador?: string | null;
          perfil_revisor_id?: string | null;
          fecha_creacion?: string;
          fecha_resolucion?: string | null;
          extemporanea?: boolean;
          dias_solicitados_efectivos?: number;
          documento_path?: string | null;
          documento_nombre_original?: string | null;
          documento_hash_sha256?: string | null;
          documento_tamano_bytes?: number | null;
          documento_mime?: string | null;
          documento_estado?: "SIN_DOCUMENTO" | "PENDIENTE_REVISION" | "ACEPTADO" | "RECHAZADO";
          documento_revisado_por?: string | null;
          documento_revisado_en?: string | null;
          documento_comentario?: string | null;
          consentimiento_salud_aceptado?: boolean;
          consentimiento_salud_fecha?: string | null;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          tipo?: "FALTA_JUSTIFICADA" | "VACACIONES" | "PERMISO" | "INCAPACIDAD";
          fecha_inicio?: string;
          fecha_fin?: string;
          motivo?: string;
          estado?: "PENDIENTE" | "APROBADA" | "RECHAZADA";
          respuesta_administrador?: string | null;
          perfil_revisor_id?: string | null;
          fecha_creacion?: string;
          fecha_resolucion?: string | null;
          extemporanea?: boolean;
          dias_solicitados_efectivos?: number;
          documento_path?: string | null;
          documento_nombre_original?: string | null;
          documento_hash_sha256?: string | null;
          documento_tamano_bytes?: number | null;
          documento_mime?: string | null;
          documento_estado?: "SIN_DOCUMENTO" | "PENDIENTE_REVISION" | "ACEPTADO" | "RECHAZADO";
          documento_revisado_por?: string | null;
          documento_revisado_en?: string | null;
          documento_comentario?: string | null;
          consentimiento_salud_aceptado?: boolean;
          consentimiento_salud_fecha?: string | null;
        };
        Relationships: [];
      };
      ubicaciones_extraordinarias: {
        Row: {
          id: string;
          empleado_id: string;
          motivo: string;
          nombre_lugar: string;
          direccion: string | null;
          latitud: number;
          longitud: number;
          radio_tolerancia_metros: number;
          fecha_inicio: string;
          fecha_fin: string;
          activo: boolean;
          creado_por: string | null;
          fecha_creacion: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          motivo: string;
          nombre_lugar: string;
          direccion?: string | null;
          latitud: number;
          longitud: number;
          radio_tolerancia_metros?: number;
          fecha_inicio?: string;
          fecha_fin: string;
          activo?: boolean;
          creado_por?: string | null;
          fecha_creacion?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          motivo?: string;
          nombre_lugar?: string;
          direccion?: string | null;
          latitud?: number;
          longitud?: number;
          radio_tolerancia_metros?: number;
          fecha_inicio?: string;
          fecha_fin?: string;
          activo?: boolean;
          creado_por?: string | null;
          fecha_creacion?: string;
        };
        Relationships: [];
      };
      intentos_acceso_pin: {
        Row: {
          id: string;
          identificador: string;
          ip_origen: string;
          exitoso: boolean;
          fecha_intento: string;
        };
        Insert: {
          id?: string;
          identificador: string;
          ip_origen?: string;
          exitoso?: boolean;
          fecha_intento?: string;
        };
        Update: {
          id?: string;
          identificador?: string;
          ip_origen?: string;
          exitoso?: boolean;
          fecha_intento?: string;
        };
        Relationships: [];
      };
      politicas_vacaciones: {
        Row: {
          id: string;
          anio_servicio_desde: number;
          anio_servicio_hasta: number;
          dias_vacaciones: number;
          vigente_desde: string;
          vigente_hasta: string | null;
          activo: boolean;
        };
        Insert: {
          id?: string;
          anio_servicio_desde: number;
          anio_servicio_hasta: number;
          dias_vacaciones: number;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          activo?: boolean;
        };
        Update: {
          id?: string;
          anio_servicio_desde?: number;
          anio_servicio_hasta?: number;
          dias_vacaciones?: number;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      dias_festivos_oficiales: {
        Row: {
          id: string;
          fecha: string;
          descripcion: string;
          irrenunciable: boolean;
        };
        Insert: {
          id?: string;
          fecha: string;
          descripcion: string;
          irrenunciable?: boolean;
        };
        Update: {
          id?: string;
          fecha?: string;
          descripcion?: string;
          irrenunciable?: boolean;
        };
        Relationships: [];
      };
      ajustes_vacaciones: {
        Row: {
          id: string;
          empleado_id: string;
          tipo: "CARGA_HISTORICA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
          dias: number;
          motivo: string;
          autor_perfil_id: string | null;
          fecha_creacion: string;
        };
        Insert: {
          id?: string;
          empleado_id: string;
          tipo: "CARGA_HISTORICA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
          dias: number;
          motivo: string;
          autor_perfil_id?: string | null;
          fecha_creacion?: string;
        };
        Update: {
          id?: string;
          empleado_id?: string;
          tipo?: "CARGA_HISTORICA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
          dias?: number;
          motivo?: string;
          autor_perfil_id?: string | null;
          fecha_creacion?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      es_administrador: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      dias_habiles_vacaciones: {
        Args: {
          fecha_inicio: string;
          fecha_fin: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
