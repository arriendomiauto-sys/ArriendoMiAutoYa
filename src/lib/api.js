import { supabase } from "./supabase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Cliente HTTP del panel. Adjunta el Bearer token de la sesión Supabase
 * activa a cada request, igual que packages/mobile-shared/api/client.js en
 * los otros clientes de esta misma API.
 */
export class ApiClient {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await getAccessToken();

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (netErr) {
      throw new Error(
        `No se pudo conectar con el servidor (${API_BASE_URL}). Revisa que la API esté corriendo.`
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Error en la solicitud: ${response.status}`);
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  // Usuario autenticado
  static getMe() {
    return this.request("/usuarios/me");
  }

  // Dashboard
  static getMetricasGlobales() {
    return this.request("/admin/metricas-globales");
  }

  static getPanelFinanciero() {
    return this.request("/admin/panel-financiero");
  }

  // Soporte (tickets)
  static getTickets(sucursalId) {
    const query = sucursalId ? `?sucursal_id=${sucursalId}` : "";
    return this.request(`/soporte/tickets${query}`);
  }

  static cerrarTicket(ticketId) {
    return this.request(`/soporte/tickets/${ticketId}/cerrar`, { method: "POST" });
  }

  static escalarTicket(ticketId, reservaId) {
    return this.request(
      `/soporte/tickets/${ticketId}/escalar?reserva_id=${encodeURIComponent(reservaId)}`,
      { method: "POST" }
    );
  }

  // Disputas
  static getDisputas(estado = "abierta") {
    return this.request(`/disputas?estado=${estado}`);
  }

  static getDisputa(disputaId) {
    return this.request(`/disputas/${disputaId}`);
  }

  static resolverDisputa(disputaId, resolucion, accionPago) {
    return this.request(`/disputas/${disputaId}/resolver`, {
      method: "POST",
      body: JSON.stringify({ resolucion, accion_pago: accionPago }),
    });
  }

  // Revisión KYC
  static getDocumentosPendientes() {
    return this.request("/admin/documentos/pendientes");
  }

  static revisarDocumento(usuarioId, accion, notas) {
    return this.request(`/admin/documentos/${usuarioId}/revisar`, {
      method: "POST",
      body: JSON.stringify({ accion, notas }),
    });
  }

  // Flota
  static getFlota() {
    return this.request("/admin/flota-sucursal");
  }

  // Configuración de plataforma
  static getConfiguracion() {
    return this.request("/admin/configuracion");
  }

  static actualizarConfiguracion(payload) {
    return this.request("/admin/configuracion", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }
}
