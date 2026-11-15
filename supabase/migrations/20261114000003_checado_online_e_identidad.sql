-- =============================================================================
-- PROYECTO: NOLAN by WYLEN
-- CLIENTE: Servicio Mecánico López
-- MIGRACIÓN: 20261114000003_checado_online_e_identidad.sql
-- VERSIÓN: 2.1.0
-- DESCRIPCIÓN: Extensión para datos fiscales (NSS, RFC, CURP), credenciales de
--              checado online (PIN 4 dígitos, Correo), configuración de geocerca
--              del taller e incidencias (vacaciones, permisos, faltas).
-- =============================================================================

-- =============================================================================
-- 1. AMPLIACIÓN DE TABLA: empleados (Identidad y acceso para checado web)
-- =============================================================================
ALTER TABLE public.empleados 
    ADD COLUMN IF NOT EXISTS nss VARCHAR(15),
    ADD COLUMN IF NOT EXISTS rfc VARCHAR(13),
    ADD COLUMN IF NOT EXISTS curp VARCHAR(18),
    ADD COLUMN IF NOT EXISTS correo VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pin VARCHAR(10),
    ADD COLUMN IF NOT EXISTS permite_checado_web BOOLEAN NOT NULL DEFAULT true;

-- Índices de búsqueda para acceso del empleado
CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_curp 
    ON public.empleados(curp) WHERE curp IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empleados_correo 
    ON public.empleados(correo) WHERE correo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empleados_rfc 
    ON public.empleados(rfc) WHERE rfc IS NOT NULL;

-- =============================================================================
-- 2. TABLA: configuracion_taller (Geolocalización, geocerca y switch de checado)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.configuracion_taller (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_taller VARCHAR(120) NOT NULL DEFAULT 'Servicio Mecánico López',
    direccion_taller TEXT NOT NULL DEFAULT 'Taller Mecánico Principal',
    checado_web_habilitado BOOLEAN NOT NULL DEFAULT true,
    latitud NUMERIC(10, 7) NOT NULL DEFAULT 19.432608,
    longitud NUMERIC(10, 7) NOT NULL DEFAULT -99.133209,
    radio_tolerancia_metros INTEGER NOT NULL DEFAULT 150,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.configuracion_taller IS 'Parámetros del taller, geocerca para marcaje móvil y switch de checado online';

-- Insertar configuración inicial por defecto si no existe
INSERT INTO public.configuracion_taller (
    id, nombre_taller, direccion_taller, checado_web_habilitado, latitud, longitud, radio_tolerancia_metros
)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Servicio Mecánico López',
    'Av. Principal Taller Mecánico',
    true,
    19.4326080,
    -99.1332090,
    150
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_taller LIMIT 1);

-- =============================================================================
-- 3. AJUSTES EN ASISTENCIAS (Soporte para descanso y origen web)
-- =============================================================================
ALTER TABLE public.asistencias 
    DROP CONSTRAINT IF EXISTS asistencias_tipo_evento_original_check;

ALTER TABLE public.asistencias 
    ADD CONSTRAINT asistencias_tipo_evento_original_check 
    CHECK (tipo_evento_original IN ('ENTRADA', 'SALIDA', 'MARCAJE', 'INICIO_DESCANSO', 'FIN_DESCANSO'));

ALTER TABLE public.asistencias 
    DROP CONSTRAINT IF EXISTS asistencias_metodo_registro_check;

ALTER TABLE public.asistencias 
    ADD CONSTRAINT asistencias_metodo_registro_check 
    CHECK (metodo_registro IN ('DISPOSITIVO', 'MANUAL', 'SISTEMA', 'WEB'));

-- =============================================================================
-- 4. TABLA: incidencias_empleado (Faltas justificadas, vacaciones y permisos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.incidencias_empleado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('FALTA_JUSTIFICADA', 'VACACIONES', 'PERMISO', 'INCAPACIDAD')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    respuesta_administrador TEXT,
    perfil_revisor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_resolucion TIMESTAMPTZ
);

COMMENT ON TABLE public.incidencias_empleado IS 'Solicitudes de vacaciones, permisos y justificaciones enviadas por los trabajadores';

CREATE INDEX IF NOT EXISTS idx_incidencias_empleado_id 
    ON public.incidencias_empleado(empleado_id, fecha_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_incidencias_estado 
    ON public.incidencias_empleado(estado);

-- =============================================================================
-- 5. POLÍTICAS RLS
-- =============================================================================
ALTER TABLE public.configuracion_taller ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias_empleado ENABLE ROW LEVEL SECURITY;

-- Configuración: Lectura pública/autenticada para validar geocerca
DROP POLICY IF EXISTS "configuracion_taller_select" ON public.configuracion_taller;
CREATE POLICY "configuracion_taller_select"
    ON public.configuracion_taller FOR SELECT
    USING (true);

-- Configuración: Modificación exclusiva de Administrador
DROP POLICY IF EXISTS "configuracion_taller_update" ON public.configuracion_taller;
CREATE POLICY "configuracion_taller_update"
    ON public.configuracion_taller FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- Incidencias: Lectura para administradores o para el mismo empleado
DROP POLICY IF EXISTS "incidencias_select" ON public.incidencias_empleado;
CREATE POLICY "incidencias_select"
    ON public.incidencias_empleado FOR SELECT
    USING (true);

-- Incidencias: Creación libre por empleados
DROP POLICY IF EXISTS "incidencias_insert" ON public.incidencias_empleado;
CREATE POLICY "incidencias_insert"
    ON public.incidencias_empleado FOR INSERT
    WITH CHECK (true);

-- Incidencias: Aprobación/Rechazo exclusiva de Administrador
DROP POLICY IF EXISTS "incidencias_update" ON public.incidencias_empleado;
CREATE POLICY "incidencias_update"
    ON public.incidencias_empleado FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());
