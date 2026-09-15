import React, { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";

/**
 * Foto de perfil del usuario con recuperación automática.
 *
 * La selfie de verificación vive en un bucket privado de Supabase y se sirve
 * con una URL firmada que expira. Si esa URL llegó vencida o mal firmada, el
 * <Image> falla en silencio y el usuario ve el círculo vacío "en todos lados".
 * Acá, ante un error de carga, se pide UNA vez `syncProfile()` — el backend
 * re-firma la URL en GET /usuarios/me — y se reintenta. Si aún así falla, se
 * muestra el ícono de placeholder.
 *
 * Props:
 *  - size: diámetro en px (default 56)
 *  - uri: URL explícita; si se omite, sale de currentUser (verificada > normal)
 *  - iconSize / iconColor: del placeholder
 *  - style: estilo extra del contenedor
 */
export function AvatarFoto({ size = 56, uri, iconSize, iconColor, style }) {
  const { currentUser, syncProfile } = useApp();
  const fuente =
    uri || currentUser?.foto_perfil_verificada_url || currentUser?.foto_perfil_url || null;

  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const reintentoHecho = useRef(false);

  // Si cambia la URL (p. ej. tras el re-sync trae una firmada nueva), se
  // limpia el error para que el <Image> reintente. El latch de reintento NO
  // se resetea: solo se pide el perfil de nuevo una vez por montaje.
  useEffect(() => {
    setError(false);
    setCargando(true);
  }, [fuente]);

  const dim = { width: size, height: size, borderRadius: size / 2 };

  const onError = () => {
    // Primer fallo: puede ser una URL firmada vencida/mal firmada. Se pide
    // el perfil de nuevo (el backend re-firma en GET /usuarios/me); si llega
    // una URL distinta, el useEffect limpia el error y el <Image> reintenta.
    // Si vuelve igual, queda el placeholder — mejor eso que un ícono roto.
    if (!reintentoHecho.current && typeof syncProfile === "function") {
      reintentoHecho.current = true;
      Promise.resolve(syncProfile()).catch(() => {});
    }
    setError(true);
  };

  if (!fuente || error) {
    return (
      <View style={[styles.empty, dim, style]}>
        <Icon name="user" size={iconSize || Math.round(size * 0.42)} color={iconColor || colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={[dim, style]}>
      {cargando && <Skeleton style={dim} />}
      <Image
        source={{ uri: fuente }}
        style={dim}
        onLoadEnd={() => setCargando(false)}
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
