const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://arriendomiautoya.onrender.com/api/v1"
).replace(/\/+$/, "");

// El access token vive SOLO en memoria (variable de módulo): se pierde al
// recargar la página a propósito, de forma que un XSS no puede leer el
// refresh token ni robar una sesión de larga vida. La cookie httpOnly del
// refresh token (seteada por la API en login/refresh) es la que permite
// restaurar la sesión tras una recarga.
let accessToken = null;

// Promesa compartida del refresh en curso (single-flight): mientras hay una
// renovación de sesión activa, todos los requests que reciban 401 esperan
// esta MISMA promesa en vez de disparar N llamadas paralelas a /auth/refresh.
let refreshPromise = null;

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
    // El refresh_token del body se ignora a propósito: para el panel la
    // sesión se restaura desde la cookie httpOnly que la API setea en el
    // login, no desde un token persistido en localStorage.
    accessToken = data.access_token || null;
    return data;
  }

  static logout() {
    if (accessToken) {
      // Best-effort: revoca la sesión en Supabase y borra la cookie. No se
      // espera la respuesta — el logout local no debe colgarse por una red
      // lenta ni fallar si el access token ya venció.
      const bearer = accessToken;
      this._requestSinAuth("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}` },
      }).catch(() => {});
    }
    accessToken = null;
    refreshPromise = null;
  }

  /** ¿Hay un access token en memoria? No detecta la cookie httpOnly (no es
   * legible por JS): la restauración real de sesión ocurre en validarSesion
   * al llamar a /usuarios/me y que la API valide la cookie. */
  static tieneSesion() {
    return accessToken !== null;
  }

  static async _requestSinAuth(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
        // Obligatorio para que el navegador 1) GUARDE la cookie httpOnly que
        // manda la API en login/refresh/logout y 2) la reenvíe en cada
        // request. Los fetch cross-origin no envían cookies por defecto.
        credentials: "include",
      });
    } catch {
      throw new Error(`No se pudo conectar con la API (${API_BASE_URL}).`);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(body.detail || `Error en la solicitud: ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return body;
  }

  /**
   * Renueva el access token usando la cookie httpOnly (el navegador la manda
   * sola en esta llamada). Single-flight: si ya hay un refresh en curso, los
   * requests concurrentes se cuelgan de la misma promesa; se limpia cuando
   * termina (éxito o fallo) para no cachear errores en sesiones largas.
   */
  static async _refrescarSesion() {
    if (!refreshPromise) {
      refreshPromise = this._requestSinAuth("/auth/refresh", {
        method: "POST",
        // Sin refresh_token en el body: el panel no lo conoce; la API lo lee
        // de la cookie. La app móvil sí lo sigue mandando (retrocompatible).
        body: JSON.stringify({}),
      })
        .then((data) => {
          accessToken = data.access_token || null;
          return accessToken !== null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  /**
   * Igual que `request` pero sin parsear JSON: devuelve el Blob de la
   * respuesta. Sirve para respuestas binarias (PDF del contrato) que el
   * endpoint pide con el mismo Bearer del panel.
   */
  /** Serializa query params omitiendo vacíos (undefined/null/"") para no mandar
   * `q=` o `cursor=` en blanco al backend. */
  static _qs(params = {}) {
    const url = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.set(k, v);
    }
    return url.toString();
  }

  static async _requestBlob(endpoint, options = {}, _retried = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = { ...options.headers };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers, credentials: "include" });
    } catch {
      throw new Error(`No se pudo conectar con la API (${API_BASE_URL}).`);
    }

    if (response.status === 401 && !_retried) {
      let renovado;
      try {
        renovado = await this._refrescarSesion();
      } catch (refreshError) {
        accessToken = null;
        throw refreshError;
      }
      if (renovado) return this._requestBlob(endpoint, options, true);
      accessToken = null;
      const err = new Error("Sesión expirada. Vuelve a iniciar sesión.");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const err = new Error(errorData.detail || `Error en la solicitud: ${response.status}`);
      err.status = response.status;
      if (response.status === 401) {
        err.code = "UNAUTHORIZED";
        accessToken = null;
      }
      throw err;
    }

    return response.blob();
  }

  static async request(endpoint, options = {}, _retriedAfterRefresh = false) {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = { ...options.headers };
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers, credentials: "include" });
    } catch {
      throw new Error(`No se pudo conectar con la API (${API_BASE_URL}).`);
    }

    if (response.status === 401 && !_retriedAfterRefresh) {
      let renovado;
      try {
        renovado = await this._refrescarSesion();
      } catch (refreshError) {
        // El refresh no pudo contactar la API: no es problema de sesión sino
        // de conectividad; se propaga el error claro en vez de fingir logout.
        accessToken = null;
        throw refreshError;
      }
      if (renovado) return this.request(endpoint, options, true);
      // La API respondió 401 al refresh: la cookie no existe o expiró.
      accessToken = null;
      const err = new Error("Sesión expirada. Vuelve a iniciar sesión.");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const err = new Error(errorData.detail || `Error en la solicitud: ${response.status}`);
      err.status = response.status;
      if (response.status === 401) {
        err.code = "UNAUTHORIZED";
        accessToken = null;
      }
      throw err;
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

  static analizarDanosIA(reservaId, { fotos_despues, fotos_antes, notas } = {}) {
    return this.request(`/entrega/${reservaId}/analisis-ia`, {
      method: "POST",
      body: JSON.stringify({
        fotos_despues: fotos_despues || [],
        fotos_antes: fotos_antes || undefined,
        notas: notas || undefined,
      }),
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

  // Antecedentes: certificados oficiales del Registro Civil que esperan al ejecutivo
  static getAntecedentesPendientes() {
    return this.request("/admin/antecedentes/pendientes");
  }

  static revisarAntecedente(certificadoId, accion, notas) {
    return this.request(`/admin/antecedentes/${certificadoId}/revisar`, {
      method: "POST",
      body: JSON.stringify({ accion, notas }),
    });
  }

  // Resultado de la consulta manual en autoseguro.gob.cl ("sin_encargo" | "con_encargo")
  static registrarEncargoRobo(autoId, resultado, notas) {
    return this.request(`/admin/autos/${autoId}/encargo-robo`, {
      method: "POST",
      body: JSON.stringify({ resultado, notas }),
    });
  }

  // Abre un PDF privado: el respaldo local exige sesión (Bearer), así que no sirve un enlace directo.
  // Devuelve una URL de objeto para abrir en una pestaña nueva.
  static async urlDeArchivoPrivado(url) {
    if (!url) throw new Error("Este certificado ya no tiene archivo (se purgó pasado el plazo de retención).");
    const local = url.includes("/storage/local/");
    const headers = local && accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    let response;
    try {
      // Las URLs firmadas de Supabase no llevan credenciales (su CORS es comodín y las rechazaría).
      response = await fetch(url, { headers, credentials: local ? "include" : "omit" });
    } catch {
      throw new Error("No se pudo descargar el documento.");
    }
    if (!response.ok) throw new Error(`No se pudo abrir el documento (${response.status}).`);
    return URL.createObjectURL(await response.blob());
  }

  // Segundo conductor: documentos e imágenes que antes no llegaban al panel
  static getConductoresPendientes() {
    return this.request("/admin/conductores/pendientes");
  }

  static revisarConductor(conductorId, accion, notas) {
    return this.request(`/admin/conductores/${conductorId}/revisar`, {
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
  // Parámetros soportados por GET /admin/reservas: `estado`, `q`, `limit`,
  // `cursor`. Devuelve `{ items, next_cursor }` (offset opaco).
  static getReservas(params = {}) {
    return this.request(`/admin/reservas${this._qs(params) ? `?${this._qs(params)}` : ""}`);
  }

  static getReserva(reservaId) {
    return this.request(`/admin/reservas/${reservaId}`);
  }

  /** Descarga el contrato de arriendo en PDF (GET /reservas/{id}/contrato-pdf)
   * y devuelve una URL de objeto para abrirla en otra pestaña. */
  static async getContratoPdfUrl(reservaId) {
    const blob = await this._requestBlob(`/reservas/${encodeURIComponent(reservaId)}/contrato-pdf`);
    return URL.createObjectURL(blob);
  }

  /** Chat de la reserva (GET /reservas/{id}/mensajes) — el admin tiene acceso. */
  static getReservaMensajes(reservaId) {
    return this.request(`/reservas/${encodeURIComponent(reservaId)}/mensajes`);
  }

  // ── Usuarios (panel) ────────────────────────────────────────────────────
  // Parámetros soportados por GET /admin/usuarios: `rol`, `estado_documentos`,
  // `q`, `limit`, `cursor`. Devuelve `{ items, next_cursor }` (offset opaco).
  static getUsuarios(params = {}) {
    return this.request(`/admin/usuarios${this._qs(params) ? `?${this._qs(params)}` : ""}`);
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

  static crearInvitacionPromotor(nota = "") {
    return this.request("/admin/promotores/invitaciones", {
      method: "POST",
      body: JSON.stringify({ nota }),
    });
  }

  static getInvitacionesPromotores() {
    return this.request("/admin/promotores/invitaciones");
  }

  // ── Finanzas ───────────────────────────────────────────────────────────
  static getLiquidaciones() {
    return this.request("/admin/liquidaciones");
  }

  static marcarLiquidacionPagada(liquidacionId) {
    return this.request(`/admin/liquidaciones/${liquidacionId}/pagar`, { method: "POST" });
  }

  static ejecutarLiquidaciones() {
    return this.request("/admin/liquidaciones/ejecutar", { method: "POST" });
  }

  static getMultasDuenos(params = {}) {
    return this.request(`/admin/multas-duenos${this._qs(params) ? `?${this._qs(params)}` : ""}`);
  }

  static getPagos(params = {}) {
    return this.request(`/admin/pagos${this._qs(params) ? `?${this._qs(params)}` : ""}`);
  }
}