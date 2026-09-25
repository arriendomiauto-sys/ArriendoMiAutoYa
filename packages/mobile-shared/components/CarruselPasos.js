import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, FlatList, TouchableOpacity, useWindowDimensions } from "react-native";
import { theme } from "../theme/tokens";

/**
 * Carrusel de páginas a lo ancho que se desliza con el dedo. Antes el
 * onboarding cambiaba de pantalla solo con el botón "Continuar": deslizar no
 * hacía nada, que es lo primero que la gente intenta en una presentación.
 *
 * El índice lo guarda el padre (`indice` + `onCambiarIndice`) para que sus
 * propios controles -- botón, puntos -- sepan en qué página está. Para mover
 * el carrusel desde afuera se usa `ref.current.irA(i)`.
 *
 * `autoAvanceMs` lo hace avanzar solo y volver al inicio al llegar al final;
 * se pausa mientras la persona lo está arrastrando.
 */
export const CarruselPasos = forwardRef(function CarruselPasos(
  { items, renderItem, indice, onCambiarIndice, autoAvanceMs, keyExtractor, style },
  ref
) {
  const { width: anchoVentana } = useWindowDimensions();
  // Se mide el contenedor (no la ventana) para que cada página ocupe
  // exactamente el hueco disponible, con o sin márgenes alrededor.
  const [medida, setMedida] = useState({ ancho: anchoVentana, alto: 0 });
  const listaRef = useRef(null);
  const arrastrando = useRef(false);

  const irA = useCallback(
    (i, animado = true) => {
      const destino = Math.max(0, Math.min(items.length - 1, i));
      onCambiarIndice?.(destino);
      try {
        listaRef.current?.scrollToIndex({ index: destino, animated: animado });
      } catch {
        // Lista todavía sin medir: el índice ya quedó en el padre.
      }
    },
    [items.length, onCambiarIndice]
  );

  useImperativeHandle(ref, () => ({ irA }), [irA]);

  useEffect(() => {
    if (!autoAvanceMs || items.length < 2) return undefined;
    const id = setInterval(() => {
      if (arrastrando.current) return;
      irA(indice >= items.length - 1 ? 0 : indice + 1);
    }, autoAvanceMs);
    return () => clearInterval(id);
  }, [autoAvanceMs, indice, items.length, irA]);

  const alTerminarDeslizar = (e) => {
    arrastrando.current = false;
    if (!medida.ancho) return;
    const nuevo = Math.round(e.nativeEvent.contentOffset.x / medida.ancho);
    if (nuevo !== indice) onCambiarIndice?.(nuevo);
  };

  return (
    <View
      style={[{ flex: 1 }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== medida.ancho || height !== medida.alto) setMedida({ ancho: width, alto: height });
      }}
    >
      <FlatList
        ref={listaRef}
        data={items}
        keyExtractor={keyExtractor || ((item, i) => String(item?.id ?? i))}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={indice || 0}
        getItemLayout={(_, i) => ({ length: medida.ancho, offset: medida.ancho * i, index: i })}
        onScrollBeginDrag={() => {
          arrastrando.current = true;
        }}
        onMomentumScrollEnd={alTerminarDeslizar}
        renderItem={({ item, index }) => (
          <View style={{ width: medida.ancho, height: medida.alto || undefined }}>
            {renderItem({ item, index, activo: index === indice })}
          </View>
        )}
      />
    </View>
  );
});

/** Puntos de avance; cada uno lleva a su página al tocarlo. */
export function PuntosPaso({ total, actual, onElegir, className = "" }) {
  return (
    <View className={`flex-row justify-center items-center gap-1.5 ${className}`}>
      {Array.from({ length: total }, (_, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={onElegir ? () => onElegir(idx) : undefined}
          disabled={!onElegir}
          hitSlop={theme.control.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Ir al paso ${idx + 1} de ${total}`}
          accessibilityState={{ selected: idx === actual }}
        >
          <View
            className={`h-1.5 rounded-full ${idx === actual ? "w-6 bg-primary-700" : "w-1.5 bg-primary-200"}`}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}
