import React from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Card, ScreenHeader, Badge, EmptyState } from "../components/ui";
import { AgregarTarjetaModal } from "../components/AgregarTarjetaModal";
import { useTarjetas } from "../hooks/useTarjetas";
import { useApp } from "../context/AppContext";
import { showAlert } from "../utils/alert";

const MARCA_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", diners: "Diners" };
const ESTADO_BADGE = {
  validada: { variant: "success", label: "Validada" },
  requiere_revision_manual: { variant: "warning", label: "En revisión" },
  rechazada: { variant: "danger", label: "Rechazada" },
};

function TarjetaFila({ tarjeta, onEliminar }) {
  const marca = MARCA_LABEL[tarjeta.marca] || "Tarjeta";
  const estado = ESTADO_BADGE[tarjeta.estado] || ESTADO_BADGE.requiere_revision_manual;
  return (
    <Card padded style={styles.fila}>
      <View style={styles.filaIcono}>
        <Icon name="card" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.filaTituloRow}>
          <Text style={styles.filaTitulo}>
            {marca} ·<Text style={styles.filaDigitos}> •••• {tarjeta.ultimos4}</Text>
          </Text>
          <View style={styles.tipoPill}>
            <Text style={styles.tipoPillTexto}>{tarjeta.tipo === "debito" ? "Débito" : "Crédito"}</Text>
          </View>
        </View>
        <View style={styles.filaMetaRow}>
          {tarjeta.vencimiento ? <Text style={styles.filaMeta}>Vence {tarjeta.vencimiento}</Text> : null}
          <Badge variant={estado.variant} label={estado.label} />
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onEliminar(tarjeta)}
        hitSlop={theme.control.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar la tarjeta terminada en ${tarjeta.ultimos4}`}
      >
        <Icon name="trash" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </Card>
  );
}

/**
 * "Mis tarjetas" — reemplaza a la vieja TarjetaScreen (una sola tarjeta).
 * El arrendatario necesita al menos una de DÉBITO (para el cobro del arriendo)
 * y una de CRÉDITO (para el hold de garantía). Mismo par de props que la
 * pantalla anterior: `onBack` y `onDone`.
 */
export function MisTarjetasScreen({ onBack, onDone }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const { tarjetas, cargando, error, recargar, agregar, eliminar, tieneDebito, tieneCredito } =
    useTarjetas();
  const [modalAbierto, setModalAbierto] = React.useState(false);

  const confirmarEliminar = (tarjeta) => {
    showAlert(
      "Eliminar tarjeta",
      `¿Quitar ${MARCA_LABEL[tarjeta.marca] || "la tarjeta"} terminada en ${tarjeta.ultimos4}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const res = await eliminar(tarjeta.id);
            if (!res.ok) {
              showAlert(
                "No se pudo eliminar",
                res.codigo === "TARJETA_EN_USO"
                  ? "Esta tarjeta está asociada a una reserva activa. Podrás quitarla cuando termine."
                  : res.mensaje
              );
            }
          },
        },
      ]
    );
  };

  const faltantes = [];
  if (!cargando && !tieneDebito) faltantes.push("una de débito para el arriendo");
  if (!cargando && !tieneCredito) faltantes.push("una de crédito para la garantía");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Mis tarjetas" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {faltantes.length > 0 ? (
          <View style={styles.avisoFalta}>
            <Icon name="alert" size={16} color={colors.warningText} />
            <Text style={styles.avisoFaltaTexto}>
              Te falta {faltantes.join(" y ")}.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitulo}>No pudimos cargar tus tarjetas</Text>
            <Text style={styles.errorTexto}>{error}</Text>
            <Button label="Reintentar" variant="secondary" onPress={recargar} fullWidth={false} style={{ alignSelf: "flex-start" }} />
          </View>
        ) : cargando ? (
          <Text style={styles.cargando}>Cargando…</Text>
        ) : tarjetas.length === 0 ? (
          <EmptyState
            icon="card"
            title="Aún no agregaste medios de pago"
            message="El arriendo se cobra a una tarjeta de débito y la garantía se retiene en una de crédito. Ambas deben estar a tu nombre."
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {tarjetas.map((t) => (
              <TarjetaFila key={t.id} tarjeta={t} onEliminar={confirmarEliminar} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button label="Agregar tarjeta" onPress={() => setModalAbierto(true)} />
        {tarjetas.length > 0 && (onDone || onBack) ? (
          <Button variant="ghost" label="Listo" onPress={() => (onDone || onBack)()} />
        ) : null}
      </View>

      <AgregarTarjetaModal
        visible={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onAgregar={agregar}
        onAgregada={() => setModalAbierto(false)}
        nombreTitular={currentUser?.nombre}
        rut={currentUser?.rut}
        tipoPreferido={!tieneDebito ? "debito" : !tieneCredito ? "credito" : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  cargando: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: theme.spacing.xl },

  avisoFalta: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  avisoFaltaTexto: { flex: 1, fontSize: 12.5, color: colors.warningText, lineHeight: 17 },

  fila: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  filaIcono: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  filaTituloRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  filaTitulo: { fontSize: 14, fontWeight: "700", color: colors.text },
  filaDigitos: { fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  tipoPill: {
    backgroundColor: colors.accent100,
    borderRadius: theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  tipoPillTexto: { fontSize: 11, fontWeight: "700", color: colors.accent800 },
  filaMetaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: 4 },
  filaMeta: { fontSize: 12, color: colors.textMuted },

  errorCard: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorTitulo: { fontSize: 14, fontWeight: "700", color: colors.dangerText },
  errorTexto: { fontSize: 13, color: colors.dangerText, lineHeight: 18 },

  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: theme.spacing.sm,
  },
});
