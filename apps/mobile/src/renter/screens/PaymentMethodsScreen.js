import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { colors, theme, Icon, Button, Card, ScreenHeader, ApiClient, showAlert } from "@rentacar/mobile-shared";

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/$/, "");

export function PaymentMethodsScreen({ car, booking, onBack, onPaymentSuccess }) {
  const insets = useSafeAreaInsets();
  const [processing, setProcessing] = useState(false);

  const montoHold = booking?.montoHold ?? 0;
  const dias = booking?.dias ?? 0;
  const esReservaReal = !!(car?.id && booking);
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");

  const irAWebpay = async (reservaId) => {
    const returnUrl = WEB_URL
      ? `${WEB_URL}/pago/retorno`
      : "https://arriendatuauto.cl/pago/retorno";
    const inicio = await ApiClient.iniciarPagoWebpay(montoHold, "hold_reserva", reservaId, returnUrl);
    if (!inicio?.url) throw new Error("La pasarela de pago no está disponible en este momento.");

    const redirect = Linking.createURL("pago-retorno");
    const res = await WebBrowser.openAuthSessionAsync(inicio.url, redirect);

    if (res.type !== "success" || !res.url) {
      return { estado: "pendiente", motivo: "cancelado" };
    }
    const { queryParams } = Linking.parse(res.url);
    const tokenWs = queryParams?.token_ws || inicio.token;
    const confirm = await ApiClient.confirmarPagoWebpay(tokenWs);
    return confirm?.autorizada
      ? { estado: "confirmada" }
      : { estado: "pendiente", motivo: confirm?.mensaje || "rechazado" };
  };

  const handlePay = async () => {
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

      let resultado;
      try {
        resultado = await irAWebpay(reserva.id);
      } catch (e) {
        // Pasarela caída / mal configurada: la reserva queda "pendiente" y
        // el usuario puede reintentar el pago desde Mis Arriendos.
        showAlert(
          "No se pudo abrir el pago",
          `${e.message || "Inténtalo de nuevo."}\n\nTu reserva quedó pendiente de pago.`
        );
        onPaymentSuccess({ ...reserva, car, estado: "pendiente" });
        return;
      }

      if (resultado.estado === "confirmada") {
        onPaymentSuccess({ ...reserva, car, estado: "confirmada" });
      } else {
        showAlert(
          resultado.motivo === "cancelado" ? "Pago no completado" : "Pago rechazado",
          "No se autorizó la garantía en Webpay. Tu reserva quedó pendiente; puedes reintentar el pago desde Mis Arriendos."
        );
        onPaymentSuccess({ ...reserva, car, estado: "pendiente" });
      }
    } catch (error) {
      // El backend rechaza la reserva cuando la licencia (o el PIC) vence antes
      // del término del arriendo, o cuando no se cumple la edad mínima. Eso no
      // se arregla reintentando, así que se muestra tal cual, sin el "intenta
      // de nuevo" que haría pensar en una falla pasajera.
      const motivo = error.message || "";
      const esRequisitoDelConductor = /licencia|permiso internacional|edad mínima|residencia/i.test(motivo);
      showAlert(
        esRequisitoDelConductor ? "No puedes reservar este auto" : "No se pudo crear la reserva",
        esRequisitoDelConductor
          ? `${motivo}

Actualiza tus documentos desde tu perfil o escríbenos a soporte.`
          : motivo || "Intenta nuevamente en unos segundos."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title={esReservaReal ? "Confirmar y pagar" : "Método de pago"} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {esReservaReal && (
          <Card padded style={styles.carRow}>
            <Image
              source={{ uri: car.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800" }}
              style={styles.carThumb}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.carName}>{nombreAuto || "Vehículo"}</Text>
              <Text style={styles.carMeta}>
                {dias} {dias === 1 ? "día" : "días"} · {car.ubicacion_base || "Los Ángeles"}
              </Text>
            </View>
          </Card>
        )}

        <Card padded style={{ gap: theme.spacing.md }}>
          <View style={styles.holdRow}>
            <Text style={styles.holdLabel}>Garantía a retener (hold)</Text>
            <Text style={styles.holdValue}>${montoHold.toLocaleString("es-CL")}</Text>
          </View>
          <Text style={styles.holdNote}>
            No es un cobro. Webpay retiene una pre-autorización sobre el cupo de tu tarjeta de crédito.
            Se libera al devolver el auto sin daños, menos cargos justificados.
          </Text>
        </Card>

        <View style={styles.webpayRow}>
          <View style={styles.webpayBadge}>
            <Icon name="card" size={18} color={colors.primary} />
          </View>
          <Text style={styles.webpayText}>
            El pago se procesa en <Text style={{ fontWeight: "700" }}>Webpay</Text>. Solo se acepta
            tarjeta de crédito porque la garantía se retiene en el cupo.
          </Text>
        </View>

        <View style={styles.secure}>
          <Icon name="shield" size={16} color={colors.accent700} />
          <Text style={styles.secureText}>
            No guardamos los datos de tu tarjeta — los administra Transbank.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button
          label={
            esReservaReal
              ? `Pagar con Webpay · $${montoHold.toLocaleString("es-CL")}`
              : "Continuar"
          }
          iconRight="arrow-right"
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
  carRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  carThumb: { width: 76, height: 58, borderRadius: theme.radius.field, backgroundColor: colors.primary100 },
  carName: { fontSize: 15, fontWeight: "700", color: colors.text },
  carMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  holdRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  holdLabel: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  holdValue: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  holdNote: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  webpayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.primary100,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
  },
  webpayBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  webpayText: { flex: 1, fontSize: 13, color: colors.primary, lineHeight: 19 },
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
