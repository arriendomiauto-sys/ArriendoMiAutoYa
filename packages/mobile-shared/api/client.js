import { Platform } from "react-native";
import { getAccessToken } from "./supabase";

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "http://localhost:8000/api/v1";

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
export class ApiClient {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await getAccessToken();

    const headers = { ...options.headers };
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (netErr) {
      // fetch solo tira cuando no se pudo ni contactar al servidor: URL mal
      // configurada, backend caído, o el teléfono no alcanza esa dirección.
      throw new Error(
        `No se pudo conectar con el servidor (${API_BASE_URL}). ` +
          "Revisa tu conexión y que la app apunte a una URL accesible desde el teléfono."
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Error en la solicitud: ${response.status}`);
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

  // Autos / Marketplace
  static async getAutos(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/autos${query ? `?${query}` : ""}`);
    } catch (err) {
      // Sin conexión con el backend: modo demo con autos de ejemplo. Si el
      // servidor SÍ respondió (aunque con error), no se inventan autos — se
      // devuelve lista vacía para no ocultar el estado real del marketplace.
      if (String(err?.message || "").includes("No se pudo conectar")) {
        return MOCK_CARS;
      }
      console.warn("[getAutos] el backend respondió con error:", err?.message);
      return [];
    }
  }

  static async getAuto(autoId) {
    return this.request(`/autos/${autoId}`);
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

  static async extenderReserva(reservaId, diasAdicionales) {
    return this.request(`/reservas/${reservaId}/extender`, {
      method: "POST",
      body: JSON.stringify({ dias_adicionales: diasAdicionales }),
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

  // Enrolamiento / KYC
  static async verifyKyc(kycData) {
    return this.request("/enrolamiento/procesar-documentos", {
      method: "POST",
      body: JSON.stringify(kycData),
    });
  }

  static async completarEnrolamiento(enrolamientoData) {
    return this.request("/enrolamiento/completar", {
      method: "POST",
      body: JSON.stringify(enrolamientoData),
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

  // Mensajería de coordinación por reserva
  static async getMensajes(reservaId) {
    return this.request(`/reservas/${reservaId}/mensajes`);
  }

  static async enviarMensaje(reservaId, texto) {
    return this.request(`/reservas/${reservaId}/mensajes`, {
      method: "POST",
      body: JSON.stringify({ texto }),
    });
  }

  // Calificaciones (sistema bidireccional dueño/cliente)
  static async getCalificaciones(destinatarioId) {
    try {
      return await this.request(`/calificaciones?destinatario_id=${destinatarioId}`);
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

  // Pasarela de Pagos Transbank Webpay Plus
  static async iniciarPagoWebpay(monto, tipo = "hold_reserva", reservaId = null, returnUrl = null) {
    return this.request("/pagos/webpay/iniciar", {
      method: "POST",
      body: JSON.stringify({ monto, tipo, reserva_id: reservaId, return_url: returnUrl }),
    });
  }

  static async confirmarPagoWebpay(tokenWs) {
    return this.request("/pagos/webpay/confirmar", {
      method: "POST",
      body: JSON.stringify({ token_ws: tokenWs }),
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

    return this.request("/storage/upload", { method: "POST", body: formData });
  }

  static getContratoPdfUrl(reservaId) {
    return `${API_BASE_URL}/reservas/${reservaId}/contrato-pdf`;
  }

  // El PDF requiere sesión (Bearer token) — no se puede abrir como link
  // directo, hay que pedirlo autenticado y abrir el blob resultante.
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
}
