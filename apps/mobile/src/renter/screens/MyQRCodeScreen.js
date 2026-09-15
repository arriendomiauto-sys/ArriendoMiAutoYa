import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { colors, theme, Button, Card, ScreenHeader, ApiClient, Icon, showAlert, msjError } from "@rentacar/mobile-shared";
import { conectarChat } from "@rentacar/mobile-shared/api/chatSocket";

// 2 minutos de validez estricta (120 segundos)
const VIGENCIA_SEGUNDOS = 120;

export function MyQRCodeScreen({ reservation, onBack }) {
  const esDevolucion = reservation?.estado === "en_curso";
  const [codigo, setCodigo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(VIGENCIA_SEGUNDOS);
  const [expirado, setExpirado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const generar = useCallback(async (isSilent = false) => {
    if (!reservation?.id) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setExpirado(false);
    setCopiado(false);
    try {
      const r = await ApiClient.generarCodigoQR(reservation.id);
      setCodigo(r.codigo_qr_hash);
      const validez = r.validez_segundos || VIGENCIA_SEGUNDOS;
      setTimeLeft(validez);
    } catch (err) {
      setError(msjError(err, "No se pudo generar el código QR."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reservation?.id]);

  useEffect(() => {
    generar(false);
  }, [generar]);

  // Escucha en vivo (nunca envía nada) la sala de la reserva mientras el
  // código está en pantalla: si el dueño confirma la identidad, se avisa
  // sin obligar al cliente a salir y volver a entrar a la app.
  useEffect(() => {
    if (!reservation?.id || loading || error || expirado) return undefined;
    const canal = conectarChat(reservation.id, {
      onEntregaConfirmada: () => {
        showAlert(
          esDevolucion ? "Devolución confirmada" : "Entrega confirmada",
          "El dueño validó tu código. Puedes volver a tu arriendo.",
          [{ text: "Ver mi arriendo", onPress: onBack }]
        );
      },
    });
    return () => canal.cerrar();
  }, [reservation?.id, loading, error, expirado]);

  // Cuenta regresiva de 2 minutos
  useEffect(() => {
    if (loading || error || expirado) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setExpirado(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, error, expirado]);

  const copiarCodigo = async () => {
    if (!codigo) return;
    try {
      await Clipboard.setStringAsync(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      showAlert("No se pudo copiar", "Selecciona el código a mano e intenta de nuevo.");
    }
  };

  const auto = reservation?.auto || reservation?.car || {};
  const minutos = Math.floor(timeLeft / 60);
  const segundos = timeLeft % 60;
  const tiempoFormateado = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  const pctRestante = Math.max(0, Math.min(100, (timeLeft / VIGENCIA_SEGUNDOS) * 100));

  // Formatear código en grupos de 4 para dictado fácil (ej: ABCD - EF12 - 3456)
  const codigoLegible = codigo ? (codigo.match(/.{1,4}/g)?.join(" - ") || codigo) : "";

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={esDevolucion ? "Código de devolución" : "Código de entrega"}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Muéstrale este código en persona a{" "}
          <Text style={{ fontWeight: "700", color: colors.text }}>
            {auto.marca ? `quien te entrega el ${auto.marca} ${auto.modelo}` : "el dueño"}
          </Text>{" "}
          para verificar tu identidad y {esDevolucion ? "cerrar el arriendo" : "comenzar el arriendo"}.
        </Text>

        {/* Tarjeta Principal del QR */}
        <View style={styles.qrCard}>
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Generando código seguro...</Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.errorBox}>
              <Icon name="alert-triangle" size={32} color={colors.danger} />
              <Text style={styles.errText}>{error}</Text>
              <Button label="Reintentar" onPress={() => generar(false)} fullWidth={false} size="sm" />
            </View>
          )}

          {/* Estado EXPIRADO (vencieron los 2 minutos) */}
          {!loading && !error && expirado && (
            <View style={styles.expiredBox}>
              <View style={styles.expiredIconWrap}>
                <Icon name="clock" size={36} color={colors.warning} />
              </View>
              <Text style={styles.expiredTitle}>Código expirado</Text>
              <Text style={styles.expiredDesc}>
                Por seguridad, el código tiene una validez de 2 minutos. Genera uno nuevo para que el dueño lo valide.
              </Text>
              <Button
                label="Generar nuevo código"
                iconLeft="refresh-cw"
                onPress={() => generar(false)}
                size="md"
              />
            </View>
          )}

          {/* Estado ACTIVO con QR y Cuenta Regresiva */}
          {!loading && !error && !expirado && codigo && (
            <>
              {/* Badge de Seguridad y Contador */}
              <View style={[styles.timerBadge, timeLeft <= 30 && styles.timerBadgeWarn]}>
                <View style={[styles.timerDot, timeLeft <= 30 ? styles.timerDotWarn : (refreshing && styles.timerDotRefreshing)]} />
                <Text style={[styles.timerText, timeLeft <= 30 && styles.timerTextWarn]}>
                  {refreshing ? "Actualizando..." : `Válido por ${tiempoFormateado}`}
                </Text>
              </View>

              {/* Barra de Tiempo Decreciente */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${pctRestante}%`,
                      backgroundColor: timeLeft <= 30 ? colors.warning : colors.primary,
                    },
                  ]}
                />
              </View>

              {/* Código QR */}
              <View style={styles.qrWrap}>
                <QRCode
                  value={codigo}
                  size={195}
                  color={colors.primary700}
                  backgroundColor="#FFFFFF"
                />
              </View>

              {/* Código Escrito para Dictar */}
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Código para ingresar a mano:</Text>
                <TouchableOpacity
                  style={styles.codeTouch}
                  onPress={copiarCodigo}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar código escrito"
                >
                  <Text testID="text-codigo-qr" style={styles.codeText}>{codigoLegible}</Text>
                  <View style={styles.copyRow}>
                    <Icon name={copiado ? "check" : "copy"} size={13} color={copiado ? colors.accentDark : colors.primary} />
                    <Text style={[styles.copyText, copiado && { color: colors.accentDark, fontWeight: "700" }]}>
                      {copiado ? "Copiado" : "Toca para copiar"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={styles.codeHint}>
                Validez estricta de 2 minutos • Cambia dinámicamente
              </Text>
            </>
          )}
        </View>

        {/* Indicador de espera en vivo */}
        {!loading && !error && !expirado && codigo && (
          <View style={styles.waitRow}>
            <View style={styles.waitDot} />
            <Text style={styles.waitText}>
              {esDevolucion
                ? "Esperando que el dueño escanee o escriba el código para cerrar..."
                : "Esperando que el dueño escanee o escriba el código para comenzar..."}
            </Text>
          </View>
        )}

        {/* Ficha Resumen del Vehículo y Entrega */}
        {reservation && (
          <Card padded style={{ gap: theme.spacing.md }}>
            <View style={styles.cardHeader}>
              <Icon name="car" size={18} color={colors.primary} />
              <Text style={styles.cardHeaderTitle}>Detalles de la reserva</Text>
            </View>
            <Row label="Vehículo" value={[auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ")} />
            <Row label="Patente" value={auto.patente || "—"} isBadge />
            <Row label="Lugar acordado" value={reservation.lugar_entrega_acordado || "—"} />
            <Row label="Estado" value={esDevolucion ? "Devolución" : "Entrega inicial"} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, isBadge }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {isBadge ? (
        <View style={styles.badgePatente}>
          <Text style={styles.badgePatenteText}>{value}</Text>
        </View>
      ) : (
        <Text style={styles.rowValue} numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg, paddingBottom: 40 },
  intro: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: "center" },

  qrCard: {
    minHeight: 260,
    borderRadius: theme.radius.card || 16,
    borderWidth: 1.5,
    borderColor: colors.primary200,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  loadingBox: { alignItems: "center", gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14, color: colors.textMuted, fontWeight: "500" },

  errorBox: { alignItems: "center", gap: 12, paddingVertical: 20 },
  errText: { fontSize: 14, color: colors.danger, textAlign: "center", maxWidth: 260 },

  expiredBox: { alignItems: "center", gap: 12, paddingVertical: 20, width: "100%" },
  expiredIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.warning100 || "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  expiredTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  expiredDesc: { fontSize: 13.5, color: colors.textMuted, textAlign: "center", lineHeight: 19, paddingHorizontal: 16, marginBottom: 8 },

  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary100,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill || 20,
    borderWidth: 1,
    borderColor: colors.primary200,
    gap: 7,
  },
  timerBadgeWarn: {
    backgroundColor: colors.warning100 || "#FEF3C7",
    borderColor: colors.warning || "#F59E0B",
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  timerDotWarn: {
    backgroundColor: colors.danger || "#EF4444",
  },
  timerDotRefreshing: {
    backgroundColor: colors.warning || "#F59E0B",
  },
  timerText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary700,
  },
  timerTextWarn: {
    color: colors.danger || "#B91C1C",
  },

  progressBarTrack: {
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceSecondary || "#E2E8F0",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },

  qrWrap: {
    padding: theme.spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.field || 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  codeContainer: {
    width: "100%",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary || "#F8FAFC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.field || 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  codeLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "500" },
  codeTouch: { alignItems: "center", gap: 4 },
  codeText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.primary800 || colors.primary,
    textAlign: "center",
    fontFamily: "monospace",
  },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  copyText: { fontSize: 11.5, color: colors.primary, fontWeight: "500" },

  codeHint: { fontSize: 11.5, color: colors.textMuted, textAlign: "center" },

  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: theme.spacing.md,
  },
  waitDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  waitText: { fontSize: 12.5, color: colors.textMuted, textAlign: "center", flexShrink: 1 },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  cardHeaderTitle: { fontSize: 14, fontWeight: "700", color: colors.text },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: "600", flexShrink: 1, textAlign: "right" },

  badgePatente: {
    backgroundColor: colors.surfaceSecondary || "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePatenteText: { fontSize: 13, fontWeight: "800", color: colors.text, letterSpacing: 1 },
});
