/**
 * NativeWind solo convierte `className` en `style` para los componentes que
 * conoce (los del core de React Native). A los nativos de terceros hay que
 * registrarlos con `cssInterop`; si no, su `className` se ignora EN SILENCIO y
 * el componente queda sin tamaño.
 *
 * Eso rompía, por ejemplo, el mapa del marketplace: `<MapView className="absolute
 * inset-0">` quedaba de 0×0 y la pantalla se veía vacía. Lo mismo afectaba a los
 * mapas de publicar auto / seguimiento GPS, a las cámaras (`CameraView`) y al
 * pad de firma (`Svg`).
 *
 * Se registra una sola vez, al cargar @rentacar/mobile-shared. Cada paquete se
 * carga con try/catch: si alguno no está instalado en la app, se omite.
 */
import { cssInterop } from "nativewind";

function registrar(cargar) {
  try {
    const componente = cargar();
    if (componente) cssInterop(componente, { className: "style" });
  } catch {
    // paquete no disponible en esta app / plataforma
  }
}

registrar(() => require("react-native-maps").default);
registrar(() => require("expo-camera").CameraView);
registrar(() => require("react-native-svg").default);
