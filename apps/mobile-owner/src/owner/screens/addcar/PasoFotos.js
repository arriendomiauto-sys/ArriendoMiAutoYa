import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, theme, Icon, usePhotoViewer, FOTOS_AUTO, TOTAL_FOTOS_AUTO } from "@rentacar/mobile-shared";
import { TituloPaso, BarraProgreso } from "./comun";
import { EncuadreAuto } from "./encuadres";

export function PasoFotos({ wizard }) {
  const { fotosPorSlot, slotsEnSubida, setCamaraSlot, fotoDesdeGaleriaEnSlot } = wizard;
  const abrirVisor = usePhotoViewer();
  const listas = FOTOS_AUTO.filter((s) => fotosPorSlot[s.key]).length;

  const fotosCargadas = FOTOS_AUTO.map((s) => fotosPorSlot[s.key]).filter(Boolean);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 12 }} showsVerticalScrollIndicator={false}>
      <TituloPaso
        titulo={`${TOTAL_FOTOS_AUTO} fotos, guiadas una por una`}
        bajada="Copia el encuadre de cada ejemplo para que tu ficha se vea pareja."
      />

      <BarraProgreso hechos={listas} total={TOTAL_FOTOS_AUTO} etiqueta="listas" />

      {/* Instructivo */}
      <View className="flex-row gap-3.5 bg-primary rounded-2xl p-3.5 shadow-md">
        <View className="w-[92px] h-[72px] rounded-xl bg-white/10 border border-dashed border-white/35 items-center justify-center">
          <EncuadreAuto tipo="lateral" size={64} color="#FFFFFF" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-white">Antes de empezar</Text>
          <Text className="text-xs text-white/80 leading-[17px] mt-1">
            Luz de día · auto limpio · a 3 metros · auto completo dentro del marco · sin personas ni
            otros autos detrás. En el frontal y la trasera tapamos la patente antes de publicar.
          </Text>
        </View>
      </View>

      {FOTOS_AUTO.map((slot, i) => {
        const url = fotosPorSlot[slot.key];
        const subiendo = slotsEnSubida.has(slot.key);
        return (
          <View key={slot.key} className="flex-row items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3">
            {url ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => abrirVisor(fotosCargadas, Math.max(0, fotosCargadas.indexOf(url)))}
                className="w-[78px] h-[58px]"
                accessibilityRole="button"
                accessibilityLabel={`Ver foto de ${slot.titulo} en grande con zoom`}
              >
                <Image source={{ uri: url }} className="w-[78px] h-[58px] rounded-xl bg-gray-100" />
                <View className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-accent border-2 border-white items-center justify-center">
                  <Icon name="check" size={10} color="#FFFFFF" />
                </View>
                <View className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                  <Icon name="search" size={9} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ) : (
              <View className="w-[78px] h-[58px] rounded-xl bg-surface-subtle border border-dashed border-primary-200 items-center justify-center">
                {subiendo ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <EncuadreAuto tipo={slot.key} size={44} color={colors.primary} />
                )}
              </View>
            )}

            <View className="flex-1">
              <Text className="text-sm font-bold text-textDark">{`${i + 1} · ${slot.titulo}`}</Text>
              <Text className="text-[11.5px] text-textMuted leading-[15px] mt-0.5" numberOfLines={2}>
                {slot.camara?.hint || slot.ayuda}
              </Text>
            </View>

            {/* Dos acciones por casilla, con etiqueta y ancho fijo para que
                queden alineadas a lo largo de la lista. "Cargar" reemplaza a
                la carga masiva de antes: la foto se elige para ESTA toma, sin
                que el dueño tenga que acertar el orden de la galería.
                "Tomar/Rehacer" NO borra la foto: abre la cámara y solo se
                reemplaza si la nueva captura sube bien. */}
            <View className="gap-1.5">
              <TouchableOpacity
                className={`w-[94px] h-9 rounded-xl flex-row items-center justify-center gap-1.5 ${
                  url ? "bg-accent/15 border border-accent/30" : "bg-primary"
                }`}
                onPress={() => setCamaraSlot(slot)}
                disabled={subiendo}
                hitSlop={theme.control.hitSlop}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${url ? "Rehacer" : "Tomar"} foto ${slot.titulo}`}
              >
                <Icon name="camera" size={15} color={url ? colors.accentDark : "#FFFFFF"} />
                <Text className={`text-[12px] font-bold ${url ? "text-accent-700" : "text-white"}`}>
                  {url ? "Rehacer" : "Tomar"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="w-[94px] h-9 rounded-xl flex-row items-center justify-center gap-1.5 border border-primary-200 bg-surface-subtle"
                onPress={() => fotoDesdeGaleriaEnSlot(slot)}
                disabled={subiendo}
                hitSlop={theme.control.hitSlop}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Cargar foto de ${slot.titulo} desde la galería`}
              >
                <Icon name="image" size={15} color={colors.primary} />
                <Text className="text-[12px] font-bold text-primary">Cargar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
