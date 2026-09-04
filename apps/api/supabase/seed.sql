-- =========================================================================
-- SEED DE DATOS DE DEMOSTRACIÓN - ARRIENDA TU AUTO (SUPABASE)
-- =========================================================================
-- Espejo exacto de app/core/seed.py (seed_demo_data), que es lo que corre
-- automáticamente en desarrollo contra SQLite. Usa este .sql para dejar el
-- mismo set de datos en un proyecto de Supabase Postgres recién provisionado
-- con schema.sql.
--
-- Los usuarios de este seed (dueno@arriendatuauto.cl, cliente@..., etc.) son
-- solo filas de base de datos: NO existen como cuentas reales de Supabase
-- Auth, así que no se puede iniciar sesión con ellas desde la app. Para
-- probar la app con login real, usa las cuentas QA descritas en
-- QA_TEST_DATA.txt (en la raíz del monorepo) o crea las tuyas con
-- supabase.auth.admin.createUser().
--
-- Ejecutar UNA sola vez, en orden, después de aplicar schema.sql.
-- =========================================================================

-- 0. Configuración de plataforma
INSERT INTO public.configuracion_plataforma (
    id, valor_uf_clp, comision_plataforma_pct, hold_enrolamiento_clp,
    cargo_limpieza_estandar_clp, cargo_limpieza_profunda_clp,
    cargo_combustible_cuarto_clp, cargo_km_extra_clp, km_diarios_incluidos,
    periodo_gracia_minutos
) VALUES (
    'default', 38000.0, 20.0, 800000, 15000, 35000, 15000, 120, 250, 30
) ON CONFLICT (id) DO NOTHING;

-- 1. Sucursal Los Ángeles, Chile
INSERT INTO public.sucursales (id, nombre, ubicacion, latitud, longitud, radio_cobertura_km, managers_asignados)
VALUES (
    'seed-sucursal-los-angeles', 'Sucursal Los Ángeles Centro',
    'Los Ángeles, Región del Biobío, Chile', -37.4697, -72.3537, 30.0, '[]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. Usuarios (RUTs chilenos matemáticamente válidos, Módulo 11)
INSERT INTO public.usuarios (id, nombre, rut, email, telefono, foto_perfil_verificada_url, estado_documentos, confianza_ocr, notas_auditoria, roles_activos, sucursal_id)
VALUES
(
    'seed-usuario-dueno', 'Carlos Mendoza', '15.892.341-6', 'dueno@arriendatuauto.cl', '+56911223344',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', 'verificado', 0.98, NULL,
    '["dueno", "cliente"]'::jsonb, 'seed-sucursal-los-angeles'
),
(
    'seed-usuario-cliente', 'María José Silva', '19.234.567-7', 'cliente@arriendatuauto.cl', '+56999887766',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', 'verificado', 0.96, NULL,
    '["cliente"]'::jsonb, 'seed-sucursal-los-angeles'
),
(
    'seed-usuario-cliente-pendiente', 'Pedro Alarcón Gómez', '18.456.789-K', 'pedro.alarcon@gmail.com', '+56977665544',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', 'requiere_revision_manual', 0.74,
    'Foto de carnet con leve reflejo de luz. Requiere confirmación visual de Admin.',
    '["cliente"]'::jsonb, 'seed-sucursal-los-angeles'
),
(
    'seed-usuario-manager', 'Rodrigo Manager', '14.333.222-5', 'manager.la@arriendatuauto.cl', '+56955443322',
    NULL, 'verificado', 1.0, NULL, '["manager"]'::jsonb, 'seed-sucursal-los-angeles'
),
(
    'seed-usuario-admin', 'Administrador General', '11.222.333-9', 'admin@arriendatuauto.cl', '+56912345678',
    NULL, 'verificado', 1.0, NULL, '["admin"]'::jsonb, NULL
)
ON CONFLICT (id) DO NOTHING;

-- 3. Autos demo en Los Ángeles (todos del dueño seed)
INSERT INTO public.autos (id, dueno_id, marca, modelo, anio, patente, tarifa_dia, estado, ubicacion_base, latitud, longitud, fotos, equipamiento)
VALUES
(
    'seed-auto-rav4', 'seed-usuario-dueno', 'Toyota', 'RAV4 Limited 4x4', 2023, 'BBCL-10', 42000, 'activo',
    'Plaza de Armas, Los Ángeles', -37.4695, -72.3540,
    '["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800", "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800"]'::jsonb,
    '{}'::jsonb
),
(
    'seed-auto-tucson', 'seed-usuario-dueno', 'Hyundai', 'Tucson GL', 2022, 'CRTX-45', 35000, 'activo',
    'Av. Alemania, Los Ángeles', -37.4620, -72.3600,
    '["https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"]'::jsonb,
    '{}'::jsonb
),
(
    'seed-auto-jimny', 'seed-usuario-dueno', 'Suzuki', 'Jimny AllGrip 4x4', 2024, 'JKLM-56', 48000, 'activo',
    'Centro, Los Ángeles', -37.4680, -72.3520,
    '["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"]'::jsonb,
    '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 4. Reserva confirmada de ejemplo (lista para escaneo QR)
-- fecha_inicio = ahora, fecha_fin = ahora + 3 días, monto_hold = 3 * 42.000
INSERT INTO public.reservas (id, auto_id, cliente_id, fecha_inicio, fecha_fin, estado, monto_hold, codigo_qr_hash, lugar_entrega_acordado)
VALUES (
    'seed-reserva-demo', 'seed-auto-rav4', 'seed-usuario-cliente',
    NOW(), NOW() + INTERVAL '3 days', 'confirmada', 126000,
    'qr_demo_hash_12345', 'Plaza de Armas Los Ángeles'
) ON CONFLICT (id) DO NOTHING;

-- 5. Hold de enrolamiento y hold de reserva
INSERT INTO public.pagos (id, reserva_id, usuario_id, tipo, monto, estado, referencia_pago)
VALUES
(
    'seed-pago-enrolamiento', NULL, 'seed-usuario-cliente', 'hold_enrolamiento', 800000, 'capturado', 'MP-DEMO-ENROL-800K'
),
(
    'seed-pago-reserva', 'seed-reserva-demo', 'seed-usuario-cliente', 'hold_reserva', 126000, 'capturado', 'MP-DEMO-RES-126K'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Ticket de soporte demo
INSERT INTO public.tickets_soporte (id, usuario_id, sucursal_id, asunto, descripcion)
VALUES (
    'seed-ticket-demo', 'seed-usuario-cliente', 'seed-sucursal-los-angeles',
    'Consulta sobre punto de encuentro en Plaza de Armas',
    'Hola, quisiera confirmar si el dueño puede entregar el auto frente a la Municipalidad.'
) ON CONFLICT (id) DO NOTHING;
