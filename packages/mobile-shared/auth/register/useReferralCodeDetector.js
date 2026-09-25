import { useState, useEffect } from "react";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient } from "../../api/client";

// Solo guarda códigos que llegaron por un enlace de invitación. La clave
// anterior (`pending_referral_code`) también guardaba lo que se sacaba del
// portapapeles, así que se descarta al arrancar: podía tener cualquier cosa.
const STORAGE_KEY = "@rentacar/pending_referral_code_enlace";
const STORAGE_KEY_ANTERIOR = "@rentacar/pending_referral_code";
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
 * Detecta códigos de colaboradores e invitación para el registro.
 *
 * - `detectedCode`: llegó por un enlace de invitación (deep link, o guardado de
 *   un enlace anterior). La persona tocó ese enlace a propósito, así que el
 *   registro lo pone solo en el campo.
 * - `sugerencia`: estaba en el portapapeles (la web lo copia al tocar
 *   "Descargar"). NO se pone solo: antes cualquier texto de 6 letras/números
 *   copiado -- el código del correo, por ejemplo -- aparecía como código de
 *   invitación sin que la persona hiciera nada. Ahora solo se sugiere si el
 *   backend confirma que es un código válido, y se usa si la persona lo acepta.
 */
export function useReferralCodeDetector() {
  const [detectedCode, setDetectedCode] = useState(null);
  const [sugerencia, setSugerencia] = useState(null);

  useEffect(() => {
    let activo = true;

    const desdeEnlace = async (code) => {
      if (!code || !activo) return;
      setDetectedCode(code);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, code);
      } catch {}
    };

    async function detectar() {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY_ANTERIOR);
      } catch {}

      // 1. Código de un enlace abierto antes (se guardó hasta terminar el registro).
      try {
        const guardado = await AsyncStorage.getItem(STORAGE_KEY);
        if (guardado && CODE_REGEX.test(guardado) && activo) {
          setDetectedCode(guardado);
          return;
        }
      } catch {}

      // 2. URL con que se abrió la app (cold start).
      try {
        const codeFromUrl = extraerCodigoDeUrl(await Linking.getInitialURL());
        if (codeFromUrl) {
          await desdeEnlace(codeFromUrl);
          return;
        }
      } catch {}

      // 3. Portapapeles: solo como sugerencia, y solo si el código existe.
      try {
        const limpio = ((await Clipboard.getStringAsync()) || "").trim().toUpperCase();
        if (!CODE_REGEX.test(limpio)) return;
        const validacion = await ApiClient.validarCodigoReferido(limpio);
        if (validacion?.valido && activo) {
          setSugerencia({ codigo: limpio, nombreReferente: validacion.nombre_referente || null });
        }
      } catch {}
    }

    detectar();

    // 4. Enlaces que llegan mientras la app está abierta.
    const subscription =
      typeof Linking?.addEventListener === "function"
        ? Linking.addEventListener("url", (event) => desdeEnlace(extraerCodigoDeUrl(event.url)))
        : null;

    return () => {
      activo = false;
      subscription?.remove();
    };
  }, []);

  const clearDetectedCode = async () => {
    setDetectedCode(null);
    setSugerencia(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return {
    detectedCode,
    setDetectedCode,
    clearDetectedCode,
    sugerencia,
    descartarSugerencia: () => setSugerencia(null),
  };
}
