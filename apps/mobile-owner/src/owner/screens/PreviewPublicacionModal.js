import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Image,
  ScrollView,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, Icon, SectionLabel, PhotoViewer, FOTOS_AUTO } from "@rentacar/mobile-shared";

// Los mismos rótulos que usa la ficha del arrendatario
// (mobile-renter/src/renter/screens/CarDetailScreen.js): la gracia de esta
// pantalla es mostrar EXACTAMENTE lo que va a leer quien arrienda, así que si
// allá cambia un texto, acá tiene que cambiar igual.
const CAT_LABEL = { economico: "Económico", sedan: "Sedán", suv: "SUV", camioneta: "Camioneta", premium: "Premium" };
const TRANS_LABEL = { automatica: "Automática", mecanica: "Mecánica" };
const FUEL_LABEL = { bencina: "Bencina", diesel: "Diésel", hibrido: "Híbrido", electrico: "Eléctrico" };
const EQUIPAMIENTO_LABELS = {
  ac: "Aire acondicionado",
  bluetooth: "Bluetooth / CarPlay",
  camara_retroceso: "Cámara de retroceso",
  doble_traccion: "Tracción 4x4",
  isofix: "Anclajes ISOFIX",
};

const ALTO_HERO = 300;
const ALTO_TIRA = 56;
const ANCHO_MINI = ALTO_TIRA + 16;
const PASO_MINI = ANCHO_MINI + 8; // miniatura + gap: lo que avanza scrollToIndex

const precioCLP = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

/**
 * Vista previa de la publicación tal como la ve un arrendatario.
 *
 * Es de solo lectura: reproduce el carrusel, la ficha técnica, el
 * equipamiento y el precio de `CarDetailScreen`, pero sin el selector de
 * fechas ni el botón de reservar — el dueño no arrienda su propio auto. Sirve
 * para revisar que las fotos y los datos se vean bien antes de dejarlo
 * publicado.
 */
