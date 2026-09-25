// ============================================================================
// Tokenización de tarjeta con Mercado Pago — 100% del lado del cliente.
// ----------------------------------------------------------------------------
// No existe un SDK nativo de MP para React Native que tokenice tarjetas, así
// que la app llama directo a la API pública de MP con la PUBLIC KEY:
//
//   1. GET  /v1/payment_methods?bin=...&public_key=...  -> tipo (crédito/débito)
//   2. POST /v1/card_tokens?public_key=...              -> card_token de un uso
//
// El número y el CVV viajan APP -> api.mercadopago.com por HTTPS y NUNCA
// pasan por nuestro backend (misma postura PCI que MercadoPago.js en web).
// A `apps/api` solo le mandamos { card_token, payment_method_id }.
//
// MODO PRUEBA (sin EXPO_PUBLIC_MP_PUBLIC_KEY): no se llama a MP; se genera un
// token falso `SIMULADO-DEBITO-1234` / `SIMULADO-CREDITO-1234` y el tipo lo
// elige el usuario con un toggle en el formulario. Con una key `TEST-...` sí
// se llama a la API real de MP con tarjetas de prueba.
// ============================================================================

const MP_API = "https://api.mercadopago.com/v1";

const leerEnv = (clave) =>
  (typeof process !== "undefined" && process.env && process.env[clave]) || "";

export function configMercadoPago() {
  const publicKey = leerEnv("EXPO_PUBLIC_MP_PUBLIC_KEY").trim();
  const forzarPrueba = leerEnv("EXPO_PUBLIC_PAGOS_PRUEBA") === "1";
  return {
    publicKey,
    tienePublicKey: !!publicKey,
    // "Prueba" = sin key, key de test, o forzado por env. Solo cambia el copy
    // y habilita el toggle manual de tipo; el backend manda con su propio flag.
    modoPrueba: forzarPrueba || !publicKey || publicKey.startsWith("TEST-"),
    // Sin key no se puede contactar a MP: el alta cae al camino simulado local.
    puedeContactarMP: !!publicKey,
  };
}

const TIPO_MP = { credit_card: "credito", debit_card: "debito" };

const soloDigitos = (s) => (s || "").replace(/\D/g, "");

// "MM/AA" -> { mes: 12, anio: 2027 }
function partirVencimiento(vencimiento) {
  const limpio = soloDigitos(vencimiento).slice(0, 4);
  const mes = parseInt(limpio.slice(0, 2), 10);
  const anio = 2000 + parseInt(limpio.slice(2, 4), 10);
  return { mes, anio };
}

async function pedirMP(url, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch (e) {
    const err = new Error("No pudimos contactar a Mercado Pago. Revisa tu conexión.");
    err.codigo = "MP_SIN_CONEXION";
    throw err;
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    // MP devuelve { cause: [{ code, description }], message }
    const causa = Array.isArray(datos.cause) ? datos.cause[0] : null;
    const err = new Error(
      traducirCausaMP(causa?.code) || datos.message || "Mercado Pago rechazó la tarjeta."
    );
    err.codigo = "TARJETA_INVALIDA";
    err.causaMP = causa?.code;
    throw err;
  }
  return datos;
}

// Los códigos más comunes de /card_tokens; el resto cae al mensaje genérico.
function traducirCausaMP(code) {
  const c = String(code || "");
  const mapa = {
    205: "Escribe el número de la tarjeta.",
    208: "Elige el mes de vencimiento.",
    209: "Elige el año de vencimiento.",
    212: "Falta el tipo de documento del titular.",
    213: "Falta el documento del titular.",
    214: "Falta el documento del titular.",
    220: "Falta el banco emisor.",
    221: "Escribe el nombre del titular tal como está en la tarjeta.",
    224: "Escribe el código de seguridad.",
    E301: "Ese número de tarjeta no es válido. Revísalo.",
    E302: "El código de seguridad no es válido.",
    316: "El nombre del titular no es válido.",
    325: "El mes de vencimiento no es válido.",
    326: "El año de vencimiento no es válido.",
  };
  return mapa[c] || mapa[code] || null;
}

/**
 * Consulta el método de pago por el BIN (primeros dígitos) para saber si la
 * tarjeta es de crédito o de débito. Devuelve null si no hay public key
 * (modo simulado local) o si MP no reconoce el BIN.
 */
