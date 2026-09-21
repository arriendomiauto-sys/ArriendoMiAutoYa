import React, { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { useApp } from "../context/AppContext";
import { SplashScreen } from "../auth/screens/SplashScreen";
import { SinConexionScreen } from "../auth/screens/SinConexionScreen";

// La carga se ve al menos este tiempo, aunque la sesión responda al instante:
// una pantalla que aparece y desaparece en un parpadeo parece un fallo.
const MINIMO_CARGA_MS = 900;
const FUNDIDO_MS = 200;

/**
 * Puerta de arranque de la app. Mientras se revisa la sesión guardada muestra la
 * pantalla de carga; si la revisión no pudo completarse por la red, "Sin
 * conexión" con Reintentar (no se manda al login: la sesión puede existir);
 * y cuando ya se sabe, deja pasar a `children` con un fundido corto.
 */
export function ArranqueGate({ variante = "renter", logoSource, logoZoom, children }) {
  const { authLoading, sesionEstado, reintentarSesion } = useApp();
  const [minimoCumplido, setMinimoCumplido] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMinimoCumplido(true), MINIMO_CARGA_MS);
    return () => clearTimeout(id);
  }, []);

  if (sesionEstado === "sin_conexion") {
    return <SinConexionScreen onReintentar={reintentarSesion} />;
  }

  if (authLoading || !minimoCumplido) {
    return <SplashScreen variante={variante} logoSource={logoSource} logoZoom={logoZoom} />;
  }

  return <Fundido>{children}</Fundido>;
}

// Entra con un fundido de 200 ms: la carga no se corta en seco contra la
// pantalla siguiente (login o la app).
function Fundido({ children }) {
  const opacidad = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacidad, { toValue: 1, duration: FUNDIDO_MS, useNativeDriver: true }).start();
  }, [opacidad]);
  return <Animated.View style={{ flex: 1, opacity: opacidad }}>{children}</Animated.View>;
}
