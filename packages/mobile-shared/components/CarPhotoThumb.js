import React, { useState } from "react";
import { View, Image } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";

/**
 * Miniatura de auto reutilizable: skeleton mientras carga la foto remota,
 * la foto real una vez lista, o un ícono de auto sobre fondo de color si no
 * hay foto o si la URL falla al cargar. Antes cada pantalla (marketplace,
 * historial, detalle, pago, mapa...) repetía esta misma lógica -- o, en la
 * mayoría de los casos, no la tenía: una foto caída se veía como el ícono de
 * imagen rota por defecto de React Native en vez de degradar con gracia.
 *
 * `className`/`style` definen el tamaño (ancho/alto/radio); el componente no
 * impone ninguno propio.
 */
export function CarPhotoThumb({ uri, className, style, resizeMode = "cover", iconSize = 22 }) {
  const [cargando, setCargando] = useState(!!uri);
  const [error, setError] = useState(false);

  if (!uri || error) {
    return (
      <View className={`items-center justify-center bg-teal-50 ${className || ""}`} style={style}>
        <Icon name="car" size={iconSize} color={colors.primary300} />
      </View>
    );
  }

  return (
    <View className={`overflow-hidden bg-teal-50 ${className || ""}`} style={style}>
      {/* Mismo truco que ya usaban CarCard/MyCarsScreen: el contenedor recorta
          (overflow-hidden) y, mientras carga, el Skeleton (arriba, w-full
          h-full) empuja al Image recién montado fuera del área visible -- sin
          necesitar posicionamiento absoluto. */}
      {cargando && <Skeleton className="w-full h-full" />}
      <Image
        source={{ uri }}
        className="w-full h-full"
        resizeMode={resizeMode}
        onLoadEnd={() => setCargando(false)}
        onError={() => {
          setCargando(false);
          setError(true);
        }}
      />
    </View>
  );
}
