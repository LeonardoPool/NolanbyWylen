-- =============================================================================
-- PROYECTO: NOLAN by WYLEN
-- CLIENTE: Servicio Mecánico López
-- MIGRACIÓN: 20261116000005_cerrar_rls_e_intentos_pin.sql
-- VERSIÓN: 2.3.0
-- DESCRIPCIÓN: Cierre estricto de RLS contra rol anon/public en incidencias y
--              ubicaciones extraordinarias. Tabla inmutable para mitigación de
--              fuerza bruta en autenticación por PIN.
-- =============================================================================

-- =============================================================================
-- 1. TABLA: intentos_acceso_pin (Mitigación de fuerza bruta en PIN)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.intentos_acceso_pin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identificador VARCHAR(100) NOT NULL,
    ip_origen VARCHAR(45) NOT NULL DEFAULT '0.0.0.0',
    exitoso BOOLEAN NOT NULL DEFAULT false,
    fecha_intento TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intentos_acceso_pin IS 'Bitácora inmutable de intentos de acceso al portal checador para prevenir fuerza bruta de PIN';

CREATE INDEX IF NOT EXISTS idx_intentos_pin_bloqueo 
    ON public.intentos_acceso_pin(identificador, fecha_intento DESC);

CREATE INDEX IF NOT EXISTS idx_intentos_pin_ip 
    ON public.intentos_acceso_pin(ip_origen, fecha_intento DESC);

-- Habilitar RLS estricto (bloqueo total al cliente anon y authenticated)
ALTER TABLE public.intentos_acceso_pin ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. FUNCIÓN: es_administrador() (Asegurada con search_path)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid()
          AND rol = 'ADMINISTRADOR'
          AND activo = true
    );
$$;

REVOKE ALL ON FUNCTION public.es_administrador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_administrador() TO authenticated;

-- =============================================================================
-- 3. POLÍTICAS RLS: incidencias_empleado (Cerrar acceso público / anon)
-- =============================================================================
DROP POLICY IF EXISTS "incidencias_select" ON public.incidencias_empleado;
DROP POLICY IF EXISTS "incidencias_insert" ON public.incidencias_empleado;
DROP POLICY IF EXISTS "incidencias_update" ON public.incidencias_empleado;
DROP POLICY IF EXISTS "incidencias_admin_select" ON public.incidencias_empleado;
DROP POLICY IF EXISTS "incidencias_admin_update" ON public.incidencias_empleado;

-- Solo administradores autenticados pueden consultar incidencias directamente
CREATE POLICY "incidencias_admin_select"
    ON public.incidencias_empleado FOR SELECT
    TO authenticated
    USING (public.es_administrador());

-- Solo administradores autenticados pueden resolver incidencias (aprobar/rechazar)
CREATE POLICY "incidencias_admin_update"
    ON public.incidencias_empleado FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- No hay política INSERT ni DELETE para clientes directos.
-- Todas las inserciones de empleados se canalizan a través de Server Actions verificadas.

-- =============================================================================
-- 4. POLÍTICAS RLS: ubicaciones_extraordinarias (Cerrar acceso público / anon)
-- =============================================================================
DROP POLICY IF EXISTS "ubicaciones_extraordinarias_select" ON public.ubicaciones_extraordinarias;
DROP POLICY IF EXISTS "ubicaciones_extraordinarias_admin_select" ON public.ubicaciones_extraordinarias;

CREATE POLICY "ubicaciones_extraordinarias_admin_select"
    ON public.ubicaciones_extraordinarias FOR SELECT
    TO authenticated
    USING (public.es_administrador());

-- =============================================================================
-- INSTRUCCIONES DE ROLLBACK (EN CASO DE CONTINGENCIA):
-- =============================================================================
-- DROP TABLE IF EXISTS public.intentos_acceso_pin;
-- DROP POLICY IF EXISTS "incidencias_admin_select" ON public.incidencias_empleado;
-- DROP POLICY IF EXISTS "incidencias_admin_update" ON public.incidencias_empleado;
-- CREATE POLICY "incidencias_select" ON public.incidencias_empleado FOR SELECT USING (true);
-- CREATE POLICY "incidencias_insert" ON public.incidencias_empleado FOR INSERT WITH CHECK (true);
-- CREATE POLICY "incidencias_update" ON public.incidencias_empleado FOR UPDATE TO authenticated USING (public.es_administrador()) WITH CHECK (public.es_administrador());
-- DROP POLICY IF EXISTS "ubicaciones_extraordinarias_admin_select" ON public.ubicaciones_extraordinarias;
-- CREATE POLICY "ubicaciones_extraordinarias_select" ON public.ubicaciones_extraordinarias FOR SELECT USING (true);
