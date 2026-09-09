const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL

const STORAGE_KEY = "rentacar_admin_session";

function leerSesion() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardarSesion(sesion) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
}

function borrarSesion() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Cliente HTTP del panel. Habla SOLO con la API pública (apps/api) — nunca
 * con Supabase directamente. El login/refresh de sesión también pasan por
 * la API (POST /auth/login, /auth/refresh), que hace el intercambio con
 * Supabase del lado del servidor.
 */
export class ApiClient {
  static async login(email, password) {
    const data = await this._requestSinAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    guardarSesion({ access_token: data.access_token, refresh_token: data.refresh_token });
    return data;
  }

  static logout() {
    borrarSesion();
  }

  static tieneSesion() {
    return !!leerSesion()?.access_token;
  }

  static async _requestSinAuth(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
      });
    } catch {
      throw new Error(`No se pudo conectar con la API (${API_BASE_URL}).`);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.detail || `Error en la solicitud: ${response.status}`);
    }
    return body;
  }

  static async _refrescarSesion() {
    const sesion = leerSesion();
    if (!sesion?.refresh_token) return false;
    try {
      const data = await this._requestSinAuth("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: sesion.refresh_token }),
      });
      guardarSesion({ access_token: data.access_token, refresh_token: data.refresh_token });
      return true;
    } catch {
      borrarSesion();
      return false;
    }
  }

  static async request(endpoint, options = {}, _retriedAfterRefresh = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    const sesion = leerSesion();

    const headers = { ...options.headers };
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (sesion?.access_token) headers["Authorization"] = `Bearer ${sesion.access_token}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch {
      throw new Error(`No se pudo conectar con la API (${API_BASE_URL}).`);
    }

    if (response.status === 401 && !_retriedAfterRefresh) {
      const renovado = await this._refrescarSesion();
      if (renovado) return this.request(endpoint, options, true);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) borrarSesion();
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

  // Revisión KYC Usuarios y Conductores
  static getDocumentosPendientes() {
    return this.request("/admin/documentos/pendientes");
  }

  static revisarDocumento(usuarioId, accion, notas) {
    return this.request(`/admin/documentos/${usuarioId}/revisar`, {
      method: "POST",
      body: JSON.stringify({ accion, notas }),
    });
  }

  // Revisión Documentos Autos (Padrón, SOAP, Permiso, Rev. Técnica)
  static getAutosDocumentosPendientes() {
    return this.request("/admin/autos/documentos-pendientes");
  }

  static revisarDocumentosAuto(autoId, accion, notas) {
    return this.request(`/admin/autos/${autoId}/revisar-documentos`, {
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

  // ── Reservas (panel) ────────────────────────────────────────────────────
  // NOTA: los siguientes endpoints todavía no existen en apps/api. El panel
  // los llama igual; mientras no estén, las pantallas muestran su estado de
  // error/vacío. Contrato esperado documentado en docs/panel-endpoints.md.
  static getReservas(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/admin/reservas${qs ? `?${qs}` : ""}`);
  }

  static getReserva(reservaId) {
    return this.request(`/admin/reservas/${reservaId}`);
  }

  // ── Usuarios (panel) ────────────────────────────────────────────────────
  static getUsuarios(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/admin/usuarios${qs ? `?${qs}` : ""}`);
  }

  static getUsuario(usuarioId) {
    return this.request(`/admin/usuarios/${usuarioId}`);
  }

  static actualizarRolesUsuario(usuarioId, roles) {
    return this.request(`/admin/usuarios/${usuarioId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roles_activos: roles }),
    });
  }

  static suspenderUsuario(usuarioId, suspender = true) {
    return this.request(`/admin/usuarios/${usuarioId}/suspension`, {
      method: "POST",
      body: JSON.stringify({ suspendido: suspender }),
    });
  }

  // ── Finanzas ───────────────────────────────────────────────────────────
  static getLiquidaciones() {
    return this.request("/admin/liquidaciones");
  }

  static marcarLiquidacionPagada(liquidacionId) {
    return this.request(`/admin/liquidaciones/${liquidacionId}/pagar`, { method: "POST" });
  }

  static getPagos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/admin/pagos${qs ? `?${qs}` : ""}`);
  }
}
