import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, StatusBar, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, Button, Card, ScreenHeader, SectionLabel, ApiClient, showAlert } from "@rentacar/mobile-shared";

function formatearNumero(v) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatearExp(v) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function PaymentMethodsScreen({ car, booking, onBack, onPaymentSuccess }) {
  const insets = useSafeAreaInsets();
  const [numero, setNumero] = useState("");
  const [titular, setTitular] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);

  const montoHold = booking?.montoHold ?? 0;
  const esReservaReal = !!(car?.id && booking);
  const last4 = numero.replace(/\s/g, "").slice(-4);

  const handlePay = async () => {
    if (esReservaReal && cvv.length < 3) {
      showAlert("Falta el código de seguridad", "Ingresa el CVV de tu tarjeta para continuar.");
      return;
    }
    if (!esReservaReal) {
      onPaymentSuccess(null);
      return;
    }
    setProcessing(true);
    try {
      const reserva = await ApiClient.crearReserva({
        auto_id: car.id,
        fecha_inicio: booking.fechaInicio,
        fecha_fin: booking.fechaFin,
        lugar_entrega_acordado: car.ubicacion_base,
      });
      onPaymentSuccess({ ...reserva, car });
    } catch (error) {
      showAlert("No se pudo confirmar la reserva", error.message || "Intenta nuevamente en unos segundos.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title={esReservaReal ? "Pago de la reserva" : "Método de pago"} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.creditCard}>
          <View style={styles.ccTop}>
            <View style={styles.chip} />
            <Text style={styles.ccBrand}>Crédito</Text>
          </View>
          <Text style={styles.ccNumber}>
            {numero || "•••• •••• •••• ••••"}
          </Text>
          <View style={styles.ccBottom}>
            <Text style={styles.ccHolder}>{titular.toUpperCase() || "NOMBRE DEL TITULAR"}</Text>
            <Text style={styles.ccExp}>{exp || "MM/AA"}</Text>
          </View>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: 6 }}>
            <SectionLabel>Número de tarjeta</SectionLabel>
            <TextInput
              style={styles.input}
              value={numero}
              onChangeText={(v) => setNumero(formatearNumero(v))}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ gap: 6 }}>
            <SectionLabel>Titular</SectionLabel>
            <TextInput
              style={styles.input}
              value={titular}
              onChangeText={setTitular}
              placeholder="Como aparece en la tarjeta"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 6 }}>
              <SectionLabel>Vencimiento</SectionLabel>
              <TextInput
                style={styles.input}
                value={exp}
                onChangeText={(v) => setExp(formatearExp(v))}
                placeholder="MM/AA"
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <SectionLabel>CVV</SectionLabel>
              <TextInput
                style={styles.input}
                value={cvv}
                onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))}
                placeholder="•••"
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                secureTextEntry
              />
            </View>
          </View>
          <Text style={styles.help}>
            Solo aceptamos tarjeta de crédito: la garantía se retiene sobre el cupo, no se cobra.
          </Text>
        </View>

        {esReservaReal && (
          <Card padded style={styles.holdCard}>
            <Text style={styles.holdLabel}>Se retiene hoy (pre-autorización)</Text>
            <Text style={styles.holdValue}>${montoHold.toLocaleString("es-CL")}</Text>
            <Text style={styles.holdNote}>
              No es un cobro. Se libera al devolver el auto, menos cargos justificados.
            </Text>
          </Card>
        )}

        <View style={styles.secure}>
          <Icon name="shield" size={16} color={colors.accent700} />
          <Text style={styles.secureText}>Pago procesado con cifrado. No guardamos el número completo.</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button
          label={
            esReservaReal
              ? `Confirmar reserva · $${montoHold.toLocaleString("es-CL")}`
              : last4
              ? `Guardar tarjeta ····${last4}`
              : "Guardar método de pago"
          }
          onPress={handlePay}
          loading={processing}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  creditCard: {
    backgroundColor: colors.primary,
    borderRadius: theme.radius.card,
    padding: theme.spacing.xl,
    gap: 20,
    ...theme.shadow.md,
  },
  ccTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { width: 40, height: 28, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.22)" },
  ccBrand: { fontSize: 13, color: colors.accent300, fontWeight: "600" },
  ccNumber: { fontSize: 19, letterSpacing: 2, color: "#FFFFFF", fontWeight: "600" },
  ccBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  ccHolder: { fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "600", flex: 1 },
  ccExp: { fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  row: { flexDirection: "row", gap: theme.spacing.md },
  input: {
    height: theme.control.height,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  help: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  holdCard: { gap: 4 },
  holdLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  holdValue: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  holdNote: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginTop: 2 },
  secure: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  secureText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
