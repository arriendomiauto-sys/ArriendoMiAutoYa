import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

export function PaymentMethodsScreen({
  car,
  booking,
  onBack,
  onPaymentSuccess,
}) {
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);

  // `booking` viene de CarDetailScreen (reserva real) — si esta pantalla se
  // abre en modo "billetera" (sin auto/booking, desde el perfil) no hay
  // nada que cobrar, solo se gestionan métodos de pago.
  const montoHold = booking?.montoHold ?? 0;
  const esReservaReal = !!(car?.id && booking);

  const handlePay = async () => {
    if (esReservaReal && cvv.length < 3) {
      showAlert("Código de seguridad requerido", "Ingresa el CVV de tu tarjeta para continuar.");
      return;
    }

    if (!esReservaReal) {
      // Modo "billetera": no hay reserva que crear.
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
      showAlert(
        "No se pudo confirmar la reserva",
        error.message || "Intenta nuevamente en unos segundos."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Nav (Pantalla 14) */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={onBack}>
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Pago</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Teal Credit Card (Pantalla 14) */}
        <View style={styles.creditCardBox}>
          <View style={styles.cardHeader}>
            <View style={styles.chipSim} />
            <Text style={styles.cardType}>Crédito</Text>
          </View>
          <Text style={styles.cardNumber}>•••• •••• •••• ••••</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardHolder}>SIN TARJETA GUARDADA</Text>
          </View>
        </View>

        {/* CVV Input */}
        <View style={styles.cvvGroup}>
          <Text style={styles.fieldLabel}>CÓDIGO DE SEGURIDAD</Text>
          <View style={styles.cvvInputBox}>
            <TextInput
              style={styles.cvvInput}
              value={cvv}
              onChangeText={setCvv}
              placeholder="•••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
          </View>
          <Text style={styles.fieldHelp}>
            Solo aceptamos tarjeta de crédito, porque la garantía se retiene en el cupo.
          </Text>
        </View>

        {esReservaReal && (
          <View style={styles.breakdownCard}>
            <View style={[styles.breakdownRow, styles.breakdownDivider]}>
              <Text style={styles.chargeTodayLabel}>Se retiene hoy (hold)</Text>
              <Text style={styles.chargeTodayVal}>${montoHold.toLocaleString("es-CL")}</Text>
            </View>
          </View>
        )}

        {/* Security / Encryption Notice */}
        <View style={styles.securityNote}>
          <Icon name="shield" size={18} color="#197A63" style={{ marginRight: 10 }} />
          <Text style={styles.securityText}>
            Pago procesado con cifrado. No guardamos su tarjeta completa.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Pay CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.payBtn}
          onPress={handlePay}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.payBtnText}>
              {esReservaReal ? `Confirmar reserva · $${montoHold.toLocaleString("es-CL")}` : "Guardar método de pago"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "space-between",
  },
  topNav: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  creditCardBox: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    gap: 22,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chipSim: {
    width: 40,
    height: 28,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  cardType: {
    fontSize: 13,
    color: "#92E3CB",
    fontWeight: "600",
  },
  cardNumber: {
    fontSize: 20,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    color: "#FFFFFF",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHolder: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  cardExp: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  cvvGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  cvvInputBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  cvvInput: {
    fontSize: 16,
    letterSpacing: 5,
    color: colors.text,
  },
  fieldHelp: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 11,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownDivider: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  chargeTodayLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  chargeTodayVal: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
