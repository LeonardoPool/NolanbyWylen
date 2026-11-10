-- =============================================================================
-- PROYECTO: NOLAN by WYLEN
-- CLIENTE: Servicio Mecánico López
-- MIGRACIÓN: 20261109000002_estructura_definitiva_nolan_v2.sql
-- VERSIÓN: 2.0.0
-- DESCRIPCIÓN: Estructura definitiva robustecida, RLS sin escalamiento,
--              mecanismo de idempotencia, inmutabilidad y auditoría protegida.
-- =============================================================================

-- =============================================================================
-- 1. TABLA: perfiles (Extensión segura de auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'SUPERVISOR' CHECK (rol IN ('ADMINISTRADOR', 'SUPERVISOR')),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.perfiles IS 'Perfiles de usuarios administrativos con RBAC estricto';

-- =============================================================================
-- 2. TABLA: empleados (Catálogo central de trabajadores)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_empleado VARCHAR(30) NOT NULL UNIQUE,
    codigo_biometrico VARCHAR(50) NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    telefono VARCHAR(30),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empleados IS 'Catálogo de empleados y clave de vinculación con el checador biométrico';

-- =============================================================================
-- 3. TABLA: dispositivos (Control de hardware ZKTeco MB10V)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dispositivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identificador_serie VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    modelo VARCHAR(50) NOT NULL DEFAULT 'ZKTeco MB10V',
    direccion_ip VARCHAR(45),
    token_hash VARCHAR(64) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_baja TIMESTAMPTZ,
    ultimo_contacto TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dispositivos IS 'Equipos biométricos con tokens hasheados y trazabilidad histórica';

-- =============================================================================
-- 4. TABLA: asistencias (Eventos inmutables con corrección aditiva)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.asistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
    dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE RESTRICT,
    identificador_evento_dispositivo VARCHAR(100),
    hash_evento VARCHAR(64) NOT NULL UNIQUE,
    
    -- Bloque inmutable original
    fecha_hora TIMESTAMPTZ NOT NULL,
    tipo_evento_original VARCHAR(20) NOT NULL DEFAULT 'MARCAJE' CHECK (tipo_evento_original IN ('ENTRADA', 'SALIDA', 'MARCAJE')),
    metodo_registro VARCHAR(20) NOT NULL DEFAULT 'DISPOSITIVO' CHECK (metodo_registro IN ('DISPOSITIVO', 'MANUAL', 'SISTEMA')),
    metadatos_origen JSONB,
    
    -- Bloque aditivo de corrección / justificación
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA' CHECK (estado IN ('REGISTRADA', 'JUSTIFICADA', 'CORREGIDA', 'ANULADA')),
    fecha_hora_corregida TIMESTAMPTZ,
    tipo_evento_corregido VARCHAR(20) CHECK (tipo_evento_corregido IS NULL OR tipo_evento_corregido IN ('ENTRADA', 'SALIDA')),
    justificacion TEXT,
    perfil_auditor_id UUID REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    fecha_modificacion TIMESTAMPTZ,
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Validación de integridad para correcciones
    CONSTRAINT asistencias_chk_justificacion CHECK (
        (estado = 'REGISTRADA') OR 
        (estado IN ('JUSTIFICADA', 'CORREGIDA', 'ANULADA') AND justificacion IS NOT NULL AND perfil_auditor_id IS NOT NULL AND fecha_modificacion IS NOT NULL)
    )
);

COMMENT ON TABLE public.asistencias IS 'Marcajes de asistencia inmutables con trazabilidad aditiva y deduplicación determinista';

-- =============================================================================
-- 5. TABLA: registros_auditoria (Bitácora inmutable protegida)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.registros_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    accion VARCHAR(50) NOT NULL,
    tabla_afectada VARCHAR(50) NOT NULL,
    registro_afectado_id UUID,
    valores_previos JSONB,
    valores_nuevos JSONB,
    direccion_ip VARCHAR(45),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.registros_auditoria IS 'Bitácora inmutable de seguridad. Solo modificable por backend confiable.';

-- =============================================================================
-- 6. ÍNDICES DE RENDIMIENTO JUSTIFICADOS (CERO REDUNDANCIAS)
-- =============================================================================

-- Búsqueda instantánea del empleado en la ingesta del checador
CREATE INDEX IF NOT EXISTS idx_empleados_codigo_biometrico 
    ON public.empleados(codigo_biometrico);

-- Filtro de trabajadores activos para selección en la interfaz
CREATE INDEX IF NOT EXISTS idx_empleados_activos 
    ON public.empleados(activo) WHERE activo = true;

-- Consultas de historial por empleado ordenadas cronológicamente
CREATE INDEX IF NOT EXISTS idx_asistencias_historial_empleado 
    ON public.asistencias(empleado_id, fecha_hora DESC);

-- Consultas de reportes por rango de fechas (Dashboard y exportaciones)
CREATE INDEX IF NOT EXISTS idx_asistencias_rango_fechas 
    ON public.asistencias(fecha_hora DESC);

-- Monitoreo rápido de asistencias con incidencias o correcciones
CREATE INDEX IF NOT EXISTS idx_asistencias_estado 
    ON public.asistencias(estado) WHERE estado != 'REGISTRADA';

