import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, theme, Icon, FOTOS_AUTO, TOTAL_FOTOS_AUTO } from "@rentacar/mobile-shared";
import { TituloPaso, BarraProgreso } from "./comun";
import { EncuadreAuto } from "./encuadres";

export function PasoFotos({ wizard }) {
  const { fotosPorSlot, slotEnSubida, setCamaraSlot, quitarFoto, uploadingPhoto, progresoGaleria } = wizard;
  const listas = FOTOS_AUTO.filter((s) => fotosPorSlot[s.key]).length;
  const completas = listas === TOTAL_FOTOS_AUTO;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 12 }} showsVerticalScrollIndicator={false}>
      <TituloPaso
        titulo="9 fotos, guiadas una por una"
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
        const subiendo = slotEnSubida === slot.key;
        return (
          <View key={slot.key} className="flex-row items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3">
            {url ? (
              <View className="w-[78px] h-[58px]">
                <Image source={{ uri: url }} className="w-[78px] h-[58px] rounded-xl bg-gray-100" />
                <View className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-accent border-2 border-white items-center justify-center">
                  <Icon name="check" size={10} color="#FFFFFF" />
                </View>
              </View>
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

            {url ? (
              <TouchableOpacity
                className="w-[34px] h-[34px] rounded-full bg-accent/20 items-center justify-center"
                onPress={() => quitarFoto(slot.key)}
                hitSlop={theme.control.hitSlop}
                accessibilityLabel={`Rehacer foto ${slot.titulo}`}
              >
                <Icon name="check" size={16} color={colors.accentDark} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="w-[34px] h-[34px] rounded-full bg-primary items-center justify-center"
                onPress={() => setCamaraSlot(slot)}
                disabled={subiendo || uploadingPhoto}
                accessibilityLabel={`Tomar foto ${slot.titulo}`}
              >
                <Icon name="camera" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <TouchableOpacity
        className="flex-row items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-primary-200"
        onPress={wizard.fotosDesdeGaleria}
        disabled={uploadingPhoto || completas}
        activeOpacity={0.85}
      >
        {uploadingPhoto ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary">
              {progresoGaleria
                ? `Subiendo ${progresoGaleria.listas} de ${progresoGaleria.total}…`
                : "Subiendo…"}
            </Text>
          </>
        ) : (
          <>
            <Icon name="camera" size={16} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary">
              {completas ? "Fotos completas" : "Ya las tengo: elegir de la galería"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
