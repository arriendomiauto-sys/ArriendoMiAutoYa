import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, BackButton } from "@rentacar/mobile-shared";

const PASOS = ["Auto", "Tarifa", "Fotos", "Docs"];

function Nodo({ indice, actual }) {
  const hecho = indice < actual;
  const activo = indice === actual;
  return (
    <View
      style={[
        styles.nodo,
        hecho && styles.nodoHecho,
        activo && styles.nodoActivo,
        !hecho && !activo && styles.nodoFuturo,
      ]}
    >
      {hecho ? (
        <Icon name="check" size={13} color="#FFFFFF" />
      ) : (
        <Text style={[styles.nodoNum, (activo || hecho) && styles.nodoNumOn]}>{indice + 1}</Text>
      )}
    </View>
  );
}

/**
 * Cromo compartido de los 4 pasos: barra superior con "volver" + contador,
 * el stepper, y abajo la barra de acción fija. El contenido de cada paso
 * (con su propio ScrollView) se pasa como `children`.
 */
export function WizardShell({
  paso, // 1..4
  onBack,
  onNext,
  siguienteLabel,
  siguienteHabilitado = true,
  cargando = false,
  children,
}) {
  const insets = useSafeAreaInsets();
  const indice = paso - 1;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <View style={styles.topBar}>
          <BackButton onPress={onBack} />
          <Text style={styles.contador}>{`Paso ${paso} de 4`}</Text>
        </View>

        <View style={styles.stepper}>
          {PASOS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 ? (
                <View style={[styles.linea, i <= indice && styles.lineaHecha]} />
              ) : null}
              <Nodo indice={i} actual={indice} />
            </React.Fragment>
          ))}
        </View>
        <View style={styles.labelsRow}>
          {PASOS.map((label, i) => (
            <Text
              key={label}
              style={[styles.stepLabel, i <= indice && styles.stepLabelOn, i === indice && styles.stepLabelActivo]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.body}>{children}</View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={theme.control.hitSlop} accessibilityRole="button">
          <Text style={styles.atras}>Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cta, !siguienteHabilitado && styles.ctaOff]}
          onPress={onNext}
          disabled={!siguienteHabilitado || cargando}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={siguienteLabel}
          accessibilityState={{ disabled: !siguienteHabilitado || cargando, busy: cargando }}
        >
          {cargando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.ctaText}>{siguienteLabel}</Text>
              <Icon name={paso === 4 ? "check" : "arrow-right"} size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: colors.background,
  },
  topBar: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  contador: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  stepper: { flexDirection: "row", alignItems: "center" },
  nodo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nodoHecho: { backgroundColor: colors.primary },
  nodoActivo: { backgroundColor: colors.primary },
  nodoFuturo: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  nodoNum: { fontSize: 13, fontWeight: "700", color: colors.textPlaceholder },
  nodoNumOn: { color: "#FFFFFF" },
  linea: { flex: 1, height: 2, backgroundColor: colors.border },
  lineaHecha: { backgroundColor: colors.primary },
  labelsRow: { flexDirection: "row", marginTop: -4 },
  stepLabel: { flex: 1, textAlign: "center", fontSize: 11, color: colors.textPlaceholder },
  stepLabelOn: { color: colors.primary, fontWeight: "600" },
  stepLabelActivo: { fontWeight: "700" },
  body: { flex: 1 },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  atras: { fontSize: 14, fontWeight: "600", color: colors.primary, paddingVertical: 8, paddingRight: 4 },
  cta: {
    flex: 1,
    height: theme.control.height,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  ctaOff: { backgroundColor: colors.borderLight },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
