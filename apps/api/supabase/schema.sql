-- =========================================================================
-- ARRIENDA TU AUTO - SCHEMA REAL PARA SUPABASE (POSTGRESQL)
-- =========================================================================
-- Este archivo es un espejo fiel de app/models/entities.py (SQLAlchemy),
-- que es la fuente de verdad real: en desarrollo, Base.metadata.create_all()
-- genera estas mismas tablas automáticamente contra SQLite. Este .sql existe
-- para poder provisionar el proyecto real de Supabase Postgres (staging /
-- producción) con el mismo esquema exacto, sin inventar columnas ni tablas
-- que el backend no usa.
--
-- IMPORTANTE: la versión anterior de este archivo (y de seed.sql) describía
-- un diseño completamente distinto — nombres de columna en inglés/español
-- mezclados (ano, categoria, transmision, garantia_requerida, rating_promedio,
-- foto_principal_url, etc.) que NUNCA correspondieron al backend FastAPI real.
-- Ese desfase es la causa raíz de varios de los "datos hardcodeados" que se
-- encontraron y corrigieron en el frontend durante esta sesión: pantallas que
-- se construyeron leyendo este .sql viejo en vez de los schemas Pydantic
-- reales del backend (app/schemas/schemas.py).
--
-- Todos los IDs (PK y FK) son TEXT, no UUID nativo: la aplicación los genera
-- en Python (str(uuid.uuid4())) y los inserta como texto plano — y la fila
-- 'default' de configuracion_plataforma usa un id que no es un UUID válido.
-- Usar TEXT en todas partes evita cualquier desajuste de tipo entre lo que
-- la app realmente envía y lo que la base espera.
--
-- Autorización: el backend NO se conecta como el rol 'anon'/'authenticated'
-- de PostgREST — usa una conexión directa a Postgres (ver DATABASE_URL en
-- .env) y hace toda la autorización (ownership, roles) en la capa FastAPI.
-- Por eso este schema no define políticas de Row Level Security: activarlas
-- sin políticas correctas rompería esa conexión directa. Si en el futuro se
-- expone la base directo a clientes vía Supabase (PostgREST/Realtime), hay
-- que diseñar RLS aparte, no asumir que este archivo ya lo cubre.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- SUCURSALES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sucursales (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    radio_cobertura_km DOUBLE PRECISION DEFAULT 25.0,
    managers_asignados JSONB DEFAULT '[]'::JSONB
);

-- -------------------------------------------------------------------------
-- USUARIOS (clientes, dueños, managers, admins — un solo rol múltiple)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    rut TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    foto_perfil_verificada_url TEXT,
    estado_documentos TEXT DEFAULT 'pendiente'
        CHECK (estado_documentos IN ('pendiente', 'verificado', 'rechazado', 'requiere_revision_manual')),
    confianza_ocr DOUBLE PRECISION DEFAULT 1.0,
    notas_auditoria TEXT,
    roles_activos JSONB DEFAULT '["cliente"]'::JSONB, -- subconjunto de: dueno, cliente, manager, admin
    sucursal_id TEXT REFERENCES public.sucursales(id),
    fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rut ON public.usuarios(rut);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

-- -------------------------------------------------------------------------
-- AUTOS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.autos (
    id TEXT PRIMARY KEY,
    dueno_id TEXT NOT NULL REFERENCES public.usuarios(id),
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    anio INTEGER NOT NULL,
    patente TEXT UNIQUE NOT NULL,
    tarifa_dia INTEGER NOT NULL, -- CLP
    estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'mantenimiento')),
    ubicacion_base TEXT NOT NULL,
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    fotos JSONB DEFAULT '[]'::JSONB,
    equipamiento JSONB DEFAULT '{}'::JSONB -- ej. {"ac": true, "bluetooth": true, "isofix": false}
);

CREATE INDEX IF NOT EXISTS idx_autos_patente ON public.autos(patente);
CREATE INDEX IF NOT EXISTS idx_autos_dueno_id ON public.autos(dueno_id);

