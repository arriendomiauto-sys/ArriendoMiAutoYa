import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

/**
 * Campo de texto del flujo de dueño usando NativeWind classes.
 *
 * `label` pone un rótulo sobre el campo, `iconLeft` un ícono antes del texto y
 * `revealIcon` cambia el "Ver/Ocultar" de la contraseña por un ojo. `invalid`
 * marca el borde en rojo (el mensaje va aparte, en un aviso).
 */
export const OwnerField = React.forwardRef(function OwnerField(
  {
    label,
    placeholder,
    accessibilityLabel,
    secure = false,
    revealIcon = false,
    iconLeft,
    invalid = false,
    prefix,
    className = "",
    style,
    format,
    value,
    onChangeText,
    ...inputProps
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const [masked, setMasked] = useState(value ?? "");
  const lastEmitted = useRef(value ?? "");
  useEffect(() => {
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

  // Bloqueado (editable={false}): se apaga para que se note que no responde.
  const apagado = inputProps.editable === false;
  const estadoCaja = invalid
    ? "border-danger bg-surface"
    : focused
      ? "border-accent bg-surface"
      : "border-transparent bg-surface-secondary";

  const campo = (
    <View
      className={`h-[52px] rounded-2xl border-[1.5px] ${estadoCaja} ${
        apagado ? "opacity-60" : ""
      } flex-row items-center gap-2 px-[18px] ${label ? "" : className}`}
      style={label ? undefined : style}
    >
      {iconLeft ? <Icon name={iconLeft} size={18} color={colors.textMuted} /> : null}
      {prefix ? <Text className="text-[15px] text-textMuted">{prefix}</Text> : null}
      <TextInput
        {...inputProps}
        ref={ref}
        value={format ? masked : value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        accessibilityLabel={accessibilityLabel || placeholder}
        secureTextEntry={secure && !revealed}
        className="flex-1 text-[15px] text-textDark"
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
          {revealIcon ? (
            <Icon name={revealed ? "eye-off" : "eye"} size={19} color={colors.textMuted} />
          ) : (
            <Text className="text-sm font-semibold text-primary-700">{revealed ? "Ocultar" : "Ver"}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!label) return campo;

  return (
    <View className={`gap-1.5 ${className}`} style={style}>
      <Text className="text-xs font-semibold text-textMuted tracking-wide">{label}</Text>
      {campo}
    </View>
  );
});
