-- =========================================================================
-- ARRIENDO MI AUTO YA - SCHEMA COMPLETO PARA SUPABASE (POSTGRESQL)
-- =========================================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función para actualizar 'updated_at' automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 2. SUCURSALES (Cobertura física)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    latitud NUMERIC(10, 7),
    longitud NUMERIC(10, 7),
    radio_cobertura_km NUMERIC(5, 2) DEFAULT 25.0,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 3. USUARIOS Y PERFILES (Clientes, Dueños, Managers, Admins)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Referencia a auth.users de Supabase
    nombre VARCHAR(150) NOT NULL,
    apellido VARCHAR(150),
    email VARCHAR(255) UNIQUE NOT NULL,
    telefono VARCHAR(30),
    rut VARCHAR(20) UNIQUE NOT NULL,
    foto_perfil_url TEXT,
    
    -- KYC y Verificación de Documentos
    estado_kyc VARCHAR(30) DEFAULT 'pendiente' 
        CHECK (estado_kyc IN ('pendiente', 'en_revision', 'verificado', 'rechazado')),
    foto_cedula_frente_url TEXT,
    foto_cedula_dorso_url TEXT,
    foto_licencia_frente_url TEXT,
    foto_licencia_dorso_url TEXT,
    confianza_ocr NUMERIC(4, 2) DEFAULT 0.0,
    fecha_vencimiento_licencia DATE,
    
    -- Roles y Estados
    roles TEXT[] DEFAULT ARRAY['pasajero']::TEXT[], -- 'pasajero', 'conductor' (dueño), 'manager', 'admin'
    rating_promedio NUMERIC(3, 2) DEFAULT 5.00,
    total_viajes INT DEFAULT 0,
    sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 4. AUTOS / FLOTA
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.autos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dueno_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    marca VARCHAR(80) NOT NULL,
    modelo VARCHAR(80) NOT NULL,
    ano INT NOT NULL CHECK (ano >= 2012),
    patente VARCHAR(15) UNIQUE NOT NULL,
    categoria VARCHAR(50) DEFAULT 'Económico', -- 'Económico', 'Automático', 'SUV', 'Camioneta', 'Premium'
    transmision VARCHAR(30) DEFAULT 'Automático', -- 'Automático', 'Manual'
    combustible VARCHAR(30) DEFAULT 'Bencina', -- 'Bencina', 'Diésel', 'Híbrido', 'Eléctrico'
    puertas INT DEFAULT 5,
    asientos INT DEFAULT 5,
    
    -- Tarifas (en Pesos Chilenos CLP)
    tarifa_dia INT NOT NULL CHECK (tarifa_dia > 0),
    garantia_requerida INT DEFAULT 150000 CHECK (garantia_requerida >= 0),
    
    -- Ubicación
    comuna VARCHAR(100) NOT NULL,
    direccion_entrega VARCHAR(255),
    latitud NUMERIC(10, 7),
    longitud NUMERIC(10, 7),
    
    -- Fotos y Galería
    foto_principal_url TEXT NOT NULL,
    fotos_galeria JSONB DEFAULT '[]'::JSONB,
    
    -- Estado
    disponible BOOLEAN DEFAULT TRUE,
    estado VARCHAR(30) DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'mantenimiento')),
    rating_promedio NUMERIC(3, 2) DEFAULT 5.00,
    total_arriendos INT DEFAULT 0,
    
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 5. BLOQUEOS DE CALENDARIO DEL VEHÍCULO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bloqueos_calendario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_id UUID NOT NULL REFERENCES public.autos(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo VARCHAR(100) DEFAULT 'Uso personal del dueño', -- 'Uso personal', 'Mantenimiento', 'Otro'
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 6. MANTENIMIENTOS DEL VEHÍCULO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mantenimientos_auto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_id UUID NOT NULL REFERENCES public.autos(id) ON DELETE CASCADE,
    tipo VARCHAR(80) NOT NULL, -- 'Cambio de Aceite', 'Frenos', 'Revisión Técnica', 'Alineación'
    kilometraje INT NOT NULL,
    fecha_servicio DATE NOT NULL,
    costo_clp INT DEFAULT 0,
    notas TEXT,
    comprobante_url TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. MÉTODOS DE PAGO (Tarjetas del Cliente)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metodos_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(30) DEFAULT 'Crédito', -- 'Crédito', 'Débito'
    marca VARCHAR(30) DEFAULT 'Visa', -- 'Visa', 'Mastercard', 'Amex'
    ultimos_4 VARCHAR(4) NOT NULL,
    titular VARCHAR(150) NOT NULL,
    vencimiento VARCHAR(7) NOT NULL, -- 'MM/YY'
    token_transbank TEXT,
    es_principal BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 8. CUENTAS BANCARIAS DE DUEÑOS (Liquidación de Ganancias)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cuentas_bancarias_dueno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    banco VARCHAR(100) NOT NULL,
    tipo_cuenta VARCHAR(50) NOT NULL, -- 'Cuenta Corriente', 'CuentaRUT', 'Cuenta Vista'
    numero_cuenta VARCHAR(50) NOT NULL,
    titular VARCHAR(150) NOT NULL,
    rut_titular VARCHAR(20) NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 9. RESERVAS Y CONTRATOS DIGITALES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_contrato VARCHAR(50) UNIQUE NOT NULL, -- ej: AMY-2026-04871
    auto_id UUID NOT NULL REFERENCES public.autos(id) ON DELETE RESTRICT,
    cliente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    
    -- Fechas y Horas
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    dias INT NOT NULL CHECK (dias > 0),
    
    -- Desglose Económico (CLP)
    tarifa_diaria_clp INT NOT NULL,
    subtotal_clp INT NOT NULL,
    iva_clp INT NOT NULL,
    recargo_nocturno_clp INT DEFAULT 0,
    total_arriendo_clp INT NOT NULL,
    garantia_retenida_clp INT DEFAULT 150000,
    ganancia_dueno_clp INT NOT NULL,
    comision_plataforma_clp INT NOT NULL,
    
    -- Cargos Adicionales de Cierre (si aplican)
    descuento_garantia_combustible_clp INT DEFAULT 0,
    descuento_garantia_limpieza_clp INT DEFAULT 0,
    descuento_garantia_km_extra_clp INT DEFAULT 0,
    descuento_garantia_danos_clp INT DEFAULT 0,
    garantia_devuelta_clp INT DEFAULT 150000,
    
    -- Estado de la Reserva
    estado VARCHAR(30) DEFAULT 'pendiente' 
        CHECK (estado IN ('pendiente', 'confirmada', 'en_curso', 'finalizada', 'cancelada', 'en_disputa')),
    estado_garantia VARCHAR(30) DEFAULT 'retenida' 
        CHECK (estado_garantia IN ('retenida', 'liberada', 'parcialmente_retenida', 'cobrada')),
    
    -- Contrato y Firma Digital
    firma_arrendatario_url TEXT,
    firma_dueno_url TEXT,
    contrato_pdf_url TEXT,
    codigo_qr_entrega TEXT,
    
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 10. PROTOCOLO DIGITAL CHECKLIST 360° (Entrega y Devolución - 8 Fotos)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklists_entrega (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrega', 'devolucion')),
    
    -- Las 8 Fotos Obligatorias
    foto_1_frontal_url TEXT,
    foto_2_lateral_izq_url TEXT,
    foto_3_trasera_url TEXT,
    foto_4_lateral_der_url TEXT,
    foto_5_asientos_url TEXT,
    foto_6_tablero_interior_url TEXT,
    foto_7_maletero_url TEXT,
    foto_8_tablero_km_gas_url TEXT,
    
    -- Datos del Tablero
    kilometraje INT NOT NULL,
    nivel_combustible VARCHAR(20) NOT NULL CHECK (nivel_combustible IN ('E', '1/4', '1/2', '3/4', 'F')),
    observaciones TEXT,
    
    completado_por_id UUID REFERENCES public.usuarios(id),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 11. TRANSACCIONES Y PAGOS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    tipo VARCHAR(40) NOT NULL 
        CHECK (tipo IN ('arriendo', 'hold_garantia', 'liquidacion_dueno', 'cargo_diferencia', 'reembolso')),
    monto_clp INT NOT NULL,
    estado VARCHAR(30) DEFAULT 'exitoso' CHECK (estado IN ('pendiente', 'exitoso', 'liberado', 'fallido', 'reembolsado')),
    pasarela VARCHAR(40) DEFAULT 'Webpay Plus',
    referencia_transbank VARCHAR(100),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 12. MENSAJERÍA Y CHAT EN TIEMPO REAL
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensajes_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID REFERENCES public.reservas(id) ON DELETE CASCADE,
    remitente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    destinatario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 13. CENTRO DE DISPUTAS Y REPORTES DE DAÑOS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
    reportado_por_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    tipo VARCHAR(50) NOT NULL, -- 'Rayón', 'Golpe', 'Vidrio', 'Neumático', 'Interior', 'Falta combustible'
    zona_afectada VARCHAR(100),
    descripcion TEXT NOT NULL,
    monto_reclamado_clp INT DEFAULT 0,
    evidencia_fotos JSONB DEFAULT '[]'::JSONB,
    estado VARCHAR(30) DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_revision', 'resuelta_acuerdo', 'resuelta_arbitraje')),
    resolucion_admin TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 14. CALIFICACIONES Y RESEÑAS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
    evaluador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    evaluado_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    puntaje INT NOT NULL CHECK (puntaje >= 1 AND puntaje <= 5),
    comentario TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 15. NOTIFICACIONES PUSH Y DEL SISTEMA
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(40) DEFAULT 'general', -- 'reserva', 'pago', 'entrega', 'chat', 'soporte'
    leido BOOLEAN DEFAULT FALSE,
    icono VARCHAR(30) DEFAULT 'bell',
    link_app TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 16. CONFIGURACIÓN DINÁMICA DE PLATAFORMA
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_plataforma (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    valor_uf_clp NUMERIC(10, 2) DEFAULT 38000.0,
    comision_plataforma_pct NUMERIC(5, 2) DEFAULT 20.0,
    garantia_base_clp INT DEFAULT 150000,
    cargo_limpieza_estandar_clp INT DEFAULT 15000,
    cargo_limpieza_profunda_clp INT DEFAULT 35000,
    cargo_combustible_cuarto_clp INT DEFAULT 15000,
    cargo_km_extra_clp INT DEFAULT 120,
    km_diarios_incluidos INT DEFAULT 250,
    periodo_gracia_minutos INT DEFAULT 30,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers de actualización automática
DROP TRIGGER IF EXISTS tr_usuarios_updated ON public.usuarios;
CREATE TRIGGER tr_usuarios_updated BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_autos_updated ON public.autos;
CREATE TRIGGER tr_autos_updated BEFORE UPDATE ON public.autos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_reservas_updated ON public.reservas;
CREATE TRIGGER tr_reservas_updated BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_disputas_updated ON public.disputas;
CREATE TRIGGER tr_disputas_updated BEFORE UPDATE ON public.disputas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
