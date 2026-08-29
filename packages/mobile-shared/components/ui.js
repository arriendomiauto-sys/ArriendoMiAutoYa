import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Primitivas de UI compartidas. Todas aceptan `tone`:
 *   - "light" (default): pantallas del arrendatario, fondo crema.
 *   - "dark": pantallas del dueño, superficies teal oscuro.
 * Así un mismo botón/tarjeta se ve bien en los dos modos sin duplicar código.
 */

function palette(tone) {
  const dark = tone === "dark";
  return {
    dark,
    surface: dark ? colors.darkCard : colors.surface,
    surfaceSubtle: dark ? colors.darkCardSubtle : colors.surfaceSubtle,
    border: dark ? colors.darkBorder : colors.border,
    text: dark ? colors.textWhite : colors.text,
    textMuted: dark ? colors.textSilver : colors.textMuted,
    accent: dark ? colors.accent : colors.primary,
  };
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
export function Button({
  label,
  onPress,
  variant = "primary", // primary | secondary | ghost | danger
  size = "md", // md | sm
  tone = "light",
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  fullWidth = true,
}) {
  const p = palette(tone);
  const isDisabled = disabled || loading;

  const bg = {
    primary: p.dark ? colors.accent : colors.primary,
    secondary: p.dark ? colors.darkCardSubtle : colors.primary100,
    ghost: "transparent",
    danger: colors.dangerBg,
  }[variant];

  const fg = {
    primary: p.dark ? colors.primary900 : "#FFFFFF",
    secondary: p.dark ? colors.textWhite : colors.primary,
    ghost: p.accent,
    danger: colors.dangerText,
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.btn,
        size === "sm" && styles.btnSm,
        { backgroundColor: bg },
        variant === "secondary" && { borderWidth: 1, borderColor: p.dark ? p.border : colors.primary200 },
        variant === "ghost" && styles.btnGhost,
        fullWidth && { alignSelf: "stretch" },
        isDisabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.btnInner}>
          {iconLeft ? <Icon name={iconLeft} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, size === "sm" && styles.btnTextSm, { color: fg }]}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={18} color={fg} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ children, tone = "light", style, padded = true, elevated = true }) {
  const p = palette(tone);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.surface, borderColor: p.border },
        padded && styles.cardPadded,
        elevated && !p.dark && theme.shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ScreenHeader — botón volver + título + acción opcional a la derecha
// ---------------------------------------------------------------------------
export function ScreenHeader({ title, subtitle, onBack, right, tone = "light", style }) {
  const p = palette(tone);
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={theme.control.hitSlop}
          style={[styles.headerBack, { borderColor: p.border, backgroundColor: p.surface }]}
        >
          <Icon name="arrow-left" size={20} color={p.accent} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBackSpacer} />
      )}
      <View style={styles.headerTitles}>
        <Text style={[styles.headerTitle, { color: p.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: p.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip — pill seleccionable
// ---------------------------------------------------------------------------
export function Chip({ label, selected, onPress, tone = "light", iconLeft }) {
  const p = palette(tone);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        { borderColor: p.border, backgroundColor: p.surface },
        selected && {
          backgroundColor: p.dark ? colors.accent : colors.primary,
          borderColor: p.dark ? colors.accent : colors.primary,
        },
      ]}
    >
      {iconLeft ? (
        <Icon
          name={iconLeft}
          size={14}
          color={selected ? (p.dark ? colors.primary900 : "#FFFFFF") : p.textMuted}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: p.text },
          selected && { color: p.dark ? colors.primary900 : "#FFFFFF", fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel — rótulo en versalitas
// ---------------------------------------------------------------------------
export function SectionLabel({ children, tone = "light", style }) {
  const p = palette(tone);
  return <Text style={[styles.sectionLabel, { color: p.textMuted }, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// EmptyState — pantalla/lista vacía con invitación a actuar
// ---------------------------------------------------------------------------
export function EmptyState({ icon = "car", title, message, action, onAction, tone = "light" }) {
  const p = palette(tone);
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: p.dark ? colors.darkCardSubtle : colors.primary100 }]}>
        <Icon name={icon} size={30} color={p.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: p.text }]}>{title}</Text>
      {message ? <Text style={[styles.emptyMessage, { color: p.textMuted }]}>{message}</Text> : null}
      {action && onAction ? (
        <Button label={action} onPress={onAction} tone={tone} size="sm" fullWidth={false} style={{ marginTop: 4 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: theme.control.height,
    borderRadius: theme.radius.field,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  btnSm: { height: theme.control.heightSm, borderRadius: theme.radius.sm },
  btnGhost: { paddingHorizontal: theme.spacing.sm },
  btnDisabled: { opacity: 0.5 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  btnText: { fontSize: 16, fontWeight: "600" },
  btnTextSm: { fontSize: 14 },

  card: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  cardPadded: { padding: theme.spacing.lg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackSpacer: { width: 0 },
  headerTitles: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13 },
  headerRight: { minWidth: 0 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  empty: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyMessage: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 300 },
});
