import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";

// Qué dice el aviso según `antecedentes_estado` del usuario (limpio | pendiente |
// revision | bloqueado; un certificado rechazado deja al usuario "pendiente").
// "limpio" no muestra nada.
const TEXTOS = {
  pendiente: {
    titulo: "Sube tus antecedentes y tu hoja de vida",
    detalle: (obligatorio) =>
      obligatorio
        ? "Son obligatorios para reservar. Gratis con tu ClaveÚnica en registrocivil.cl."
        : "Tenlos listos para reservar sin demoras. Gratis con tu ClaveÚnica en registrocivil.cl.",
    accion: "Subir",
  },
  revision: {
    titulo: "Estamos revisando tus certificados",
    detalle: "Te avisamos apenas estén aprobados. Mientras, ya puedes elegir tu auto.",
    accion: null,
  },
  bloqueado: {
    titulo: "Tu cuenta está en revisión",
    detalle: "Contacta a soporte para poder reservar.",
    accion: "Ver",
  },
};

/** El estado de antecedentes del usuario, visto como "falta algo". */
export function antecedentesPendientes(estado) {
  return (estado || "pendiente") !== "limpio";
}

/**
 * Aviso de antecedentes (certificado de antecedentes + hoja de vida del
 * conductor). Con ANTECEDENTES_OBLIGATORIOS encendido el backend no deja
 * reservar sin ellos aprobados, pero en la app solo aparecían como una fila más
 * del perfil: la persona se enteraba al intentar reservar. Va en la pantalla
 * principal (bajo el aviso de identidad) y arriba del perfil mientras falten.
 * `obligatorio` ajusta el texto a si hoy se exigen o no.
 */
export function AntecedentesBanner({ estado, obligatorio = false, onPress, className = "", style }) {
  const clave = TEXTOS[estado] ? estado : "pendiente";
  if (!antecedentesPendientes(estado)) return null;
  const t = TEXTOS[clave];
  const enRevision = clave === "revision";
  return (
    <TouchableOpacity
      testID="banner-antecedentes"
      className={`flex-row items-center gap-3 rounded-2xl p-3.5 border ${
        enRevision ? "bg-surface border-gray-200" : "bg-[#FFF8EC] border-[#F0DDBB]"
      } ${className}`}
      style={style}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t.titulo}
    >
      <View
        className="w-[34px] h-[34px] rounded-xl items-center justify-center"
        style={{ backgroundColor: enRevision ? colors.primary100 : "#F9E7C4" }}
      >
        <Icon name={enRevision ? "clock" : "document"} size={16} color={enRevision ? colors.primary : colors.warningText} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-textDark">{t.titulo}</Text>
        <Text className="text-[12.5px] text-textMuted mt-0.5 leading-[17px]">
          {typeof t.detalle === "function" ? t.detalle(obligatorio) : t.detalle}
        </Text>
      </View>
      {t.accion ? (
        <View className="px-3 py-2 rounded-full" style={{ backgroundColor: colors.warning }}>
          <Text className="text-[13px] font-bold text-white">{t.accion}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
