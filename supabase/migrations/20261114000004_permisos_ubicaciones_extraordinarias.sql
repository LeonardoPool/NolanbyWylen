-- =============================================================================
-- PROYECTO: NOLAN by WYLEN
-- CLIENTE: Servicio Mecánico López
-- MIGRACIÓN: 20261114000004_permisos_ubicaciones_extraordinarias.sql
-- VERSIÓN: 2.2.0
-- DESCRIPCIÓN: Ubicaciones extraordinarias temporales por viaje de negocios
--              o comisión para empleados, con vigencia automática de 1 a 14 días.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ubicaciones_extraordinarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
    motivo VARCHAR(150) NOT NULL,
    nombre_lugar VARCHAR(150) NOT NULL,
    direccion TEXT,
    latitud NUMERIC(10, 7) NOT NULL,
    longitud NUMERIC(10, 7) NOT NULL,
    radio_tolerancia_metros INTEGER NOT NULL DEFAULT 200,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Restricción de vigencia máxima de 14 días (2 semanas)
    CONSTRAINT chk_vigencia_maxima CHECK (
        fecha_fin >= fecha_inicio AND fecha_fin <= (fecha_inicio + INTERVAL '14 days')
    )
);

COMMENT ON TABLE public.ubicaciones_extraordinarias IS 'Geocercas temporales autorizadas para trabajadores en comisión o viaje de negocios';

CREATE INDEX IF NOT EXISTS idx_ubicaciones_extraordinarias_emp 
    ON public.ubicaciones_extraordinarias(empleado_id, fecha_inicio, fecha_fin) 
    WHERE activo = true;

-- Habilitar RLS
ALTER TABLE public.ubicaciones_extraordinarias ENABLE ROW LEVEL SECURITY;

-- Lectura: Usuarios autenticados (Admin y empleados para checar)
DROP POLICY IF EXISTS "ubicaciones_extraordinarias_select" ON public.ubicaciones_extraordinarias;
CREATE POLICY "ubicaciones_extraordinarias_select"
    ON public.ubicaciones_extraordinarias FOR SELECT
    USING (true);

-- Inserción: Exclusiva de Administrador
DROP POLICY IF EXISTS "ubicaciones_extraordinarias_insert" ON public.ubicaciones_extraordinarias;
CREATE POLICY "ubicaciones_extraordinarias_insert"
    ON public.ubicaciones_extraordinarias FOR INSERT
    TO authenticated
    WITH CHECK (public.es_administrador());

-- Modificación: Exclusiva de Administrador
DROP POLICY IF EXISTS "ubicaciones_extraordinarias_update" ON public.ubicaciones_extraordinarias;
CREATE POLICY "ubicaciones_extraordinarias_update"
    ON public.ubicaciones_extraordinarias FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- Eliminación: Exclusiva de Administrador
DROP POLICY IF EXISTS "ubicaciones_extraordinarias_delete" ON public.ubicaciones_extraordinarias;
CREATE POLICY "ubicaciones_extraordinarias_delete"
    ON public.ubicaciones_extraordinarias FOR DELETE
    TO authenticated
    USING (public.es_administrador());
