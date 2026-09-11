import { Platform } from "react-native";
import { getAccessToken, refreshAccessToken } from "./supabase";

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://arriendomiautoya.onrender.com/api/v1";

// Autos de respaldo SOLO para modo offline (backend inalcanzable). Los
// campos siguen el mismo shape que devuelve GET /autos (AutoOut) para que
// las pantallas no muestren datos con otra forma que la real.
export const MOCK_CARS = [
  {
    id: "car-swift-01",
    dueno_id: "dueno-demo",
    marca: "Suzuki",
    modelo: "Swift",
    anio: 2023,
    patente: "BBFK-42",
    tarifa_dia: 38000,
    ubicacion_base: "Providencia, Santiago",
    estado: "activo",
    transmision: "automatica",
    combustible: "bencina",
    asientos: 5,
    puertas: 5,
    categoria: "economico",
    equipamiento: { ac: true, bluetooth: true, camara_retroceso: true },
    documentos_verificados: true,
    fotos: [
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800",
    ],
  },
];

/**
 * Cliente HTTP único, compartido por las experiencias de arrendatario y dueño.
 * Adjunta automáticamente el Bearer token de la sesión Supabase activa a
 * cada request. Los métodos de lectura pública (getAutos/getAuto) no
 * requieren sesión.
 */
// El backend vive en el plan gratuito de Render: se duerme tras ~15 min sin
// tráfico y tarda entre 20 y 50 segundos en despertar en el peor caso. Antes
// esto se cubría con 2 reintentos separados por 1.8s (~3.6s en total), que no
// alcanza ni de cerca — el primer request del día fallaba con "no se pudo
// conectar" aunque el servidor estuviera sano, solo dormido. Este backoff
// creciente suma ~35s de espera antes de rendirse, que sí cubre un cold
// start real. Es el default para requests normales (JSON, chicos).
const ESPERAS_REINTENTO_MS =
  process.env.NODE_ENV === "test" ? [10, 10] : [2000, 3000, 5000, 8000, 13000];

// Subir una foto que se ABORTÓ POR TIMEOUT es distinto: se cortó porque la
// transferencia va lenta (señal débil), así que reintentar con esperas
// largas no ayuda en nada — es la MISMA foto pesada por la MISMA conexión
// lenta, va a volver a tardar/cortarse igual. Un solo reintento rápido
// alcanza; subirImagenOptimizada ya tiene su propio reintento por encima.
//
// OJO: esto solo aplica cuando el fetch llegó a abrir la conexión y se
// abortó. Si el fetch falló de una (no se pudo ni contactar al servidor),
// la subida usa el mismo backoff largo que el JSON: la foto suele ser la
// primera request pesada tras abrir la app y Render puede estar en cold
// start — ahí las esperas largas SÍ sirven (ver selección de `esperas` abajo).
const ESPERAS_REINTENTO_SUBIDA_MS = process.env.NODE_ENV === "test" ? [10] : [1500];

// Sin esto, una subida en una red lenta puede quedar colgada minutos enteras
// esperando que el sistema operativo se rinda solo — el usuario ve la app
// "trabada" sin ningún mensaje. 45s es generoso para una foto ya optimizada
// (200-400 KB) incluso en una conexión mala; 20s alcanza de sobra para
// cualquier otro request (JSON, sin archivos).
const TIMEOUT_JSON_MS = 20000;
const TIMEOUT_SUBIDA_MS = 45000;

// ---------------------------------------------------------------------------
// Subida de archivos (multipart) por XMLHttpRequest
// ---------------------------------------------------------------------------
// Desde Expo SDK 54 el `fetch` global es el del runtime "winter" (expo/fetch),
// que NO sabe subir un archivo con el shorthand de React Native
// `FormData.append("file", { uri, name, type })`: revienta con "Unsupported
// FormDataPart implementation" y la subida a POST /storage/upload nunca sale
// del teléfono. Se notaba justo acá — el cargador de licencia / fotos KYC:
// la captura se veía bien pero el archivo nunca llegaba y la validación
// quedaba trancada en "Falta tu licencia".
//
// XMLHttpRequest (el mismo que usaba el `fetch` clásico por debajo) sí soporta
// el shorthand. Las subidas multipart van por ahí salvo que se desactive con
// EXPO_PUBLIC_USE_RN_FETCH=0. En web no aplica (ahí el FormData ya es el real
// del navegador y `subirArchivoStorage` sube un Blob).
function usarXhrParaMultipart() {
  return (
    Platform.OS !== "web" &&
    typeof XMLHttpRequest === "function" &&
    (typeof process === "undefined" || process.env?.EXPO_PUBLIC_USE_RN_FETCH !== "0")
  );
}