export async function consultarMetodoPago(numero) {
  const { publicKey, puedeContactarMP } = configMercadoPago();
  if (!puedeContactarMP) return null;
  const bin = soloDigitos(numero).slice(0, 8);
  if (bin.length < 6) return null;
  try {
    const datos = await pedirMP(
      `${MP_API}/payment_methods?bin=${bin}&public_key=${encodeURIComponent(publicKey)}`,
      { method: "GET" }
    );
    const lista = Array.isArray(datos?.results) ? datos.results : Array.isArray(datos) ? datos : [];
    const pm = lista[0];
    if (!pm) return null;
    return {
      payment_method_id: pm.id,
      tipo: TIPO_MP[pm.payment_type_id] || null,
    };
  } catch {
    // Que falle el lookup del BIN no debe frenar el alta: se sigue sin tipo y
    // se resuelve con el toggle / la respuesta del token.
    return null;
  }
}

/**
 * Token de un solo uso para cobrar una tarjeta YA guardada: Mercado Pago pide
 * el CVV de nuevo en cada cobro. Devuelve null si no hay a quién pedírselo
 * (modo simulado local o tarjeta simulada): en ese caso el backend se arregla solo.
 *
 * @param cardId  `mp_card_id` de la tarjeta (viene en GET /usuarios/me/tarjetas)
 * @param cvv     código de seguridad que escribió el usuario
 */
export async function tokenizarTarjetaGuardada({ cardId, cvv }) {
  const { publicKey, puedeContactarMP } = configMercadoPago();
  if (!puedeContactarMP || !cardId || String(cardId).startsWith("SIM-")) return null;

  const datos = await pedirMP(
    `${MP_API}/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: String(cardId), security_code: soloDigitos(cvv) }),
    }
  );
  if (!datos?.id) {
    const err = new Error("Mercado Pago no devolvió un token de tarjeta.");
    err.codigo = "TARJETA_INVALIDA";
    throw err;
  }
  return datos.id;
}

/**
 * Genera el card_token de un solo uso.
 *
 * @param datos.numero        número de la tarjeta (con o sin espacios)
 * @param datos.vencimiento   "MM/AA"
 * @param datos.cvv           código de seguridad
 * @param datos.titular       nombre del titular (viene del KYC)
 * @param datos.rut           RUT del titular (viene del KYC), para identification
 * @param datos.tipoManual    "credito" | "debito" — SOLO se usa en modo simulado
 *                            local (sin public key) para armar el token falso
 * @returns { card_token, payment_method_id, tipo, ultimos4 }
 */
export async function crearCardToken({ numero, vencimiento, cvv, titular, rut, tipoManual }) {
  const { publicKey, puedeContactarMP } = configMercadoPago();
  const num = soloDigitos(numero);
  const ultimos4 = num.slice(-4);

  // ── Modo simulado local: sin key no hay a quién pedirle el token ──────────
  if (!puedeContactarMP) {
    const tipo = tipoManual === "debito" ? "debito" : "credito";
    return {
      card_token: `SIMULADO-${tipo.toUpperCase()}-${ultimos4}`,
      payment_method_id: null,
      tipo,
      ultimos4,
    };
  }

  // ── Camino real: MP resuelve tipo y titular ──────────────────────────────
  const metodo = await consultarMetodoPago(num);
  const { mes, anio } = partirVencimiento(vencimiento);
  const rutLimpio = (rut || "").replace(/[.\-\s]/g, "").toUpperCase();

  const cuerpo = {
    card_number: num,
    security_code: soloDigitos(cvv),
    expiration_month: mes,
    expiration_year: anio,
    cardholder: {
      name: (titular || "").trim(),
      ...(rutLimpio ? { identification: { type: "RUT", number: rutLimpio } } : {}),
    },
  };

  const datos = await pedirMP(
    `${MP_API}/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }
  );

  if (!datos?.id) {
    const err = new Error("Mercado Pago no devolvió un token de tarjeta.");
    err.codigo = "TARJETA_INVALIDA";
    throw err;
  }

  return {
    card_token: datos.id,
    payment_method_id: metodo?.payment_method_id || null,
    tipo: metodo?.tipo || null,
    ultimos4: datos.last_four_digits || ultimos4,
  };
}
