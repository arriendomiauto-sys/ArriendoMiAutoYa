import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { colors } from "../theme/colors";

/**
 * Componente Icon Oficial - Arriendo Mi Auto Ya
 * Renderiza íconos vectoriales SVG reales con trazo nítido y dimensiones exactas.
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

  const renderSvg = (content, customViewBox = "0 0 24 24") => {
    if (Platform.OS === "web") {
      return (
        <svg
          width={s}
          height={s}
          viewBox={customViewBox}
          fill={fill === "currentColor" ? color : fill}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        >
          {content}
        </svg>
      );
    }

    return (
      <View
        style={[
          { width: s, height: s, alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        <svg
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
        </svg>
      </View>
    );
  };

  switch (name) {
    case "search":
      return renderSvg(
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </>
      );

    case "car":
    case "auto":
      return renderSvg(
        <>
          <path d="M3 14h18v-3a2 2 0 0 0-2-2h-1l-2-3H8L6 9H5a2 2 0 0 0-2 2z" />
          <circle cx="7.5" cy="16.5" r="1.8" fill={color} />
          <circle cx="16.5" cy="16.5" r="1.8" fill={color} />
        </>
      );

    case "key":
    case "llave":
      return renderSvg(
        <>
          <circle cx="7" cy="12" r="4" />
          <path d="M11 12h10" />
          <path d="M17 12v3" />
        </>
      );

    case "calendar":
    case "calendario":
      return renderSvg(
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="3" />
          <path d="M3.5 10h17" />
          <path d="M8 3v3" />
          <path d="M16 3v3" />
        </>
      );

    case "camera":
    case "camara":
      return renderSvg(
        <>
          <rect x="3" y="7" width="18" height="13" rx="3" />
          <circle cx="12" cy="13.5" r="3.6" />
          <path d="M9 7l1.5-2.5h3L15 7" />
        </>
      );

    case "shield":
    case "escudo":
      return renderSvg(
        <>
          <path d="M12 3l7 2.5v6c0 5-7 9.5-7 9.5s-7-4.5-7-9.5v-6z" />
          <path d="M9 12l2 2 4-4" />
        </>
      );

    case "star":
    case "estrella":
      return renderSvg(
        <path
          d="M12 3.5l2.7 5.6 6 .8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.9l6-.8z"
          fill={fill !== "none" ? fill : color}
        />
      );

    case "star-outline":
      return renderSvg(
        <path
          d="M12 3.5l2.7 5.6 6 .8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.9l6-.8z"
          fill="none"
        />
      );

    case "chat":
    case "message":
    case "mensaje":
      return renderSvg(
        <>
          <rect x="3" y="5" width="18" height="12" rx="3.5" />
          <path d="M8 17l-1 3.5L11.5 17" />
        </>
      );

    case "location":
    case "pin":
    case "ubicacion":
      return renderSvg(
        <>
          <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </>
      );

    case "card":
    case "wallet":
    case "tarjeta":
      return renderSvg(
        <>
          <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
          <path d="M2.5 10h19" />
          <path d="M6 14.5h4" />
        </>
      );

    case "document":
    case "contract":
    case "documento":
      return renderSvg(
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </>
      );

    case "user":
    case "profile":
    case "usuario":
      return renderSvg(
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </>
      );

    case "combustible":
    case "gas":
    case "fuel":
      return renderSvg(
        <>
          <rect x="5" y="3.5" width="9" height="17" rx="2.5" />
          <path d="M5 9h9" />
          <path d="M14 8h3a2 2 0 0 1 2 2v6.5a1.8 1.8 0 1 1-3.6 0V13H14" />
        </>
      );

    case "kilometraje":
    case "speedometer":
    case "odometer":
      return renderSvg(
        <>
          <path d="M4 17a8 8 0 1 1 16 0" />
          <path d="M12 17l4-4.5" />
        </>
      );

    case "maletero":
    case "trunk":
      return renderSvg(
        <>
          <path d="M3.5 18v-4a3 3 0 0 1 1.4-2.5l5-3.2a3 3 0 0 1 3.2 0l5 3.2A3 3 0 0 1 19.5 14v4z" />
          <path d="M3.5 15.5h16" />
        </>
      );

    case "dollar":
    case "earnings":
    case "ganancias":
      return renderSvg(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M14.5 9.5a2.5 2.5 0 0 0-5 0c0 3 5 2 5 5a2.5 2.5 0 0 1-5 0" />
        </>
      );

    case "bell":
    case "notificaciones":
      return renderSvg(
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      );

    case "history":
    case "receipt":
    case "historial":
      return renderSvg(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </>
      );

    case "check":
      return renderSvg(
        <path d="M5 13l4 4L19 7" strokeWidth={strokeWidth >= 2 ? strokeWidth : 2.2} />
      );

    case "close":
    case "x":
      return renderSvg(<path d="M18 6L6 18M6 6l12 12" />);

    case "arrow-right":
      return renderSvg(
        <>
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </>
      );

    case "arrow-left":
      return renderSvg(
        <>
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </>
      );

    case "chevron-right":
      return renderSvg(<path d="M9 18l6-6-6-6" />);

    case "chevron-left":
      return renderSvg(<path d="M15 18l-6-6 6-6" />);

    case "chevron-down":
      return renderSvg(<path d="M6 9l6 6 6-6" />);

    case "chevron-up":
      return renderSvg(<path d="M18 15l-6-6-6 6" />);

    case "gear":
    case "settings":
      return renderSvg(
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      );

    case "alert":
    case "warning":
      return renderSvg(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeWidth={2} />
        </>
      );

    case "support":
    case "help":
      return renderSvg(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" strokeWidth={2} />
        </>
      );

    case "phone":
      return renderSvg(
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      );

    case "trash":
    case "delete":
      return renderSvg(
        <>
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      );

    case "plus":
    case "add":
      return renderSvg(<path d="M12 5v14M5 12h14" strokeWidth={2} />);

    case "filter":
      return renderSvg(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);

    default:
      return renderSvg(<circle cx="12" cy="12" r="4" fill={color} />);
  }
}