// Envía un cuerpo multipart y devuelve un objeto con la misma forma mínima que
// una Response de fetch (`ok`, `status`, `json()`) para que `request()` lo
// trate igual.
function enviarMultipartXHR(url, { headers = {}, body, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // No se fija Content-Type: al detectar el FormData, XHR pone el
    // `multipart/form-data; boundary=…` correcto. Fijarlo a mano lo rompe.
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== "content-type") xhr.setRequestHeader(k, v);
    }
    xhr.onload = () => {
      const texto = xhr.responseText || "";
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => {
          try {
            return texto ? JSON.parse(texto) : {};
          } catch {
            return {};
          }
        },
      });
    };
    // Mismo error que tira `fetch` para que el retry/backoff de `request()`
    // lo reconozca igual.
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.onabort = () => {
      const e = new Error("La subida se canceló.");
      e.name = "AbortError";
      reject(e);
    };
    if (signal) {
      if (signal.aborted) return xhr.abort();
      signal.addEventListener("abort", () => xhr.abort());
    }
    xhr.send(body);
  });
}

export class ApiClient {
  static async request(endpoint, options = {}, { reintentoDeAuth = false, intento = 0, esSubida = false } = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await getAccessToken();

    const headers = { ...options.headers };
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const timeoutMs = esSubida ? TIMEOUT_SUBIDA_MS : TIMEOUT_JSON_MS;
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);

    let response;
    let seAgotoElTiempo = false;
    try {
      response =
        isFormData && usarXhrParaMultipart()
          ? await enviarMultipartXHR(url, { headers, body: options.body, signal: controlador.signal })
          : await fetch(url, { ...options, headers, signal: controlador.signal });
    } catch (netErr) {
      seAgotoElTiempo = controlador.signal.aborted;
      // Cuánta paciencia para reintentar. Una subida que se abortó por
      // timeout usa el reintento corto (misma foto, misma red lenta: esperar
      // más no cambia nada). Todo lo demás — JSON, o una subida que ni pudo
      // contactar al servidor — usa el backoff largo (~35s), que es lo que
      // cubre un cold start de Render en la primera request tras abrir la app.
      const esperas =
        esSubida && seAgotoElTiempo ? ESPERAS_REINTENTO_SUBIDA_MS : ESPERAS_REINTENTO_MS;
      // El mensaje que ve el usuario es siempre genérico ("no se pudo conectar"),
      // pero acá abajo tragábamos el error real de fetch sin dejar rastro — al
      // diagnosticar un fallo en KYC/subida de fotos no había forma de saber si
      // era timeout, DNS, TLS, o el archivo local ilegible. Se loguea el error
      // crudo tal cual lo tira fetch, en cada intento.
      console.error(
        `[ApiClient] fetch falló en ${endpoint} (intento ${intento}, esSubida=${esSubida}, abortado=${seAgotoElTiempo}):`,
        netErr?.name,
        netErr?.message,
        netErr
      );
      // Si el backend está en cold start (Render despertando) o hubo un microcorte,
      // reintentamos automáticamente antes de lanzar el error a la pantalla.
      if (intento < esperas.length) {
        await new Promise((r) => setTimeout(r, esperas[intento]));
        return await this.request(endpoint, options, {
          reintentoDeAuth,
          intento: intento + 1,
          esSubida,
        });
      }

      // Distinguir "se cortó porque tardaba demasiado" (típico de una subida
      // en mala señal) de "no se pudo ni contactar al servidor" (URL mal
      // configurada, backend caído, o el teléfono no alcanza esa dirección)
      // — son causas distintas y el mensaje genérico de "sin conexión"
      // confundía a alguien que sí tenía señal, solo lenta.
      const err = seAgotoElTiempo
        ? new Error(
            esSubida
              ? "La subida está tardando demasiado. Revisa tu señal e inténtalo de nuevo."
              : "El servidor está tardando en responder. Revisa tu conexión e inténtalo de nuevo."
          )
        : new Error(
            `No se pudo conectar con el servidor (${API_BASE_URL}). ` +
              "Revisa tu conexión y que la app apunte a una URL accesible desde el teléfono."
          );
      // Marca explícita para distinguir "no llegué al servidor" de "el
      // servidor respondió mal": son dos fallas distintas y las pantallas
      // reaccionan distinto (modo demo vs. error con reintento).
      err.esFalloDeConexion = true;
      throw err;
    } finally {
      clearTimeout(timer);
    }

