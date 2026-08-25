import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { colors, useApp, Icon } from "@rentacar/mobile-shared";

export function CarCalendarScreen({ onBack }) {
  const { cars } = useApp();
  const [selectedCarId, setSelectedCarId] = useState(cars[0]?.id || "auto-1");

  // Mock days of month: 1 to 31
  // Status: 'available' | 'booked' | 'blocked'
  const [daysState, setDaysState] = useState({
    16: "booked",
    17: "booked",
    18: "booked",
    22: "blocked",
    23: "blocked",
  });

  const toggleDayState = (dayNum) => {
    if (daysState[dayNum] === "booked") {
      Alert.alert("Día con Arriendo Activo", "Este día cuenta con una reserva confirmada y no puede ser bloqueado.");
      return;
    }
    setDaysState((prev) => {
      const current = prev[dayNum];
      if (!current || current === "available") {
        return { ...prev, [dayNum]: "blocked" };
      } else {
        const next = { ...prev };
        delete next[dayNum];
        return next;
      }
    });
  };

  const handleBlockWeekends = () => {
    setDaysState((prev) => ({
      ...prev,
      22: "blocked",
      23: "blocked",
      29: "blocked",
      30: "blocked",
    }));
    Alert.alert("Fines de Semana Bloqueados", "Los fines de semana restantes del mes quedaron reservados para tu uso personal.");
  };

  const handleClearBlocks = () => {
    setDaysState({
      16: "booked",
      17: "booked",
      18: "booked",
    });
    Alert.alert("Calendario Habilitado", "Todos los días libres quedaron disponibles para arriendo.");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={colors.textWhite} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>DISPONIBILIDAD DE FLOTA</Text>
        </View>
        <Text style={styles.title}>Calendario de Fechas</Text>
        <Text style={styles.subtitle}>
          Bloquea días de uso personal o mantención técnica de tus autos
        </Text>
      </View>

      {/* Selector de Vehículo */}
      <View style={styles.carPickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(cars.length > 0 ? cars : [{ id: "auto-1", marca: "Toyota", modelo: "RAV4", patente: "BBCL-10" }]).map((c) => {
            const isSelected = selectedCarId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.carChip, isSelected && styles.carChipActive]}
                onPress={() => setSelectedCarId(c.id)}
              >
                <Text style={[styles.carChipText, isSelected && styles.carChipTextActive]}>
                  {c.marca} {c.modelo} ({c.patente || "BBCL-10"})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Calendario Mensual */}
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.monthTitle}>Agosto 2026</Text>
          <Text style={styles.monthSub}>Los Ángeles, Chile</Text>
        </View>

        {/* Días de la Semana */}
        <View style={styles.weekdaysRow}>
          {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d, i) => (
            <Text key={i} style={styles.weekdayText}>
              {d}
            </Text>
          ))}
        </View>

        {/* Grilla de Días */}
        <View style={styles.daysGrid}>
          {/* Offset de días iniciales si parte en sábado */}
          {[null, null, null, null, null].map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCellEmpty} />
          ))}

          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const state = daysState[day] || "available";
            const isBooked = state === "booked";
            const isBlocked = state === "blocked";

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayCell,
                  isBooked && styles.dayCellBooked,
                  isBlocked && styles.dayCellBlocked,
                ]}
                onPress={() => toggleDayState(day)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.dayNum,
                    isBooked && styles.dayNumBooked,
                    isBlocked && styles.dayNumBlocked,
                  ]}
                >
                  {day}
                </Text>
                <View
                  style={[
                    styles.dayDot,
                    isBooked
                      ? styles.dotBooked
                      : isBlocked
                      ? styles.dotBlocked
                      : styles.dotAvailable,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Leyenda */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotAvailable]} />
            <Text style={styles.legendText}>Disponible</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBooked]} />
            <Text style={styles.legendText}>Arrendado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBlocked]} />
            <Text style={styles.legendText}>Bloqueado</Text>
          </View>
        </View>
      </View>

      {/* Acciones Rápidas de Bloqueo */}
      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Acciones Rápidas</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBlockWeekends}>
          <Text style={styles.actionBtnText}>Bloquear todos los fines de semana restantes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtnOutline} onPress={handleClearBlocks}>
          <Text style={styles.actionBtnOutlineText}>Desbloquear todos los días libres</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
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
    backgroundColor: colors.darkCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 2,
  },
  carPickerRow: {
    marginBottom: 12,
  },
  carChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.darkCard,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  carChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.primaryLight,
  },
  carChipText: {
    fontSize: 11,
    color: colors.textSilver,
    fontWeight: "700",
  },
  carChipTextActive: {
    color: colors.accent,
    fontWeight: "800",
  },
  calendarCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textWhite,
  },
  monthSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    width: 38,
    textAlign: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  dayCellEmpty: {
    width: "14.28%",
    height: 42,
  },
  dayCell: {
    width: "14.28%",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    marginVertical: 2,
  },
  dayCellBooked: {
    backgroundColor: colors.primaryLight,
  },
  dayCellBlocked: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  dayNum: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textWhite,
  },
  dayNumBooked: {
    color: colors.info,
    fontWeight: "800",
  },
  dayNumBlocked: {
    color: colors.danger,
    textDecorationLine: "line-through",
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  dotAvailable: {
    backgroundColor: colors.accent,
  },
  dotBooked: {
    backgroundColor: colors.info,
  },
  dotBlocked: {
    backgroundColor: colors.danger,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: colors.textSilver,
  },
  actionsCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 8,
  },
  actionBtn: {
    backgroundColor: colors.darkCardHover,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  actionBtnText: {
    color: colors.textWhite,
    fontSize: 11,
    fontWeight: "700",
  },
  actionBtnOutline: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  actionBtnOutlineText: {
    color: colors.textSilver,
    fontSize: 11,
    fontWeight: "600",
  },
});
