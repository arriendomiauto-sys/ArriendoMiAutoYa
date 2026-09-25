import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { colors } from "../../theme/colors";
import { theme } from "../../theme/tokens";
import { Icon } from "../../components/Icon";
import { reglasContrasena } from "./validaciones";

/**
 * Piezas visuales del registro de cuenta que comparten la app de arrendatario y
 * la de dueño. Lo que cambia entre apps (cabecera, forma de los campos y del
 * botón principal) vive en cada pantalla.
 */

/** Barra de avance: pasos ya hechos en pino, el actual en menta, el resto en gris. */
export function SegmentosPaso({ actual, total }) {
  return (
    <View
      className="flex-row gap-1.5"
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${actual} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: actual }}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const color = n < actual ? "bg-primary-700" : n === actual ? "bg-accent-500" : "bg-gray-200";
        return <View key={n} className={`h-1 flex-1 rounded-full ${color}`} />;
      })}
    </View>
  );
}

/** Mensaje de error corto con ícono, para lo que no es un campo de texto (casilla, código). */
export function MensajeCampo({ children, testID }) {
  return (
    <View testID={testID} className="flex-row items-start gap-1.5" accessibilityRole="alert">
      <View className="mt-px">
        <Icon name="alert" size={13} color={colors.dangerText} />
      </View>
      <Text className="flex-1 text-[11.5px] leading-4" style={{ color: colors.dangerText }}>
        {children}
      </Text>
    </View>
  );
}

/** Las tres reglas de la contraseña: se marcan en verde apenas se cumplen. */
export function RequisitosContrasena({ contrasena }) {
  const r = reglasContrasena(contrasena);
  const items = [
    { ok: r.largo, texto: "8 o más caracteres" },
    { ok: r.letra, texto: "Una letra" },
    { ok: r.numero, texto: "Un número" },
  ];
  return (
    <View className="flex-row flex-wrap gap-1.5" accessibilityLiveRegion="polite">
      {items.map(({ ok, texto }) => (
        <View
          key={texto}
          accessibilityLabel={`${texto}: ${ok ? "cumplido" : "pendiente"}`}
          className={`flex-row items-center gap-1 rounded-full pl-1.5 pr-2.5 py-[3px] ${
            ok ? "bg-accent-100" : "bg-gray-100"
          }`}
        >
          <Icon name="check" size={12} color={ok ? colors.accent800 : colors.textPlaceholder} strokeWidth={2.6} />
          <Text className={`text-[11.5px] font-medium ${ok ? "text-accent-800" : "text-textMuted"}`}>{texto}</Text>
        </View>
      ))}
    </View>
  );
}

function CasillaCodigo({ indice, valor, inputRef, error, onCambiar, onTecla }) {
  const [enfocada, setEnfocada] = useState(false);
  const estado = error
    ? "border-danger bg-surface"
    : enfocada
      ? "border-accent bg-surface"
      : valor
        ? "border-accent-200 bg-[#F1FAF7]"
        : "border-gray-200 bg-surface";
  return (
    <TextInput
      testID={`codigo-${indice}`}
      ref={inputRef}
      className={`flex-1 h-[54px] rounded-xl border-[1.5px] p-0 text-center text-[22px] font-bold text-textDark ${estado}`}
      value={valor}
      onChangeText={(texto) => onCambiar(indice, texto)}
      onKeyPress={(e) => onTecla(indice, e)}
      onFocus={() => setEnfocada(true)}
      onBlur={() => setEnfocada(false)}
      keyboardType="number-pad"
      // Más de 1 para poder pegar el código entero en cualquier casilla.
      maxLength={6}
      selectTextOnFocus
      accessibilityLabel={`Dígito ${indice + 1}`}
      autoComplete={indice === 0 ? "sms-otp" : "off"}
      textContentType={indice === 0 ? "oneTimeCode" : "none"}
    />
  );
}

/** Seis casillas grandes; el foco avanza solo y acepta pegar el código completo. */
export function CodigoVerificacion({ digitos, casillasRef, error, onCambiar, onTecla }) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2" accessibilityLabel="Código de verificación">
        {digitos.map((valor, i) => (
          <CasillaCodigo
            key={i}
            indice={i}
            valor={valor}
            error={!!error}
            inputRef={(el) => {
              casillasRef.current[i] = el;
            }}
            onCambiar={onCambiar}
            onTecla={onTecla}
          />
        ))}
      </View>
      {error ? <MensajeCampo testID="error-codigo">{error}</MensajeCampo> : null}
    </View>
  );
}

/**
 * Código de invitación encontrado en el portapapeles. Se ofrece, no se pone
 * solo: la persona decide si lo usa.
 */
export function SugerenciaCodigo({ sugerencia, onUsar, onDescartar }) {
  if (!sugerencia) return null;
  return (
    <View
      testID="sugerencia-codigo"
      className="flex-row items-center gap-2.5 rounded-xl border border-accent-200 bg-accent-100/40 px-3 py-2.5"
    >
      <Icon name="gift" size={16} color={colors.accent800} />
      <Text className="flex-1 text-[12.5px] leading-[17px] text-textDark">
        {sugerencia.nombreReferente ? `¿Te invitó ${sugerencia.nombreReferente}? ` : ""}
        Tienes copiado el código <Text className="font-bold">{sugerencia.codigo}</Text>.
      </Text>
      <TouchableOpacity testID="btn-usar-sugerencia" onPress={onUsar} hitSlop={theme.control.hitSlop} accessibilityRole="button">
        <Text className="text-[13px] font-bold text-accent-700">Usar</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDescartar}
        hitSlop={theme.control.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Descartar código sugerido"
      >
        <Icon name="close" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

/** "Reenviar código en 0:38" mientras corre la espera; después, la acción. */
export function ReenvioCodigo({ segundos, deshabilitado, onReenviar }) {
  if (segundos > 0) {
    return (
      <Text className="text-[13.5px] font-semibold text-textMuted text-center opacity-70">
        Reenviar código en 0:{String(segundos).padStart(2, "0")}
      </Text>
    );
  }
  return (
    <TouchableOpacity
      onPress={onReenviar}
      disabled={deshabilitado}
      hitSlop={theme.control.hitSlop}
      accessibilityRole="button"
      className="items-center py-1"
    >
      <Text className="text-[13.5px] font-bold text-accent-700">Reenviar código</Text>
    </TouchableOpacity>
  );
}

/** Ícono circular + título + mensaje, centrado (código enviado / cuenta creada). */
export function EncabezadoCentrado({ icono, titulo, children }) {
  return (
    <View className="items-center gap-2.5">
      <View className="w-16 h-16 rounded-full bg-accent-100 items-center justify-center">
        <Icon name={icono} size={30} color={colors.accent700} strokeWidth={2} />
      </View>
      <Text className="text-[22px] font-bold text-textDark text-center" style={{ letterSpacing: -0.4 }}>
        {titulo}
      </Text>
      <Text className="text-[13.5px] leading-5 text-textMuted text-center">{children}</Text>
    </View>
  );
}

/** Tarjeta con los datos con que quedó la cuenta. */
export function ResumenCuenta({ filas }) {
  return (
    <View className="rounded-2xl border border-gray-200 bg-surface px-3">
      {filas.map(({ etiqueta, valor }, i) => (
        <View
          key={etiqueta}
          className={`flex-row items-center justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-gray-200" : ""}`}
        >
          <Text className="text-[12.5px] text-textMuted">{etiqueta}</Text>
          <Text className="flex-1 text-right text-[12.5px] font-bold text-textDark">{valor}</Text>
        </View>
      ))}
    </View>
  );
}
