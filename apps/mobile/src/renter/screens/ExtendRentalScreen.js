import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, useApp, Button, Card, ScreenHeader, SectionLabel, ApiClient, showAlert, msjError } from "@rentacar/mobile-shared";

const DIA_MS = 86400000;

export function ExtendRentalScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const { activeReservation, setActiveReservation } = useApp();
  const [dias, setDias] = useState(1);
  const [loading, setLoading] = useState(false);

  const res = activeReservation || {};
  const auto = res.auto || res.car || {};
  const tarifa = auto.tarifa_dia || 0;
  const adicional = tarifa * dias;

  const finActual = new Date(res.fecha_fin || Date.now() + 2 * DIA_MS);
  const finNuevo = new Date(finActual.getTime() + dias * DIA_MS);
  const fmt = (d) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

  // Techo de la extensión: inicio de la próxima reserva del auto. Sin esto el
  // usuario sube los días y recién al mandar se come el 400 del backend
  // ("no disponible para esas fechas"). El arriendo actual arranca antes del
  // fin actual, así que un rango que empieza en `finActual` o después es
  // siempre OTRA reserva (incluida una back-to-back, que deja tope 0).
  const [proximaReserva, setProximaReserva] = useState(null);
  useEffect(() => {
    const autoId = auto?.id;
    if (!autoId || typeof ApiClient.getDisponibilidadAuto !== "function") return undefined;
    let vivo = true;
    ApiClient.getDisponibilidadAuto(autoId)
      .then((r) => {
        if (!vivo) return;
        const siguientes = (r?.rangos_ocupados || [])
          .map((x) => new Date(x.fecha_inicio))
          .filter((d) => !isNaN(d) && d.getTime() >= finActual.getTime())
          .sort((a, b) => a - b);
        setProximaReserva(siguientes[0] || null);
      })
      .catch((e) => {
        if (__DEV__) console.warn("[extender] no se pudo cargar disponibilidad:", e?.message || e);
      });
    return () => {
      vivo = false;
    };
  }, [auto?.id, res.fecha_fin]);

  // Días máximos que se pueden agregar sin pisar la próxima reserva. Extender
  // justo hasta el inicio de la siguiente (back-to-back) está permitido.
  const topeDias = proximaReserva
    ? Math.max(0, Math.floor((proximaReserva.getTime() - finActual.getTime()) / DIA_MS))
    : Infinity;
  const sinMargen = topeDias === 0;
  const colisiona = dias > topeDias;

  const handleExtender = async () => {
    if (loading || !res.id) return;
    if (sinMargen || colisiona) {
      showAlert(
        "No se puede extender tanto",
        proximaReserva
          ? `El auto tiene otra reserva desde el ${fmt(proximaReserva)}. Elige menos días.`
          : "El auto no está disponible para esas fechas.",
      );
      return;
    }
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
      showAlert("No se pudo extender", msjError(err, "Intenta de nuevo en unos segundos."));
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
            <TouchableOpacity
              style={[styles.pickerBtn, dias >= topeDias && styles.pickerBtnOff]}
              onPress={() => setDias((d) => Math.min(d + 1, topeDias))}
              disabled={dias >= topeDias}
            >
              <Text style={styles.pickerSign}>+</Text>
            </TouchableOpacity>
          </View>
          {sinMargen ? (
            <Text style={styles.avisoBloqueo}>
              El auto ya tiene otra reserva justo después de tu devolución. No se puede extender.
            </Text>
          ) : proximaReserva ? (
            <Text style={styles.avisoTope}>
              Máximo hasta el {fmt(proximaReserva)}: el auto está reservado desde esa fecha.
            </Text>
          ) : null}
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
          label={
            sinMargen || colisiona
              ? "No disponible para esas fechas"
              : `Solicitar extensión · $${adicional.toLocaleString("es-CL")}`
          }
          onPress={handleExtender}
          loading={loading}
          disabled={!res.id || sinMargen || colisiona}
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
  pickerBtnOff: { opacity: 0.35 },
  avisoTope: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  avisoBloqueo: { fontSize: 12.5, color: colors.danger, fontWeight: "600", lineHeight: 17 },
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
