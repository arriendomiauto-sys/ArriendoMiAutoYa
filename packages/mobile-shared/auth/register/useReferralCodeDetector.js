import { useState, useEffect } from "react";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@rentacar/pending_referral_code";
const CODE_REGEX = /^[A-Z0-9]{6}$/;

/**
 * Extrae un código de referido/colaborador de una URL (deep link o web).
 * Soporta formatos:
 * - rentacar://registro?ref=ABC123
 * - https://arriendomiautoya.cl/invitacion/ABC123
 * - https://arriendomiautoya.cl/colaborador/ABC123
 */
function extraerCodigoDeUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = Linking.parse(url);
    if (parsed.queryParams?.ref) {
      const code = String(parsed.queryParams.ref).trim().toUpperCase();
      if (CODE_REGEX.test(code)) return code;
    }
    const pathParts = (parsed.path || "").split("/").filter(Boolean);
    const lastPart = (pathParts[pathParts.length - 1] || "").trim().toUpperCase();
    if (CODE_REGEX.test(lastPart)) return lastPart;
  } catch {
    // URL no parseable
  }
  return null;
}

/**
 * Hook para detectar automáticamente códigos de colaboradores e invitación:
 * 1. Desde Deep Links entrantes (Linking).
 * 2. Desde AsyncStorage si se guardó previamente.
 * 3. Desde el Portapapeles (Deferred deep linking al descargar desde la web).
 */
export function useReferralCodeDetector() {
  const [detectedCode, setDetectedCode] = useState(null);

  useEffect(() => {
    let activo = true;

    async function detectar() {
      // 1. Revisar storage primero
      try {
        const guardado = await AsyncStorage.getItem(STORAGE_KEY);
        if (guardado && CODE_REGEX.test(guardado) && activo) {
          setDetectedCode(guardado);
          return;
        }
      } catch {}

      // 2. Revisar URL inicial (cold start)
      try {
        const initialUrl = await Linking.getInitialURL();
        const codeFromUrl = extraerCodigoDeUrl(initialUrl);
        if (codeFromUrl && activo) {
          setDetectedCode(codeFromUrl);
          await AsyncStorage.setItem(STORAGE_KEY, codeFromUrl);
          return;
        }
      } catch {}

      // 3. Revisar portapapeles (copiado desde la web al presionar "Descargar")
      try {
        const text = await Clipboard.getStringAsync();
        const limpio = (text || "").trim().toUpperCase();
        if (CODE_REGEX.test(limpio) && activo) {
          setDetectedCode(limpio);
          await AsyncStorage.setItem(STORAGE_KEY, limpio);
        }
      } catch {}
    }

    detectar();

    // 4. Escuchar URLs entrantes mientras la app está abierta
    const subscription =
      typeof Linking?.addEventListener === "function"
        ? Linking.addEventListener("url", async (event) => {
            const code = extraerCodigoDeUrl(event.url);
            if (code && activo) {
              setDetectedCode(code);
              await AsyncStorage.setItem(STORAGE_KEY, code);
            }
          })
        : null;

    return () => {
      activo = false;
      subscription?.remove();
    };
  }, []);

  const clearDetectedCode = async () => {
    setDetectedCode(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return {
    detectedCode,
    setDetectedCode,
    clearDetectedCode,
  };
}
