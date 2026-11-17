-- =============================================================================
-- PROYECTO: NOLAN by WYLEN
-- CLIENTE: Servicio Mecánico López
-- MIGRACIÓN: 20261116000006_incidencias_documentos_y_vacaciones.sql
-- VERSIÓN: 2.4.0
-- DESCRIPCIÓN: Extensión de incidencias (extemporánea, justificantes médicos
--              sin OCR), tablas de políticas y ajustes de vacaciones (LFT),
--              días festivos oficiales y función SQL de cálculo de días hábiles.
-- =============================================================================

-- =============================================================================
-- 1. AMPLIACIÓN: incidencias_empleado (Etapas 3 y 6)
-- =============================================================================
ALTER TABLE public.incidencias_empleado
    ADD COLUMN IF NOT EXISTS extemporanea BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS dias_solicitados_efectivos INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS documento_path TEXT,
    ADD COLUMN IF NOT EXISTS documento_nombre_original TEXT,
    ADD COLUMN IF NOT EXISTS documento_hash_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS documento_tamano_bytes INTEGER,
    ADD COLUMN IF NOT EXISTS documento_mime VARCHAR(50),
    ADD COLUMN IF NOT EXISTS documento_estado VARCHAR(25) NOT NULL DEFAULT 'SIN_DOCUMENTO'
        CHECK (documento_estado IN ('SIN_DOCUMENTO', 'PENDIENTE_REVISION', 'ACEPTADO', 'RECHAZADO')),
    ADD COLUMN IF NOT EXISTS documento_revisado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS documento_revisado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS documento_comentario TEXT,
    ADD COLUMN IF NOT EXISTS consentimiento_salud_aceptado BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS consentimiento_salud_fecha TIMESTAMPTZ;

COMMENT ON COLUMN public.incidencias_empleado.extemporanea IS 'Marca solicitudes de incapacidad retroactivas';
COMMENT ON COLUMN public.incidencias_empleado.documento_estado IS 'Estado de revisión manual del justificante por el Administrador';

-- =============================================================================
-- 2. AMPLIACIÓN: configuracion_taller (Etapa 7 - Día de descanso semanal)
-- =============================================================================
ALTER TABLE public.configuracion_taller
    ADD COLUMN IF NOT EXISTS dia_descanso_semanal INTEGER NOT NULL DEFAULT 0; -- 0 = Domingo

COMMENT ON COLUMN public.configuracion_taller.dia_descanso_semanal IS '0=Domingo, 1=Lunes, ..., 6=Sábado. Domingo por defecto';

-- =============================================================================
-- 3. TABLA: politicas_vacaciones (Etapa 7 - Art. 76 LFT)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.politicas_vacaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio_servicio_desde INTEGER NOT NULL,
    anio_servicio_hasta INTEGER NOT NULL,
    dias_vacaciones INTEGER NOT NULL,
    vigente_desde DATE NOT NULL DEFAULT '2023-01-01',
    vigente_hasta DATE,
    activo BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT chk_rango_anios CHECK (anio_servicio_hasta >= anio_servicio_desde)
);

COMMENT ON TABLE public.politicas_vacaciones IS 'Tabla de vacaciones mínimas de la Ley Federal del Trabajo';

-- Insertar tabla vigente LFT 2023+ (Reforma Vacaciones Dignas) si está vacía
INSERT INTO public.politicas_vacaciones (anio_servicio_desde, anio_servicio_hasta, dias_vacaciones, vigente_desde)
SELECT v.desde, v.hasta, v.dias, '2023-01-01'::date
FROM (VALUES
    (1, 1, 12),
    (2, 2, 14),
    (3, 3, 16),
    (4, 4, 18),
    (5, 5, 20),
    (6, 10, 22),
    (11, 15, 24),
    (16, 20, 26),
    (21, 25, 28),
    (26, 30, 30),
    (31, 35, 32)
) AS v(desde, hasta, dias)
WHERE NOT EXISTS (SELECT 1 FROM public.politicas_vacaciones LIMIT 1);

-- =============================================================================
-- 4. TABLA: dias_festivos_oficiales (Etapa 7 - Art. 74 LFT)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dias_festivos_oficiales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL UNIQUE,
    descripcion VARCHAR(150) NOT NULL,
    irrenunciable BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.dias_festivos_oficiales IS 'Días de descanso obligatorio según Art. 74 de la LFT';

-- =============================================================================
-- 5. TABLA: ajustes_vacaciones (Etapa 7 - Kardex append-only para saldos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ajustes_vacaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('CARGA_HISTORICA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO')),
    dias INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    autor_perfil_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ajustes_vacaciones IS 'Bitácora inmutable de ajustes y cargas históricas de vacaciones';

CREATE INDEX IF NOT EXISTS idx_ajustes_vacaciones_emp 
    ON public.ajustes_vacaciones(empleado_id, fecha_creacion DESC);

