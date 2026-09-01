import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { Button } from "./ui";

/**
 * Selector de fecha y hora sobre un calendario, para reemplazar los campos
 * de texto libre ("AAAA-MM-DD" / "HH:MM") donde el usuario tenía que tipear
 * el formato exacto y podía dejar una fecha imposible.
 *
 * Es JS puro sobre react-native: no agrega ninguna dependencia nativa, así
 * que se comporta igual en Expo Go, en el build nativo y en web (el mismo
 * criterio que el calendario del dueño en CarCalendarScreen).
 */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const dosDigitos = (n) => String(n).padStart(2, "0");

export const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const mismoDia = (a, b) => !!a && !!b && inicioDelDia(a).getTime() === inicioDelDia(b).getTime();

const conHora = (dia, horas, minutos) =>
  new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), horas, minutos, 0, 0);

export function formatearHora(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  return `${dosDigitos(date.getHours())}:${dosDigitos(date.getMinutes())}`;
}

export function formatearFecha(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  return date.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });
}

export function formatearFechaHora(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  return `${formatearFecha(date)} · ${formatearHora(date)}`;
}

/**
 * ISO local (sin zona horaria): el backend guarda datetime naive, así que se
 * envía la hora tal cual la eligió el usuario. Convertir con toISOString()
 * correría la reserva varias horas según el huso.
 */
export function aISOLocal(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  return (
    `${date.getFullYear()}-${dosDigitos(date.getMonth() + 1)}-${dosDigitos(date.getDate())}` +
    `T${dosDigitos(date.getHours())}:${dosDigitos(date.getMinutes())}:00`
  );
}

/**
 * Campo tocable que abre el calendario. `value`/`onChange` trabajan con
 * objetos Date; el consumidor no parsea strings.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  minuteStep = 30,
  helper,
  disabled = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const valido = value instanceof Date && !isNaN(value);

  return (
    <View style={{ flex: 1, gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={() => !disabled && setAbierto(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label || "Fecha"}: ${valido ? formatearFechaHora(value) : "sin elegir"}`}
      >
        <View style={styles.fieldRow}>
          <Icon name="calendar" size={16} color={colors.primary} />
          <Text style={[styles.fieldText, !valido && styles.fieldPlaceholder]} numberOfLines={1}>
            {valido ? formatearFecha(value) : "Elegir fecha"}
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <Icon name="history" size={16} color={colors.primary} />
          <Text style={[styles.fieldText, !valido && styles.fieldPlaceholder]}>
            {valido ? formatearHora(value) : "--:--"}
          </Text>
          <Icon name="chevron-down" size={14} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <DateTimePickerModal
        visible={abierto}
        title={label}
        value={valido ? value : new Date()}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        minuteStep={minuteStep}
        onCancel={() => setAbierto(false)}
        onConfirm={(fecha) => {
          setAbierto(false);
          onChange?.(fecha);
        }}
      />
    </View>
  );
}

/**
 * Calendario del mes + grilla de horas. La selección se confirma con el
 * botón: mientras se navega no se toca el valor del formulario, así no
 * quedan estados intermedios inválidos.
 */