    // Un 401 con sesión guardada casi nunca significa "no estás logueado":
    // significa que el access token venció. Se renueva y se reintenta una sola
    // vez, para que un token vencido no se vea como un cierre de sesión.
    // Solo se reintenta si había token: sin sesión, un 401 es un 401.
    if (response.status === 401 && token && !reintentoDeAuth) {
      const tokenNuevo = await refreshAccessToken();
      if (tokenNuevo) {
        return await this.request(endpoint, options, { reintentoDeAuth: true, esSubida });
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let msg = `Error en la solicitud: ${response.status}`;
      if (typeof errorData.detail === "string") {
        msg = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        msg = errorData.detail
          .map((e) => (typeof e === "string" ? e : e.msg || e.message || JSON.stringify(e)))
          .join("\n");
      } else if (errorData.detail && typeof errorData.detail === "object") {
        msg =
          errorData.detail.mensaje ||
          errorData.detail.motivo ||
          errorData.detail.message ||
          errorData.detail.msg ||
          JSON.stringify(errorData.detail);
      } else if (errorData.mensaje) {
        msg = errorData.mensaje;
      } else if (errorData.message) {
        msg = errorData.message;
      }

      // Si por alguna razón vino como JSON serializado en string, extraer el mensaje humano
      if (typeof msg === "string" && msg.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(msg);
          msg = parsed.mensaje || parsed.motivo || parsed.message || parsed.msg || msg;
        } catch {}
      }

      const err = new Error(msg);
      err.status = response.status;
      // Categoría de error que algunos endpoints (p. ej. /enrolamiento/completar)
      // mandan en `detail.categoria` para que la pantalla reaccione distinto
      // según el tipo de fallo, sin tener que parsear el texto del mensaje.
      const detalle =
        errorData.detail && typeof errorData.detail === "object" ? errorData.detail : errorData;
      if (detalle.categoria) err.categoria = detalle.categoria;
      // `codigo` / `campo`: los usa el flujo de pago (SIN_CUPO, COBRO_RECHAZADO,
      // NOMBRE_NO_COINCIDE…) para mostrar el error en el lugar correcto sin
      // depender del texto. `titular_detectado` acompaña a NOMBRE_NO_COINCIDE.
      if (detalle.codigo) err.codigo = detalle.codigo;
      if (detalle.campo) err.campo = detalle.campo;
      if (detalle.mensaje) err.mensaje = detalle.mensaje;
      if (detalle.titular_detectado) err.titularDetectado = detalle.titular_detectado;
      throw err;
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  // Usuario autenticado (perfil sincronizado desde Supabase Auth)
  static async getMe() {
    return this.request("/usuarios/me");
  }

  static async actualizarPerfilBasico(data) {
    return this.request("/usuarios/me/perfil-basico", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  static async aplicarCodigoReferido(codigo) {
    return this.request("/usuarios/me/codigo-referido", {
      method: "PUT",
      body: JSON.stringify({ codigo }),
    });
  }

  // Autos / Marketplace
  static async getAutos(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/autos${query ? `?${query}` : ""}`);
    } catch (err) {
      // Sin conexión con el backend: modo demo con autos de ejemplo.
      if (err?.esFalloDeConexion) return MOCK_CARS;
      // El servidor SÍ respondió, pero con error (p. ej. el 500 que devolvía
      // GET /autos cuando una fila traía NULL en fotos/equipamiento). Antes
      // se devolvía [] y el marketplace se veía igual que "todavía no hay
      // autos publicados": el fallo quedaba invisible y sin forma de
      // reintentar. Se propaga para que la pantalla lo muestre como error.
      console.warn("[getAutos] el backend respondió con error:", err?.message);
      throw err;
    }
  }

  static async getAuto(autoId) {
    return this.request(`/autos/${autoId}`);
  }

  // Rangos de fechas ya reservados de un auto (reserva pendiente_pago vigente,
  // confirmada o en_curso). El calendario deshabilita esos días.
  static async getDisponibilidadAuto(autoId) {
    return this.request(`/autos/${autoId}/disponibilidad`);
  }

  /**
   * Pasa por OCR los documentos legales del auto (padron, permiso, SOAP,
   * seguro y revision tecnica) y devuelve por cada uno que documento es, de
   * que patente y hasta cuando vale. Se llama mientras el dueno los sube,
   * para avisarle de un vencido antes de que arme toda la publicacion.
   */
  static async validarDocumentosAuto(datos) {
    return this.request("/autos/validar-documentos", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  }

  static async getMisAutos() {
    return this.request("/autos/mios");
  }

  static async crearAuto(autoData) {
    return this.request("/autos", {
      method: "POST",
      body: JSON.stringify(autoData),
    });
  }

  static async actualizarAuto(autoId, autoData) {
    return this.request(`/autos/${autoId}`, {
      method: "PATCH",
      body: JSON.stringify(autoData),
    });
  }

  // Reservas
  static async getReservas(rol = "cliente") {
    try {
      return await this.request(`/reservas?rol=${rol}`);
    } catch {
      return [];
    }
  }

  static async crearReserva(reservaData) {
    return this.request("/reservas", {
      method: "POST",
      body: JSON.stringify(reservaData),
    });
  }

  static async actualizarEstadoReserva(reservaId, nuevoEstado) {
    return this.request(`/reservas/${reservaId}/estado?nuevo_estado=${nuevoEstado}`, {
      method: "PATCH",
    });
  }

  // Firma del contrato de arriendo por una de las partes. `metodo` es
  // "huella" | "facial" | "escrita"; `firma_svg` solo va con "escrita".
  // El backend deduce el rol (arrendatario/arrendador) del usuario autenticado.
  static async firmarContrato(reservaId, { metodo, firma_svg, nombre_firmante, acepta_terminos = true }) {
    return this.request(`/reservas/${reservaId}/firmar-contrato`, {
      method: "POST",
      body: JSON.stringify({ metodo, firma_svg, nombre_firmante, acepta_terminos }),
    });
  }

  static async extenderReserva(reservaId, diasAdicionales) {
    return this.request(`/reservas/${reservaId}/extender`, {
      method: "POST",
      body: JSON.stringify({ dias_adicionales: diasAdicionales }),
    });
  }

  static async realizarPreCheckin(reservaId, data) {
    return this.request(`/reservas/${reservaId}/precheckin`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static async obtenerPreCheckin(reservaId) {
    return this.request(`/reservas/${reservaId}/precheckin`);
  }

  static async aplicarMultaReserva(reservaId, data) {
    return this.request(`/reservas/${reservaId}/aplicar-multa`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Cobra un TAG/peaje o multa de tránsito detectado hasta 30 días después
  // del arriendo, directo contra la tarjeta de crédito de garantía en la
  // bóveda (no contra la tarjeta de débito con la que se pagó el arriendo).
  static async cobrarPosterior(reservaId, { tipo, monto, descripcion, comprobante_url }) {
    return this.request(`/reservas/${reservaId}/cobro-posterior`, {
      method: "POST",
      body: JSON.stringify({ tipo, monto, descripcion, comprobante_url }),
    });
  }

  // Segundo Conductor / Conductor Adicional
  static async asignarSegundoConductor(reservaId, data) {
    return this.request(`/reservas/${reservaId}/segundo-conductor`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static async obtenerSegundoConductor(reservaId) {
    return this.request(`/reservas/${reservaId}/segundo-conductor`);
  }

  static async actualizarSegundoConductor(reservaId, data) {
    return this.request(`/reservas/${reservaId}/segundo-conductor`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  static async eliminarSegundoConductor(reservaId) {
    return this.request(`/reservas/${reservaId}/segundo-conductor`, {
      method: "DELETE",
    });
  }

  static async verificarKycSegundoConductor(reservaId) {
    return this.request(`/reservas/${reservaId}/segundo-conductor/verificar-kyc`, {
      method: "POST",
    });
  }

  // Mantenciones y documentación legal del auto
  static async getMantenciones(autoId) {
    return this.request(`/autos/${autoId}/mantenciones`);
  }

  static async crearMantencion(autoId, data) {
    return this.request(`/autos/${autoId}/mantenciones`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Calendario de disponibilidad (bloqueos por uso personal)
  static async getBloqueosCalendario(autoId) {
    return this.request(`/autos/${autoId}/bloqueos`);
  }

  static async crearBloqueoCalendario(autoId, fecha, motivo) {
    return this.request(`/autos/${autoId}/bloqueos`, {
      method: "POST",
      body: JSON.stringify({ fecha, motivo }),
    });
  }

  static async eliminarBloqueoCalendario(bloqueoId) {
    return this.request(`/bloqueos/${bloqueoId}`, { method: "DELETE" });
  }

  // GPS: última posición conocida (solo dueño del auto o admin; el backend
  // exige gps_consentimiento y un equipo instalado, y devuelve 404/403 con
  // el motivo si no se cumple).
  static async getPosicionGPS(autoId) {
    return this.request(`/autos/${autoId}/gps/posicion`);
  }

  // Enrolamiento / KYC
  static async verifyKyc(kycData) {
    return this.request("/enrolamiento/procesar-documentos", {
      method: "POST",
      body: JSON.stringify(kycData),
    });
  }

  // Manda el caso a revisión manual (sin cobrar el hold). Lo usa KycScreen
  // cuando la verificación automática rechaza por edad / algo vencido /
  // control facial y el usuario elige "enviar a soporte".
  static async enviarEnrolamientoARevision(datos) {
    return this.request("/enrolamiento/enviar-a-revision", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  }

  static async completarEnrolamiento(enrolamientoData) {
    return this.request("/enrolamiento/completar", {
      method: "POST",
      body: JSON.stringify(enrolamientoData),
    });
  }

  // Crea una sesión de verificación de identidad con el proveedor externo
  // (Didit, flujo hosted). Devuelve { url, session_id, estado } para abrir en
  // el navegador, o `null` si el backend no tiene la verificación externa
  // habilitada (HTTP 503) — en ese caso la app sigue con el flujo de cámara.
  static async crearSesionVerificacionExterna() {
    try {
      return await this.request("/enrolamiento/verificacion-externa/sesion", { method: "POST" });
    } catch (err) {
      if (err?.status === 503) return null;
      throw err;
    }
  }

  // Valida solo la licencia (usuario ya verificado como dueño que quiere
  // arrendar). Devuelve el perfil con `licencia_estado` actualizado.
  static async completarLicencia(datos) {
    return this.request("/enrolamiento/completar-licencia", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  }

  // Flujo de Entrega y Devolución (QR y Checklists)
  static async generarCodigoQR(reservaId) {
    return this.request(`/reservas/${reservaId}/generar-codigo`, { method: "POST" });
  }

  static async validarCodigoQR(codigoQrHash) {
    return this.request("/entrega/validar-codigo", {
      method: "POST",
      body: JSON.stringify({ codigo_qr_hash: codigoQrHash }),
    });
  }

  static async confirmarVerificacionIdentidad(reservaId, data) {
    return this.request(`/entrega/${reservaId}/confirmar-verificacion`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  static async registrarChecklist(reservaId, checklistData) {
    return this.request(`/entrega/${reservaId}/checklist`, {
      method: "POST",
      body: JSON.stringify(checklistData),
    });
  }

  static async analizarDanosIA(reservaId, { fotos_despues, fotos_antes, notas } = {}) {
    return this.request(`/entrega/${reservaId}/analisis-ia`, {
      method: "POST",
      body: JSON.stringify({
        fotos_despues: fotos_despues || [],
        fotos_antes: fotos_antes || undefined,
        notas: notas || undefined,
      }),
    });
  }

  // Mensajería de coordinación por reserva
  static async getMensajes(reservaId) {
    return this.request(`/reservas/${reservaId}/mensajes`);
  }

  static async enviarMensaje(reservaId, texto, clientId = null) {
    const body = { texto };
    if (clientId) body.client_id = clientId;
    return this.request(`/reservas/${reservaId}/mensajes`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Última línea y no leídos de cada conversación.
   *
   * Devuelve [] si falla: es información de adorno (el globo de la pestaña,
   * la vista previa de la lista) y no vale la pena romper una pantalla que
   * por lo demás funciona.
   */
  static async getResumenConversaciones() {
    try {
      return (await this.request("/reservas/mensajes/resumen")) || [];
    } catch {
      return [];
    }
  }

  // Calificaciones (sistema bidireccional dueño/cliente)
  static async getCalificaciones(destinatarioId) {
    try {
      return await this.request(`/calificaciones?destinatario_id=${destinatarioId}`);
    } catch {
      return [];
    }
  }

  static async getCalificacionesDeReserva(reservaId) {
    try {
      return await this.request(`/calificaciones?reserva_id=${reservaId}`);
    } catch {
      return [];
    }
  }

  static async crearCalificacion(data) {
    return this.request("/calificaciones", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Favoritos / wishlist
  static async getFavoritos() {
    try {
      return await this.request("/favoritos");
    } catch {
      return [];
    }
  }

  static async getIdsFavoritos() {
    try {
      return await this.request("/favoritos/ids");
    } catch {
      return [];
    }
  }

  static async marcarFavorito(autoId) {
    return this.request(`/favoritos/${autoId}`, { method: "POST" });
  }

  static async quitarFavorito(autoId) {
    return this.request(`/favoritos/${autoId}`, { method: "DELETE" });
  }

  // Notificaciones in-app
  static async getNotificaciones() {
    try {
      return await this.request("/notificaciones");
    } catch {
      return [];
    }
  }

  static async getConteoNotificacionesNoLeidas() {
    try {
      const { no_leidas } = await this.request("/notificaciones/conteo-no-leidas");
      return no_leidas || 0;
    } catch {
      return 0;
    }
  }

  static async marcarNotificacionLeida(id) {
    return this.request(`/notificaciones/${id}/leida`, { method: "POST" });
  }

  static async marcarTodasNotificacionesLeidas() {
    return this.request("/notificaciones/marcar-todas-leidas", { method: "POST" });
  }

  static async registrarPushToken(expoPushToken) {
    return this.request("/usuarios/me/push-token", {
      method: "PUT",
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
  }

  // Soporte (tickets)
  static async crearTicketSoporte(asunto, descripcion) {
    return this.request("/soporte/tickets", {
      method: "POST",
      body: JSON.stringify({ asunto, descripcion }),
    });
  }

  static async getMisTicketsSoporte() {
    return this.request("/soporte/mis-tickets");
  }

  // Solicita la baja de la cuenta. El backend bloquea con 409 (y el detalle
  // exacto) si todavía hay arriendos o pagos en curso, como cliente o como
  // dueño de flota.
  static async solicitarEliminacionCuenta() {
    return this.request("/usuarios/me/solicitar-eliminacion", { method: "POST" });
  }

  // Pasarela de pagos: Mercado Pago (Checkout Pro)
  static async iniciarPago(monto, tipo = "hold_reserva", reservaId = null, returnUrl = null) {
    return this.request("/pagos/mercadopago/iniciar", {
      method: "POST",
      body: JSON.stringify({ monto, tipo, reserva_id: reservaId, return_url: returnUrl }),
    });
  }

  /**
   * Datos públicos de la pasarela: la llave con la que el SDK tokeniza la
   * tarjeta y, mientras dure el bypass, si los pagos están simulados.
   */
  static async getConfiguracionPagos() {
    return this.request("/pagos/configuracion");
  }

  /**
   * Adelanta el resultado del pago cuando el usuario vuelve del checkout.
   *
   * No es la confirmación definitiva: el backend también recibe el webhook de
   * Mercado Pago, así que la reserva queda confirmada aunque el usuario cierre
   * la app antes de volver. Acá solo se evita hacerlo esperar.
   */
  static async confirmarPago(paymentId, pagoId = null) {
    return this.request("/pagos/mercadopago/confirmar", {
      method: "POST",
      body: JSON.stringify({ payment_id: paymentId, pago_id: pagoId }),
    });
  }

  static async getMisGanancias() {
    return this.request("/pagos/mis-ganancias");
  }

  static async actualizarCuentaBancaria(cuentaBancaria) {
    return this.request("/usuarios/me/cuenta-bancaria", {
      method: "PUT",
      body: JSON.stringify(cuentaBancaria),
    });
  }

  static async actualizarTarjeta(datosTarjeta) {
    return this.request("/usuarios/me/tarjeta", {
      method: "PUT",
      body: JSON.stringify(datosTarjeta),
    });
  }

  // ── Vault de tarjetas (Mercado Pago) ─────────────────────────────────────
  // El PAN nunca pasa por acá: el mobile tokeniza contra api.mercadopago.com
  // (ver api/mercadopago.js) y a nuestro backend solo le llega el card_token.
  // El backend consulta la tarjeta en MP y de ahí saca marca, últimos 4,
  // vencimiento, tipo (crédito/débito) y titular.
  static async getTarjetas() {
    const r = await this.request("/usuarios/me/tarjetas");
    return Array.isArray(r?.tarjetas) ? r.tarjetas : Array.isArray(r) ? r : [];
  }

  static async agregarTarjeta({
    card_token,
    payment_method_id,
    device_id = null,
    tipo = null,
    ultimos4 = null,
    marca = null,
  }) {
    // `tipo` / `ultimos4` / `marca` son pistas: el backend las usa solo si no
    // puede consultar la tarjeta en Mercado Pago (modo simulado sin credenciales).
    const r = await this.request("/usuarios/me/tarjetas", {
      method: "POST",
      body: JSON.stringify({ card_token, payment_method_id, device_id, tipo, ultimos4, marca }),
    });
    return r?.tarjeta || r;
  }

  static async eliminarTarjeta(tarjetaId) {
    return this.request(`/usuarios/me/tarjetas/${tarjetaId}`, { method: "DELETE" });
  }

  // Cuentas de cobro del dueño (dónde recibe sus liquidaciones)
  static async getCuentasCobro() {
    const r = await this.request("/usuarios/me/cuentas-cobro");
    return Array.isArray(r?.cuentas_cobro) ? r.cuentas_cobro : Array.isArray(r) ? r : [];
  }

  static async agregarCuentaCobro(datos) {
    const r = await this.request("/usuarios/me/cuentas-cobro", {
      method: "POST",
      body: JSON.stringify(datos),
    });
    return r?.cuenta_cobro || r;
  }

  static async eliminarCuentaCobro(cuentaId) {
    return this.request(`/usuarios/me/cuentas-cobro/${cuentaId}`, { method: "DELETE" });
  }

  static async marcarCuentaCobroPredeterminada(cuentaId) {
    const r = await this.request(`/usuarios/me/cuentas-cobro/${cuentaId}/predeterminada`, {
      method: "PATCH",
    });
    return r?.cuenta_cobro;
  }

  // Cobra el arriendo (a la tarjeta de débito) y autoriza el hold de garantía
  // (a la de crédito) en un solo paso. Va DESPUÉS de firmar el contrato.
  static async pagarReserva(reservaId, { tarjeta_cobro_id, tarjeta_garantia_id, device_id = null }) {
    return this.request(`/reservas/${reservaId}/pagar`, {
      method: "POST",
      body: JSON.stringify({ tarjeta_cobro_id, tarjeta_garantia_id, device_id }),
    });
  }

  // ── Telemetría GPS ────────────────────────────────────────────────────────
  // El celular del arrendatario reporta ubicación periódicamente mientras el
  // arriendo esté en curso. El dueño o admin pueden consultar la posición en vivo.
  static async enviarTelemetria(reservaId, { latitud, longitud, precision = null, velocidad = null, altitud = null, bateria = null }) {
    return this.request(`/reservas/${reservaId}/telemetria`, {
      method: "POST",
      body: JSON.stringify({ latitud, longitud, precision, velocidad, altitud, bateria }),
    });
  }

  static async getPosicionGpsAuto(autoId) {
    return this.request(`/autos/${autoId}/gps/posicion`);
  }

  // Almacenamiento de Fotos / Documentos (Supabase Storage vía backend)
  static async subirArchivoStorage(fileUriOrBlob, filename = "foto.jpg", bucket = "general") {
    const formData = new FormData();

    if (typeof fileUriOrBlob === "string") {
      if (Platform.OS === "web") {
        // En RN-Web, expo-image-picker también devuelve un `uri` de tipo
        // string (blob:/data:), pero el FormData del navegador es el real:
        // el truco de RN {uri, name, type} no sirve acá — append() lo
        // castea a "[object Object]" en vez de subir la foto. Hay que
        // resolver el uri a un Blob real primero.
        const blob = await fetch(fileUriOrBlob).then((r) => r.blob());
        formData.append("file", blob, filename);
      } else {
        // Nativo (iOS/Android): uri local del picker de imágenes.
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1] === "jpg" ? "jpeg" : match[1]}` : "image/jpeg";
        formData.append("file", { uri: fileUriOrBlob, name: filename, type });
      }
    } else {
      // Ya viene como Blob/File
      formData.append("file", fileUriOrBlob, filename);
    }
    formData.append("bucket", bucket);

    return this.request("/storage/upload", { method: "POST", body: formData }, { esSubida: true });
  }

  static getContratoPdfUrl(reservaId) {
    return `${API_BASE_URL}/reservas/${reservaId}/contrato-pdf`;
  }

  // El PDF requiere sesión (Bearer token) — no se puede abrir como link
  // directo, hay que pedirlo autenticado y abrir el blob resultante.
  // Solo se usa en web: en RN no existe URL.createObjectURL (ver
  // descargarContratoPdfArchivo para nativo).
  static async descargarContratoPdfBlob(reservaId) {
    const token = await getAccessToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(this.getContratoPdfUrl(reservaId), { headers });
    if (!response.ok) {
      throw new Error(`No se pudo obtener el contrato (status ${response.status})`);
    }
    return response.blob();
  }

  // Nativo (iOS/Android): descarga el PDF autenticado a un archivo del caché
  // y devuelve su file:// URI, para abrirlo con la hoja de compartir del
  // sistema (expo-sharing). En RN no hay URL.createObjectURL, así que el
  // flujo de blob de arriba no aplica acá.
  static async descargarContratoPdfArchivo(reservaId) {
    // Bloque: validación de entrada — sin reserva no hay contrato que pedir
    if (!reservaId) {
      throw new Error("La reserva no tiene un identificador válido.");
    }

    const { File, Paths } = require("expo-file-system");
    const token = await getAccessToken();

    // Bloque: descarga autenticada a un archivo fijo del caché.
    // `downloadFileAsync` rechaza si el servidor responde con HTTP != 2xx
    // (el mensaje incluye el status). `idempotent` permite sobrescribir una
    // descarga previa sin fallar.
    const destino = new File(Paths.cache, `contrato-${reservaId}.pdf`);
    let archivo;
    try {
      archivo = await File.downloadFileAsync(this.getContratoPdfUrl(reservaId), destino, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        idempotent: true,
      });
    } catch (err) {
      const detalle = err?.message ? ` (${err.message})` : "";
      throw new Error(`No se pudo descargar el contrato desde el servidor${detalle}.`);
    }

    // Bloque: verificación de que lo descargado es realmente un PDF y no una
    // página de error (JSON/HTML) guardada con extensión .pdf — eso es lo que
    // hace que el visor del sistema diga "no se puede abrir el documento".
    let bytes = null;
    try {
      bytes = new Uint8Array(await archivo.arrayBuffer());
    } catch {
      bytes = null;
    }
    // "%PDF" = 0x25 0x50 0x44 0x46
    const esPdf =
      bytes && bytes.length > 4 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

    if (!esPdf) {
      // Decodifica los primeros bytes como ASCII para mostrar el error real
      // del servidor (sin depender de TextDecoder).
      let cuerpo = "";
      if (bytes) {
        for (let i = 0; i < Math.min(bytes.length, 200); i++) {
          cuerpo += String.fromCharCode(bytes[i]);
        }
        cuerpo = cuerpo.trim();
      }
      try {
        archivo.delete();
      } catch {}
      throw new Error(
        cuerpo
          ? `El servidor no devolvió un PDF válido: ${cuerpo}`
          : "El servidor no devolvió un PDF válido."
      );
    }

    return archivo.uri;
  }
}