-- =============================================================================
-- 6. FUNCIÓN DETERMINISTA: Generación de días festivos oficiales LFT por año
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generar_festivos_lft(anio INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    f_feb DATE;
    f_mar DATE;
    f_nov DATE;
BEGIN
    -- 1 ene: Año Nuevo
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (make_date(anio, 1, 1), 'Año Nuevo')
    ON CONFLICT (fecha) DO NOTHING;

    -- Primer lunes de febrero (Constitución)
    f_feb := make_date(anio, 2, 1);
    WHILE EXTRACT(ISODOW FROM f_feb) <> 1 LOOP
        f_feb := f_feb + INTERVAL '1 day';
    END LOOP;
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (f_feb, 'Día de la Constitución Mexicana')
    ON CONFLICT (fecha) DO NOTHING;

    -- Tercer lunes de marzo (Natalicio de Benito Juárez)
    f_mar := make_date(anio, 3, 1);
    WHILE EXTRACT(ISODOW FROM f_mar) <> 1 LOOP
        f_mar := f_mar + INTERVAL '1 day';
    END LOOP;
    f_mar := f_mar + INTERVAL '14 days';
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (f_mar, 'Natalicio de Benito Juárez')
    ON CONFLICT (fecha) DO NOTHING;

    -- 1 may: Día del Trabajo
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (make_date(anio, 5, 1), 'Día del Trabajo')
    ON CONFLICT (fecha) DO NOTHING;

    -- 16 sep: Independencia de México
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (make_date(anio, 9, 16), 'Día de la Independencia de México')
    ON CONFLICT (fecha) DO NOTHING;

    -- Tercer lunes de noviembre (Revolución Mexicana)
    f_nov := make_date(anio, 11, 1);
    WHILE EXTRACT(ISODOW FROM f_nov) <> 1 LOOP
        f_nov := f_nov + INTERVAL '1 day';
    END LOOP;
    f_nov := f_nov + INTERVAL '14 days';
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (f_nov, 'Día de la Revolución Mexicana')
    ON CONFLICT (fecha) DO NOTHING;

    -- 1 oct: Transmisión del Poder Ejecutivo Federal (cada 6 años: 2024, 2030, ...)
    IF anio IN (2024, 2030, 2036, 2042) THEN
        INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
        VALUES (make_date(anio, 10, 1), 'Transmisión del Poder Ejecutivo Federal')
        ON CONFLICT (fecha) DO NOTHING;
    END IF;

    -- 25 dic: Navidad
    INSERT INTO public.dias_festivos_oficiales (fecha, descripcion)
    VALUES (make_date(anio, 12, 25), 'Navidad')
    ON CONFLICT (fecha) DO NOTHING;
END;
$$;

-- Poblar festivos para 2026, 2027 y 2028
SELECT public.generar_festivos_lft(2026);
SELECT public.generar_festivos_lft(2027);
SELECT public.generar_festivos_lft(2028);

-- =============================================================================
-- 7. FUNCIÓN FUENTE DE VERDAD: dias_habiles_vacaciones(inicio, fin)
-- Excluye día de descanso semanal (domingo) y días festivos de la LFT.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.dias_habiles_vacaciones(
    fecha_inicio DATE,
    fecha_fin DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    curr_date DATE := fecha_inicio;
    dias_habiles INTEGER := 0;
    dia_descanso INTEGER := 0; -- 0 = Domingo
    dow_postgres INTEGER;
BEGIN
    IF fecha_fin < fecha_inicio THEN
        RETURN 0;
    END IF;

    -- Obtener día de descanso configurado en el taller (por defecto 0 = Domingo)
    SELECT dia_descanso_semanal INTO dia_descanso 
    FROM public.configuracion_taller 
    LIMIT 1;

    dia_descanso := COALESCE(dia_descanso, 0);

    WHILE curr_date <= fecha_fin LOOP
        -- EXTRACT(DOW FROM date): 0=Domingo, 1=Lunes, ..., 6=Sábado
        dow_postgres := EXTRACT(DOW FROM curr_date)::INTEGER;

        -- El día cuenta si NO es día de descanso y NO es festivo oficial LFT
        IF dow_postgres <> dia_descanso THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.dias_festivos_oficiales 
                WHERE fecha = curr_date
            ) THEN
                dias_habiles := dias_habiles + 1;
            END IF;
        END IF;

        curr_date := curr_date + INTERVAL '1 day';
    END LOOP;

    RETURN dias_habiles;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dias_habiles_vacaciones(DATE, DATE) TO authenticated, anon;

-- =============================================================================
-- 8. POLÍTICAS RLS PARA NUEVAS TABLAS
-- =============================================================================
ALTER TABLE public.politicas_vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_festivos_oficiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_vacaciones ENABLE ROW LEVEL SECURITY;

-- Lectura de políticas y festivos (disponible para autenticados para simular)
CREATE POLICY "politicas_select" ON public.politicas_vacaciones FOR SELECT USING (true);
CREATE POLICY "festivos_select" ON public.dias_festivos_oficiales FOR SELECT USING (true);

-- Ajustes de vacaciones: Exclusivo Administrador
CREATE POLICY "ajustes_vacaciones_admin" ON public.ajustes_vacaciones
    FOR ALL TO authenticated
    USING (public.es_administrador())
    WITH CHECK (public.es_administrador());