export function DateTimePickerModal({
  visible,
  title,
  value,
  minimumDate,
  maximumDate,
  minuteStep = 30,
  onConfirm,
  onCancel,
}) {
  const base = value instanceof Date && !isNaN(value) ? value : new Date();
  const [seleccion, setSeleccion] = useState(base);
  const [mesVisible, setMesVisible] = useState(inicioDelDia(base));
  // Al reabrir el modal se vuelve a partir del valor actual del campo.
  const [ultimoBase, setUltimoBase] = useState(base.getTime());
  if (visible && base.getTime() !== ultimoBase) {
    setUltimoBase(base.getTime());
    setSeleccion(base);
    setMesVisible(inicioDelDia(base));
  }

  const minDia = minimumDate ? inicioDelDia(minimumDate) : null;
  const maxDia = maximumDate ? inicioDelDia(maximumDate) : null;

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  // getDay() parte en domingo; la grilla parte en lunes como el resto de la app.
  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;

  const horaHabilitada = (fecha) => {
    if (minimumDate && fecha < minimumDate) return false;
    if (maximumDate && fecha > maximumDate) return false;
    return true;
  };

  const horas = useMemo(() => {
    const paso = Math.max(5, Math.min(minuteStep, 60));
    const out = [];
    for (let m = 0; m < 24 * 60; m += paso) {
      out.push({ h: Math.floor(m / 60), m: m % 60 });
    }
    return out;
  }, [minuteStep]);

  const diaHabilitado = (dia) => {
    const d = new Date(anio, mes, dia);
    if (minDia && d < minDia) return false;
    if (maxDia && d > maxDia) return false;
    return true;
  };

  const elegirDia = (dia) => {
    const candidata = conHora(new Date(anio, mes, dia), seleccion.getHours(), seleccion.getMinutes());
    if (horaHabilitada(candidata)) {
      setSeleccion(candidata);
      return;
    }
    // La hora que venía elegida no existe en ese día (p. ej. hoy, más
    // temprano que ahora): se toma el primer horario válido del día.
    const primera = horas
      .map(({ h, m }) => conHora(new Date(anio, mes, dia), h, m))
      .find(horaHabilitada);
    setSeleccion(primera || candidata);
  };

  const puedeMesAnterior = !minDia || new Date(anio, mes, 1) > minDia;
  const puedeMesSiguiente = !maxDia || new Date(anio, mes + 1, 1) <= maxDia;
  const seleccionValida = horaHabilitada(seleccion);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title || "Elige fecha y hora"}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={theme.control.hitSlop} accessibilityLabel="Cerrar">
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity
              onPress={() => puedeMesAnterior && setMesVisible(new Date(anio, mes - 1, 1))}
              disabled={!puedeMesAnterior}
              hitSlop={theme.control.hitSlop}
              accessibilityLabel="Mes anterior"
            >
              <Icon
                name="chevron-left"
                size={18}
                color={puedeMesAnterior ? colors.primary : colors.textDisabled}
              />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MESES[mes]} {anio}</Text>
            <TouchableOpacity
              onPress={() => puedeMesSiguiente && setMesVisible(new Date(anio, mes + 1, 1))}
              disabled={!puedeMesSiguiente}
              hitSlop={theme.control.hitSlop}
              accessibilityLabel="Mes siguiente"
            >
              <Icon
                name="chevron-right"
                size={18}
                color={puedeMesSiguiente ? colors.primary : colors.textDisabled}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {DIAS_SEMANA.map((d) => (
              <Text key={d} style={styles.weekday}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: offset }, (_, i) => (
              <View key={`e${i}`} style={styles.cellEmpty} />
            ))}
            {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((dia) => {
              const habilitado = diaHabilitado(dia);
              const elegido = mismoDia(seleccion, new Date(anio, mes, dia));
              const esHoy = mismoDia(new Date(), new Date(anio, mes, dia));
              return (
                <TouchableOpacity
                  key={dia}
                  style={[styles.cell, elegido && styles.cellSelected]}
                  onPress={() => elegirDia(dia)}
                  disabled={!habilitado}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !habilitado, selected: elegido }}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      !habilitado && styles.dayDisabled,
                      elegido && styles.daySelected,
                      esHoy && !elegido && styles.dayToday,
                    ]}
                  >
                    {String(dia)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.timeLabel}>Hora</Text>
          <ScrollView style={styles.timeBox} contentContainerStyle={styles.timeGrid}>
            {horas.map(({ h, m }) => {
              const fecha = conHora(seleccion, h, m);
              const habilitada = horaHabilitada(fecha);
              const elegida = seleccion.getHours() === h && seleccion.getMinutes() === m;
              return (
                <TouchableOpacity
                  key={`${h}-${m}`}
                  style={[styles.timeChip, elegida && styles.timeChipSelected]}
                  onPress={() => setSeleccion(fecha)}
                  disabled={!habilitada}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !habilitada, selected: elegida }}
                >
                  <Text
                    style={[
                      styles.timeText,
                      !habilitada && styles.dayDisabled,
                      elegida && styles.timeTextSelected,
                    ]}
                  >
                    {dosDigitos(h)}:{dosDigitos(m)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sheetFooter}>
            <Text style={styles.resumen} numberOfLines={1}>{formatearFechaHora(seleccion)}</Text>
            <Button
              label="Confirmar"
              size="sm"
              fullWidth={false}
              disabled={!seleccionValida}
              onPress={() => onConfirm?.(seleccion)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: { ...theme.typography.label, color: colors.textMuted },
  field: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  fieldDisabled: { backgroundColor: colors.disabledBg, borderColor: colors.border },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  fieldPlaceholder: { color: colors.textPlaceholder, fontWeight: "400" },
  helper: { fontSize: 12, color: colors.textMuted },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(6,30,31,0.55)",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow.lg,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { ...theme.typography.heading, color: colors.text },

  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
  },
  monthLabel: { fontSize: 15, fontWeight: "700", color: colors.text },

  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.textMuted, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cellEmpty: { width: `${100 / 7}%`, height: 40 },
  cell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  cellSelected: { backgroundColor: colors.primary },
  dayNum: { fontSize: 14, fontWeight: "600", color: colors.text },
  daySelected: { color: colors.textWhite, fontWeight: "800" },
  dayDisabled: { color: colors.textDisabled },
  dayToday: { color: colors.accentDark, textDecorationLine: "underline" },

  timeLabel: { ...theme.typography.label, color: colors.textMuted, marginTop: theme.spacing.sm },
  timeBox: { maxHeight: 132 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, paddingVertical: 2 },
  timeChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  timeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeText: { fontSize: 13, fontWeight: "600", color: colors.text },
  timeTextSelected: { color: colors.textWhite },

  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resumen: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textMuted },
});
