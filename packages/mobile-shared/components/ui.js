import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

const TouchableAnimado = Animated.createAnimatedComponent(TouchableOpacity);

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
const VARIANTES_VALIDAS = ["primary", "secondary", "ghost", "danger", "outline", "dangerOutline"];

export function Button({
  label,
  onPress,
  variant = "primary", // primary | secondary | ghost | danger | outline | dangerOutline
  size = "md", // md | sm
  tone = "light",
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  fullWidth = true,
  accessibilityLabel,
}) {
  const p = palette(tone);
  const isDisabled = disabled || loading;

  // Una variante fuera de la lista no debe dejar el botón sin fondo ni color
  // de texto (ver SegundoConductorModal, que usaba "outline"/"dangerOutline"
  // antes de que existieran de verdad): se avisa en dev y se cae a "primary".
  if (__DEV__ && !VARIANTES_VALIDAS.includes(variant)) {
    console.warn(
      `[Button] variante desconocida "${variant}" (label="${label}") — se usa "primary". ` +
        `Variantes válidas: ${VARIANTES_VALIDAS.join(", ")}.`
    );
  }
  const varianteSegura = VARIANTES_VALIDAS.includes(variant) ? variant : "primary";

  const bg = {
    primary: p.dark ? colors.accent : colors.primary,
    secondary: p.dark ? colors.darkCardSubtle : colors.primary100,
    ghost: "transparent",
    danger: colors.dangerBg,
    outline: "transparent",
    dangerOutline: "transparent",
  }[varianteSegura];

  const fg = {
    primary: p.dark ? colors.primary900 : "#FFFFFF",
    secondary: p.dark ? colors.textWhite : colors.primary,
    ghost: p.accent,
    danger: colors.dangerText,
    outline: p.dark ? colors.textWhite : colors.primary,
    dangerOutline: colors.dangerText,
  }[varianteSegura];

  // Un botón que no reacciona al toque se siente roto un instante antes de
  // que pase nada — el `activeOpacity` de TouchableOpacity ayuda, pero un
  // achique físico confirma el toque de forma mucho más clara. useNativeDriver
  // corre la animación en el hilo nativo: no compite con el trabajo de JS que
  // el propio onPress puede disparar (crear una reserva, subir un archivo…).
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <TouchableAnimado
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      // Mientras carga, el texto se reemplaza por el spinner: sin esta
      // etiqueta el botón quedaba mudo para un lector de pantalla justo
      // durante la espera, que es cuando más importa saber qué está pasando.
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.btn,
        size === "sm" && styles.btnSm,
        { backgroundColor: bg },
        varianteSegura === "secondary" && { borderWidth: 1, borderColor: p.dark ? p.border : colors.primary200 },
        varianteSegura === "outline" && { borderWidth: 1.5, borderColor: p.dark ? p.border : colors.primary200 },
        varianteSegura === "dangerOutline" && { borderWidth: 1.5, borderColor: colors.dangerBorder },
        varianteSegura === "ghost" && styles.btnGhost,
        fullWidth && { alignSelf: "stretch" },
        isDisabled && styles.btnDisabled,
        { transform: [{ scale }] },
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
    </TouchableAnimado>
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
// BackButton — el botón "volver" estándar de toda la app.
//   variant "default": caja 40×40 con borde, sobre fondo claro/oscuro.
//   variant "overlay": misma caja translúcida, para flotar sobre una foto
//                      o un mapa (hero de detalle de auto, mapa de búsqueda).
// Es un botón sin texto: SIEMPRE lleva accessibilityLabel para el lector.
// ---------------------------------------------------------------------------
export function BackButton({
  onPress,
  onBack,
  tone = "light",
  variant = "default",
  accessibilityLabel = "Volver",
  style,
}) {
  const p = palette(tone);
  const overlay = variant === "overlay";
  return (
    <TouchableOpacity
      onPress={onPress || onBack}
      hitSlop={theme.control.hitSlop}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.backButton,
        overlay
          ? {
              backgroundColor: p.dark ? "rgba(6,30,31,0.55)" : "rgba(255,255,255,0.94)",
              ...theme.shadow.sm,
            }
          : { borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
        style,
      ]}
    >
      <Icon name="arrow-left" size={20} color={overlay && p.dark ? colors.textWhite : p.accent} />
    </TouchableOpacity>
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
        <BackButton onPress={onBack} tone={tone} />
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

  // Mismo resorte que el botón: un chip de filtro se toca muchas veces
  // seguidas (probando categorías, tipos de cuenta, marcas) y sin este
  // "snap" cada toque se siente igual de plano que el anterior.
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <TouchableAnimado
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Sin esto, un filtro activo se distinguía solo por color.
      accessibilityState={{ selected: !!selected }}
      // El chip mide ~34 px de alto, bajo el mínimo cómodo de 44: el hitSlop
      // agranda el área táctil sin cambiar el diseño.
      hitSlop={theme.control.hitSlop}
      style={[
        styles.chip,
        { borderColor: p.border, backgroundColor: p.surface },
        selected && {
          backgroundColor: p.dark ? colors.accent : colors.primary,
          borderColor: p.dark ? colors.accent : colors.primary,
        },
        { transform: [{ scale }] },
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
    </TouchableAnimado>
  );
}

// ---------------------------------------------------------------------------
// Rating — estrella + puntaje (coma decimal chilena) y, opcional, el conteo.
// El puntaje SIEMPRE va por este componente, nunca como texto suelto.
//   <Rating value={4.8} count={23} size="sm" />  → ★ 4,8 · 23 arriendos
// value nulo/0 => "Sin evaluaciones" (o el `emptyLabel` que se pase).
// ---------------------------------------------------------------------------
export function Rating({ value, count, size = "md", tone = "light", emptyLabel = "Sin evaluaciones", style }) {
  const p = palette(tone);
  const num = Number(value);
  const has = Number.isFinite(num) && num > 0;
  const dims = size === "sm"
    ? { star: 12, score: 13, meta: 12 }
    : size === "lg"
      ? { star: 16, score: 16, meta: 14 }
      : { star: 14, score: 14, meta: 13 };

  if (!has) {
    return (
      <Text style={[styles.ratingMeta, { fontSize: dims.meta, color: p.textMuted }, style]}>
        {emptyLabel}
      </Text>
    );
  }

  const score = num.toFixed(1).replace(".", ",");
  return (
    <View
      style={[styles.ratingRow, style]}
      accessibilityRole="text"
      accessibilityLabel={`${score} de 5${count ? `, ${count} arriendos` : ""}`}
    >
      <Icon name="star" size={dims.star} color={colors.accent500} fill={colors.accent500} />
      <Text style={[styles.ratingScore, { fontSize: dims.score, color: p.text }]}>{score}</Text>
      {count ? (
        <Text style={[styles.ratingMeta, { fontSize: dims.meta, color: p.textMuted }]}>
          {` · ${count} ${count === 1 ? "arriendo" : "arriendos"}`}
        </Text>
      ) : null}
    </View>
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

export function MenuRow({
  icon,
  label,
  meta,
  onPress,
  tone = "light",
  danger = false,
  // `tile`: envuelve el icono en un cuadro redondeado tintado (34px) — el
  // lenguaje del hub de cuenta. `tileTone`: "brand" (pino) | "menta" | "danger".
  tile = false,
  tileTone = "brand",
  _last = false,
}) {
  const p = palette(tone);
  const color = danger ? colors.danger : p.accent;
  const tileBg = danger
    ? colors.dangerBg
    : tileTone === "menta"
      ? p.dark ? "rgba(47,191,155,0.15)" : colors.accent100
      : p.dark ? colors.darkCardSubtle : colors.primary100;
  const tileFg = danger
    ? colors.dangerText
    : tileTone === "menta"
      ? p.dark ? colors.accent : colors.accent800
      : p.dark ? colors.accent : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      style={[tile ? styles.menuRowTiled : styles.menuRow, !_last && { borderBottomWidth: 1, borderBottomColor: p.border }]}
    >
      <View style={styles.menuRowLeft}>
        {tile ? (
          <View style={[styles.menuTile, { backgroundColor: tileBg }]}>
            <Icon name={icon} size={16} color={tileFg} />
          </View>
        ) : (
          <Icon name={icon} size={19} color={color} />
        )}
        <Text
          style={[styles.menuRowText, { color: danger ? colors.danger : p.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {meta ? (
        <Text style={[styles.menuRowMeta, { color: p.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
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

  // Aparece justo cuando una lista termina de cargar y no hay nada que
  // mostrar — sin transición, el salto de "cargando" a "vacío" se siente
  // como un parpadeo. Un fundido corto marca que es un estado nuevo, no un
  // error de layout.
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [entrada]);

  return (
    <Animated.View style={[styles.empty, { opacity: entrada }]}>
      <View style={[styles.emptyIcon, { backgroundColor: p.dark ? colors.darkCardSubtle : colors.primary100 }]}>
        <Icon name={icon} size={30} color={p.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: p.text }]}>{title}</Text>
      {message ? <Text style={[styles.emptyMessage, { color: p.textMuted }]}>{message}</Text> : null}
      {action && onAction ? (
        <Button label={action} onPress={onAction} tone={tone} size="sm" fullWidth={false} style={{ marginTop: 4 }} />
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Field — rótulo + input + texto de ayuda. Cubre los tres casos que las
// pantallas de auth repetían a mano: campo simple, campo con prefijo fijo
// (+56 9) y campo de contraseña con botón Ver/Ocultar.
//
// `format`: función `raw => texto` para campos con máscara (RUT, teléfono,
// tarjeta). Cuando se pasa, el Field maneja su PROPIO texto: el `value=` del
// TextInput sale de un estado que se setea en el mismo handler del cambio, y
// el prop `value` de afuera solo se vuelve a adoptar cuando cambia por algo
// externo (prefill, reset). Sin esto, al reformatear (meter puntos/guiones) el
// prop `value` llegaba desfasado un caracter y peleaba con el input nativo:
// en Android eso DUPLICABA dígitos al tipear rápido o pegar.
// ---------------------------------------------------------------------------
export const Field = React.forwardRef(function Field(
  {
    label,
    helper,
    error,
    prefix,
    secure = false,
    tone = "light",
    style,
    format,
    value,
    onChangeText,
    ...inputProps
  },
  // La ref apunta al TextInput interno: es lo que permite que un campo enfoque
  // al siguiente desde el botón "Siguiente" del teclado.
  ref
) {
  const p = palette(tone);
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  // Texto que ve el input cuando hay `format`. El ref recuerda lo último que
  // emitimos para distinguir "el padre nos devolvió lo nuestro" (no tocar) de
  // "el padre cambió el valor por fuera" (adoptarlo).
  const [masked, setMasked] = React.useState(value ?? "");
  const lastEmitted = React.useRef(value ?? "");
  React.useEffect(() => {
    if (format && value !== lastEmitted.current) {
      setMasked(value ?? "");
      lastEmitted.current = value ?? "";
    }
  }, [format, value]);

  const handleChangeText = (raw) => {
    if (format) {
      const next = format(raw);
      lastEmitted.current = next;
      setMasked(next);
      onChangeText?.(next);
    } else {
      onChangeText?.(raw);
    }
  };

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
          ref={ref}
          value={format ? masked : value}
          onChangeText={handleChangeText}
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
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ocultar la contraseña" : "Mostrar la contraseña"}
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
          // Un error marcado solo con color rojo no existe para quien no lo ve.
          accessibilityRole={error ? "alert" : undefined}
        >
          {error || helper}
        </Text>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Checkbox — casilla cuadrada con etiqueta a la derecha
// ---------------------------------------------------------------------------
export function Checkbox({ checked, onToggle, label, tone = "light" }) {
  const p = palette(tone);
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      // El estado marcado vivía solo en el color de fondo del cuadrito.
      accessibilityState={{ checked: !!checked }}
    >
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.field,
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

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingScore: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  ratingMeta: { fontWeight: "400" },

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
  menuRowTiled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: theme.spacing.md,
  },
  menuRowLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, flex: 1 },
  menuTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRowText: { fontSize: 15, fontWeight: "500", flexShrink: 1 },
  menuRowMeta: { fontSize: 13, marginLeft: theme.spacing.sm },

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
