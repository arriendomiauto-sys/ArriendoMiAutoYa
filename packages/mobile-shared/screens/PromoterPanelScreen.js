import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { ScreenHeader, Button } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

/**
 * Panel completo del programa de invitación ("invita y gana"): código
 * propio, link para compartir y las estadísticas de cuántas personas ya se
 * registraron con ese código. Reemplaza a `ReferralCodeCard` (la versión
 * compacta embebida en el perfil) cuando la pantalla completa se justifica.
 */
export function PromoterPanelScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    ApiClient.getProgramaReferidos()
      .then((d) => vivo && setDatos(d))
      .catch((err) => vivo && showAlert("No se pudo cargar", msjError(err, "Intenta de nuevo en unos segundos.")))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const compartir = () => {
    if (!datos?.codigo) return;
    Share.share({
      message:
        `Te invito a ArriendoMiAutoYa: arrienda o publica tu auto y ambos ganamos un descuento. ` +
        `Usa mi código ${datos.codigo} al registrarte, o entra directo desde ${datos.link}`,
    }).catch(() => {});
  };

  const copiarLink = async () => {
    if (!datos?.link) return;
    await Clipboard.setStringAsync(datos.link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Invita y gana" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Tu código de invitación</Text>
          <Text style={styles.heroCodigo}>{cargando ? "······" : datos?.codigo || "—"}</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={copiarLink}
            activeOpacity={0.75}
            disabled={!datos?.link}
          >
            <Text style={styles.linkTexto} numberOfLines={1}>
              {datos?.link || " "}
            </Text>
            <Icon name={copiado ? "check" : "copy"} size={15} color={colors.accent400} />
          </TouchableOpacity>

          <Button
            label="Compartir"
            iconLeft="share"
            tone="dark"
            onPress={compartir}
            disabled={!datos?.codigo}
            style={styles.heroBoton}
          />
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Text style={styles.statValor}>{cargando ? "—" : datos?.referidos_totales ?? 0}</Text>
            <Text style={styles.statLabel}>
              {datos?.referidos_totales === 1 ? "persona invitada" : "personas invitadas"}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValor}>{cargando ? "—" : `${datos?.bono_pct_vigente ?? 0}%`}</Text>
            <Text style={styles.statLabel}>bono vigente hoy</Text>
          </View>
        </View>

        <View style={styles.explica}>
          <Text style={styles.explicaTitulo}>Cómo funciona</Text>
          <Text style={styles.explicaTexto}>
            Cuando alguien se registra con tu código, ambos reciben un descuento o un extra en sus
            ganancias. Ese beneficio es más alto recién llegado y va bajando con el tiempo, así que
            conviene compartirlo pronto.
          </Text>
          <Text style={styles.explicaTexto}>
            Tu propio bono por haberte sumado a la plataforma decae desde tu fecha de registro. Si
            además invitas a alguien y esa persona completa su primer arriendo, se activa un segundo
            bono que decae desde ese momento — el mayor de los dos es el que se aplica.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },

  hero: {
    backgroundColor: colors.primary900,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  heroLabel: { fontSize: 13, color: colors.darkTextMuted, fontWeight: "600" },
  heroCodigo: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.accent400,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: theme.radius.field,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    maxWidth: "100%",
  },
  linkTexto: { color: colors.darkTextMuted, fontSize: 12.5, flexShrink: 1 },
  heroBoton: { alignSelf: "stretch", marginTop: theme.spacing.xs },

  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: theme.spacing.xl,
  },
  statBlock: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValor: { fontSize: 26, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 12.5, color: colors.textMuted, textAlign: "center" },

  explica: { gap: theme.spacing.sm },
  explicaTitulo: { fontSize: 16, fontWeight: "700", color: colors.text },
  explicaTexto: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20 },
});
