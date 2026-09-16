import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { colors } from "@rentacar/mobile-shared";

/**
 * Dibujo de referencia del encuadre de cada foto del auto. La idea es que
 * todas las fichas se vean parejas: el dueño copia el encuadre del ejemplo
 * antes de disparar la cámara. Las claves calzan con `FOTOS_AUTO`.
 */

const TRAZOS = {
  frontal: (c) => (
    <>
      <Path d="M12 42V24c0-4 3-7 7-8l4-8h26l4 8c4 1 7 4 7 8v18" stroke={c} />
      <Circle cx="20" cy="30" r="3.5" stroke={c} />
      <Circle cx="52" cy="30" r="3.5" stroke={c} />
      <Path d="M28 34h16" stroke={c} />
      <Path d="M8 42h56" stroke={c} />
    </>
  ),
  trasera: (c) => (
    <>
      <Path d="M12 42V24c0-4 3-7 7-8l4-8h26l4 8c4 1 7 4 7 8v18" stroke={c} />
      <Rect x="16" y="27" width="9" height="6" rx="1.5" stroke={c} />
      <Rect x="47" y="27" width="9" height="6" rx="1.5" stroke={c} />
      <Path d="M36 16v20" stroke={c} />
      <Path d="M8 42h56" stroke={c} />
    </>
  ),
  lateral_izquierdo: (c) => TRAZOS.lateral(c),
  lateral_derecho: (c) => TRAZOS.lateral(c),
  lateral: (c) => (
    <>
      <Path d="M6 40h60" stroke={c} />
      <Path d="M10 40c0-6 2-9 8-10l6-9h20l10 9c5 1 8 4 8 10" stroke={c} />
      <Circle cx="21" cy="40" r="5" stroke={c} />
      <Circle cx="50" cy="40" r="5" stroke={c} />
      <Path d="M22 21h13l7 9H24z" stroke={c} />
    </>
  ),
  interior_delantero: (c) => (
    <>
      <Circle cx="20" cy="28" r="8" stroke={c} />
      <Path d="M20 20v16M12 28h16" stroke={c} />
      <Rect x="34" y="16" width="12" height="26" rx="3" stroke={c} />
      <Rect x="50" y="18" width="10" height="24" rx="3" stroke={c} />
    </>
  ),
  interior_trasero: (c) => (
    <>
      <Rect x="12" y="24" width="48" height="20" rx="3" stroke={c} />
      <Rect x="16" y="14" width="10" height="10" rx="3" stroke={c} />
      <Rect x="31" y="14" width="10" height="10" rx="3" stroke={c} />
      <Rect x="46" y="14" width="10" height="10" rx="3" stroke={c} />
    </>
  ),
  maletero: (c) => (
    <>
      <Path d="M14 44V30c0-4 3-7 7-8h30c4 1 7 4 7 8v14" stroke={c} />
      <Path d="M22 22l-6-12h34" stroke={c} />
      <Rect x="20" y="30" width="32" height="12" rx="2" stroke={c} strokeDasharray="3 3" />
    </>
  ),
  tablero: (c) => (
    <>
      <Rect x="8" y="16" width="56" height="24" rx="4" stroke={c} />
      <Circle cx="24" cy="28" r="7" stroke={c} />
      <Circle cx="48" cy="28" r="7" stroke={c} />
      <Path d="M24 28l4-3M48 28l-4-3" stroke={c} />
    </>
  ),
  limpieza: (c) => (
    <>
      <Path d="M18 40V22c0-4 2-6 6-6h6c4 0 6 2 6 6v18" stroke={c} />
      <Rect x="14" y="40" width="30" height="4" rx="1" stroke={c} />
      <Rect x="46" y="30" width="14" height="12" rx="1" stroke={c} />
      <Path d="M48 33h10M48 36h10M48 39h10" stroke={c} />
    </>
  ),
};

export function EncuadreAuto({ tipo, size = 44, color = colors.primary }) {
  const dibujar = TRAZOS[tipo] || TRAZOS.lateral;
  return (
    <Svg
      width={size}
      height={size * (52 / 72)}
      viewBox="0 0 72 52"
      fill="none"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dibujar(color)}
    </Svg>
  );
}
