import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { useApp } from "../context/AppContext";
import { showAlert } from "../utils/alert";
import { PROVEEDORES_OAUTH, NOMBRE_PROVEEDOR } from "../utils/oauth";

// Marcas de cada proveedor (SVG a color, no el Icon monocromo de la app).
function MarcaProveedor({ provider, size = 20 }) {
  if (provider === "google") {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
        <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.7l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.6 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
      </Svg>
    );
  }
  if (provider === "apple") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#000000"
          d="M16.365 1.43c0 1.14-.42 2.22-1.19 3.02-.83.87-2.17 1.55-3.29 1.46-.14-1.1.44-2.28 1.16-3.03.79-.83 2.22-1.46 3.32-1.45zM20.5 17.09c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.05-1.78-4.04-3.34C0 15.9-.26 10.03 1.47 7.1c1.09-1.83 2.81-2.9 4.43-2.9 1.64 0 2.67 1.02 4.02 1.02 1.31 0 2.11-1.02 4.02-1.02 1.44 0 2.97.79 4.06 2.15-3.57 1.96-2.99 7.06.5 8.74z"
        />
      </Svg>
    );
  }
  if (provider === "facebook") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#1877F2"
          d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
        />
      </Svg>
    );
  }
  return null;
}

const nombre = (provider) => NOMBRE_PROVEEDOR[provider] || provider;

/**
 * Botones de inicio de sesión / registro con proveedores sociales.
 *
 * `preferredMode` ("renter" | "owner") fija el modo con el que arranca la
 * app la primera vez (igual que el rol elegido en el registro por correo).
 * `onDone` se llama tras un login exitoso, por si la pantalla quiere navegar.
 * `compact` pone los proveedores en una fila, con solo su nombre, bajo el
 * separador "o continúa con" (pantallas de login).
 */
export function BotonesOAuth({ preferredMode, onDone, divider = true, compact = false }) {
  const { loginConProveedor } = useApp();
  const [cargando, setCargando] = useState(null); // provider en curso | null

  const entrar = async (provider) => {
    setCargando(provider);
    try {
      await loginConProveedor(provider, preferredMode);
      onDone?.();
    } catch (err) {
      if (err?.code !== "oauth_cancelado") {
        showAlert(
          "No se pudo iniciar sesión",
          err?.message || `Hubo un problema con ${nombre(provider)}.`
        );
      }
    } finally {
      setCargando(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {divider ? (
        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>{compact ? "o continúa con" : "o"}</Text>
          <View style={styles.line} />
        </View>
      ) : null}

      <View style={compact ? styles.fila : styles.columna}>
        {(PROVEEDORES_OAUTH || ["google"]).map((provider) => (
          <TouchableOpacity
            key={provider}
            style={[
              styles.boton,
              compact && styles.botonCompacto,
              cargando && cargando !== provider && styles.botonOff,
            ]}
            activeOpacity={0.7}
            disabled={!!cargando}
            onPress={() => entrar(provider)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!cargando, busy: cargando === provider }}
            accessibilityLabel={`Continuar con ${nombre(provider)}`}
          >
            {cargando === provider ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MarcaProveedor provider={provider} size={20} />
                <Text style={styles.botonTexto}>
                  {compact ? nombre(provider) : `Continuar con ${nombre(provider)}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.sm, width: "100%" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.xs,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.textMuted },
  boton: {
    height: theme.control.height,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  columna: { gap: theme.spacing.sm },
  fila: { flexDirection: "row", gap: theme.spacing.sm },
  botonCompacto: { flex: 1 },
  botonOff: { opacity: 0.5 },
  botonTexto: { fontSize: 15, fontWeight: "600", color: colors.text },
});
