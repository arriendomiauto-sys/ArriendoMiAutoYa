import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GestureViewer,
  useGestureViewerController,
  useGestureViewerState,
} from "react-native-gesture-image-viewer";

import { colors } from "../theme/colors";
import { Icon } from "./Icon";

// Visor de fotos a pantalla completa sobre `react-native-gesture-image-viewer`:
// pellizcar y doble tap para zoom, arrastrar la foto ampliada, deslizar entre
// fotos y deslizar hacia abajo para cerrar. La librería trae su propio
// GestureHandlerRootView, así que funciona dentro de un <Modal> (los gestos del
// visor casero anterior fallaban ahí en Android). El <Modal> además:
//   · cubre la pantalla completa, barra de estado incluida;
//   · se cierra con el botón "Atrás" de Android (onRequestClose) — antes el
//     visor era un overlay y quedaba encima de la pantalla siguiente.

const ID_VISOR = "visor-fotos";
const TAMANO_MINIATURA = 44;

function PhotoViewerModal({ photos, initialIndex, onClose }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { goToIndex } = useGestureViewerController(ID_VISOR);
  const { currentIndex, totalCount } = useGestureViewerState(ID_VISOR);
  const [mostrarControles, setMostrarControles] = useState(true);
  const tiraRef = useRef(null);

  const renderFoto = useCallback(
    (uri) => <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />,
    []
  );

  // La tira de miniaturas sigue a la foto activa.
  useEffect(() => {
    tiraRef.current?.scrollTo({
      x: Math.max(0, currentIndex * (TAMANO_MINIATURA + 8) - width / 2 + TAMANO_MINIATURA / 2),
      animated: true,
    });
  }, [currentIndex, width]);

  const varias = photos.length > 1;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <GestureViewer
          id={ID_VISOR}
          data={photos}
          initialIndex={initialIndex}
          renderItem={renderFoto}
          width={width}
          height={height}
          pageSpacing={16}
          maxZoomScale={4}
          backdropStyle={{ backgroundColor: "#000" }}
          onDismissStart={() => setMostrarControles(false)}
          onDismiss={onClose}
          // Un toque muestra u oculta los controles para ver la foto limpia.
          onSingleTap={() => setMostrarControles((v) => !v)}
        />

        {mostrarControles && (
          <View
            pointerEvents="box-none"
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            {varias ? (
              <View className="bg-black/60 rounded-full px-3 py-1.5">
                <Text className="text-[13px] font-bold text-white">
                  {currentIndex + 1} / {totalCount || photos.length}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-black/60 items-center justify-center"
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar visor"
            >
              <Icon name="close" size={20} color={colors.textWhite} />
            </TouchableOpacity>
          </View>
        )}

        {mostrarControles && varias && (
          <View className="absolute left-0 right-0" style={{ bottom: insets.bottom + 12 }}>
            <ScrollView
              ref={tiraRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {photos.map((uri, i) => {
                const activa = i === currentIndex;
                return (
                  <TouchableOpacity
                    key={uri + i}
                    onPress={() => goToIndex(i)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver foto ${i + 1} de ${photos.length}`}
                  >
                    <Image
                      source={{ uri }}
                      className={`w-11 h-11 rounded-[10px] ${activa ? "opacity-100 border-2 border-accent" : "opacity-50"}`}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const PhotoViewerContext = createContext(null);

/**
 * Se monta UNA vez cerca de la raíz de cada app. Cualquier pantalla abre el
 * visor con `usePhotoViewer()`; el visor se cierra solo si la pantalla que lo
 * abrió se desmonta (se navega a otra).
 */
export function PhotoViewerProvider({ children }) {
  const [visor, setVisor] = useState(null); // { photos, initialIndex, dueno } | null

  const abrir = useCallback((photos, initialIndex = 0, dueno = null) => {
    if (!photos?.length) return;
    setVisor({ photos, initialIndex, dueno });
  }, []);

  const cerrar = useCallback(() => setVisor(null), []);

  const cerrarSiEsDe = useCallback(
    (dueno) => setVisor((actual) => (actual && actual.dueno === dueno ? null : actual)),
    []
  );

  const valor = useMemo(() => ({ abrir, cerrarSiEsDe }), [abrir, cerrarSiEsDe]);

  return (
    <PhotoViewerContext.Provider value={valor}>
      <View className="flex-1">
        {children}
        {visor && (
          <PhotoViewerModal photos={visor.photos} initialIndex={visor.initialIndex} onClose={cerrar} />
        )}
      </View>
    </PhotoViewerContext.Provider>
  );
}

/**
 * Devuelve `abrirVisor(fotos, indiceInicial?)`. Requiere `<PhotoViewerProvider>` en la raíz.
 */
export function usePhotoViewer() {
  const ctx = useContext(PhotoViewerContext);
  if (!ctx) {
    throw new Error("usePhotoViewer() debe usarse dentro de <PhotoViewerProvider>");
  }
  const { abrir, cerrarSiEsDe } = ctx;
  const identidad = useRef({}).current;
  useEffect(() => () => cerrarSiEsDe(identidad), [cerrarSiEsDe, identidad]);
  return useCallback((photos, initialIndex = 0) => abrir(photos, initialIndex, identidad), [abrir, identidad]);
}
