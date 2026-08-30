import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Aviso persistente para incentivar a validar la identidad — la cuenta se
 * crea simple (sin RUT ni KYC), así que sin esto no hay señal visible de
 * que falta ese paso hasta que el usuario choca con el gate al reservar o
 * publicar. Se muestra arriba de la pantalla principal de cada modo
 * mientras estado_documentos !== "verificado".
 */
export function VerifyIdentityBanner({ onPress, role = "renter" }) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.icon}>
        <Icon name="shield" size={18} color={colors.warningText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Verifica tu identidad</Text>
        <Text style={styles.desc}>
          {role === "owner"
            ? "Necesaria para publicar tus vehículos."
            : "Necesaria para reservar un vehículo."}
        </Text>
      </View>
      <Icon name="arrow-right" size={16} color={colors.warningText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.warningBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.warningText },
  desc: { fontSize: 13, color: colors.warningText, marginTop: 1, lineHeight: 17 },
});
