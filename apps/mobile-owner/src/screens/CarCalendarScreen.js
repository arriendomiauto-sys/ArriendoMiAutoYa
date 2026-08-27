import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { colors, useApp, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mismoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CarCalendarScreen({ car, onBack }) {
  const { cars } = useApp();
  const [selectedCarId, setSelectedCarId] = useState(car?.id || cars[0]?.id || null);

  const [reservas, setReservas] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [loading, setLoading] = useState(true);

  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth(); // mes actual real
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // 0 = lunes

  const cargar = useCallback(async () => {
    if (!selectedCarId) return;
    setLoading(true);
    try {
      const [todasReservas, bloqueosData] = await Promise.all([
        ApiClient.getReservas("dueno"),
        ApiClient.getBloqueosCalendario(selectedCarId),
      ]);
      setReservas((todasReservas || []).filter((r) => r.auto_id === selectedCarId));
      setBloqueos(bloqueosData || []);
    } catch (err) {
      showAlert("No se pudo cargar el calendario", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCarId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const estadoDelDia = (day) => {
    const fecha = new Date(anio, mes, day);

    const reservado = reservas.some((r) => {
      if (!["confirmada", "en_curso"].includes(r.estado)) return false;
      const inicio = new Date(r.fecha_inicio);
      const fin = new Date(r.fecha_fin);
      return fecha >= new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()) &&
        fecha < new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1);
    });
    if (reservado) return "booked";

    const bloqueo = bloqueos.find((b) => mismoDia(new Date(b.fecha), fecha));
    if (bloqueo) return { state: "blocked", bloqueo };

    return "available";
  };

  const toggleDayState = async (day) => {
    const estado = estadoDelDia(day);
    if (estado === "booked") {
      showAlert("Día con Arriendo Activo", "Este día cuenta con una reserva confirmada y no puede ser bloqueado.");
      return;
    }
    const fecha = new Date(anio, mes, day);

    if (typeof estado === "object" && estado.state === "blocked") {
      // Ya bloqueado: lo quitamos
      try {
        await ApiClient.eliminarBloqueoCalendario(estado.bloqueo.id);
        setBloqueos((prev) => prev.filter((b) => b.id !== estado.bloqueo.id));
      } catch (err) {
        showAlert("No se pudo desbloquear", err.message);
      }
      return;
    }

    try {
      const nuevo = await ApiClient.crearBloqueoCalendario(selectedCarId, fecha.toISOString(), "Uso personal");
      setBloqueos((prev) => [...prev, nuevo]);
    } catch (err) {
      showAlert("No se pudo bloquear el día", err.message);
    }
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
          Bloquea días de uso personal — los días con reserva confirmada no se pueden tocar
        </Text>
      </View>

      {/* Selector de Vehículo */}
      <View style={styles.carPickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {cars.map((c) => {
            const isSelected = selectedCarId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.carChip, isSelected && styles.carChipActive]}
                onPress={() => setSelectedCarId(c.id)}
              >
                <Text style={[styles.carChipText, isSelected && styles.carChipTextActive]}>
                  {c.marca} {c.modelo} ({c.patente || "—"})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Calendario Mensual */}
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.monthTitle}>{MESES[mes]} {anio}</Text>
          <Text style={styles.monthSub}>Los Ángeles, Chile</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
        ) : (
          <>
            <View style={styles.weekdaysRow}>
              {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d, i) => (
                <Text key={i} style={styles.weekdayText}>{d}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: primerDiaSemana }, (_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellEmpty} />
              ))}

              {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((day) => {
                const estado = estadoDelDia(day);
                const isBooked = estado === "booked";
                const isBlocked = typeof estado === "object" && estado.state === "blocked";

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
                        isBooked ? styles.dotBooked : isBlocked ? styles.dotBlocked : styles.dotAvailable,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

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
          </>
        )}
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
});
