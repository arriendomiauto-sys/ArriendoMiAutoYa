import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { colors, useApp, Icon, ApiClient } from "@rentacar/mobile-shared";

export function ExtendRentalScreen({ onBack, onComplete }) {
  const { activeReservation, setActiveReservation } = useApp();
  const [extraDays, setExtraDays] = useState(1);
  const [loading, setLoading] = useState(false);

  const reservation = activeReservation || {};
  const auto = reservation.auto || {};
  const tarifaDia = auto.tarifa_dia || 0;
  const montoAdicional = tarifaDia * extraDays;

  const currentEndDate = new Date(reservation.fecha_fin || Date.now() + 2 * 86400000);
  const newEndDate = new Date(currentEndDate.getTime() + extraDays * 86400000);

  const handleRequestExtension = async () => {
    if (!reservation.id) return;
    setLoading(true);
    try {
      const actualizada = await ApiClient.extenderReserva(reservation.id, extraDays);
      setActiveReservation({ ...actualizada, auto: reservation.auto });
      Alert.alert(
        "Arriendo Extendido",
        `Tu arriendo ahora termina el ${new Date(actualizada.fecha_fin).toLocaleDateString("es-CL")}. Se retuvo un hold adicional de $${montoAdicional.toLocaleString("es-CL")} CLP.`,
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    } catch (err) {
      Alert.alert("No se pudo extender el arriendo", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={colors.textDark} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>MODIFICAR VIAJE</Text>
        </View>
        <Text style={styles.title}>Extender Arriendo</Text>
        <Text style={styles.subtitle}>
          Añade días adicionales a tu arriendo activo en Los Ángeles
        </Text>
      </View>

      {/* Resumen del Arriendo Actual */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vehículo en Uso</Text>
        <View style={styles.carRow}>
          <View>
            <Text style={styles.carName}>
              {auto.marca} {auto.modelo}
            </Text>
            <Text style={styles.carPatente}>Patente: {auto.patente || "—"}</Text>
          </View>
          <View style={styles.rateBadge}>
            <Text style={styles.rateText}>${tarifaDia.toLocaleString("es-CL")} CLP / día</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Devolución programada actual:</Text>
          <Text style={styles.dateVal}>
            {currentEndDate.toLocaleDateString("es-CL")} a las 18:00 hrs
          </Text>
        </View>
      </View>

      {/* Selector de Días Adicionales */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Selecciona Tiempo Adicional</Text>

        <View style={styles.daysPicker}>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setExtraDays(Math.max(1, extraDays - 1))}
          >
            <Text style={styles.pickerBtnText}>-</Text>
          </TouchableOpacity>
          <View style={styles.pickerDisplay}>
            <Text style={styles.pickerNum}>+{extraDays} {extraDays === 1 ? "Día" : "Días"}</Text>
            <Text style={styles.pickerSub}>
              Nueva fecha: {newEndDate.toLocaleDateString("es-CL")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setExtraDays(extraDays + 1)}
          >
            <Text style={styles.pickerBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Desglose Económico */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Desglose del Monto Adicional</Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>
            Tarifa adicional ({extraDays} días x ${tarifaDia.toLocaleString("es-CL")})
          </Text>
          <Text style={styles.priceVal}>${montoAdicional.toLocaleString("es-CL")} CLP</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Seguro Full Cobertura (15 UF)</Text>
          <Text style={[styles.priceVal, { color: colors.success }]}>Continuidad Incluida</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          <Text style={styles.totalLabel}>Hold Adicional a Pre-Autorizar</Text>
          <Text style={styles.totalVal}>${montoAdicional.toLocaleString("es-CL")} CLP</Text>
        </View>

        <Text style={styles.disclaimer}>
          * El monto adicional se retiene de inmediato como hold, igual que en tu reserva original.
        </Text>
      </View>

      {/* Botón Solicitar */}
      <TouchableOpacity
        style={[styles.submitBtn, (loading || !reservation.id) && styles.btnDisabled]}
        onPress={handleRequestExtension}
        disabled={loading || !reservation.id}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.textWhite} />
        ) : (
          <Text style={styles.submitBtnText}>
            Solicitar Extensión (+${montoAdicional.toLocaleString("es-CL")} CLP) →
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textDark,
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: colors.primaryMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.lightCard,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 8,
  },
  carRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textDark,
  },
  carPatente: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  rateBadge: {
    backgroundColor: colors.primaryMuted,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  rateText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },
  dateRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightCardBorder,
  },
  dateLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  dateVal: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDark,
    marginTop: 1,
  },
  daysPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
    overflow: "hidden",
  },
  pickerBtn: {
    width: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lightCard,
  },
  pickerBtnText: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.primary,
  },
  pickerDisplay: {
    flex: 1,
    alignItems: "center",
  },
  pickerNum: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textDark,
  },
  pickerSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  priceVal: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightCardBorder,
    marginVertical: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textDark,
  },
  totalVal: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.primary,
  },
  disclaimer: {
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 13,
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 12,
  },
});
