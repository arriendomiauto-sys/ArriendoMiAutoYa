import React, { useMemo, useState } from "react";
import { View, Text, Modal, ScrollView, TouchableOpacity } from "react-native";
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
  // [{ fecha_inicio, fecha_fin }] — rangos ya reservados de este auto: sus
  // días salen deshabilitados para no elegir fechas que el backend rechaza.
  rangosBloqueados = [],
  className = "",
  style,
}) {
  const [abierto, setAbierto] = useState(false);
  const valido = value instanceof Date && !isNaN(value);

  return (
    <View className={`flex-1 gap-1.5 ${className}`} style={style}>
      {label ? <Text className="text-xs font-semibold text-textMuted uppercase tracking-wider">{label}</Text> : null}

      <TouchableOpacity
        className={`border-[1.5px] border-border rounded-xl bg-surface px-3 py-2.5 gap-2 ${disabled ? "bg-disabledBg" : ""}`}
        onPress={() => !disabled && setAbierto(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${label || "Fecha"}: ${valido ? formatearFechaHora(value) : "sin elegir"}`}
      >
        <View className="flex-row items-center gap-2">
          <Icon name="calendar" size={16} color={colors.primary} />
          <Text className={`flex-1 text-sm font-semibold ${valido ? "text-text" : "text-textPlaceholder font-normal"}`} numberOfLines={1}>
            {valido ? formatearFecha(value) : "Elegir fecha"}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon name="history" size={16} color={colors.primary} />
          <Text className={`flex-1 text-sm font-semibold ${valido ? "text-text" : "text-textPlaceholder font-normal"}`}>
            {valido ? formatearHora(value) : "--:--"}
          </Text>
          <Icon name="chevron-down" size={14} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      {helper ? <Text className="text-xs text-textMuted">{helper}</Text> : null}

      <DateTimePickerModal
        visible={abierto}
        title={label}
        value={valido ? value : new Date()}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        minuteStep={minuteStep}
        rangosBloqueados={rangosBloqueados}
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
  rangosBloqueados = [],
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

  // Rangos ocupados normalizados a [inicioMs, finMs] de día completo. Un día
  // se bloquea si cae dentro de cualquier rango (extremos incluidos: entregar
  // y retirar el mismo día es justo lo que queremos evitar).
  const rangosDia = useMemo(
    () =>
      (rangosBloqueados || [])
        .map((r) => {
          const i = inicioDelDia(new Date(r.fecha_inicio)).getTime();
          const f = inicioDelDia(new Date(r.fecha_fin)).getTime();
          return [Math.min(i, f), Math.max(i, f)];
        })
        .filter(([i, f]) => !Number.isNaN(i) && !Number.isNaN(f)),
    [rangosBloqueados]
  );
  const fechaBloqueada = (fecha) => {
    const t = inicioDelDia(fecha).getTime();
    return rangosDia.some(([i, f]) => t >= i && t <= f);
  };

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
    if (fechaBloqueada(d)) return false;
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
  const seleccionValida = horaHabilitada(seleccion) && !fechaBloqueada(seleccion);
  const hayBloqueadosEsteMes = Array.from({ length: diasEnMes }, (_, i) =>
    fechaBloqueada(new Date(anio, mes, i + 1))
  ).some(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-[#061e1f]/55 justify-center p-6">
        <View className="bg-surface rounded-2xl p-4 gap-2 shadow-lg">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">{title || "Elige fecha y hora"}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={theme.control.hitSlop} accessibilityLabel="Cerrar">
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between py-2">
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
            <Text className="text-[15px] font-bold text-text">{MESES[mes]} {anio}</Text>
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

          <View className="flex-row">
            {DIAS_SEMANA.map((d) => (
              <Text key={d} className="flex-1 text-[11px] font-bold text-textMuted text-center">{d}</Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {Array.from({ length: offset }, (_, i) => (
              <View key={`e${i}`} className="w-[14.28%] h-10" />
            ))}
            {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((dia) => {
              const bloqueado = fechaBloqueada(new Date(anio, mes, dia));
              const habilitado = diaHabilitado(dia);
              const elegido = mismoDia(seleccion, new Date(anio, mes, dia));
              const esHoy = mismoDia(new Date(), new Date(anio, mes, dia));
              return (
                <TouchableOpacity
                  key={dia}
                  className={`w-[14.28%] h-10 items-center justify-center rounded-md ${
                    elegido ? "bg-primary" : bloqueado ? "bg-red-50" : ""
                  }`}
                  onPress={() => elegirDia(dia)}
                  disabled={!habilitado}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={bloqueado ? `${dia}, no disponible` : String(dia)}
                  accessibilityState={{ disabled: !habilitado, selected: elegido }}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      elegido
                        ? "text-white font-extrabold"
                        : !habilitado
                        ? "text-gray-300"
                        : bloqueado
                        ? "text-red-700 line-through"
                        : esHoy
                        ? "text-accent-dark underline"
                        : "text-text"
                    }`}
                  >
                    {String(dia)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {hayBloqueadosEsteMes ? (
            <Text className="text-[11.5px] text-textMuted mt-1">
              Los días tachados ya están reservados para este auto.
            </Text>
          ) : null}

          <Text className="text-xs font-semibold text-textMuted uppercase tracking-wider mt-2">Hora</Text>
          <ScrollView className="max-h-[132px]" contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 2 }}>
            {horas.map(({ h, m }) => {
              const fecha = conHora(seleccion, h, m);
              const habilitada = horaHabilitada(fecha);
              const elegida = seleccion.getHours() === h && seleccion.getMinutes() === m;
              return (
                <TouchableOpacity
                  key={`${h}-${m}`}
                  className={`py-1.5 px-3 rounded-full border border-border bg-surface ${
                    elegida ? "bg-primary border-primary" : ""
                  }`}
                  onPress={() => setSeleccion(fecha)}
                  disabled={!habilitada}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !habilitada, selected: elegida }}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      elegida ? "text-white" : !habilitada ? "text-gray-300" : "text-text"
                    }`}
                  >
                    {dosDigitos(h)}:{dosDigitos(m)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View className="flex-row items-center justify-between gap-3 mt-2 pt-3 border-t border-border">
            <Text className="flex-1 text-[13px] font-semibold text-textMuted" numberOfLines={1}>{formatearFechaHora(seleccion)}</Text>
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
