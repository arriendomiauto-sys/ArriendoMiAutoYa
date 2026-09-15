import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Almacén seguro para datos de sesión (access JWT, refresh JWT y el
 * code_verifier de PKCE). API mínima compatible con el `storage` que espera
 * @supabase/supabase-js: { getItem(key), setItem(key, value), removeItem(key) }.
 *
 * Prioridad del backend:
 *   1. Nativo + expo-secure-store disponible -> Keychain / Encrypted
 *      SharedPreferences (Keystore). Esta es la vía segura real.
 *   2. Nativo sin expo-secure-store -> Map en memoria del proceso (no
 *      persiste entre reinicios, pero nunca vuelve a escribir los tokens en
 *      claro). Solo ocurre si el módulo nativo no está disponible.
 *   3. Web -> localStorage (SecureStore no existe en web; equivalente al
 *      backend que AsyncStorage usaba en el navegador).
 *
 * Las claves se pasan tal cual las usa supabase (p. ej. `sb-<ref>-auth-token`),
 * así una sesión ya guardada se sigue leyendo bajo el mismo nombre.
 *
 * Migración única: en nativo, al leer una clave que todavía no está en
 * SecureStore se consulta AsyncStorage (donde vivía la sesión sin cifrar).
 * Si estaba ahí, se copia a SecureStore y se borra el original. Así los
 * usuarios con sesión activa no tienen que volver a iniciar sesión al
 * actualizar la app.
 */

let secureStore = null;
let origenSeguroResuelto = false;

const memoriaFallback = new Map();

function esWeb() {
  return Platform.OS === "web";
}

function obtenerSecureStore() {
  if (origenSeguroResuelto) return secureStore;
  origenSeguroResuelto = true;
  try {
    const mod = require("expo-secure-store");
    if (mod && typeof mod.setItemAsync === "function" && typeof mod.getItemAsync === "function") {
      secureStore = mod;
    }
  } catch {
    secureStore = null;
  }
  return secureStore;
}

function obtenerLocalStorage() {
  try {
    if (typeof window !== "undefined" && typeof window.localStorage === "object") {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function resolverOrigen() {
  if (!esWeb()) {
    const ss = obtenerSecureStore();
    if (ss) {
      return {
        getItem: (key) => ss.getItemAsync(key),
        setItem: (key, value) => ss.setItemAsync(key, value),
        removeItem: (key) => ss.deleteItemAsync(key),
        nativo: true,
      };
    }
    return {
      getItem: async (key) => (memoriaFallback.has(key) ? memoriaFallback.get(key) : null),
      setItem: async (key, value) => {
        memoriaFallback.set(key, value);
      },
      removeItem: async (key) => {
        memoriaFallback.delete(key);
      },
      nativo: false,
    };
  }

  const ls = obtenerLocalStorage();
  if (ls) {
    return {
      getItem: (key) => Promise.resolve(ls.getItem(key)),
      setItem: async (key, value) => {
        ls.setItem(key, value);
      },
      removeItem: async (key) => {
        ls.removeItem(key);
      },
      nativo: false,
    };
  }

  return {
    getItem: async (key) => (memoriaFallback.has(key) ? memoriaFallback.get(key) : null),
    setItem: async (key, value) => {
      memoriaFallback.set(key, value);
    },
    removeItem: async (key) => {
      memoriaFallback.delete(key);
    },
    nativo: false,
  };
}

export async function getItem(key) {
  const origen = resolverOrigen();
  let valor = await origen.getItem(key);

  if (valor == null && origen.nativo) {
    // Sesión de una versión anterior: pasaba por AsyncStorage sin cifrar.
    valor = await AsyncStorage.getItem(key).catch(() => null);
    if (valor != null) {
      try {
        await origen.setItem(key, valor);
        await AsyncStorage.removeItem(key);
      } catch {
        // Si no se pudo migrar, al menos la sesión queda disponible esta vez.
      }
    }
  }

  return valor;
}

export async function setItem(key, value) {
  const origen = resolverOrigen();
  await origen.setItem(key, value);
}

export async function removeItem(key) {
  const origen = resolverOrigen();
  await origen.removeItem(key);
  // También la copia plana que pudo haber quedado sin migrar.
  await AsyncStorage.removeItem(key).catch(() => {});
}