import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Piezas compartidas por los dos perfiles (arrendatario y dueño). Ambos hacen
 * lo mismo — decir si la cuenta está lista para operar y ofrecer el cambio de
 * rol — solo cambia el `tone` (crema vs. teal oscuro) y algo de copy.
 */

// ───────────────────────────────────────────────────────────────────────────
// Estado de la cuenta: ¿puede reservar / publicar? Función pura, la usan los
// dos perfiles para la banda de estado y para el copy de las filas.
// ───────────────────────────────────────────────────────────────────────────
export function estadoCuenta({ estadoDocumentos, tarjetaEstado, rol = "renter" }) {
  const accion = rol === "owner" ? "publicar" : "reservar";
  const idOk = estadoDocumentos === "verificado";
  const tarjetaOk = tarjetaEstado === "validada";

  if (idOk && tarjetaOk) {
    return { tono: "ok", titulo: `Tu cuenta puede ${accion}`, detalle: "Identidad y medios de pago al día" };
  }
  if (estadoDocumentos === "requiere_revision_manual" || tarjetaEstado === "requiere_revision_manual") {
    return { tono: "espera", titulo: "Estamos revisando tu cuenta", detalle: "Te avisamos apenas quede lista." };
  }

  const detalle =
    !idOk && !tarjetaOk
      ? "Te falta verificar tu identidad y agregar una tarjeta."
      : !idOk
        ? "Te falta verificar tu identidad."
        : "Te falta agregar un medio de pago.";
  return {
    tono: "accion",
    titulo: `Falta un paso para ${accion}`,
    detalle,
    resolver: !idOk ? "identidad" : "tarjeta",
  };
}

const BANDA_COLORES = {
  ok: { bg: colors.accent100, ink: colors.accent800, icon: "check" },
  espera: { bg: colors.warningBg, ink: colors.warningText, icon: "clock" },
  accion: { bg: colors.warningBg, ink: colors.warningText, icon: "alert" },
};

/**
 * Banda de estado — el ancla del perfil. Va pegada abajo del hero (bordes
 * inferiores redondeados) o suelta como tarjeta propia (`standalone`).
 * Cuando falta un paso, toda la banda es tocable y lleva a resolverlo.
 */
export function ReadinessBand({
  estadoDocumentos,
  tarjetaEstado,
  rol = "renter",
  onResolver,
  standalone = false,
  style,
}) {
  const e = estadoCuenta({ estadoDocumentos, tarjetaEstado, rol });
  const c = BANDA_COLORES[e.tono] || BANDA_COLORES.ok;
  const accionable = e.tono === "accion" && typeof onResolver === "function";

  const contenido = (
    <>
      <View style={[styles.bandIcon, { backgroundColor: "rgba(0,0,0,0.05)" }]}>
        <Icon name={c.icon} size={13} color={c.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bandTitle, { color: c.ink }]}>{e.titulo}</Text>
        <Text style={[styles.bandDetail, { color: c.ink }]}>{e.detalle}</Text>
      </View>
      {accionable ? <Icon name="chevron-right" size={16} color={c.ink} /> : null}
    </>
  );

  const estilo = [
    styles.band,
    { backgroundColor: c.bg },
    standalone ? styles.bandStandalone : styles.bandAttached,
    style,
  ];

  return accionable ? (
    <TouchableOpacity
      style={estilo}
      onPress={() => onResolver(e.resolver)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${e.titulo}. ${e.detalle}`}
    >
      {contenido}
    </TouchableOpacity>
  ) : (
    <View style={estilo} accessibilityRole="text" accessibilityLabel={`${e.titulo}. ${e.detalle}`}>
      {contenido}
    </View>
  );
}

/**
 * Botón de cambio de rol. Central en una app que es un solo binario con dos
 * experiencias.
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
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.lg,
  },
  bandAttached: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomLeftRadius: theme.radius.card - 1,
    borderBottomRightRadius: theme.radius.card - 1,
  },
  bandStandalone: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.card,
  },
  bandIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  bandTitle: { fontSize: 13.5, fontWeight: "700" },
  bandDetail: { fontSize: 12, marginTop: 1, opacity: 0.85, lineHeight: 16 },

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
