import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
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
// Badge — etiqueta de estado compacta
// ---------------------------------------------------------------------------
const BADGE_TONES = {
  neutral: { bg: colors.neutralBadgeBg, fg: colors.neutralBadgeText },
  success: { bg: colors.successBg, fg: colors.successText },
  warning: { bg: colors.warningBg, fg: colors.warningText },
  danger: { bg: colors.dangerBg, fg: colors.dangerText },
  info: { bg: colors.primary100, fg: colors.primary },
};

export function Badge({ label, variant = "neutral", style }) {
  const c = BADGE_TONES[variant] || BADGE_TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
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
// StatRow — fila de métricas separadas por divisores
// ---------------------------------------------------------------------------
export function StatRow({ items, tone = "light", style }) {
  const p = palette(tone);
  return (
    <View
      style={[
        styles.statRow,
        { backgroundColor: p.surface, borderColor: p.border },
        style,
      ]}
    >
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 ? <View style={[styles.statDivider, { backgroundColor: p.border }]} /> : null}
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: p.accent }]}>{it.value}</Text>
            <Text style={[styles.statLabel, { color: p.textMuted }]}>{it.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// MenuList / MenuRow — lista de accesos con icono, opcionalmente agrupada
// ---------------------------------------------------------------------------
export function MenuList({ children, tone = "light", style }) {
  const p = palette(tone);
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      style={[styles.menuList, { backgroundColor: p.surface, borderColor: p.border }, style]}
    >
      {rows.map((child, i) =>
        React.cloneElement(child, { tone, _last: i === rows.length - 1 })
      )}
    </View>
  );
}

export function MenuRow({ icon, label, meta, onPress, tone = "light", danger = false, _last = false }) {
  const p = palette(tone);
  const color = danger ? colors.danger : p.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.menuRow, !_last && { borderBottomWidth: 1, borderBottomColor: p.border }]}
    >
      <View style={styles.menuRowLeft}>
        <Icon name={icon} size={19} color={color} />
        <Text style={[styles.menuRowText, { color: danger ? colors.danger : p.text }]}>{label}</Text>
      </View>
      {meta ? (
        <Text style={[styles.menuRowMeta, { color: p.textMuted }]}>{meta}</Text>
      ) : (
        <Icon name="chevron-right" size={16} color={p.textMuted} />
      )}
    </TouchableOpacity>
  );
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

// ---------------------------------------------------------------------------
// Field — rótulo + input + texto de ayuda. Cubre los tres casos que las
// pantallas de auth repetían a mano: campo simple, campo con prefijo fijo
// (+56 9) y campo de contraseña con botón Ver/Ocultar.
// ---------------------------------------------------------------------------
export function Field({
  label,
  helper,
  error,
  prefix,
  secure = false,
  tone = "light",
  style,
  ...inputProps
}) {
  const p = palette(tone);
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const borderColor = error ? colors.danger : focused ? p.accent : p.border;

  return (
    <View style={[styles.field, style]}>
      {label ? <SectionLabel tone={tone}>{label}</SectionLabel> : null}
      <View
        style={[
          styles.fieldBox,
          { backgroundColor: p.surface, borderColor },
          focused && !error && styles.fieldBoxFocused,
        ]}
      >
        {prefix ? (
          <Text style={[styles.fieldPrefix, { color: p.textMuted }]}>{prefix}</Text>
        ) : null}
        <TextInput
          {...inputProps}
          style={[styles.fieldInput, { color: p.text }]}
          placeholderTextColor={colors.textPlaceholder}
          secureTextEntry={secure && !revealed}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setRevealed((v) => !v)}
            hitSlop={theme.control.hitSlop}
            activeOpacity={0.7}
          >
            <Text style={[styles.fieldReveal, { color: p.accent }]}>
              {revealed ? "Ocultar" : "Ver"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error || helper ? (
        <Text
          style={[styles.fieldHelper, { color: error ? colors.danger : p.textMuted }]}
        >
          {error || helper}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Checkbox — casilla cuadrada con etiqueta a la derecha
// ---------------------------------------------------------------------------
export function Checkbox({ checked, onToggle, label, tone = "light" }) {
  const p = palette(tone);
  return (
    <TouchableOpacity style={styles.checkboxRow} onPress={onToggle} activeOpacity={0.8}>
      <View
        style={[
          styles.checkbox,
          { borderColor: p.border, backgroundColor: p.surface },
          checked && { backgroundColor: p.accent, borderColor: p.accent },
        ]}
      >
        {checked ? (
          <Icon name="check" size={14} color={p.dark ? colors.primary900 : "#FFFFFF"} />
        ) : null}
      </View>
      <Text style={[styles.checkboxLabel, { color: p.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// BottomBar — barra fija inferior para el CTA principal de una pantalla
// ---------------------------------------------------------------------------
export function BottomBar({ children, tone = "light", bordered = true, style }) {
  const p = palette(tone);
  return (
    <View
      style={[
        styles.bottomBar,
        { backgroundColor: p.surface },
        bordered && { borderTopWidth: 1, borderTopColor: p.border },
        style,
      ]}
    >
      {children}
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

  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.radius.card,
    paddingVertical: theme.spacing.lg,
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 30 },

  menuList: {
    borderWidth: 1,
    borderRadius: theme.radius.card,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: theme.spacing.lg,
  },
  menuRowLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, flex: 1 },
  menuRowText: { fontSize: 15, fontWeight: "500" },
  menuRowMeta: { fontSize: 13 },

  field: { gap: 6 },
  fieldBox: {
    height: theme.control.height,
    borderWidth: 1.5,
    borderRadius: theme.radius.field,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  fieldBoxFocused: { boxShadow: `0 0 0 4px ${colors.focusRingSoft}` },
  fieldPrefix: { fontSize: 16 },
  fieldInput: { flex: 1, fontSize: 16 },
  fieldReveal: { fontSize: 15, fontWeight: "600" },
  fieldHelper: { fontSize: 13, lineHeight: 18 },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxLabel: { flex: 1, fontSize: 14, lineHeight: 20 },

  bottomBar: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.lg,
    paddingBottom: 34,
    gap: theme.spacing.md,
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
