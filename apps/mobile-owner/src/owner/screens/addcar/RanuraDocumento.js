import React from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

const TONO = {
  vigente: "ok",
  sin_vencimiento: "ok",
  por_vencer: "aviso",
  vencido: "error",
  patente_no_coincide: "error",
  tipo_incorrecto: "error",
};

export function RanuraDocumento({ doc, uri, uploading, validando, validacion, onCamera, onFile, onClear }) {
  const tono = validacion ? TONO[validacion.estado] || "aviso" : null;
  const texto = (() => {
    if (validando) return "Leyendo el documento…";
    if (!validacion) return null;
    if (validacion.motivo) return validacion.motivo;
    if (validacion.vencimiento) {
      const [a, m, d] = validacion.vencimiento.split("-");
      return `Vigente hasta el ${d}-${m}-${a}`;
    }
    return "Documento verificado";
  })();

  const colorTono =
    tono === "error" ? colors.danger : tono === "ok" ? colors.accentDark : colors.warning;

  const borderClass =
    tono === "error"
      ? "border-red-300"
      : tono === "aviso"
        ? "border-amber-300"
        : uri
          ? "border-emerald-300 bg-surface-subtle"
          : doc.opcional
            ? "border-dashed border-gray-300 bg-white"
            : "border-gray-200 bg-white";

  return (
    <View className={`rounded-2xl border p-3.5 gap-2.5 ${borderClass}`}>
      <View className="flex-row items-center gap-3">
        {uri ? (
          <Image source={{ uri }} className="w-11 h-11 rounded-xl bg-gray-100 border border-emerald-300" />
        ) : (
          <View className={`w-[42px] h-[42px] rounded-xl items-center justify-center ${doc.opcional ? "bg-surface-subtle" : "bg-primary-100"}`}>
            <Icon name={doc.icon} size={19} color={doc.opcional ? colors.textMuted : colors.primary} />
          </View>
        )}

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm font-bold text-textDark flex-shrink">{doc.titulo}</Text>
            {doc.opcional ? (
              <Text className="text-[10px] font-bold uppercase tracking-wider text-textMuted bg-gray-100 rounded px-1.5 py-0.5 overflow-hidden">
                Opcional
              </Text>
            ) : null}
          </View>
          <Text
            className={`text-[11.5px] leading-[15px] mt-0.5 ${
              uri && !texto ? "text-accent-700 font-semibold" : "text-textMuted"
            }`}
          >
            {uri && !texto ? "Documento listo" : doc.ayuda}
          </Text>
        </View>

        {uploading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : uri ? (
          <TouchableOpacity onPress={onClear} hitSlop={theme.control.hitSlop} accessibilityLabel="Quitar documento">
            <Icon name="trash" size={18} color={colors.danger} />
          </TouchableOpacity>
        ) : null}
      </View>

      {texto ? (
        <View className="flex-row items-start gap-1.5">
          <Icon
            name={tono === "error" ? "alert" : tono === "ok" ? "check" : "clock"}
            size={13}
            color={colorTono}
          />
          <Text style={{ color: colorTono }} className="flex-1 text-[11.5px] leading-4">
            {texto}
          </Text>
        </View>
      ) : null}

      {!uri && !uploading ? (
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 h-[42px] rounded-xl border border-primary-200 bg-primary-100"
            onPress={onCamera}
            activeOpacity={0.85}
          >
            <Icon name="camera" size={15} color={colors.primary} />
            <Text className="text-[13px] font-bold text-primary">Fotografiar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 h-[42px] rounded-xl border border-primary-200 bg-primary-100"
            onPress={onFile}
            activeOpacity={0.85}
          >
            <Icon name="document" size={15} color={colors.primary} />
            <Text className="text-[13px] font-bold text-primary">Galería</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
