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
  // Falla de red/infra al validar, no un rechazo del documento: se avisa
  // igual que un "por vencer" (ámbar), no como un error duro (rojo).
  error_validacion: "aviso",
};

export function RanuraDocumento({ doc, uri, uploading, validando, validacion, onCamera, onFile, onClear, onReintentar }) {
  const tono = validacion ? TONO[validacion.estado] || "aviso" : null;
  const estaValidado = Boolean(
    uri && (tono === "ok" || validacion?.estado === "vigente" || validacion?.estado === "sin_vencimiento")
  );

  const texto = (() => {
    if (validando) return "Leyendo el documento…";
    if (!validacion) return null;
    if (validacion.motivo) return validacion.motivo;
    if (validacion.vencimiento) {
      // El backend a veces manda solo "YYYY-MM-DD" y a veces un ISO completo
      // con hora ("YYYY-MM-DDTHH:mm:ssZ"); antes el split("-") se rompía con
      // lo segundo (el "día" salía con la hora pegada, ej. "10T00:00:00Z").
      // Un vencimiento es una fecha de calendario, no un instante: se toman
      // los primeros 10 caracteres a mano, sin pasar por Date/zona horaria
      // (new Date("YYYY-MM-DD") lo interpreta como medianoche UTC, que en
      // Chile puede mostrar el día anterior).
      const [a, m, d] = validacion.vencimiento.slice(0, 10).split("-");
      if (a && m && d) return `Vigente hasta el ${d}-${m}-${a}`;
      return "Documento verificado";
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
        : estaValidado
          ? "border-emerald-400 bg-emerald-50/20"
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
              estaValidado
                ? "text-accent-700 font-bold"
                : uri && !texto
                  ? "text-accent-700 font-semibold"
                  : "text-textMuted"
            }`}
          >
            {estaValidado ? "Documento validado y aprobado" : uri && !texto ? "Documento listo" : doc.ayuda}
          </Text>
        </View>

        {uploading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : estaValidado ? (
          <View className="flex-row items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-full px-2.5 py-1">
            <Icon name="check" size={13} color={colors.accentDark} />
            <Text className="text-[11px] font-bold text-accent-700">Validado</Text>
          </View>
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

      {validacion?.estado === "error_validacion" && onReintentar ? (
        <TouchableOpacity
          className="self-start py-1"
          onPress={onReintentar}
          hitSlop={theme.control.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Reintentar verificación de ${doc.titulo}`}
        >
          <Text className="text-[12.5px] font-bold text-primary">Reintentar verificación</Text>
        </TouchableOpacity>
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
