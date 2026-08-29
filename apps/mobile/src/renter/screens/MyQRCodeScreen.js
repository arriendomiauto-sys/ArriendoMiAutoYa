import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors, Icon, ApiClient } from "@rentacar/mobile-shared";

// El código lo genera GET /reservas/{id}/generar-codigo (real, único por
// reserva) y POST /entrega/validar-codigo lo valida contra ese mismo hash
// en el backend — nada de esto es simulado. Se muestra como QR escaneable
// de verdad (react-native-qrcode-svg) y también como texto debajo, para
// cuando escanear no es práctico (poca luz, cámara del dueño ocupada,
// etc.) — el dueño puede validar cualquiera de los dos.
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
      const resultado = await ApiClient.generarCodigoQR(reservation.id);
      setCodigo(resultado.codigo_qr_hash);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{esDevolucion ? "Código de devolución" : "Código de entrega"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.instructions}>
          Muéstrale este código a {auto.marca ? `quien te entrega el ${auto.marca} ${auto.modelo}` : "el dueño del vehículo"}{" "}
          para que verifique tu identidad y {esDevolucion ? "cierre el arriendo" : "comience el arriendo"}.
        </Text>

        <View style={styles.codeCard}>
          {loading && <ActivityIndicator color={colors.primary} size="large" />}

          {!loading && error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={generar}>
                <Text style={styles.retryBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && codigo && (
            <>
              <View style={styles.qrWrap}>
                <QRCode value={codigo} size={180} color={colors.primary700} backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.codeText}>{codigo}</Text>
              <Text style={styles.codeHint}>Código único de esta reserva</Text>
            </>
          )}
        </View>

        {reservation && (
          <View style={styles.detailBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vehículo</Text>
              <Text style={styles.detailVal}>{auto.marca} {auto.modelo} {auto.anio}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Patente</Text>
              <Text style={styles.detailVal}>{auto.patente || "—"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lugar acordado</Text>
              <Text style={styles.detailVal}>{reservation.lugar_entrega_acordado || "—"}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  instructions: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  codeCard: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  qrWrap: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 4,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.primary700,
    textAlign: "center",
  },
  codeHint: {
    fontSize: 12,
    color: colors.primary600 || colors.textMuted,
  },
  errorBox: {
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  detailBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  detailVal: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
});
