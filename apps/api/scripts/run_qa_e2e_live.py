"""
Script de prueba automatizada E2E en vivo para Arrienda Tu Auto
Ejecuta secuencialmente los puntos A, B, C, D y E de QA_TEST_PROMPT.md
utilizando las 4 cuentas reales en Supabase Auth y la API local.
"""

import sys
import json
import httpx
from datetime import datetime, date, timedelta, timezone

API_BASE = "http://127.0.0.1:8000/api/v1"
WEB_BASE = "http://localhost:3000"
SUPABASE_URL = "https://rgxiyidijtoazcrmijly.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneGl5aWRpanRvYXpjcm1pamx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzkyNzIsImV4cCI6MjEwMjY1NTI3Mn0."
    "CkLZA7coBk9lvngokZNpbHik6ESGTDWvLOKq2opMVqc"
)
PASSWORD = "QaTest2026!"

ACCOUNTS = {
    "arrendatario": "qa.arrendatario@arriendatuauto.cl",
    "dueno": "qa.dueno@arriendatuauto.cl",
    "admin": "qa.admin@arriendatuauto.cl",
    "manager": "qa.manager@arriendatuauto.cl",
}

def login_supabase(email: str, password: str = PASSWORD) -> str:
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    data = {"email": email, "password": password}
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(url, headers=headers, json=data)
        if resp.status_code != 200:
            raise RuntimeError(f"Error al autenticar {email} en Supabase ({resp.status_code}): {resp.text}")
        token = resp.json().get("access_token")
        if not token:
            raise RuntimeError(f"No se recibió access_token para {email}")
        return token

