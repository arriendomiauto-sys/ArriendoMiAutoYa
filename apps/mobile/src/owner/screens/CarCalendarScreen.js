import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, useApp, Chip, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";
import { CabeceraOwner, oc } from "../comun";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Clave local de un día ("año-mes-día", mes 0-based) para indexar sin comparar Date.
const claveDia = (y, m, d) => `${y}-${m}-${d}`;

// Mismos estados que ocupan el auto en el backend (validators.ESTADOS_OCUPAN_AUTO):
// una `pendiente_pago` cuenta mientras no venza su TTL. Sin esto el dueño veía
// libre —y podía bloquear como "uso personal"— un día en pleno checkout de un
// arrendatario, que el backend igual va a rechazar al confirmar.
const reservaOcupaAuto = (r) => {
  if (r.estado === "confirmada" || r.estado === "en_curso") return true;
  if (r.estado === "pendiente_pago") {
    return !r.expira_en || new Date(r.expira_en).getTime() > Date.now();
  }
  return false;
};

export function CarCalendarScreen({ car, onBack }) {
  const insets = useSafeAreaInsets();
  const { cars } = useApp();
  const [selectedCarId, setSelectedCarId] = useState(car?.id || cars[0]?.id || null);
  // Las reservas del dueño no dependen del auto elegido: se piden una sola vez.
  const [reservas, setReservas] = useState([]);
  // Los bloqueos sí son por-auto y se recargan al cambiar de auto.
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

  // Reservas del dueño: una sola vez. No cambian al cambiar de auto ni de mes,
  // y traerlas de nuevo en cada toque era parte de la lentitud.
  useEffect(() => {
    let vivo = true;
    ApiClient.getReservas("dueno")
      .then((todas) => vivo && setReservas(Array.isArray(todas) ? todas : []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const cargarBloqueos = useCallback(async () => {
    if (!selectedCarId) return;
    setLoading(true);
    try {
      const bloq = await ApiClient.getBloqueosCalendario(selectedCarId);
      setBloqueos(Array.isArray(bloq) ? bloq : []);
    } catch (err) {
      showAlert("No se pudo cargar el calendario", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCarId]);

  useEffect(() => {
    cargarBloqueos();
  }, [cargarBloqueos]);

  // Índices O(1) por día. Se rearman solo cuando cambian los datos o el auto,
  // NO al navegar de mes: antes `estadoDelDia` recorría todas las reservas
  // (con 4 `new Date` cada una) por cada una de las 31 celdas, en cada render.
  const { diasReservados, diasBloqueados } = useMemo(() => {
    const reservados = new Set();
    const bloqueados = new Map();

    for (const r of reservas) {
      if (r.auto_id !== selectedCarId) continue;
      if (!reservaOcupaAuto(r)) continue;
      const ini = new Date(r.fecha_inicio);
      const fin = new Date(r.fecha_fin);
      const cursor = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
      const tope = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1);
      let guarda = 0;
      while (cursor < tope && guarda++ < 400) {
        reservados.add(claveDia(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const b of bloqueos) {
      const f = new Date(b.fecha);
      bloqueados.set(claveDia(f.getFullYear(), f.getMonth(), f.getDate()), b);
    }

    return { diasReservados: reservados, diasBloqueados: bloqueados };
  }, [reservas, bloqueos, selectedCarId]);

  const estadoDelDia = (day) => {
    const k = claveDia(anio, mes, day);
    if (diasReservados.has(k)) return "booked";
    const bloqueo = diasBloqueados.get(k);
    if (bloqueo) return { state: "blocked", bloqueo };
    return "available";
  };

  // Update optimista: el estado cambia YA y la API va en segundo plano. Con el
  // backend de Render dormido, esperar la respuesta eran 10-40s de nada.
  const toggleDay = (day) => {
    const estado = estadoDelDia(day);
    if (estado === "booked") {
      showAlert("Día con reserva", "Este día tiene una reserva de un arrendatario y no se puede bloquear.");
      return;
    }
    const fecha = new Date(anio, mes, day);

    if (typeof estado === "object" && estado.state === "blocked") {
      const bloqueo = estado.bloqueo;
      // Un bloqueo recién creado que todavía no volvió del backend: sin id
      // real no se puede borrar, se ignora el toque hasta que llegue.
      if (String(bloqueo.id).startsWith("tmp-")) return;
      setBloqueos((p) => p.filter((b) => b.id !== bloqueo.id));
      ApiClient.eliminarBloqueoCalendario(bloqueo.id).catch((err) => {
        setBloqueos((p) => [...p, bloqueo]);
        showAlert("No se pudo desbloquear", err.message);
      });
      return;
    }

    const tempId = `tmp-${fecha.getTime()}`;
    const optimista = { id: tempId, fecha: fecha.toISOString(), motivo: "Uso personal" };
    setBloqueos((p) => [...p, optimista]);
    ApiClient.crearBloqueoCalendario(selectedCarId, fecha.toISOString(), "Uso personal")
      .then((nuevo) => {
        // Se reemplaza el temporal por el real (trae el id que usa el DELETE).
        setBloqueos((p) => p.map((b) => (b.id === tempId ? nuevo || optimista : b)));
      })
      .catch((err) => {
        setBloqueos((p) => p.filter((b) => b.id !== tempId));
        showAlert("No se pudo bloquear el día", err.message);
      });
  };

  return (
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner titulo="Calendario" subtitulo="Bloquea días de uso personal" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carChips}>
          {cars.map((c) => (
            <Chip
              key={c.id}
              label={`${c.marca} ${c.modelo}`}
              selected={selectedCarId === c.id}
              onPress={() => setSelectedCarId(c.id)}
            />
          ))}
        </ScrollView>

        <View style={[oc.card, oc.cardPadded]}>
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
              <Icon name="chevron-left" size={18} color={enMesActual ? colors.textPlaceholder : colors.primary} />
            </TouchableOpacity>
            <Text style={styles.month}>{MESES[mes]} {anio}</Text>
            <TouchableOpacity
              onPress={irMesSiguiente}
              hitSlop={theme.control.hitSlop}
              style={styles.monthNavBtn}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Icon name="chevron-right" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
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
                          booked && { color: colors.primary, fontWeight: "800" },
                          blocked && { color: colors.danger, textDecorationLine: "line-through" },
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
                  { c: colors.primary, l: "Arrendado" },
                  { c: colors.danger, l: "Bloqueado" },
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
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  carChips: { gap: theme.spacing.sm, paddingRight: theme.spacing.screen },
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
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthNavBtnDisabled: { opacity: 0.4 },
  month: { fontSize: 16, fontWeight: "700", color: colors.text },
  weekRow: { flexDirection: "row", marginBottom: theme.spacing.sm },
  weekday: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.textMuted, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cellEmpty: { width: `${100 / 7}%`, height: 44 },
  cell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  cellBooked: { backgroundColor: colors.primary100 },
  cellBlocked: { backgroundColor: colors.dangerBg },
  dayNum: { fontSize: 13, fontWeight: "600", color: colors.text },
  legend: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textMuted },
});
