import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, theme, useApp, Chip, Icon, ScreenHeader, ApiClient, showAlert } from "@rentacar/mobile-shared";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const mismoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function CarCalendarScreen({ car, onBack }) {
  const { cars } = useApp();
  const [selectedCarId, setSelectedCarId] = useState(car?.id || cars[0]?.id || null);
  const [reservas, setReservas] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [loading, setLoading] = useState(true);

  const hoy = new Date();
  // 0 = mes actual, 1 = el siguiente, etc. No se navega hacia atrás: no
  // tiene sentido bloquear un día que ya pasó.
  const [mesOffset, setMesOffset] = useState(0);
  const fechaMostrada = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const anio = fechaMostrada.getFullYear();
  const mes = fechaMostrada.getMonth();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const primerDia = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const enMesActual = mesOffset === 0;
  const irMesAnterior = () => setMesOffset((o) => Math.max(0, o - 1));
  const irMesSiguiente = () => setMesOffset((o) => o + 1);

  const cargar = useCallback(async () => {
    if (!selectedCarId) return;
    setLoading(true);
    try {
      const [todas, bloq] = await Promise.all([
        ApiClient.getReservas("dueno"),
        ApiClient.getBloqueosCalendario(selectedCarId),
      ]);
      setReservas((todas || []).filter((r) => r.auto_id === selectedCarId));
      setBloqueos(bloq || []);
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
      const ini = new Date(r.fecha_inicio);
      const fin = new Date(r.fecha_fin);
      return (
        fecha >= new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()) &&
        fecha < new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1)
      );
    });
    if (reservado) return "booked";
    const bloqueo = bloqueos.find((b) => mismoDia(new Date(b.fecha), fecha));
    if (bloqueo) return { state: "blocked", bloqueo };
    return "available";
  };

  const toggleDay = async (day) => {
    const estado = estadoDelDia(day);
    if (estado === "booked") {
      showAlert("Día con arriendo activo", "Este día tiene una reserva confirmada y no se puede bloquear.");
      return;
    }
    const fecha = new Date(anio, mes, day);
    if (typeof estado === "object" && estado.state === "blocked") {
      try {
        await ApiClient.eliminarBloqueoCalendario(estado.bloqueo.id);
        setBloqueos((p) => p.filter((b) => b.id !== estado.bloqueo.id));
      } catch (err) {
        showAlert("No se pudo desbloquear", err.message);
      }
      return;
    }
    try {
      const nuevo = await ApiClient.crearBloqueoCalendario(selectedCarId, fecha.toISOString(), "Uso personal");
      setBloqueos((p) => [...p, nuevo]);
    } catch (err) {
      showAlert("No se pudo bloquear el día", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        tone="dark"
        title="Calendario"
        subtitle="Bloquea días de uso personal"
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carChips}>
          {cars.map((c) => (
            <Chip
              key={c.id}
              tone="dark"
              label={`${c.marca} ${c.modelo}`}
              selected={selectedCarId === c.id}
              onPress={() => setSelectedCarId(c.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.calCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={irMesAnterior}
              disabled={enMesActual}
              hitSlop={theme.control.hitSlop}
              style={[styles.monthNavBtn, enMesActual && styles.monthNavBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
              accessibilityState={{ disabled: enMesActual }}
            >
              <Icon name="chevron-left" size={18} color={enMesActual ? colors.darkTextMuted : colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.month}>{MESES[mes]} {anio}</Text>
            <TouchableOpacity
              onPress={irMesSiguiente}
              hitSlop={theme.control.hitSlop}
              style={styles.monthNavBtn}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Icon name="chevron-right" size={18} color={colors.textWhite} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
          ) : (
            <>
              <View style={styles.weekRow}>
                {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
                  <Text key={d} style={styles.weekday}>{d}</Text>
                ))}
              </View>
              <View style={styles.grid}>
                {Array.from({ length: primerDia }, (_, i) => (
                  <View key={`e${i}`} style={styles.cellEmpty} />
                ))}
                {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((day) => {
                  const estado = estadoDelDia(day);
                  const booked = estado === "booked";
                  const blocked = typeof estado === "object";
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.cell, booked && styles.cellBooked, blocked && styles.cellBlocked]}
                      onPress={() => toggleDay(day)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          booked && { color: colors.primary200, fontWeight: "800" },
                          blocked && { color: "#F98080", textDecorationLine: "line-through" },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.legend}>
                {[
                  { c: colors.accent, l: "Disponible" },
                  { c: colors.primary200, l: "Arrendado" },
                  { c: "#F98080", l: "Bloqueado" },
                ].map((it) => (
                  <View key={it.l} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: it.c }]} />
                    <Text style={styles.legendText}>{it.l}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  carChips: { gap: theme.spacing.sm, paddingRight: theme.spacing.screen },
  calCard: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkCardSubtle,
  },
  monthNavBtnDisabled: { opacity: 0.4 },
  month: { fontSize: 16, fontWeight: "700", color: colors.textWhite },
  weekRow: { flexDirection: "row", marginBottom: theme.spacing.sm },
  weekday: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.darkTextMuted, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cellEmpty: { width: `${100 / 7}%`, height: 44 },
  cell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  cellBooked: { backgroundColor: colors.primary600 },
  cellBlocked: { backgroundColor: "rgba(220,38,38,0.14)" },
  dayNum: { fontSize: 13, fontWeight: "600", color: colors.textWhite },
  legend: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorder,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textSilver },
});
