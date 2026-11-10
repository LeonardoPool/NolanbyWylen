-- =============================================================================
-- PROYECTO: NOLAN by WYLEN
-- CLIENTE: Servicio Mecánico López
-- MIGRACIÓN: 20261109000001_estructura_inicial_nolan.sql
-- DESCRIPCIÓN: Estructura definitiva de base de datos relacional (PostgreSQL / Supabase)
-- =============================================================================

-- Habilitar extensión para generación de identificadores UUIDv4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. TABLA: perfiles (Extensión de auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'SUPERVISOR' CHECK (rol IN ('ADMINISTRADOR', 'SUPERVISOR')),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.perfiles IS 'Información de perfil y control de acceso administrativo (RBAC)';

-- =============================================================================
-- 2. TABLA: empleados (Catálogo del taller mecánico)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_empleado VARCHAR(30) NOT NULL UNIQUE,
    codigo_biometrico VARCHAR(50) NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    telefono VARCHAR(30),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.empleados IS 'Catálogo de empleados y clave de vinculación con el checador biométrico';

-- =============================================================================
-- 3. TABLA: dispositivos (Checador ZKTeco MB10V)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dispositivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identificador_serie VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    modelo VARCHAR(50) NOT NULL DEFAULT 'ZKTeco MB10V',
    direccion_ip VARCHAR(45),
    token_autenticacion VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    ultimo_contacto TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.dispositivos IS 'Equipos biométricos registrados y monitoreo de conectividad';

-- =============================================================================
-- 4. TABLA: asistencias (Marcajes de entrada y salida)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
    dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE SET NULL,
    fecha_hora TIMESTAMPTZ NOT NULL,
    tipo_evento VARCHAR(20) NOT NULL DEFAULT 'MARCAJE' CHECK (tipo_evento IN ('ENTRADA', 'SALIDA', 'MARCAJE')),
    metodo_registro VARCHAR(20) NOT NULL DEFAULT 'DISPOSITIVO' CHECK (metodo_registro IN ('DISPOSITIVO', 'MANUAL', 'SISTEMA')),
    notas TEXT,
    metadatos_origen JSONB,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.asistencias IS 'Registro inmutable de marcajes de asistencia y trazabilidad de eventos';

-- =============================================================================
-- 5. TABLA: registros_auditoria (Bitácora de operaciones administrativas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.registros_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perfil_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    accion VARCHAR(50) NOT NULL,
    tabla_afectada VARCHAR(50) NOT NULL,
    registro_afectado_id UUID,
    valores_previos JSONB,
    valores_nuevos JSONB,
    direccion_ip VARCHAR(45),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.registros_auditoria IS 'Bitácora inmutable de cambios administrativos para trazabilidad interna';

-- =============================================================================
-- 6. ÍNDICES DE RENDIMIENTO Y PREVENCIÓN DE DUPLICADOS
-- =============================================================================

-- Búsqueda veloz de empleados al recibir evento del checador
CREATE INDEX IF NOT EXISTS idx_empleados_codigo_biometrico ON public.empleados(codigo_biometrico);
CREATE INDEX IF NOT EXISTS idx_empleados_activo ON public.empleados(activo);

-- Consultas de reportes e historial de asistencias
CREATE INDEX IF NOT EXISTS idx_asistencias_empleado_fecha ON public.asistencias(empleado_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha_rango ON public.asistencias(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_dispositivo ON public.asistencias(dispositivo_id);

-- PREVENCIÓN DE DUPLICADOS (Ventana de 1 minuto por empleado y tipo de evento)
CREATE UNIQUE INDEX IF NOT EXISTS idx_asistencias_anti_duplicado_minuto 
ON public.asistencias (empleado_id, date_trunc('minute', fecha_hora), tipo_evento);

-- Consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON public.registros_auditoria(tabla_afectada, registro_afectado_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.registros_auditoria(fecha_creacion DESC);

-- =============================================================================
-- 7. FUNCIONES AUXILIARES Y TRIGGERS DE ACTUALIZACIÓN
-- =============================================================================

-- Actualización automática de la columna 'fecha_actualizacion'
CREATE OR REPLACE FUNCTION public.actualizar_marca_tiempo()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_actualizar_perfiles
    BEFORE UPDATE ON public.perfiles
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

CREATE TRIGGER tr_actualizar_empleados
    BEFORE UPDATE ON public.empleados
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

-- Función de seguridad para comprobar si el usuario conectado es ADMINISTRADOR
CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND rol = 'ADMINISTRADOR' AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger automático para crear perfil cuando se crea un usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.manejar_nuevo_usuario()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfiles (id, nombre, apellidos, rol, activo)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
        COALESCE(NEW.raw_user_meta_data->>'apellidos', 'Sistema'),
        COALESCE(NEW.raw_user_meta_data->>'rol', 'SUPERVISOR'),
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronizar con el evento de Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.manejar_nuevo_usuario();

-- =============================================================================
-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Activar RLS en todas las tablas
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_auditoria ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS: perfiles
-- -----------------------------------------------------------------------------
CREATE POLICY "Usuarios autenticados pueden ver perfiles"
    ON public.perfiles FOR SELECT
    TO authenticated
    USING (activo = true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil o administradores a todos"
    ON public.perfiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.es_administrador())
    WITH CHECK (id = auth.uid() OR public.es_administrador());

-- -----------------------------------------------------------------------------
-- RLS: empleados
-- -----------------------------------------------------------------------------
CREATE POLICY "Usuarios autenticados pueden consultar catálogo de empleados"
    ON public.empleados FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Solo administradores pueden crear empleados"
    ON public.empleados FOR INSERT
    TO authenticated
    WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administradores pueden modificar empleados"
    ON public.empleados FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- -----------------------------------------------------------------------------
-- RLS: dispositivos
-- -----------------------------------------------------------------------------
CREATE POLICY "Usuarios autenticados pueden ver estado de dispositivos"
    ON public.dispositivos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Solo administradores pueden gestionar dispositivos"
    ON public.dispositivos FOR ALL
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- -----------------------------------------------------------------------------
-- RLS: asistencias
-- -----------------------------------------------------------------------------
CREATE POLICY "Usuarios autenticados pueden ver asistencias"
    ON public.asistencias FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Administradores pueden registrar asistencias manuales"
    ON public.asistencias FOR INSERT
    TO authenticated
    WITH CHECK (public.es_administrador());

CREATE POLICY "Administradores pueden justificar o modificar asistencias"
    ON public.asistencias FOR UPDATE
    TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());

-- -----------------------------------------------------------------------------
-- RLS: registros_auditoria
-- -----------------------------------------------------------------------------
CREATE POLICY "Solo administradores pueden consultar auditoría"
    ON public.registros_auditoria FOR SELECT
    TO authenticated
    USING (public.es_administrador());

CREATE POLICY "Usuarios autenticados pueden insertar registros de auditoría"
    ON public.registros_auditoria FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