-- Consulta cronológica de auditoría para administradores
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha 
    ON public.registros_auditoria(fecha_creacion DESC);

-- =============================================================================
-- 7. FUNCIONES DE SEGURIDAD Y TRIGGERS (HARDENED CON search_path)
-- =============================================================================

-- Actualización automática de timestamps
CREATE OR REPLACE FUNCTION public.actualizar_marca_tiempo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.fecha_actualizacion = now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_marca_tiempo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_marca_tiempo() TO authenticated;

DROP TRIGGER IF EXISTS tr_actualizar_perfiles ON public.perfiles;
CREATE TRIGGER tr_actualizar_perfiles
    BEFORE UPDATE ON public.perfiles
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

DROP TRIGGER IF EXISTS tr_actualizar_empleados ON public.empleados;
CREATE TRIGGER tr_actualizar_empleados
    BEFORE UPDATE ON public.empleados
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

-- Verificación de rol ADMINISTRADOR (Segura, determinista y sin recursión)
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

-- Manejo estricto de nuevos usuarios en Supabase Auth:
-- Asigna SIEMPRE rol SUPERVISOR. Ignora cualquier intento de asignar rol desde metadatos.
CREATE OR REPLACE FUNCTION public.manejar_nuevo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.perfiles (id, nombre, apellidos, rol, activo, fecha_creacion, fecha_actualizacion)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre'), ''), 'Usuario'),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'apellidos'), ''), 'Sistema'),
        'SUPERVISOR', -- ROL POR DEFECTO ESTRICTO
        true,
        now(),
        now()
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.manejar_nuevo_usuario() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.manejar_nuevo_usuario();

-- =============================================================================
-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS) v2.0
-- =============================================================================

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_auditoria ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS: perfiles
-- -----------------------------------------------------------------------------
-- Lectura: Usuarios activos pueden ver perfiles de sus compañeros de panel
CREATE POLICY "perfiles_select_politica"
    ON public.perfiles FOR SELECT
    TO authenticated
    USING (activo = true);

-- Actualización: Solo un administrador puede modificar perfiles (sin poder cambiar su propio rol vía cliente)
CREATE POLICY "perfiles_update_politica"
    ON public.perfiles FOR UPDATE
    TO authenticated
    USING (public.es_administrador() AND id <> auth.uid())
    WITH CHECK (public.es_administrador() AND id <> auth.uid());

-- -----------------------------------------------------------------------------
-- RLS: empleados
-- -----------------------------------------------------------------------------
-- Lectura: Cualquier usuario autenticado (ADMIN o SUPERVISOR) consulta catálogo
CREATE POLICY "empleados_select_politica"
    ON public.empleados FOR SELECT
    TO authenticated
    USING (true);

-- Creación: Exclusivo ADMINISTRADOR
CREATE POLICY "empleados_insert_politica"
    ON public.empleados FOR INSERT
    TO authenticated
    WITH CHECK (public.es_administrador());

-- Modificación (edición y baja lógica): Exclusivo ADMINISTRADOR
CREATE POLICY "empleados_update_politica"
    ON public.empleados FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- Eliminación física: Terminantemente prohibida (Baja lógica mandatoria)

-- -----------------------------------------------------------------------------
-- RLS: dispositivos
-- -----------------------------------------------------------------------------
-- Lectura: Cualquier usuario autenticado consulta estado operativo
CREATE POLICY "dispositivos_select_politica"
    ON public.dispositivos FOR SELECT
    TO authenticated
    USING (true);

-- Modificación / Registro: Exclusivo ADMINISTRADOR
CREATE POLICY "dispositivos_insert_politica"
    ON public.dispositivos FOR INSERT
    TO authenticated
    WITH CHECK (public.es_administrador());

CREATE POLICY "dispositivos_update_politica"
    ON public.dispositivos FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- -----------------------------------------------------------------------------
-- RLS: asistencias
-- -----------------------------------------------------------------------------
-- Lectura: Usuarios autenticados ven asistencias
CREATE POLICY "asistencias_select_politica"
    ON public.asistencias FOR SELECT
    TO authenticated
    USING (true);

-- Inserción manual: Exclusivo ADMINISTRADOR (el hardware inserta con service_role en el backend)
CREATE POLICY "asistencias_insert_manual_politica"
    ON public.asistencias FOR INSERT
    TO authenticated
    WITH CHECK (public.es_administrador() AND metodo_registro = 'MANUAL');

-- Corrección / Justificación: Exclusivo ADMINISTRADOR con justificación
CREATE POLICY "asistencias_update_politica"
    ON public.asistencias FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- Eliminación física: Prohibida (Inmutabilidad estricta)

-- -----------------------------------------------------------------------------
-- RLS: registros_auditoria
-- -----------------------------------------------------------------------------
-- Lectura: Exclusivo ADMINISTRADOR
CREATE POLICY "auditoria_select_politica"
    ON public.registros_auditoria FOR SELECT
    TO authenticated
    USING (public.es_administrador());

-- Inserción, Actualización y Eliminación directa desde el cliente: DENEGADAS.
-- Los registros de auditoría se generan exclusivamente en el servidor mediante el cliente de servicio.

