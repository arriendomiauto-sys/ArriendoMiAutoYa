import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { colors } from "../../../theme/colors";
import { kycStyles } from "../styles/kycStyles";

// ============================================================================
// Pantalla 1: Activación de la verificación rápida con Didit
// Explica el flujo (cédula + licencia + selfie) y abre la sesión hosted externa.
// El riel vertical se dibuja como secuencia real: carnet -> licencia -> selfie.
// ============================================================================

// Los 3 requisitos, en el orden en que Didit los pide dentro del flujo hosted.
const REQUIREMENTS = [
  {
    title: "Carnet de identidad",
    description: "Foto por ambos lados, sin reflejos.",
  },
  {
    title: "Licencia de conducir",
    description: "Vigente y Clase B.",
  },
  {
    title: "Selfie biométrica",
    description: "Prueba de vida para confirmar que eres tú.",
  },
];

// ----------------------------------------------------------------------------
// Nodo del riel: disco de menta con check y, salvo en el último, la línea que
// lo conecta con el siguiente paso.
// ----------------------------------------------------------------------------
function RailStep({ title, description, last }) {
  return (
    <View style={styles.railStep}>
      <View style={styles.railNode}>
        <Icon name="check" size={14} color={colors.textWhite} strokeWidth={2.6} />
        {!last && <View style={styles.railLine} />}
      </View>
      <View style={styles.railBody}>
        <Text style={styles.railTitle}>{title}</Text>
        <Text style={styles.railDescription}>{description}</Text>
      </View>
    </View>
  );
}

export function StepDiditActivation({ onStartDidit, onTriggerFallback, isLoading }) {
  return (
    <View style={kycStyles.screenContainer}>
      {/* Contenido con scroll: promesa, riel de requisitos y nota de privacidad */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bloque cabecera: emblema de seguridad y promesa del flujo */}
        <View style={styles.header}>
          <View style={styles.emblem}>
            <Icon name="shield" size={30} color={colors.accent500} />
          </View>
          <Text style={styles.title}>Verificación rápida de identidad y licencia</Text>
          <Text style={styles.subtitle}>
            En menos de 2 minutos validamos tu cédula de identidad, tu licencia de
            conducir y una selfie biométrica.
          </Text>
        </View>

        {/* Bloque riel: los 3 pasos que corre Didit, como secuencia conectada */}
        <View style={styles.rail}>
          {REQUIREMENTS.map((item, index) => (
            <RailStep
              key={item.title}
              title={item.title}
              description={item.description}
              last={index === REQUIREMENTS.length - 1}
            />
          ))}
        </View>

        {/* Bloque privacidad: qué hace Didit con las fotos */}
        <View style={styles.privacy}>
          <Icon name="lock" size={16} color={colors.accent800} strokeWidth={1.7} />
          <Text style={styles.privacyText}>
            Didit procesa tus fotos de forma cifrada. No quedan guardadas en el
            teléfono.
          </Text>
        </View>
      </ScrollView>

      {/* Bloque acciones: CTA primario (Didit) y salida manual como respaldo */}
      <View style={[kycStyles.footerBar, styles.footer]}>
        <TouchableOpacity
          style={kycStyles.primaryButton}
          onPress={onStartDidit}
          disabled={isLoading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Iniciar verificación"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textWhite} />
          ) : (
            <Text style={kycStyles.primaryButtonText}>Iniciar verificación</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={kycStyles.secondaryButton}
          onPress={onTriggerFallback}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Subir fotos manualmente"
        >
          <Text style={kycStyles.secondaryButtonText}>Subir fotos manualmente</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },

  // Cabecera
  header: {
    marginBottom: 26,
  },
  emblem: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary700,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 27,
    letterSpacing: -0.3,
    color: colors.primary700,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  // Riel de requisitos
  rail: {
    gap: 20,
  },
  railStep: {
    flexDirection: "row",
    gap: 14,
  },
  railNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent500,
    justifyContent: "center",
    alignItems: "center",
  },
  // La línea arranca bajo el nodo, centrada, y baja hasta el siguiente paso.
  railLine: {
    position: "absolute",
    top: 28,
    left: 13,
    width: 2,
    height: 40,
    backgroundColor: colors.accent200,
  },
  railBody: {
    flex: 1,
    paddingTop: 3,
  },
  railTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.text,
  },
  railDescription: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Nota de privacidad
  privacy: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  privacyText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.accent800,
  },

  // Pie de acciones
  footer: {
    paddingBottom: 16,
  },
});
