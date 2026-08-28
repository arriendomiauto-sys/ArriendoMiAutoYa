import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

/**
 * Aviso persistente para incentivar a validar la identidad — la cuenta se
 * crea simple (sin RUT ni KYC), así que sin esto no hay ninguna señal
 * visible de que falta ese paso hasta que el usuario choca contra el gate
 * al intentar reservar/publicar. Se muestra arriba de la pantalla
 * principal de cada app mientras estado_documentos !== "verificado".
 */
export function VerifyIdentityBanner({ onPress, role = "renter" }) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconCircle}>
        <Icon name="shield" size={18} color={colors.warningText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Verifica tu identidad</Text>
        <Text style={styles.desc}>
          {role === "owner"
            ? "Necesitas validarla para poder publicar tus vehículos."
            : "Necesitas validarla para poder reservar un vehículo."}
        </Text>
      </View>
      <Icon name="arrow-right" size={16} color={colors.warningText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.warningText,
  },
  desc: {
    fontSize: 12,
    color: colors.warningText,
    marginTop: 1,
    lineHeight: 16,
  },
});
