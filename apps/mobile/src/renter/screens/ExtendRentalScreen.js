import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, useApp, Button, Card, ScreenHeader, SectionLabel, ApiClient, showAlert } from "@rentacar/mobile-shared";

export function ExtendRentalScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const { activeReservation, setActiveReservation } = useApp();
  const [dias, setDias] = useState(1);
  const [loading, setLoading] = useState(false);

  const res = activeReservation || {};
  const auto = res.auto || res.car || {};
  const tarifa = auto.tarifa_dia || 0;
  const adicional = tarifa * dias;

  const finActual = new Date(res.fecha_fin || Date.now() + 2 * 86400000);
  const finNuevo = new Date(finActual.getTime() + dias * 86400000);
  const fmt = (d) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

  const handleExtender = async () => {
    if (!res.id) return;
    setLoading(true);
    try {
      const actualizada = await ApiClient.extenderReserva(res.id, dias);
      setActiveReservation({ ...actualizada, auto: res.auto });
      showAlert(
        "Arriendo extendido",
        `Ahora termina el ${fmt(new Date(actualizada.fecha_fin))}. Se retuvo un hold adicional de $${adicional.toLocaleString("es-CL")}.`,
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    } catch (err) {
      showAlert("No se pudo extender", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Extender arriendo" subtitle="Añade días a tu arriendo activo" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Card padded style={{ gap: theme.spacing.md }}>
          <View style={styles.carRow}>
            <View>
              <Text style={styles.carName}>{auto.marca} {auto.modelo}</Text>
              <Text style={styles.carMeta}>Patente {auto.patente || "—"}</Text>
            </View>
            <Text style={styles.rate}>${tarifa.toLocaleString("es-CL")} / día</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Devolución actual</Text>
            <Text style={styles.dateValue}>{fmt(finActual)} · 18:00</Text>
          </View>
        </Card>

        <Card padded style={{ gap: theme.spacing.md }}>
          <SectionLabel>Tiempo adicional</SectionLabel>
          <View style={styles.picker}>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setDias(Math.max(1, dias - 1))}>
              <Text style={styles.pickerSign}>−</Text>
            </TouchableOpacity>
            <View style={styles.pickerMid}>
              <Text style={styles.pickerNum}>+{dias} {dias === 1 ? "día" : "días"}</Text>
              <Text style={styles.pickerSub}>Nueva fecha: {fmt(finNuevo)}</Text>
            </View>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setDias(dias + 1)}>
              <Text style={styles.pickerSign}>+</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card padded style={{ gap: theme.spacing.sm }}>
          <SectionLabel>Monto adicional</SectionLabel>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              {dias} {dias === 1 ? "día" : "días"} × ${tarifa.toLocaleString("es-CL")}
            </Text>
            <Text style={styles.priceValue}>${adicional.toLocaleString("es-CL")}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Seguro Full Cobertura</Text>
            <Text style={[styles.priceValue, { color: colors.success }]}>Incluido</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Hold adicional a pre-autorizar</Text>
            <Text style={styles.totalValue}>${adicional.toLocaleString("es-CL")}</Text>
          </View>
          <Text style={styles.note}>
            El monto adicional se retiene de inmediato como hold, igual que en tu reserva original.
          </Text>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button
          label={`Solicitar extensión · $${adicional.toLocaleString("es-CL")}`}
          onPress={handleExtender}
          loading={loading}
          disabled={!res.id}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  carRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  carName: { fontSize: 15, fontWeight: "700", color: colors.text },
  carMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rate: { fontSize: 13, fontWeight: "700", color: colors.primary },
  dateRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: theme.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateLabel: { fontSize: 13, color: colors.textMuted },
  dateValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pickerBtn: { width: 52, height: 56, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  pickerSign: { fontSize: 24, fontWeight: "700", color: colors.primary },
  pickerMid: { flex: 1, alignItems: "center", gap: 2 },
  pickerNum: { fontSize: 16, fontWeight: "700", color: colors.text },
  pickerSub: { fontSize: 12, color: colors.textMuted },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 13, color: colors.textMuted },
  priceValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  totalLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "800", color: colors.primary },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 4 },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
