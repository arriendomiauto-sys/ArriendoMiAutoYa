-- =========================================================================
-- SEED DE DATOS REALISTAS - ARRIENDO MI AUTO YA (SUPABASE)
-- =========================================================================

-- 1. Configuración de Plataforma
INSERT INTO public.configuracion_plataforma (id, valor_uf_clp, comision_plataforma_pct, garantia_base_clp)
VALUES ('default', 38000.0, 20.0, 150000)
ON CONFLICT (id) DO UPDATE SET
    valor_uf_clp = EXCLUDED.valor_uf_clp,
    comision_plataforma_pct = EXCLUDED.comision_plataforma_pct,
    garantia_base_clp = EXCLUDED.garantia_base_clp;

-- 2. Sucursales
INSERT INTO public.sucursales (id, nombre, comuna, region, direccion, latitud, longitud)
VALUES 
('11111111-1111-1111-1111-111111111111', 'Sucursal Santiago Providencia', 'Providencia', 'Metropolitana', 'Av. Providencia 2145', -33.4258, -70.6087),
('22222222-2222-2222-2222-222222222222', 'Sucursal Los Ángeles Centro', 'Los Ángeles', 'Biobío', 'Plaza de Armas, Los Ángeles', -37.4697, -72.3537)
ON CONFLICT (id) DO NOTHING;

-- 3. Usuarios de Demostración
INSERT INTO public.usuarios (id, nombre, apellido, email, telefono, rut, foto_perfil_url, estado_kyc, roles, rating_promedio, total_viajes, sucursal_id)
VALUES 
-- Dueño / Anfitrión
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rodrigo', 'Muñoz', 'rodrigo.munoz@arriendamiauto.cl', '+56 9 7734 1208', '15.892.341-6', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', 'verificado', ARRAY['conductor', 'pasajero'], 4.90, 31, '11111111-1111-1111-1111-111111111111'),

-- Arrendataria / Cliente
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camila', 'Aravena', 'camila.aravena@gmail.com', '+56 9 8812 4433', '19.234.567-7', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', 'verificado', ARRAY['pasajero'], 4.95, 12, '11111111-1111-1111-1111-111111111111'),

-- Manager de Sucursal
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Fernando', 'Manager', 'manager.santiago@arriendamiauto.cl', '+56 9 5544 3322', '14.333.222-5', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', 'verificado', ARRAY['manager'], 5.00, 0, '11111111-1111-1111-1111-111111111111'),

-- Administrador General
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Admin', 'General', 'admin@arriendamiauto.cl', '+56 9 1234 5678', '11.222.333-9', NULL, 'verificado', ARRAY['admin'], 5.00, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Cuenta Bancaria del Dueño
INSERT INTO public.cuentas_bancarias_dueno (id, usuario_id, banco, tipo_cuenta, numero_cuenta, titular, rut_titular)
VALUES 
('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Banco Estado', 'CuentaRUT', '15892341', 'Rodrigo Muñoz', '15.892.341-6')
ON CONFLICT (id) DO NOTHING;

-- 5. Tarjetas de la Arrendataria
INSERT INTO public.metodos_pago (id, usuario_id, tipo, marca, ultimos_4, titular, vencimiento, es_principal)
VALUES 
('44444444-4444-4444-4444-444444444441', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Crédito', 'Visa', '8842', 'CAMILA ARAVENA', '08/28', TRUE),
('44444444-4444-4444-4444-444444444442', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Débito', 'Mastercard', '1932', 'CAMILA ARAVENA', '11/27', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 6. Vehículos Publicados
INSERT INTO public.autos (id, dueno_id, marca, modelo, ano, patente, categoria, transmision, combustible, tarifa_dia, garantia_requerida, comuna, direccion_entrega, latitud, longitud, foto_principal_url, rating_promedio, total_arriendos)
VALUES 
('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Suzuki', 'Swift', 2023, 'BBFK-42', 'Económico', 'Automático', 'Bencina', 38000, 150000, 'Providencia', 'Av. Providencia 2145', -33.4258, -70.6087, 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800', 4.80, 18),
('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Toyota', 'RAV4 Limited 4x4', 2023, 'BBCL-10', 'SUV', 'Automático', 'Bencina', 55000, 200000, 'Las Condes', 'Av. Apoquindo 4800', -33.4120, -70.5750, 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800', 4.95, 24),
('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hyundai', 'Tucson GL', 2022, 'CRTX-45', 'SUV', 'Automático', 'Bencina', 46000, 150000, 'Santiago Centro', 'Alameda 1400', -33.4440, -70.6550, 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800', 4.70, 9),
('10000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ford', 'Ranger XLT 4x4', 2024, 'RGFT-99', 'Camioneta', 'Automático', 'Diésel', 62000, 250000, 'Los Ángeles', 'Av. Alemania 800', -37.4620, -72.3600, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800', 4.90, 15)
ON CONFLICT (id) DO NOTHING;

-- 7. Reserva Activa de Demostración
INSERT INTO public.reservas (id, codigo_contrato, auto_id, cliente_id, fecha_inicio, fecha_fin, dias, tarifa_diaria_clp, subtotal_clp, iva_clp, total_arriendo_clp, garantia_retenida_clp, ganancia_dueno_clp, comision_plataforma_clp, estado, estado_garantia)
VALUES 
('99999999-9999-9999-9999-999999999999', 'AMY-2026-04871', '10000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', 4, 38000, 158000, 30020, 188020, 150000, 150416, 37604, 'en_curso', 'retenida')
ON CONFLICT (id) DO NOTHING;

-- 8. Checklist de Entrega (Check-in con fotos)
INSERT INTO public.checklists_entrega (id, reserva_id, tipo, kilometraje, nivel_combustible, observaciones, completado_por_id)
VALUES 
('55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', 'entrega', 48320, '3/4', 'Auto entregado limpio y en perfecto estado. 8 fotos tomadas sin objeciones.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- 9. Pagos Registrados
INSERT INTO public.pagos (id, reserva_id, usuario_id, tipo, monto_clp, estado, referencia_transbank)
VALUES 
('66666666-6666-6666-6666-666666666661', '99999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'arriendo', 188020, 'exitoso', 'TBK-RES-188K'),
('66666666-6666-6666-6666-666666666662', '99999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'hold_garantia', 150000, 'exitoso', 'TBK-HOLD-150K')
ON CONFLICT (id) DO NOTHING;

-- 10. Mensajes de Chat Demo
INSERT INTO public.mensajes_chat (id, reserva_id, remitente_id, destinatario_id, contenido)
VALUES 
('77777777-7777-7777-7777-777777777771', '99999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hola Rodrigo, voy en camino al punto de encuentro en Providencia 2145.'),
('77777777-7777-7777-7777-777777777772', '99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Perfecto Camila, el auto está limpio y con 3/4 de estanque listo para las fotos.')
ON CONFLICT (id) DO NOTHING;

-- 11. Notificaciones
INSERT INTO public.notificaciones (id, usuario_id, titulo, mensaje, tipo, icono)
VALUES 
('88888888-8888-8888-8888-888888888881', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arriendo en curso', 'El Suzuki Swift fue entregado a Camila Aravena.', 'reserva', 'car'),
('88888888-8888-8888-8888-888888888882', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Garantía retenida', 'Se autorizó el hold de $150.000 CLP de garantía.', 'pago', 'card')
ON CONFLICT (id) DO NOTHING;