-- -------------------------------------------------------------------------
-- RESERVAS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas (
    id TEXT PRIMARY KEY,
    auto_id TEXT NOT NULL REFERENCES public.autos(id),
    cliente_id TEXT NOT NULL REFERENCES public.usuarios(id),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    estado TEXT DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'en_curso', 'finalizada', 'cancelada', 'disputada')),
    monto_hold INTEGER DEFAULT 0, -- CLP
    cargo_limpieza_clp INTEGER DEFAULT 0,
    cargo_combustible_clp INTEGER DEFAULT 0,
    cargo_km_extra_clp INTEGER DEFAULT 0,
    cargo_atraso_clp INTEGER DEFAULT 0,
    cargos_adicionales_clp INTEGER DEFAULT 0,
    monto_cobro_final INTEGER DEFAULT 0,
    liquidacion_dueno_clp INTEGER DEFAULT 0,
    codigo_qr_hash TEXT,
    lugar_entrega_acordado TEXT NOT NULL,
    contrato_pdf_url TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservas_codigo_qr_hash ON public.reservas(codigo_qr_hash);
CREATE INDEX IF NOT EXISTS idx_reservas_auto_id ON public.reservas(auto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_id ON public.reservas(cliente_id);

-- -------------------------------------------------------------------------
-- VERIFICACIONES DE ENTREGA (identidad, vía código QR)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verificaciones_entrega (
    id TEXT PRIMARY KEY,
    reserva_id TEXT NOT NULL REFERENCES public.reservas(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrega', 'devolucion')),
    resultado TEXT NOT NULL CHECK (resultado IN ('confirmada', 'rechazada')),
    foto_evidencia_url TEXT,
    motivo_rechazo TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    dueno_id_que_verifica TEXT NOT NULL REFERENCES public.usuarios(id)
);

-- -------------------------------------------------------------------------
-- CHECKLISTS DE AUTO (checklist fotográfico antes/después)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklists_auto (
    id TEXT PRIMARY KEY,
    reserva_id TEXT NOT NULL REFERENCES public.reservas(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('antes', 'despues')),
    fotos JSONB DEFAULT '[]'::JSONB, -- URLs de fotos
    kilometraje INTEGER NOT NULL,
    nivel_combustible TEXT NOT NULL CHECK (nivel_combustible IN ('lleno', '3/4', '1/2', '1/4', 'vacio')),
    estado_limpieza TEXT DEFAULT 'limpio' CHECK (estado_limpieza IN ('limpio', 'sucio_estandar', 'sucio_profundo')),
    cargo_limpieza_clp INTEGER DEFAULT 0,
    notas TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- CALIFICACIONES (sistema bidireccional dueño/cliente)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calificaciones (
    id TEXT PRIMARY KEY,
    reserva_id TEXT NOT NULL REFERENCES public.reservas(id),
    autor_id TEXT NOT NULL REFERENCES public.usuarios(id),
    autor_rol TEXT NOT NULL CHECK (autor_rol IN ('dueno', 'cliente')),
    destinatario_id TEXT NOT NULL REFERENCES public.usuarios(id),
    puntaje INTEGER NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_destinatario_id ON public.calificaciones(destinatario_id);

-- -------------------------------------------------------------------------
-- PAGOS (holds, cobros finales, liquidaciones — Transbank Webpay Plus)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagos (
    id TEXT PRIMARY KEY,
    reserva_id TEXT REFERENCES public.reservas(id),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN (
        'hold_reserva', 'hold_enrolamiento', 'cobro_final', 'liquidacion_dueno',
        'deducible_seguro', 'cargo_limpieza', 'cargo_combustible'
    )),
    monto INTEGER NOT NULL,
    estado TEXT DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'capturado', 'liberado', 'fallido', 'reembolsado', 'pagado')),
    referencia_transbank TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_reserva_id ON public.pagos(reserva_id);

-- -------------------------------------------------------------------------
-- DISPUTAS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputas (
    id TEXT PRIMARY KEY,
    reserva_id TEXT NOT NULL REFERENCES public.reservas(id),
    tipo TEXT NOT NULL CHECK (tipo IN (
        'no_coincidencia_identidad', 'dano', 'incumplimiento', 'limpieza', 'combustible', 'atraso', 'otro'
    )),
    estado TEXT DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_revision', 'resuelta')),
    admin_asignado_id TEXT REFERENCES public.usuarios(id),
    motivo TEXT,
    foto_evidencia_url TEXT,
    evidencia_fotos JSONB DEFAULT '[]'::JSONB,
    resolucion TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- TICKETS DE SOPORTE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets_soporte (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id),
    sucursal_id TEXT REFERENCES public.sucursales(id),
    asunto TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_revision', 'cerrado')),
    escalado_a_disputa BOOLEAN DEFAULT FALSE,
    disputa_id TEXT REFERENCES public.disputas(id),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_soporte_sucursal_id ON public.tickets_soporte(sucursal_id);

-- -------------------------------------------------------------------------
-- MANTENCIONES Y DOCUMENTACIÓN LEGAL DEL AUTO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mantenciones_auto (
    id TEXT PRIMARY KEY,
    auto_id TEXT NOT NULL REFERENCES public.autos(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('documento_legal', 'servicio_mecanico')),
    nombre TEXT NOT NULL, -- ej. "Revisión Técnica", "Cambio de aceite"
    fecha_vencimiento TIMESTAMPTZ, -- solo aplica a documento_legal
    kilometraje INTEGER, -- solo aplica a servicio_mecanico
    notas TEXT,
    documento_url TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mantenciones_auto_auto_id ON public.mantenciones_auto(auto_id);

-- -------------------------------------------------------------------------
-- CALENDARIO DE DISPONIBILIDAD (bloqueos por uso personal)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bloqueos_calendario_auto (
    id TEXT PRIMARY KEY,
    auto_id TEXT NOT NULL REFERENCES public.autos(id),
    fecha TIMESTAMPTZ NOT NULL, -- día bloqueado (00:00 del día)
    motivo TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_calendario_auto_auto_id ON public.bloqueos_calendario_auto(auto_id);

-- -------------------------------------------------------------------------
-- MENSAJES (chat de coordinación por reserva)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensajes (
    id TEXT PRIMARY KEY,
    reserva_id TEXT NOT NULL REFERENCES public.reservas(id),
    autor_id TEXT NOT NULL REFERENCES public.usuarios(id),
    texto TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_reserva_id ON public.mensajes(reserva_id);

-- -------------------------------------------------------------------------
-- CONFIGURACIÓN DINÁMICA DE PLATAFORMA (RF-33) — fila única, id = 'default'
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_plataforma (
    id TEXT PRIMARY KEY DEFAULT 'default',
    valor_uf_clp DOUBLE PRECISION DEFAULT 38000.0,
    comision_plataforma_pct DOUBLE PRECISION DEFAULT 20.0,
    hold_enrolamiento_clp INTEGER DEFAULT 800000,
    cargo_limpieza_estandar_clp INTEGER DEFAULT 15000,
    cargo_limpieza_profunda_clp INTEGER DEFAULT 35000,
    cargo_combustible_cuarto_clp INTEGER DEFAULT 15000,
    cargo_km_extra_clp INTEGER DEFAULT 120,
    km_diarios_incluidos INTEGER DEFAULT 250,
    periodo_gracia_minutos INTEGER DEFAULT 30,
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_por_id TEXT REFERENCES public.usuarios(id)
);

-- La app actualiza actualizado_en manualmente en cada PUT /admin/configuracion
-- (no depende de un trigger), pero este trigger la mantiene correcta incluso
-- si algo escribe directo a la tabla por fuera del backend.
CREATE OR REPLACE FUNCTION public.set_configuracion_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_configuracion_plataforma_actualizado ON public.configuracion_plataforma;
CREATE TRIGGER tr_configuracion_plataforma_actualizado
    BEFORE UPDATE ON public.configuracion_plataforma
    FOR EACH ROW EXECUTE FUNCTION public.set_configuracion_actualizado_en();
