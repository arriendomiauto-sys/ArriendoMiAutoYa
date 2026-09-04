import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Share, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { ApiClient } from "../api/client";
import { useApp } from "../context/AppContext";
import { urlWeb } from "../utils/webUrl";
import { showAlert } from "../utils/alert";

/**
 * Código propio para invitar amigos (compartir) + campo para ingresar el
 * código de quien invitó a este usuario, si todavía no aplicó uno. El
 * propio se genera solo (perezosamente) la primera vez que se pide
 * GET /usuarios/me, así que si `currentUser` todavía no lo trae, se
 * refresca acá.
 */
export function ReferralCodeCard() {
  const { currentUser, setCurrentUser } = useApp();
  const [codigo, setCodigo] = useState(currentUser?.codigo_referido || null);
  const [yaTieneReferente, setYaTieneReferente] = useState(!!currentUser?.referido_por_id);
  const [cargando, setCargando] = useState(!currentUser?.codigo_referido);
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (currentUser?.codigo_referido) {
      setCodigo(currentUser.codigo_referido);
      setYaTieneReferente(!!currentUser.referido_por_id);
      setCargando(false);
      return;
    }
    let cancelado = false;
    if (typeof ApiClient?.getMe === "function") {
      ApiClient.getMe()
        .then((perfil) => {
          if (cancelado) return;
          setCodigo(perfil?.codigo_referido || null);
          setYaTieneReferente(!!perfil?.referido_por_id);
          setCurrentUser?.(perfil);
        })
        .catch(() => {})
        .finally(() => !cancelado && setCargando(false));
    } else {
      setCargando(false);
    }
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compartir = () => {
    if (!codigo) return;
    Share.share({
      message:
        `Arrienda o publica tu auto en Arrienda Tu Auto y ambos ganamos un descuento/bono. ` +
        `Usa mi código ${codigo} al registrarte: ${urlWeb()}`,
    }).catch(() => {});
  };

  const aplicarCodigo = async () => {
    const limpio = codigoIngresado.trim();
    if (!limpio || aplicando) return;
    setAplicando(true);
    try {
      const perfil = await ApiClient.aplicarCodigoReferido(limpio);
      setCurrentUser(perfil);
      setYaTieneReferente(true);
      showAlert("¡Listo!", "Código de invitación registrado.");
    } catch (err) {
      showAlert("No se pudo registrar el código", err.message || "Revisa el código e inténtalo de nuevo.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="star" size={20} color={colors.accent700} />
        <Text style={styles.titulo}>Invita y gana</Text>
      </View>
      <Text style={styles.texto}>
        Comparte tu código: quien lo use y tú reciben un descuento o un extra en sus ganancias que
        va bajando con el tiempo, así que conviene compartirlo pronto.
      </Text>

      <View style={styles.codigoBox}>
        <Text style={styles.codigoTexto}>{cargando ? "..." : codigo || "—"}</Text>
      </View>

      <TouchableOpacity
        style={[styles.boton, !codigo && styles.botonDeshabilitado]}
        onPress={compartir}
        disabled={!codigo}
        activeOpacity={0.85}
      >
        <Icon name="share" size={16} color="#FFFFFF" />
        <Text style={styles.botonTexto}>Compartir código</Text>
      </TouchableOpacity>

      {!cargando && !yaTieneReferente ? (
        <View style={styles.ingresarBox}>
          <Text style={styles.ingresarLabel}>¿Alguien te invitó? Ingresa su código</Text>
          <View style={styles.ingresarFila}>
            <TextInput
              style={styles.input}
              value={codigoIngresado}
              onChangeText={(t) => setCodigoIngresado(t.toUpperCase())}
              placeholder="Código de 6 letras/números"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="characters"
              maxLength={12}
            />
            <TouchableOpacity
              style={[styles.botonIngresar, (!codigoIngresado.trim() || aplicando) && styles.botonDeshabilitado]}
              onPress={aplicarCodigo}
              disabled={!codigoIngresado.trim() || aplicando}
              activeOpacity={0.85}
            >
              {aplicando ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.botonIngresarTexto}>Usar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  titulo: { fontSize: 16, fontWeight: "700", color: colors.text },
  texto: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  codigoBox: {
    backgroundColor: colors.background,
    borderRadius: theme.radius.field,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    paddingVertical: 14,
    alignItems: "center",
  },
  codigoTexto: { fontSize: 22, fontWeight: "800", letterSpacing: 4, color: colors.primary },
  boton: {
    marginTop: 4,
    height: 46,
    borderRadius: theme.radius.field,
    backgroundColor: colors.accent500,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  botonDeshabilitado: { opacity: 0.5 },
  botonTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  ingresarBox: { marginTop: theme.spacing.sm, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: theme.spacing.sm },
  ingresarLabel: { fontSize: 13, color: colors.textMuted },
  ingresarFila: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    paddingHorizontal: theme.spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  botonIngresar: {
    height: 44,
    minWidth: 68,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  botonIngresarTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
