import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Card, ScreenHeader, Badge } from "../components/ui";
import { FormularioTarjeta, validarFormularioTarjeta, tokenizarTarjeta } from "../components/FormularioTarjeta";
import { ApiClient } from "../api/client";
import { useApp } from "../context/AppContext";
import { showAlert } from "../utils/alert";

const ESTADO_BADGE = {
  validada: { variant: "success", label: "Validada" },
  pendiente: { variant: "neutral", label: "Sin registrar" },
  rechazada: { variant: "danger", label: "Rechazada" },
  requiere_revision_manual: { variant: "warning", label: "En revisión" },
};

/**
 * Agregar o reemplazar la tarjeta fuera del enrolamiento inicial — la pieza
 * que faltaba: antes la única forma de cargar una tarjeta era completando
 * todo el KYC de nuevo, así que si alguien la dejó pendiente o se la
 * rechazaron no tenía cómo arreglarlo sin soporte.
 */
export function TarjetaScreen({ onBack, onDone }) {
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser } = useApp();
  const [tarjeta, setTarjeta] = useState({ numero: "", vencimiento: "", cvv: "", nombre: "" });
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const estadoActual = currentUser?.tarjeta_estado || "pendiente";
  const badge = ESTADO_BADGE[estadoActual] || ESTADO_BADGE.pendiente;

  const guardar = async () => {
    setIntentado(true);
    const errores = validarFormularioTarjeta(tarjeta);
    if (Object.keys(errores).length > 0) return;

    setGuardando(true);
    try {
      const resultado = await ApiClient.actualizarTarjeta(tokenizarTarjeta(tarjeta));
      setCurrentUser((prev) => (prev ? { ...prev, ...resultado } : prev));
      if (resultado.tarjeta_estado === "validada") {
        showAlert("Tarjeta registrada", "Tu tarjeta quedó validada.", [
          { text: "Listo", onPress: () => onDone?.() },
        ]);
      } else {
        showAlert(
          "Tarjeta guardada, en revisión",
          resultado.motivo || "Tu tarjeta quedó pendiente de revisión manual.",
          [{ text: "Entendido", onPress: () => onDone?.() }]
        );
      }
    } catch (err) {
      showAlert("No se pudo guardar la tarjeta", err.message || "Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Tarjeta de crédito" onBack={onBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card padded style={styles.estadoCard}>
            <View style={styles.estadoRow}>
              <View style={styles.estadoIcono}>
                <Icon name="card" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.estadoTitulo}>
                  {currentUser?.tarjeta_ultimos4
                    ? `${currentUser.tarjeta_marca || "Tarjeta"} · •••• ${currentUser.tarjeta_ultimos4}`
                    : "Sin tarjeta registrada"}
                </Text>
                <Text style={styles.estadoSub}>
                  Es la garantía con la que se retiene el hold y se cobran los cargos del arriendo.
                </Text>
              </View>
              <Badge variant={badge.variant} label={badge.label} />
            </View>
          </Card>

          <FormularioTarjeta
            valor={tarjeta}
            onChange={setTarjeta}
            errores={{ ...validarFormularioTarjeta(tarjeta), mostrarTodos: intentado }}
            nombreTitular={currentUser?.nombre}
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Button
            label={currentUser?.tarjeta_ultimos4 ? "Reemplazar tarjeta" : "Guardar tarjeta"}
            onPress={guardar}
            loading={guardando}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  estadoCard: { gap: theme.spacing.sm },
  estadoRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  estadoIcono: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  estadoTitulo: { fontSize: 14, fontWeight: "700", color: colors.text },
  estadoSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
