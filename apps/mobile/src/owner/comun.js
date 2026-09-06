import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

/**
 * Piezas compartidas de las pantallas del dueño. Base clara idéntica a la del
 * arrendatario (fondo crema, tarjetas blancas, bordes `colors.border`).
 *
 * Lo que distingue al dueño es un **acento oscuro estilo premium** reservado
 * para las piezas hero: la franja de resumen, el saldo, el botón + del
 * navbar. Es un teal casi negro (`colors.primary900` #061E1F) con hairline
 * menta y sombra alta — el arrendatario nunca lo usa.
 */

// Superficie premium del dueño y su detalle de acento.
export const OWNER_PREMIUM_BG = colors.primary900;
export const OWNER_PREMIUM_LINE = "rgba(47, 191, 155, 0.22)"; // menta a baja opacidad

const MAX_GLOBO = 9;

/** Botón de "Mensajes" para el header, con el globo real de no leídos. */
export function BotonMensajes({ noLeidos = 0, onPress }) {
  const texto = noLeidos > MAX_GLOBO ? `${MAX_GLOBO}+` : String(noLeidos);
  return (
    <TouchableOpacity
      style={oc.msgBtn}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={noLeidos > 0 ? `Mensajes, ${noLeidos} sin leer` : "Mensajes"}
    >
      <Icon name="chat" size={20} color={colors.primary} />
      {noLeidos > 0 ? (
        <View style={oc.msgGlobo}>
          <Text style={oc.msgGloboTexto} allowFontScaling={false}>
            {texto}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Cabecera estándar de una pantalla del dueño: título grande, bajada
 * opcional y (opcional) el botón de Mensajes con su globo. `right` mete un
 * control extra a la izquierda del de mensajes.
 */
export function CabeceraOwner({ titulo, subtitulo, noLeidos, onMensajes, onBack, right }) {
  return (
    <View style={oc.header}>
      {onBack ? (
        <TouchableOpacity
          style={oc.backBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon name="arrow-left" size={20} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={oc.title}>{titulo}</Text>
        {subtitulo ? <Text style={oc.subtitle}>{subtitulo}</Text> : null}
      </View>
      {right}
      {onMensajes ? <BotonMensajes noLeidos={noLeidos || 0} onPress={onMensajes} /> : null}
    </View>
  );
}

/** Franja de resumen — el bloque hero premium (teal casi negro) del dueño. */
export function FranjaResumen({ items }) {
  return (
    <View style={oc.franja}>
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 ? <View style={oc.franjaDiv} /> : null}
          <View style={oc.franjaItem}>
            <Text style={oc.franjaValor}>{it.value}</Text>
            <Text style={oc.franjaLabel}>{it.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

export const oc = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  listContent: { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.lg },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  msgBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  msgGlobo: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  msgGloboTexto: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },

  // Tarjeta blanca estándar.
  card: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...theme.shadow.sm,
  },
  cardPadded: { padding: theme.spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },

  // Sección pequeña en color de marca (caja de tarifa, detalle, etc.).
  seccionMarca: {
    backgroundColor: colors.primary100,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  seccionSuave: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },

  // Franja de resumen — hero premium: teal casi negro + hairline menta + sombra alta.
  franja: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: OWNER_PREMIUM_BG,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: OWNER_PREMIUM_LINE,
    paddingVertical: theme.spacing.lg,
    ...theme.shadow.lg,
  },
  franjaItem: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 6 },
  franjaValor: { ...theme.typography.price, color: "#FFFFFF", letterSpacing: -0.2 },
  franjaLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.56)",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  franjaDiv: { width: 1, backgroundColor: OWNER_PREMIUM_LINE, marginVertical: 4 },

  // Píldora de estado (disponible / pausado / ...).
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
});