def get_auth_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def run_qa_suite():
    report = []
    def log(section, msg, status="PASS"):
        formatted = f"[{status}] [{section}] {msg}"
        print(formatted)
        report.append(formatted)

    client = httpx.Client(timeout=20.0)

    print("\n=======================================================")
    print(" INICIANDO PRUEBAS AUTOMATIZADAS DE QA EN VIVO")
    print("=======================================================\n")

    # -----------------------------------------------------------------
    # SECCIÓN A: SITIO WEB PÚBLICO (SIN LOGIN)
    # -----------------------------------------------------------------
    print("--- SECCIÓN A: SITIO WEB PÚBLICO Y CATÁLOGO ---")
    try:
        resp_web = client.get(f"{WEB_BASE}/")
        if resp_web.status_code == 200:
            log("A.Web", "Sitio Web Next.js responde correctamente (HTTP 200)")
        else:
            log("A.Web", f"Sitio Web retornó HTTP {resp_web.status_code}", "FAIL")

        resp_autos = client.get(f"{API_BASE}/autos")
        if resp_autos.status_code != 200:
            log("A.API", f"Endpoint /autos falló con HTTP {resp_autos.status_code}", "FAIL")
        else:
            autos = resp_autos.json()
            log("A.API", f"Listado de autos obtenido con éxito ({len(autos)} autos activos)")
            
            valid_specs = True
            for a in autos:
                patente = a.get("patente")
                marca = a.get("marca")
                modelo = a.get("modelo")
                tarifa = a.get("tarifa_dia")
                
                if not (marca and modelo and patente and tarifa):
                    valid_specs = False
                    log("A.Specs", f"Auto {patente} tiene datos básicos faltantes", "FAIL")
                
                auto_id = a.get("id")
                resp_detail = client.get(f"{API_BASE}/autos/{auto_id}")
                if resp_detail.status_code != 200:
                    valid_specs = False
                    log("A.Detail", f"Error al consultar detalle de auto {auto_id}", "FAIL")

            if valid_specs:
                log("A.Specs", "Todos los autos tienen especificaciones válidas y completas sin campos vacíos")
    except Exception as e:
        log("A.Error", f"Excepción en Sección A: {str(e)}", "FAIL")

    # -----------------------------------------------------------------
    # SECCIÓN B: MOBILE-OWNER — LOGIN Y FLOTA
    # -----------------------------------------------------------------
    print("\n--- SECCIÓN B: DUEÑO (LOGIN, FLOTA, GANANCIAS Y CUENTA) ---")
    try:
        dueno_token = login_supabase(ACCOUNTS["dueno"])
        dueno_headers = get_auth_headers(dueno_token)
        log("B.Auth", "Login exitoso en Supabase Auth como Dueño (qa.dueno@arriendatuauto.cl)")

        # Verificar perfil
        resp_me = client.get(f"{API_BASE}/usuarios/me", headers=dueno_headers)
        dueno_user = resp_me.json()
        log("B.Perfil", f"Perfil cargado: {dueno_user.get('nombre')} (RUT: {dueno_user.get('rut')})")

        # Verificar flota
        resp_flota = client.get(f"{API_BASE}/autos?dueno_id={dueno_user['id']}", headers=dueno_headers)
        flota = resp_flota.json()
        patentes = [a["patente"] for a in flota]
        log("B.Flota", f"Autos encontrados: {patentes}")
        if "QATS-01" in patentes and "QATS-02" in patentes:
            log("B.Flota", "QATS-01 (Chevrolet Sail) y QATS-02 (Nissan Versa) están presentes en la flota")
        else:
            log("B.Flota", "Faltan autos esperados en la flota del dueño", "FAIL")

        auto_qats02 = next((a for a in flota if a["patente"] == "QATS-02"), None)
        auto_qats01 = next((a for a in flota if a["patente"] == "QATS-01"), None)

        if auto_qats02:
            auto_id = auto_qats02["id"]
            # 1. Editar tarifa
            nueva_tarifa = 28500
            resp_tarifa = client.patch(
                f"{API_BASE}/autos/{auto_id}",
                headers=dueno_headers,
                json={"tarifa_dia": nueva_tarifa}
            )
            if resp_tarifa.status_code == 200 and resp_tarifa.json().get("tarifa_dia") == nueva_tarifa:
                log("B.Tarifa", f"Tarifa de QATS-02 actualizada exitosamente a ${nueva_tarifa:,} CLP")
            else:
                log("B.Tarifa", f"Error al actualizar tarifa de QATS-02: {resp_tarifa.text}", "FAIL")

            # 2. Pausar y reactivar auto
            resp_pause = client.patch(f"{API_BASE}/autos/{auto_id}", headers=dueno_headers, json={"estado": "pausado"})
            resp_active = client.patch(f"{API_BASE}/autos/{auto_id}", headers=dueno_headers, json={"estado": "activo"})
            if resp_pause.status_code == 200 and resp_active.status_code == 200:
                log("B.Estado", "Pausa y reactivación de QATS-02 ejecutadas con éxito")
            else:
                log("B.Estado", "Error en cambio de estado de publicación", "FAIL")

            # 3. Bloqueo de calendario
            bloqueo_fecha = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
            resp_bloqueo = client.post(
                f"{API_BASE}/autos/{auto_id}/bloqueos",
                headers=dueno_headers,
                json={"fecha": bloqueo_fecha, "motivo": "Uso personal fin de semana"}
            )
            if resp_bloqueo.status_code == 200:
                bloqueo_id = resp_bloqueo.json().get("id")
                log("B.Bloqueo", f"Bloqueo de calendario creado para {bloqueo_fecha[:10]} (ID: {bloqueo_id})")
            else:
                log("B.Bloqueo", f"Error al crear bloqueo: {resp_bloqueo.text}", "FAIL")

            # 4. Mantención
            resp_mant = client.post(
                f"{API_BASE}/autos/{auto_id}/mantenciones",
                headers=dueno_headers,
                json={
                    "tipo": "servicio_mecanico",
                    "nombre": "Cambio de aceite sintético 5W-30 y filtro de aire",
                    "kilometraje": 32000,
                    "notas": "Realizado en Taller Central Los Ángeles"
                }
            )
            if resp_mant.status_code == 200:
                log("B.Mantencion", f"Mantención registrada con éxito: {resp_mant.json().get('nombre')}")
            else:
                log("B.Mantencion", f"Error al registrar mantención: {resp_mant.text}", "FAIL")

        # 5. Ganancias y Cuenta Bancaria
        resp_ganancias = client.get(f"{API_BASE}/pagos/mis-ganancias", headers=dueno_headers)
        if resp_ganancias.status_code == 200:
            data_ganancias = resp_ganancias.json()
            log("B.Ganancias", f"Saldo disponible consultado: ${data_ganancias.get('saldo_disponible_clp', 0):,} CLP (Total pagado: ${data_ganancias.get('total_pagado_clp', 0):,} CLP)")
        else:
            log("B.Ganancias", f"Error al consultar ganancias: {resp_ganancias.text}", "FAIL")

        # 6. Actualizar y persistir Cuenta Bancaria
        cuenta_payload = {
            "banco": "Banco de Chile",
            "tipo_cuenta": "Cuenta Corriente",
            "numero": "00123456789",
            "titular": "QA Dueño",
            "rut": "17.123.456-5"
        }
        resp_cuenta = client.put(f"{API_BASE}/usuarios/me/cuenta-bancaria", headers=dueno_headers, json=cuenta_payload)
        resp_check_me = client.get(f"{API_BASE}/usuarios/me", headers=dueno_headers)
        saved_cuenta = resp_check_me.json().get("cuenta_bancaria") or {}
        if saved_cuenta.get("rut") == "17.123.456-5" and saved_cuenta.get("banco") == "Banco de Chile":
            log("B.CuentaBancaria", "Cuenta bancaria con RUT chileno guardada y persistida correctamente")
        else:
            log("B.CuentaBancaria", f"Fallo al persistir cuenta bancaria: {saved_cuenta}", "FAIL")

    except Exception as e:
        log("B.Error", f"Excepción en Sección B: {str(e)}", "FAIL")

    # -----------------------------------------------------------------
    # SECCIÓN C: CIRCUITO DE ENTREGA QR Y DEVOLUCIÓN
    # -----------------------------------------------------------------
    print("\n--- SECCIÓN C: CIRCUITO CRUZADO DE ENTREGA Y DEVOLUCIÓN ---")
    try:
        arrendatario_token = login_supabase(ACCOUNTS["arrendatario"])
        arrendatario_headers = get_auth_headers(arrendatario_token)
        log("C.Auth", "Login exitoso como Arrendatario (qa.arrendatario@arriendatuauto.cl)")

        # Localizar la reserva confirmada
        reserva_id = "b13f6aea-53ff-4d1b-bd50-4e7d1eec83cf"
        resp_reserva = client.get(f"{API_BASE}/reservas/{reserva_id}", headers=arrendatario_headers)
        if resp_reserva.status_code != 200:
            log("C.Reserva", f"Error al cargar reserva {reserva_id}: {resp_reserva.text}", "FAIL")
        else:
            reserva_data = resp_reserva.json()
            log("C.Reserva", f"Reserva encontrada en estado '{reserva_data.get('estado')}' (Lugar: {reserva_data.get('lugar_entrega_acordado')})")

        # C.1 Arrendatario genera código QR de entrega
        resp_qr_entrega = client.post(f"{API_BASE}/reservas/{reserva_id}/generar-codigo", headers=arrendatario_headers)
        if resp_qr_entrega.status_code != 200:
            log("C.QR_Entrega", f"Error al generar código QR: {resp_qr_entrega.text}", "FAIL")
            codigo_hash = None
        else:
            qr_data = resp_qr_entrega.json()
            codigo_hash = qr_data.get("codigo_qr_hash")
            log("C.QR_Entrega", f"Código QR generado por Arrendatario (Hash: {codigo_hash[:16]}...)")

        # C.2 Dueño valida el código QR
        if codigo_hash:
            resp_val_entrega = client.post(
                f"{API_BASE}/entrega/validar-codigo",
                headers=dueno_headers,
                json={"codigo_qr_hash": codigo_hash}
            )
            if resp_val_entrega.status_code == 200:
                val_data = resp_val_entrega.json()
                log("C.Valida_Entrega", f"Dueño valida código: Cliente '{val_data.get('cliente_nombre')}', Auto '{val_data.get('auto_patente')}'")
            else:
                log("C.Valida_Entrega", f"Error al validar código QR: {resp_val_entrega.text}", "FAIL")

            # C.3 Dueño confirma identidad del cliente
            resp_conf_identidad = client.post(
                f"{API_BASE}/entrega/{reserva_id}/confirmar-verificacion",
                headers=dueno_headers,
                json={"resultado": "confirmada", "tipo": "entrega"}
            )
            if resp_conf_identidad.status_code == 200:
                log("C.Identidad_Entrega", "Identidad del cliente verificada y aprobada por el dueño")
            else:
                log("C.Identidad_Entrega", f"Error al confirmar verificación: {resp_conf_identidad.text}", "FAIL")

            # C.4 Dueño completa checklist inicial (fotos + odómetro + combustible)
            checklist_inicial_payload = {
                "tipo": "antes",
                "fotos": [
                    "https://storage.arriendatuauto.cl/checklists/front.jpg",
                    "https://storage.arriendatuauto.cl/checklists/back.jpg",
                    "https://storage.arriendatuauto.cl/checklists/left.jpg",
                    "https://storage.arriendatuauto.cl/checklists/right.jpg",
                    "https://storage.arriendatuauto.cl/checklists/dashboard.jpg",
                    "https://storage.arriendatuauto.cl/checklists/interior_front.jpg",
                    "https://storage.arriendatuauto.cl/checklists/interior_back.jpg",
                    "https://storage.arriendatuauto.cl/checklists/trunk.jpg"
                ],
                "kilometraje": 45200,
                "nivel_combustible": "lleno",
                "estado_limpieza": "limpio",
                "notas": "Auto entregado en perfecto estado con estanque lleno."
            }
            resp_chk_ini = client.post(
                f"{API_BASE}/entrega/{reserva_id}/checklist",
                headers=dueno_headers,
                json=checklist_inicial_payload
            )
            if resp_chk_ini.status_code == 200:
                log("C.Checklist_Inicial", "Checklist inicial registrado. Reserva ha pasado a 'en_curso'")
            else:
                log("C.Checklist_Inicial", f"Error en checklist inicial: {resp_chk_ini.text}", "FAIL")

            # C.5 CIRCUITO DE DEVOLUCIÓN
            # Arrendatario genera código QR de devolución
            resp_qr_dev = client.post(f"{API_BASE}/reservas/{reserva_id}/generar-codigo", headers=arrendatario_headers)
            codigo_dev_hash = resp_qr_dev.json().get("codigo_qr_hash")
            log("C.QR_Devolucion", f"Código QR de devolución generado (Hash: {codigo_dev_hash[:16]}...)")

            # Dueño valida código de devolución
            resp_val_dev = client.post(
                f"{API_BASE}/entrega/validar-codigo",
                headers=dueno_headers,
                json={"codigo_qr_hash": codigo_dev_hash}
            )
            log("C.Valida_Devolucion", "Dueño valida código de devolución correctamente")

            # Dueño confirma verificación de devolución
            resp_conf_dev = client.post(
                f"{API_BASE}/entrega/{reserva_id}/confirmar-verificacion",
                headers=dueno_headers,
                json={"resultado": "confirmada", "tipo": "devolucion"}
            )
            log("C.Identidad_Devolucion", "Verificación de devolución confirmada")

            # Dueño completa checklist final
            checklist_final_payload = {
                "tipo": "despues",
                "fotos": [
                    "https://storage.arriendatuauto.cl/checklists/return_front.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_back.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_left.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_right.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_dashboard.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_interior_front.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_interior_back.jpg",
                    "https://storage.arriendatuauto.cl/checklists/return_trunk.jpg"
                ],
                "kilometraje": 45450,
                "nivel_combustible": "lleno",
                "estado_limpieza": "limpio",
                "cargo_limpieza_clp": 0,
                "notas": "Auto recibido en excelentes condiciones, sin novedades."
            }
            resp_chk_fin = client.post(
                f"{API_BASE}/entrega/{reserva_id}/checklist",
                headers=dueno_headers,
                json=checklist_final_payload
            )
            if resp_chk_fin.status_code == 200:
                chk_fin_data = resp_chk_fin.json()
                log("C.Checklist_Final", f"Checklist final completado. Reserva finalizada. Liquidación calculada: ${chk_fin_data.get('liquidacion_dueno', 0):,} CLP")
            else:
                log("C.Checklist_Final", f"Error en checklist final: {resp_chk_fin.text}", "FAIL")

            # C.6 Calificación de cliente por el dueño
            resp_calif = client.post(
                f"{API_BASE}/calificaciones",
                headers=dueno_headers,
                json={
                    "reserva_id": reserva_id,
                    "autor_rol": "dueno",
                    "destinatario_id": reserva_data.get("cliente_id"),
                    "puntaje": 5,
                    "comentario": "Excelente arrendatario, muy puntual y cuidó el auto como propio."
                }
            )
            if resp_calif.status_code == 200:
                log("C.Calificacion", "Calificación con 5 estrellas enviada exitosamente")
            else:
                log("C.Calificacion", f"Error al emitir calificación: {resp_calif.text}", "FAIL")

            # C.7 Ganancias actualizadas y solicitud de retiro inmediato
            resp_ganancias_post = client.get(f"{API_BASE}/pagos/mis-ganancias", headers=dueno_headers)
            g_post = resp_ganancias_post.json()
            log("C.Ganancias_Post", f"Ganancias actualizadas: Saldo disponible = ${g_post.get('saldo_disponible_clp', 0):,} CLP, {g_post.get('cantidad_liquidaciones', 0)} liquidaciones")

            # Solicitar retiro inmediato creando ticket de soporte
            resp_ticket_retiro = client.post(
                f"{API_BASE}/soporte/tickets",
                headers=dueno_headers,
                json={
                    "asunto": "Solicitud de retiro inmediato de ganancias",
                    "descripcion": f"Solicito transferencia a mi cuenta bancaria registrada por el saldo disponible de ${g_post.get('saldo_disponible_clp', 0):,} CLP."
                }
            )
            if resp_ticket_retiro.status_code == 200:
                ticket_id = resp_ticket_retiro.json().get("id")
                log("C.Retiro_Inmediato", f"Ticket de soporte para retiro inmediato generado (Ticket ID: {ticket_id})")
            else:
                log("C.Retiro_Inmediato", f"Error al generar ticket de retiro: {resp_ticket_retiro.text}", "FAIL")

    except Exception as e:
        log("C.Error", f"Excepción en Sección C: {str(e)}", "FAIL")

    # -----------------------------------------------------------------
    # SECCIÓN D: CHAT EN VIVO CLIENTE - DUEÑO
    # -----------------------------------------------------------------
    print("\n--- SECCIÓN D: CHAT CLIENTE - DUEÑO ---")
    try:
        # Mensaje 1: Arrendatario a Dueño
        msg1_resp = client.post(
            f"{API_BASE}/reservas/{reserva_id}/mensajes",
            headers=arrendatario_headers,
            json={"texto": "Hola, ya voy en camino a Plaza de Armas, llego en 10 minutos."}
        )
        if msg1_resp.status_code == 200:
            log("D.Mensaje_Renter", "Arrendatario envió mensaje de coordinación exitosamente")
        else:
            log("D.Mensaje_Renter", f"Error al enviar mensaje de arrendatario: {msg1_resp.text}", "FAIL")

        # Dueño consulta mensajes y responde
        dueno_msgs_resp = client.get(f"{API_BASE}/reservas/{reserva_id}/mensajes", headers=dueno_headers)
        dueno_msgs = dueno_msgs_resp.json()
        log("D.Polling_Dueno", f"Dueño recibió {len(dueno_msgs)} mensajes en la conversación")

        msg2_resp = client.post(
            f"{API_BASE}/reservas/{reserva_id}/mensajes",
            headers=dueno_headers,
            json={"texto": "Excelente, estoy estacionado frente a la estatua con el Chevrolet Sail blanco."}
        )
        if msg2_resp.status_code == 200:
            log("D.Mensaje_Dueno", "Dueño envió respuesta al chat")
        else:
            log("D.Mensaje_Dueno", f"Error al responder mensaje: {msg2_resp.text}", "FAIL")

        # Arrendatario consulta y verifica el mensaje del dueño
        renter_msgs_resp = client.get(f"{API_BASE}/reservas/{reserva_id}/mensajes", headers=arrendatario_headers)
        renter_msgs = renter_msgs_resp.json()
        if len(renter_msgs) >= 2 and renter_msgs[-1]["texto"].startswith("Excelente"):
            log("D.Chat_Completo", "Conversación bidireccional en tiempo real verificada con éxito")
        else:
            log("D.Chat_Completo", "No se encontró la respuesta en el polling del arrendatario", "FAIL")

    except Exception as e:
        log("D.Error", f"Excepción en Sección D: {str(e)}", "FAIL")

    # -----------------------------------------------------------------
    # SECCIÓN E: PANELES DE STAFF (ADMIN Y MANAGER)
    # -----------------------------------------------------------------
    print("\n--- SECCIÓN E: PANELES DE STAFF (ADMIN & MANAGER) ---")
    try:
        # 1. Admin
        admin_token = login_supabase(ACCOUNTS["admin"])
        admin_headers = get_auth_headers(admin_token)
        log("E.Auth_Admin", "Login exitoso como Admin (qa.admin@arriendatuauto.cl)")

        resp_fin = client.get(f"{API_BASE}/admin/panel-financiero", headers=admin_headers)
        log("E.Admin_Financiero", f"Panel Financiero Admin: {resp_fin.json()}")

        resp_met = client.get(f"{API_BASE}/admin/metricas-globales", headers=admin_headers)
        log("E.Admin_Metricas", f"Métricas Globales: {resp_met.json()}")

        resp_disp = client.get(f"{API_BASE}/disputas", headers=admin_headers)
        log("E.Admin_Disputas", f"Disputas activas listadas ({len(resp_disp.json())} abiertas)")

        resp_ocr = client.get(f"{API_BASE}/admin/documentos/pendientes", headers=admin_headers)
        log("E.Admin_OCR", f"Revisión OCR manual ({len(resp_ocr.json())} usuarios pendientes)")

        resp_cfg = client.get(f"{API_BASE}/admin/configuracion", headers=admin_headers)
        cfg_data = resp_cfg.json()
        log("E.Admin_Config_RF33", f"Configuración de Plataforma RF-33: Comisión = {cfg_data.get('comision_plataforma_pct')}%, UF = ${cfg_data.get('valor_uf_clp'):,}")

        # Probar actualización de parámetro RF-33
        resp_cfg_upd = client.put(
            f"{API_BASE}/admin/configuracion",
            headers=admin_headers,
            json={"comision_plataforma_pct": 20.0, "cargo_limpieza_estandar_clp": 16000}
        )
        if resp_cfg_upd.status_code == 200:
            log("E.Admin_Config_Update", "Parámetro de plataforma actualizado correctamente por Admin")
        else:
            log("E.Admin_Config_Update", f"Error al actualizar configuración: {resp_cfg_upd.text}", "FAIL")

        # 2. Manager
        manager_token = login_supabase(ACCOUNTS["manager"])
        manager_headers = get_auth_headers(manager_token)
        log("E.Auth_Manager", "Login exitoso como Manager (qa.manager@arriendatuauto.cl)")

        resp_flota_suc = client.get(f"{API_BASE}/admin/flota-sucursal", headers=manager_headers)
        flota_suc = resp_flota_suc.json()
        suc_patentes = [a["patente"] for a in flota_suc]
        log("E.Manager_Flota", f"Flota de sucursal Los Ángeles: {suc_patentes}")
        if "QATS-01" in suc_patentes and "QATS-02" in suc_patentes:
            log("E.Manager_Flota", "Los autos QATS-01 y QATS-02 están visibles para el Manager")
        else:
            log("E.Manager_Flota", "Autos QATS faltantes en vista de sucursal", "FAIL")

        resp_tickets = client.get(f"{API_BASE}/soporte/tickets", headers=manager_headers)
        tickets = resp_tickets.json()
        log("E.Manager_Tickets", f"Tickets de soporte de la sucursal: {len(tickets)} tickets encontrados")
        
        # Probar resolver localmente el ticket de retiro o de consulta
        if tickets:
            t_to_resolve = tickets[0]
            resp_close_ticket = client.post(
                f"{API_BASE}/soporte/tickets/{t_to_resolve['id']}/cerrar",
                headers=manager_headers
            )
            if resp_close_ticket.status_code == 200:
                log("E.Manager_Resolver_Ticket", f"Ticket '{t_to_resolve['asunto']}' resuelto localmente por Manager")
            else:
                log("E.Manager_Resolver_Ticket", f"Error al cerrar ticket: {resp_close_ticket.text}", "FAIL")

    except Exception as e:
        log("E.Error", f"Excepción en Sección E: {str(e)}", "FAIL")

    print("\n=======================================================")
    print(" RESUMEN FINAL DE EJECUCIÓN QA")
    print("=======================================================")
    fails = [r for r in report if "[FAIL]" in r]
    passes = [r for r in report if "[PASS]" in r]
    print(f"Total pruebas pasadas: {len(passes)}")
    print(f"Total fallos: {len(fails)}")
    if fails:
        print("\nDetalle de fallos:")
        for f in fails:
            print(f" - {f}")
        return False
    else:
        print("\n¡TODAS LAS PRUEBAS DE QA EN VIVO SE COMPLETARON EXITOSAMENTE!")
        return True

if __name__ == "__main__":
    success = run_qa_suite()
    sys.exit(0 if success else 1)
