import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, useApp, Chip, Icon, ApiClient, showAlert, msjError } from "@rentacar/mobile-shared";
import { CabeceraOwner } from "../comun";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const claveDia = (y, m, d) => `${y}-${m}-${d}`;

// Cada cuánto se vuelven a pedir las reservas mientras el calendario está
// abierto: si un arrendatario reserva justo ahora, el dueño lo ve sin salir.
const REFRESCO_RESERVAS_MS = 30000;

const reservaOcupaAuto = (r) => {
  // "pendiente" = pagada y esperando al dueño: el auto ya está tomado en esas fechas.
  if (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "en_curso") return true;
  if (r.estado === "pendiente_pago") {
    return !r.expira_en || new Date(r.expira_en).getTime() > Date.now();
  }
  return false;
};

export function CarCalendarScreen({ car, onBack }) {
  const insets = useSafeAreaInsets();
  const { cars } = useApp();
  const [selectedCarId, setSelectedCarId] = useState(car?.id || cars[0]?.id || null);
  const [reservas, setReservas] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [loading, setLoading] = useState(true);

  const hoy = new Date();
  const [mesOffset, setMesOffset] = useState(0);
  const fechaMostrada = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const anio = fechaMostrada.getFullYear();
  const mes = fechaMostrada.getMonth();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const primerDia = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const enMesActual = mesOffset === 0;
  const irMesAnterior = () => setMesOffset((o) => Math.max(0, o - 1));
  const irMesSiguiente = () => setMesOffset((o) => o + 1);

  useEffect(() => {
    let vivo = true;
    const cargarReservas = () =>
      ApiClient.getReservas("dueno")
        .then((todas) => vivo && setReservas(Array.isArray(todas) ? todas : []))
        .catch(() => {});
    cargarReservas();
    const intervalo = setInterval(cargarReservas, REFRESCO_RESERVAS_MS);
    // Al volver de segundo plano el intervalo pudo quedar dormido: se refresca ya.
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") cargarReservas();
    });
    return () => {
      vivo = false;
      clearInterval(intervalo);
      suscripcion?.remove?.();
    };
  }, []);

  const cargarBloqueos = useCallback(async () => {
    if (!selectedCarId) return;
    setLoading(true);
    try {
      const bloq = await ApiClient.getBloqueosCalendario(selectedCarId);
      setBloqueos(Array.isArray(bloq) ? bloq : []);
    } catch (err) {
      showAlert("No se pudo cargar el calendario", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setLoading(false);
    }
  }, [selectedCarId]);

  useEffect(() => {
    cargarBloqueos();
  }, [cargarBloqueos]);

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

  const toggleDay = (day) => {
    const estado = estadoDelDia(day);
    if (estado === "booked") {
      showAlert("Día con reserva", "Este día tiene una reserva de un arrendatario y no se puede bloquear.");
      return;
    }
    const fecha = new Date(anio, mes, day);

    if (typeof estado === "object" && estado.state === "blocked") {
      const bloqueo = estado.bloqueo;
      if (String(bloqueo.id).startsWith("tmp-")) return;
      setBloqueos((p) => p.filter((b) => b.id !== bloqueo.id));
      ApiClient.eliminarBloqueoCalendario(bloqueo.id).catch((err) => {
        setBloqueos((p) => [...p, bloqueo]);
        showAlert("No se pudo desbloquear", msjError(err, "Intenta de nuevo en unos segundos."));
      });
      return;
    }

    const tempId = `tmp-${fecha.getTime()}`;
    const optimista = { id: tempId, fecha: fecha.toISOString(), motivo: "Uso personal" };
    setBloqueos((p) => [...p, optimista]);
    ApiClient.crearBloqueoCalendario(selectedCarId, fecha.toISOString(), "Uso personal")
      .then((nuevo) => {
        setBloqueos((p) => p.map((b) => (b.id === tempId ? nuevo || optimista : b)));
      })
      .catch((err) => {
        setBloqueos((p) => p.filter((b) => b.id !== tempId));
        showAlert("No se pudo bloquear el día", msjError(err, "Intenta de nuevo en unos segundos."));
      });
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <CabeceraOwner titulo="Calendario" subtitulo="Bloquea días de uso personal" onBack={onBack} />

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }} className="px-4 gap-4" showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {cars.map((c) => (
            <Chip
              key={c.id}
              label={`${c.marca} ${c.modelo}`}
              selected={selectedCarId === c.id}
              onPress={() => setSelectedCarId(c.id)}
            />
          ))}
        </ScrollView>

        <View className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              onPress={irMesAnterior}
              disabled={enMesActual}
              hitSlop={theme.control.hitSlop}
              className={`w-8 h-8 rounded-full items-center justify-center bg-surface-subtle border border-gray-200 ${enMesActual ? "opacity-40" : ""}`}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
              accessibilityState={{ disabled: enMesActual }}
            >
              <Icon name="chevron-left" size={18} color={enMesActual ? colors.textPlaceholder : colors.primary} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-textDark">{MESES[mes]} {anio}</Text>
            <TouchableOpacity
              onPress={irMesSiguiente}
              hitSlop={theme.control.hitSlop}
              className="w-8 h-8 rounded-full items-center justify-center bg-surface-subtle border border-gray-200"
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Icon name="chevron-right" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} className="my-8" />
          ) : (
            <>
              <View className="flex-row mb-2">
                {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
                  <Text key={d} className="flex-1 text-[11px] font-bold text-textMuted text-center">{d}</Text>
                ))}
              </View>
              <View className="flex-row flex-wrap">
                {Array.from({ length: primerDia }, (_, i) => (
                  <View key={`e${i}`} className="w-[14.28%] h-11" />
                ))}
                {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((day) => {
                  const estado = estadoDelDia(day);
                  const booked = estado === "booked";
                  const blocked = typeof estado === "object";
                  return (
                    <TouchableOpacity
                      key={day}
                      className={`w-[14.28%] h-11 items-center justify-center rounded-lg ${
                        booked
                          ? "bg-primary-100"
                          : blocked
                            ? "bg-red-50"
                            : "bg-accent/15"
                      }`}
                      onPress={() => toggleDay(day)}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-[13px] font-semibold ${
                          booked
                            ? "text-primary font-extrabold"
                            : blocked
                              ? "text-red-500 line-through"
                              : "text-textDark"
                        }`}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View className="flex-row justify-around mt-4 pt-3 border-t border-gray-100">
                {[
                  { c: "bg-accent", l: "Disponible" },
                  { c: "bg-primary", l: "Arrendado" },
                  { c: "bg-red-500", l: "Bloqueado" },
                ].map((it) => (
                  <View key={it.l} className="flex-row items-center gap-1.5">
                    <View className={`w-2 h-2 rounded-full ${it.c}`} />
                    <Text className="text-xs text-textMuted">{it.l}</Text>
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
