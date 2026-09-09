import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Aviso persistente para incentivar a validar la identidad — la cuenta se
 * crea simple (sin RUT ni KYC), así que sin esto no hay señal visible de
 * que falta ese paso hasta que el usuario choca con el gate al reservar o
 * publicar. Va como PRIMER ítem de la lista de la pantalla principal de
 * cada modo mientras `estado_documentos !== "verificado"` — no un banner
 * flotante. Superficie pino oscuro con hairline menta, igual que los
 * bloques de seguridad del KYC.
 */
export function VerifyIdentityBanner({ onPress, role = "renter" }) {
  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Verifica tu identidad"
    >
      <View style={styles.hairline} />
      <View style={styles.iconTile}>
        <Icon name="shield" size={16} color={colors.accent500} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Verifica tu identidad</Text>
        <Text style={styles.desc}>
          {role === "owner"
            ? "Toma unos minutos y te habilita para publicar"
            : "Toma unos minutos y te habilita para reservar"}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Empezar</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.primary900,
    borderRadius: theme.radius.card,
    padding: 14,
    overflow: "hidden",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: colors.accent500,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(47,191,155,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600", color: colors.textWhite },
  desc: { fontSize: 12.5, color: colors.accent200, marginTop: 2, lineHeight: 17 },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent500,
  },
  ctaText: { fontSize: 13, fontWeight: "700", color: colors.primary900 },
});