export function PreviewPublicacionModal({ visible, car, onClose }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const [zoom, setZoom] = useState(null); // índice de la foto abierta a pantalla completa
  const heroRef = useRef(null);
  const tiraRef = useRef(null);

  const fotos = car?.fotos?.length ? car.fotos : [];
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");
  const specs = [
    car?.transmision && { icon: "settings", label: TRANS_LABEL[car.transmision] || car.transmision },
    car?.combustible && { icon: "gas", label: FUEL_LABEL[car.combustible] || car.combustible },
    car?.asientos && { icon: "user", label: `${car.asientos} asientos` },
    car?.puertas && { icon: "car", label: `${car.puertas} puertas` },
  ].filter(Boolean);
  const equipamientoActivo = Object.entries(car?.equipamiento || {})
    .filter(([, activo]) => activo)
    .map(([key]) => EQUIPAMIENTO_LABELS[key] || key);

  // Las fotos se suben en el orden de FOTOS_AUTO, así que la i-ésima
  // corresponde a la i-ésima toma guiada: sirve para rotular el carrusel
  // ("Frontal", "Lateral izquierdo"…) sin guardar nada extra.
  const rotuloDe = (i) => FOTOS_AUTO[i]?.titulo || `Foto ${i + 1}`;

  const irA = (i) => {
    if (i < 0 || i >= fotos.length) return;
    setIndice(i);
    heroRef.current?.scrollToOffset?.({ offset: i * width, animated: true });
  };

  const alTerminarScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i === indice) return;
    setIndice(i);
    // La tira de miniaturas sigue a la foto grande.
    tiraRef.current?.scrollToIndex?.({ index: i, viewPosition: 0.5, animated: true });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-background">
        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ---- Carrusel ---------------------------------------------- */}
          {fotos.length > 0 ? (
            <View>
              <FlatList
                ref={heroRef}
                data={fotos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={fotos.length > 1}
                onMomentumScrollEnd={alTerminarScroll}
                keyExtractor={(uri, i) => `${uri}-${i}`}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.95} onPress={() => setZoom(index)}>
                    <Image source={{ uri: item }} style={{ width, height: ALTO_HERO }} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />

              {/* Degradado simulado para que el texto claro se lea sobre
                  cualquier foto, sin depender de expo-linear-gradient. */}
              <View pointerEvents="none" className="absolute left-0 right-0 bottom-0 h-24 bg-black/35" />
              <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-24 bg-black/25" />

              {/* Contador + rótulo de la toma */}
              <View className="absolute left-4 bottom-4 flex-row items-center gap-2">
                <View className="bg-black/55 rounded-full px-3 py-1.5">
                  <Text className="text-[12px] font-bold text-white">
                    {indice + 1} / {fotos.length}
                  </Text>
                </View>
                <View className="bg-black/55 rounded-full px-3 py-1.5">
                  <Text className="text-[12px] font-semibold text-white">{rotuloDe(indice)}</Text>
                </View>
              </View>

              {/* Flechas: en un carrusel ancho el swipe no siempre es obvio */}
              {fotos.length > 1 ? (
                <>
                  {indice > 0 ? (
                    <TouchableOpacity
                      className="absolute left-3 w-10 h-10 rounded-full bg-black/45 items-center justify-center"
                      style={{ top: ALTO_HERO / 2 - 20 }}
                      onPress={() => irA(indice - 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Foto anterior"
                    >
                      <Icon name="chevron-left" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                  {indice < fotos.length - 1 ? (
                    <TouchableOpacity
                      className="absolute right-3 w-10 h-10 rounded-full bg-black/45 items-center justify-center"
                      style={{ top: ALTO_HERO / 2 - 20 }}
                      onPress={() => irA(indice + 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Foto siguiente"
                    >
                      <Icon name="chevron-right" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}

              {/* Pista de que se puede ampliar */}
              <View pointerEvents="none" className="absolute right-4 bottom-4 flex-row items-center gap-1.5 bg-black/55 rounded-full px-3 py-1.5">
                <Icon name="search" size={12} color="#FFFFFF" />
                <Text className="text-[11.5px] font-semibold text-white">Ampliar</Text>
              </View>
            </View>
          ) : (
            <View className="h-[220px] bg-surface-subtle items-center justify-center gap-2">
              <Icon name="camera" size={30} color={colors.textMuted} />
              <Text className="text-[13px] text-textMuted">Esta publicación todavía no tiene fotos.</Text>
            </View>
          )}

          {/* Tira de miniaturas */}
          {fotos.length > 1 ? (
            <FlatList
              ref={tiraRef}
              data={fotos}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="bg-surface border-b border-gray-100"
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
              keyExtractor={(uri, i) => `mini-${uri}-${i}`}
              getItemLayout={(_, i) => ({ length: PASO_MINI, offset: PASO_MINI * i, index: i })}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => irA(index)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver ${rotuloDe(index)}`}
                >
                  <Image
                    source={{ uri: item }}
                    style={{ width: ANCHO_MINI, height: ALTO_TIRA }}
                    className={`rounded-lg ${index === indice ? "border-2 border-primary" : "opacity-60"}`}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
          ) : null}

          {/* ---- Ficha --------------------------------------------------- */}
          <View className="px-4 pt-4 gap-4">
            <View>
              <Text className="text-xl font-extrabold text-textDark">{nombreAuto || "Tu auto"}</Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <Icon name="pin" size={13} color={colors.textMuted} />
                <Text className="text-[13px] text-textMuted">
                  {CAT_LABEL[car?.categoria] || car?.categoria || "—"} · {car?.ubicacion_base || "Concepción"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-end gap-1.5 bg-primary-100 rounded-xl px-4 py-3">
              <Text className="text-2xl font-extrabold text-primary">{precioCLP(car?.tarifa_dia)}</Text>
              <Text className="text-[13px] text-textMuted mb-1">por día</Text>
            </View>

            {specs.length > 0 ? (
              <View>
                <SectionLabel>Ficha técnica</SectionLabel>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {specs.map((s) => (
                    <View
                      key={s.label}
                      className="flex-row items-center gap-1.5 bg-surface border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <Icon name={s.icon} size={14} color={colors.primary} />
                      <Text className="text-xs font-semibold text-textDark">{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {equipamientoActivo.length > 0 ? (
              <View>
                <SectionLabel>Equipamiento</SectionLabel>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {equipamientoActivo.map((label) => (
                    <View key={label} className="flex-row items-center gap-1.5 bg-accent/10 rounded-lg px-3 py-2">
                      <Icon name="check" size={13} color={colors.accentDark} />
                      <Text className="text-xs font-semibold text-accent-700">{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {car?.descripcion ? (
              <View>
                <SectionLabel>Descripción</SectionLabel>
                <Text className="text-sm text-textMuted leading-5 mt-2">{car.descripcion}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Cabecera flotante: va encima del carrusel para no robarle alto */}
        <View
          className="absolute left-0 right-0 flex-row items-center gap-3 px-4"
          style={{ top: Math.max(insets.top, 12) }}
        >
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar la vista previa"
          >
            <Icon name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5 bg-black/50 rounded-full px-3 py-2">
            <Icon name="search" size={12} color="#FFFFFF" />
            <Text className="text-[11.5px] font-bold text-white">Así la ve quien arrienda</Text>
          </View>
        </View>

        {/* Acá el arrendatario ve el selector de fechas y "Reservar". */}
        <View
          className="border-t border-gray-200 bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Text className="text-[12px] text-textMuted text-center">
            Quien arrienda ve acá el selector de fechas y el botón para reservar.
          </Text>
        </View>

        <PhotoViewer
          visible={zoom !== null}
          photos={fotos}
          initialIndex={zoom || 0}
          onClose={() => setZoom(null)}
        />
      </View>
    </Modal>
  );
}
