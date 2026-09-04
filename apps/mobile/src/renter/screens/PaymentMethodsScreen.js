import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { colors, theme, Icon, Button, Card, ScreenHeader, ApiClient, showAlert, urlWeb } from "@rentacar/mobile-shared";

export function PaymentMethodsScreen({ car, booking, onBack, onPaymentSuccess }) {
  const insets = useSafeAreaInsets();
  const [processing, setProcessing] = useState(false);

  // BLOQUE TEMPORAL — PAGOS SIMULADOS
  // Mientras la pasarela real no esté configurada, el backend da el pago y la
  // retención por aprobados. La pantalla lo pregunta al montar para decirlo de
  // frente en vez de fingir un cobro que no existe. Borrar junto con el bypass
  // del backend (app/services/pagos_simulados.py).
  const [pagoSimulado, setPagoSimulado] = useState(false);

  useEffect(() => {
    let vivo = true;
    ApiClient.getConfiguracionPagos()
      .then((cfg) => {
        if (vivo) setPagoSimulado(!!cfg?.simulado);
      })
      // Si no se puede preguntar, se asume pasarela real: es el camino que no
      // le promete al usuario un pago de prueba que quizá no ocurra.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const montoHold = booking?.montoHold ?? 0;
  const dias = booking?.dias ?? 0;
  const esReservaReal = !!(car?.id && booking);
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");

  const irAPagar = async (reservaId) => {
    // urlWeb() normaliza EXPO_PUBLIC_WEB_URL y cae al dominio de producción
    // real. Armar esta URL a mano dejaba un dominio que el backend no tiene
    // autorizado y el pago moría con "URL de retorno no válida".
    const returnUrl = urlWeb("pago/retorno");
    const inicio = await ApiClient.iniciarPago(montoHold, "hold_reserva", reservaId, returnUrl);

    // BLOQUE TEMPORAL — PAGOS SIMULADOS
    // Mientras la cuenta de Mercado Pago no esté configurada, el backend
    // devuelve `simulado: true` y da el pago y la retención por aprobados. Acá
    // se salta el checkout, que no tendría a dónde ir. Borrar este bloque
    // junto con app/services/pagos_simulados.py del backend.
    if (inicio?.simulado) {
      const confirmSimulado = await ApiClient.confirmarPago(inicio.preferencia_id, inicio.pago_id);
      return confirmSimulado?.autorizada
        ? { estado: "confirmada", simulado: true }
        : { estado: "pendiente", motivo: confirmSimulado?.mensaje || "rechazado" };
    }

    if (!inicio?.url) throw new Error("La pasarela de pago no está disponible en este momento.");

    const redirect = Linking.createURL("pago-retorno");
    const res = await WebBrowser.openAuthSessionAsync(inicio.url, redirect);

    // Cerrar el checkout ya no significa perder el pago: si alcanzó a pagar,
    // el webhook de Mercado Pago confirma la reserva igual. Por eso queda
    // "pendiente" y no "rechazada" — el estado real llega por el otro camino.
    if (res.type !== "success" || !res.url) {
      return { estado: "pendiente", motivo: "cancelado" };
    }

    // Mercado Pago devuelve payment_id; collection_id es el nombre antiguo del
    // mismo dato y sigue viniendo en algunos flujos.
    const { queryParams } = Linking.parse(res.url);
    const paymentId = queryParams?.payment_id || queryParams?.collection_id;
    if (!paymentId) return { estado: "pendiente", motivo: "cancelado" };

    const confirm = await ApiClient.confirmarPago(paymentId, inicio.pago_id);
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
        resultado = await irAPagar(reserva.id);
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
        onPaymentSuccess({ ...reserva, car, estado: "confirmada", pagoSimulado: !!resultado.simulado });
      } else {
        showAlert(
          resultado.motivo === "cancelado" ? "Pago no completado" : "Pago rechazado",
          "No se autorizó la garantía en Mercado Pago. Tu reserva quedó pendiente; puedes reintentar el pago desde Mis Arriendos."
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
            No es un cobro. Mercado Pago retiene el monto sobre el cupo de tu tarjeta y lo libera al
            terminar el arriendo si no hay cargos.
            Se libera al devolver el auto sin daños, menos cargos justificados.
          </Text>
        </Card>

        {/* BLOQUE TEMPORAL — PAGOS SIMULADOS */}
        {pagoSimulado ? (
          <View style={styles.pruebaRow}>
            <View style={styles.pruebaBadge}>
              <Icon name="alert" size={18} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pruebaTitulo}>Modo de prueba</Text>
              <Text style={styles.pruebaTexto}>
                La pasarela de pago todavía no está conectada. Al continuar,{" "}
                <Text style={{ fontWeight: "700" }}>no se cobra ni se retiene nada</Text>: la reserva
                avanza como si el pago hubiera sido exitoso, para poder probar el resto del flujo.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.pasarelaRow}>
            <View style={styles.pasarelaBadge}>
              <Icon name="card" size={18} color={colors.primary} />
            </View>
            <Text style={styles.pasarelaText}>
              El pago se procesa en <Text style={{ fontWeight: "700" }}>Mercado Pago</Text>. Solo se acepta
              tarjeta de crédito porque la garantía se retiene en el cupo.
            </Text>
          </View>
        )}

        {!pagoSimulado && (
          <View style={styles.secure}>
            <Icon name="shield" size={16} color={colors.accent700} />
            <Text style={styles.secureText}>
              No guardamos los datos de tu tarjeta — los administra Mercado Pago.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button
          label={
            !esReservaReal
              ? "Continuar"
              : pagoSimulado
                // BLOQUE TEMPORAL: en modo prueba el botón no miente sobre lo
                // que hace — confirma la reserva sin cobrar.
                ? "Simular pago exitoso y confirmar reserva"
                : `Pagar con Mercado Pago · $${montoHold.toLocaleString("es-CL")}`
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
  // BLOQUE TEMPORAL — estilos del aviso de modo prueba.
  pruebaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  pruebaBadge: { marginTop: 1 },
  pruebaTitulo: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 2 },
  pruebaTexto: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pasarelaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.primary100,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
  },
  pasarelaBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pasarelaText: { flex: 1, fontSize: 13, color: colors.primary, lineHeight: 19 },
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
