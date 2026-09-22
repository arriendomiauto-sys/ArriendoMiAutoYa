import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
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
  ok: { bgClass: "bg-accent-100", ink: colors.accent800, icon: "check" },
  espera: { bgClass: "bg-amber-50", ink: colors.warningText, icon: "clock" },
  accion: { bgClass: "bg-amber-50", ink: colors.warningText, icon: "alert" },
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
  className = "",
  style,
}) {
  const e = estadoCuenta({ estadoDocumentos, tarjetaEstado, rol });
  const c = BANDA_COLORES[e.tono] || BANDA_COLORES.ok;
  const accionable = e.tono === "accion" && typeof onResolver === "function";

  const contenido = (
    <>
      <View className="w-[22px] h-[22px] rounded-lg items-center justify-center bg-black/5">
        <Icon name={c.icon} size={13} color={c.ink} />
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] font-bold" style={{ color: c.ink }}>{e.titulo}</Text>
        <Text className="text-xs mt-0.5 opacity-85 leading-4" style={{ color: c.ink }}>{e.detalle}</Text>
      </View>
      {accionable ? <Icon name="chevron-right" size={16} color={c.ink} /> : null}
    </>
  );

  const baseClasses = `flex-row items-center gap-2 py-3 px-4 ${c.bgClass} ${
    standalone ? "border border-border rounded-2xl" : "border-t border-border rounded-b-2xl"
  } ${className}`;

  return accionable ? (
    <TouchableOpacity
      className={baseClasses}
      style={style}
      onPress={() => onResolver(e.resolver)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${e.titulo}. ${e.detalle}`}
    >
      {contenido}
    </TouchableOpacity>
  ) : (
    <View className={baseClasses} style={style} accessibilityRole="text" accessibilityLabel={`${e.titulo}. ${e.detalle}`}>
      {contenido}
    </View>
  );
}

/**
 * Botón de cambio de rol. Central en una app que es un solo binario con dos
 * experiencias.
 */
export function ModeSwitchRow({ target, title, desc, onPress, tone = "light", className = "", style }) {
  const dark = tone === "dark";
  const accent = dark ? colors.accent : colors.primary;
  return (
    <TouchableOpacity
      className={`flex-row items-center gap-3 p-4 rounded-2xl border ${
        dark ? "bg-darkCard border-darkBorder" : "bg-primary-100 border-primary-200"
      } ${className}`}
      style={style}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View className={`w-[38px] h-[38px] rounded-full items-center justify-center ${dark ? "bg-darkCardSubtle" : "bg-surface"}`}>
        <Icon name={target === "owner" ? "car" : "key"} size={18} color={accent} />
      </View>
      <View className="flex-1">
        <Text className={`text-[15px] font-bold ${dark ? "text-white" : "text-primary"}`}>{title}</Text>
        <Text className={`text-[13px] mt-0.5 ${dark ? "text-textSilver" : "text-textMuted"}`}>{desc}</Text>
      </View>
      <Icon name="arrow-right" size={16} color={dark ? colors.textSilver : colors.textMuted} />
    </TouchableOpacity>
  );
}
