import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Piezas compartidas por los dos perfiles (arrendatario y dueño). Ambos hacen
 * lo mismo — mostrar si la cuenta está lista para operar y ofrecer el cambio
 * de rol — solo cambia el `tone` (crema vs. teal oscuro) y algo de copy.
 */

function coloresEstado(tone, estado) {
  const dark = tone === "dark";
  const paletas = dark
    ? {
        ok: { fg: colors.accent, bg: "rgba(47,191,155,0.15)" },
        espera: { fg: colors.warningAccent, bg: "rgba(242,200,121,0.15)" },
        accion: { fg: colors.warningAccent, bg: "rgba(242,200,121,0.15)" },
      }
    : {
        ok: { fg: colors.accent800, bg: colors.accent100 },
        espera: { fg: colors.warningText, bg: colors.warningBg },
        accion: { fg: colors.warningText, bg: colors.warningBg },
      };
  return {
    text: dark ? colors.textWhite : colors.text,
    hint: dark ? colors.textSilver : colors.textMuted,
    border: dark ? colors.darkBorder : colors.border,
    ...(paletas[estado] || paletas.ok),
  };
}

function FilaEstado({ tone, estado, icon, label, hint, onPress, last }) {
  const c = coloresEstado(tone, estado);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      style={[styles.fila, !last && { borderBottomWidth: 1, borderBottomColor: c.border }]}
    >
      <View style={[styles.filaIcon, { backgroundColor: c.bg }]}>
        <Icon name={icon} size={15} color={c.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.filaLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.filaHint, { color: c.hint }]} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={c.hint} />
    </TouchableOpacity>
  );
}

/**
 * Las dos condiciones que la app exige para reservar o publicar: identidad
 * verificada y tarjeta registrada. Pensada para ir dentro del `Card` de
 * cabecera del perfil, justo debajo del nombre.
 */
export function AccountStatusCard({
  estadoDocumentos,
  tarjetaUltimos4,
  tarjetaEstado,
  rol = "renter",
  tone = "light",
  onPressIdentidad,
  onPressTarjeta,
}) {
  const accion = rol === "owner" ? "publicar tus autos" : "reservar un auto";

  const identidad =
    estadoDocumentos === "verificado"
      ? { estado: "ok", icon: "shield", label: "Identidad verificada", hint: `Tu cuenta puede ${accion}.` }
      : estadoDocumentos === "requiere_revision_manual"
        ? { estado: "espera", icon: "clock", label: "Identidad en revisión", hint: "Te avisamos apenas la aprobemos." }
        : { estado: "accion", icon: "warning", label: "Verifica tu identidad", hint: `La necesitas para ${accion}.` };

  const tarjeta = tarjetaUltimos4
    ? { estado: "ok", icon: "card", label: "Tarjeta de crédito", hint: `Terminada en ${tarjetaUltimos4}` }
    : tarjetaEstado === "requiere_revision_manual"
      ? { estado: "espera", icon: "card", label: "Tarjeta de crédito", hint: "En revisión" }
      : {
          estado: "accion",
          icon: "card",
          label: "Agrega una tarjeta",
          hint: rol === "owner" ? "Cubre deducible y cargos posteriores." : "Es la garantía de tu reserva.",
        };

  const border = tone === "dark" ? colors.darkBorder : colors.border;

  return (
    <View style={[styles.wrap, { borderTopColor: border }]}>
      <FilaEstado tone={tone} {...identidad} onPress={onPressIdentidad} />
      <FilaEstado tone={tone} {...tarjeta} onPress={onPressTarjeta} last />
    </View>
  );
}

/**
 * Botón de cambio de rol. Se conserva de la versión anterior del perfil: es
 * central en una app que es un solo binario con dos experiencias.
 */
export function ModeSwitchRow({ target, title, desc, onPress, tone = "light" }) {
  const dark = tone === "dark";
  const accent = dark ? colors.accent : colors.primary;
  return (
    <TouchableOpacity
      style={[
        styles.switch,
        dark
          ? { backgroundColor: colors.darkCard, borderColor: colors.darkBorder }
          : { backgroundColor: colors.primary100, borderColor: colors.primary200 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.switchIcon, { backgroundColor: dark ? colors.darkCardSubtle : colors.surface }]}>
        <Icon name={target === "owner" ? "car" : "key"} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.switchTitle, { color: dark ? colors.textWhite : colors.primary }]}>{title}</Text>
        <Text style={[styles.switchDesc, { color: dark ? colors.textSilver : colors.textMuted }]}>{desc}</Text>
      </View>
      <Icon name="arrow-right" size={16} color={dark ? colors.textSilver : colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 13,
    paddingHorizontal: theme.spacing.lg,
  },
  filaIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  filaLabel: { fontSize: 15, fontWeight: "600" },
  filaHint: { fontSize: 13, marginTop: 1 },

  switch: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  switchIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { fontSize: 15, fontWeight: "700" },
  switchDesc: { fontSize: 13, marginTop: 1 },
});
