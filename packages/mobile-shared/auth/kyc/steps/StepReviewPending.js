import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";
import { kycStyles } from "../styles/kycStyles";

// ============================================================================
// Paso de Estado: Caso en Revisión Manual
// Informa al usuario que un ejecutivo de soporte está revisando sus documentos
// ============================================================================
export function StepReviewPending({ onGoToHome }) {
  return (
    <View style={kycStyles.screenContainer}>
      <View style={styles.centerBox}>
        <View style={styles.iconCircle}>
          <Icon name="clock" size={40} color={colors.primary600} />
        </View>

        <Text style={styles.title}>Verificación en Revisión</Text>
        <Text style={styles.subtitle}>
          Hemos recibido tus documentos. Un ejecutivo está validando tu cuenta manualmente para garantizar la seguridad en la plataforma.
        </Text>
        <Text style={styles.note}>
          Te notificaremos mediante la app y por correo en cuanto tu cuenta esté activa.
        </Text>
      </View>

      <TouchableOpacity style={kycStyles.primaryButton} onPress={onGoToHome}>
        <Text style={kycStyles.primaryButtonText}>Ir al Inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary700,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  note: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
});
