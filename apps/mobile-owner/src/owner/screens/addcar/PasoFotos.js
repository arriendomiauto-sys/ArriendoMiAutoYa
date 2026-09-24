import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, theme, Icon, usePhotoViewer, FOTOS_AUTO, TOTAL_FOTOS_AUTO } from "@rentacar/mobile-shared";
import { TituloPaso, BarraProgreso } from "./comun";
import { EncuadreAuto } from "./encuadres";

export function PasoFotos({ wizard }) {
  const { fotosPorSlot, slotsEnSubida, setCamaraSlot, uploadingPhoto, progresoGaleria } = wizard;
  const abrirVisor = usePhotoViewer();
  const listas = FOTOS_AUTO.filter((s) => fotosPorSlot[s.key]).length;
  const completas = listas === TOTAL_FOTOS_AUTO;

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

            {url ? (
              // A diferencia de antes, esto ya NO borra la foto: abre la
              // cámara directo para retomarla, y solo se reemplaza si la
              // nueva captura sube bien (fotoCapturada sobreescribe la URL
              // de esta casilla). Antes el ícono de check parecía "listo"
              // pero en realidad borraba la foto sin avisar.
              <TouchableOpacity
                className="w-[34px] h-[34px] rounded-full bg-accent/20 items-center justify-center"
                onPress={() => setCamaraSlot(slot)}
                disabled={subiendo || uploadingPhoto}
                hitSlop={theme.control.hitSlop}
                accessibilityLabel={`Rehacer foto ${slot.titulo}`}
              >
                <Icon name="camera" size={16} color={colors.accentDark} />
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
