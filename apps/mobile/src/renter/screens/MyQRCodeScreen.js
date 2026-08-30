import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors, theme, Button, Card, ScreenHeader, ApiClient } from "@rentacar/mobile-shared";

// El código lo genera GET /reservas/{id}/generar-codigo (real, único por
// reserva) y POST /entrega/validar-codigo lo valida en el backend. Se
// muestra como QR escaneable y también como texto (para poca luz, etc.).
export function MyQRCodeScreen({ reservation, onBack }) {
  const esDevolucion = reservation?.estado === "en_curso";
  const [codigo, setCodigo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const generar = useCallback(async () => {
    if (!reservation?.id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await ApiClient.generarCodigoQR(reservation.id);
      setCodigo(r.codigo_qr_hash);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [reservation?.id]);

  useEffect(() => {
    generar();
  }, [generar]);

  const auto = reservation?.auto || reservation?.car || {};

  return (
    <View style={styles.container}>
      <ScreenHeader title={esDevolucion ? "Código de devolución" : "Código de entrega"} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Muéstrale este código a {auto.marca ? `quien te entrega el ${auto.marca} ${auto.modelo}` : "el dueño"} para
          verificar tu identidad y {esDevolucion ? "cerrar el arriendo" : "comenzar el arriendo"}.
        </Text>

        <View style={styles.qrCard}>
          {loading && <ActivityIndicator color={colors.primary} size="large" />}
          {!loading && error && (
            <View style={{ alignItems: "center", gap: theme.spacing.md }}>
              <Text style={styles.errText}>{error}</Text>
              <Button label="Reintentar" onPress={generar} fullWidth={false} size="sm" />
            </View>
          )}
          {!loading && !error && codigo && (
            <>
              <View style={styles.qrWrap}>
                <QRCode value={codigo} size={190} color={colors.primary700} backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.codeText}>{codigo}</Text>
              <Text style={styles.codeHint}>Código único de esta reserva</Text>
            </>
          )}
        </View>

        {reservation && (
          <Card padded style={{ gap: theme.spacing.md }}>
            <Row label="Vehículo" value={[auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ")} />
            <Row label="Patente" value={auto.patente || "—"} />
            <Row label="Lugar acordado" value={reservation.lugar_entrega_acordado || "—"} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  intro: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: "center" },
  qrCard: {
    minHeight: 180,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    borderColor: colors.primary200,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  qrWrap: { padding: theme.spacing.md, backgroundColor: "#FFFFFF", borderRadius: theme.radius.field },
  codeText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.primary700,
    textAlign: "center",
    marginTop: 4,
  },
  codeHint: { fontSize: 12, color: colors.primary },
  errText: { fontSize: 14, color: colors.danger, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: "500", flexShrink: 1, textAlign: "right" },
});
