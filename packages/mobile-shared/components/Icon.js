import React from "react";
import { View, Image } from "react-native";
import Svg, { Circle, Path, Rect, Polygon } from "react-native-svg";
import { colors } from "../theme/colors";

/**
 * Componente Icon Oficial - Arriendo Mi Auto Ya
 * Renderiza íconos vectoriales SVG reales con trazo nítido y dimensiones exactas.
 *
 * Usa react-native-svg (bundleado en Expo Go), que también funciona en web vía
 * react-native-web. Antes se renderizaban tags DOM en minúscula (<svg>/<circle>)
 * que en nativo revientan con "View config getter callback for component
 * 'circle' must be a function".
 */
export function Icon({
  name,
  size = 20,
  color = colors.primary,
  fill = "none",
  strokeWidth = 1.6,
  style,
}) {
  const s = size;

  const renderSvg = (content, customViewBox = "0 0 24 24") => (
    <View
      style={[
        { width: s, height: s, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Svg
        width={s}
        height={s}
        viewBox={customViewBox}
        fill={fill === "currentColor" ? color : fill}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </Svg>
    </View>
  );

  switch (name) {
    case "logo":
    case "brand":
      return (
        <Image
          source={require("../assets/logo.png")}
          style={[
            {
              width: s,
              height: s,
              borderRadius: Math.round(s * 0.22),
            },
            style,
          ]}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Logo oficial Arriendo Mi Auto Ya"
        />
      );

    case "search":
      return renderSvg(
        <>
          <Circle cx="11" cy="11" r="7" />
          <Path d="M21 21l-4.35-4.35" />
        </>
      );

    case "car":
    case "auto":
      return renderSvg(
        <>
          <Path d="M3 14h18v-3a2 2 0 0 0-2-2h-1l-2-3H8L6 9H5a2 2 0 0 0-2 2z" />
          <Circle cx="7.5" cy="16.5" r="1.8" fill={color} />
          <Circle cx="16.5" cy="16.5" r="1.8" fill={color} />
        </>
      );

    case "key":
    case "llave":
      return renderSvg(
        <>
          <Circle cx="7" cy="12" r="4" />
          <Path d="M11 12h10" />
          <Path d="M17 12v3" />
        </>
      );

    case "calendar":
    case "calendario":
      return renderSvg(
        <>
          <Rect x="3.5" y="5" width="17" height="15" rx="3" />
          <Path d="M3.5 10h17" />
          <Path d="M8 3v3" />
          <Path d="M16 3v3" />
        </>
      );

    case "camera":
    case "camara":
      return renderSvg(
        <>
          <Rect x="3" y="7" width="18" height="13" rx="3" />
          <Circle cx="12" cy="13.5" r="3.6" />
          <Path d="M9 7l1.5-2.5h3L15 7" />
        </>
      );

    case "shield":
    case "escudo":
      return renderSvg(
        <>
          <Path d="M12 3l7 2.5v6c0 5-7 9.5-7 9.5s-7-4.5-7-9.5v-6z" />
          <Path d="M9 12l2 2 4-4" />
        </>
      );

    case "star":
    case "estrella":
      return renderSvg(
        <Path
          d="M12 3.5l2.7 5.6 6 .8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.9l6-.8z"
          fill={fill !== "none" ? fill : color}
        />
      );

    case "star-outline":
      return renderSvg(
        <Path
          d="M12 3.5l2.7 5.6 6 .8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.9l6-.8z"
          fill="none"
        />
      );

    case "chat":
    case "message":
    case "mensaje":
      return renderSvg(
        <>
          <Rect x="3" y="5" width="18" height="12" rx="3.5" />
          <Path d="M8 17l-1 3.5L11.5 17" />
        </>
      );

    case "location":
    case "pin":
    case "ubicacion":
      return renderSvg(
        <>
          <Path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" />
          <Circle cx="12" cy="10" r="2.6" />
        </>
      );

    case "card":
    case "wallet":
    case "tarjeta":
      return renderSvg(
        <>
          <Rect x="2.5" y="5.5" width="19" height="13" rx="3" />
          <Path d="M2.5 10h19" />
          <Path d="M6 14.5h4" />
        </>
      );

    case "document":
    case "contract":
    case "documento":
      return renderSvg(
        <>
          <Path d="M6 3h8l4 4v14H6z" />
          <Path d="M9 12h6" />
          <Path d="M9 16h4" />
        </>
      );

    case "user":
    case "profile":
    case "usuario":
      return renderSvg(
        <>
          <Circle cx="12" cy="8" r="4" />
          <Path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </>
      );

    case "combustible":
    case "gas":
    case "fuel":
      return renderSvg(
        <>
          <Rect x="5" y="3.5" width="9" height="17" rx="2.5" />
          <Path d="M5 9h9" />
          <Path d="M14 8h3a2 2 0 0 1 2 2v6.5a1.8 1.8 0 1 1-3.6 0V13H14" />
        </>
      );

    case "kilometraje":
    case "speedometer":
    case "odometer":
      return renderSvg(
        <>
          <Path d="M4 17a8 8 0 1 1 16 0" />
          <Path d="M12 17l4-4.5" />
        </>
      );

    case "maletero":
    case "trunk":
      return renderSvg(
        <>
          <Path d="M3.5 18v-4a3 3 0 0 1 1.4-2.5l5-3.2a3 3 0 0 1 3.2 0l5 3.2A3 3 0 0 1 19.5 14v4z" />
          <Path d="M3.5 15.5h16" />
        </>
      );

    case "dollar":
    case "earnings":
    case "ganancias":
      return renderSvg(
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v10M14.5 9.5a2.5 2.5 0 0 0-5 0c0 3 5 2 5 5a2.5 2.5 0 0 1-5 0" />
        </>
      );

    case "bell":
    case "notificaciones":
      return renderSvg(
        <>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      );

    case "history":
    case "receipt":
    case "historial":
    // Tres pantallas pedían "clock" y caían al círculo genérico del default;
    // este mismo dibujo (esfera con manecillas) es exactamente un reloj.
    case "clock":
      return renderSvg(
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 6v6l4 2" />
        </>
      );

    case "check":
      return renderSvg(
        <Path d="M5 13l4 4L19 7" strokeWidth={strokeWidth >= 2 ? strokeWidth : 2.2} />
      );

    case "close":
    case "x":
      return renderSvg(<Path d="M18 6L6 18M6 6l12 12" />);

    case "arrow-right":
      return renderSvg(
        <>
          <Path d="M5 12h14" />
          <Path d="M13 6l6 6-6 6" />
        </>
      );

    case "arrow-left":
      return renderSvg(
        <>
          <Path d="M19 12H5" />
          <Path d="M11 18l-6-6 6-6" />
        </>
      );

    case "chevron-right":
      return renderSvg(<Path d="M9 18l6-6-6-6" />);

    case "chevron-left":
      return renderSvg(<Path d="M15 18l-6-6 6-6" />);

    case "chevron-down":
      return renderSvg(<Path d="M6 9l6 6 6-6" />);

    case "chevron-up":
      return renderSvg(<Path d="M18 15l-6-6-6 6" />);

    case "gear":
    case "settings":
      return renderSvg(
        <>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      );

    case "alert":
    case "warning":
      return renderSvg(
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 8v4M12 16h.01" strokeWidth={2} />
        </>
      );

    case "support":
    case "help":
      return renderSvg(
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" strokeWidth={2} />
        </>
      );

    case "phone":
      return renderSvg(
        <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      );

    case "trash":
    case "delete":
      return renderSvg(
        <>
          <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      );

    case "plus":
    case "add":
      return renderSvg(<Path d="M12 5v14M5 12h14" strokeWidth={2} />);

    case "filter":
      return renderSvg(<Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);

    case "heart":
    case "favorito":
      return renderSvg(
        <Path
          d="M12 20.5s-7.5-4.6-10-9.3C.5 7.7 2.6 4.3 6 4.3c2 0 3.5 1 6 3.4 2.5-2.4 4-3.4 6-3.4 3.4 0 5.5 3.4 4 6.9-2.5 4.7-10 9.3-10 9.3z"
          fill={fill !== "none" ? fill : "none"}
        />
      );

    case "share":
    case "compartir":
      return renderSvg(
        <>
          <Circle cx="18" cy="5" r="2.6" />
          <Circle cx="6" cy="12" r="2.6" />
          <Circle cx="18" cy="19" r="2.6" />
          <Path d="M8.3 10.7l7.4-4.2M8.3 13.3l7.4 4.2" />
        </>
      );

    case "pencil":
    case "edit":
      return renderSvg(<Path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />);

    default:
      return renderSvg(<Circle cx="12" cy="12" r="4" fill={color} />);
  }
}
