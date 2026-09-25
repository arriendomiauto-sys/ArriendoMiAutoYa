import React, { useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Chip } from "../../components/ui";
import { AlertaInline } from "../../components/AlertaInline";
import { CuerpoDocumentoLegal } from "../../screens/LegalModal";
import { DOCUMENTOS_LEGALES } from "../../legal/documentos";

// Cuánto antes del final ya se da por leído (margen para el rebote del scroll).
const MARGEN_FINAL_PX = 24;

/**
 * Paso "Términos" del registro: una pantalla aparte para leer los términos y
 * condiciones y la política de privacidad, con el botón de aceptar siempre a la
 * vista abajo.
 *
 * Hay que leer los dos documentos hasta el final antes de poder aceptar: cada
 * uno se marca como leído cuando se desliza hasta abajo (o de inmediato si
 * cabe entero en pantalla). El botón lo pone cada app, como función:
 * `children({ puedeAceptar, faltan })`, para que lo habilite recién entonces.
 */
export function PasoTerminos({ error, children }) {
  const documentos = Object.values(DOCUMENTOS_LEGALES);
  const [activo, setActivo] = useState("terminos");
  const [leidos, setLeidos] = useState({});
  const alto = useRef({ vista: 0, contenido: 0 });
  const documento = DOCUMENTOS_LEGALES[activo] || DOCUMENTOS_LEGALES.terminos;

  const marcarLeido = () => setLeidos((l) => (l[activo] ? l : { ...l, [activo]: true }));
  const revisarSiCabe = () => {
    const { vista, contenido } = alto.current;
    if (vista > 0 && contenido > 0 && contenido <= vista + MARGEN_FINAL_PX) marcarLeido();
  };

  const faltan = documentos.filter((d) => !leidos[d.id]);
  const puedeAceptar = faltan.length === 0;

  return (
    <View className="flex-1 gap-3">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-textDark" style={{ letterSpacing: -0.5 }}>
          Términos y condiciones
        </Text>
        <Text className="text-[13px] leading-[18px] text-textMuted">
          Lee los dos documentos hasta el final. Al continuar aceptas los términos de uso y la política de privacidad.
        </Text>
      </View>

      <View className="flex-row gap-2">
        {documentos.map((d) => (
          <Chip
            key={d.id}
            label={`${leidos[d.id] ? "✓ " : ""}${d.tab || d.titulo}`}
            selected={activo === d.id}
            onPress={() => setActivo(d.id)}
          />
        ))}
      </View>

      <View className="flex-1 rounded-2xl border border-gray-200 bg-surface overflow-hidden">
        <ScrollView
          // Otra `key` por documento: al cambiar de pestaña parte desde arriba.
          key={activo}
          testID="documento-legal"
          contentContainerStyle={{ padding: 16, gap: 16 }}
          showsVerticalScrollIndicator
          scrollEventThrottle={100}
          onLayout={(e) => {
            alto.current.vista = e.nativeEvent.layout.height;
            revisarSiCabe();
          }}
          onContentSizeChange={(_, h) => {
            alto.current.contenido = h;
            revisarSiCabe();
          }}
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - MARGEN_FINAL_PX) marcarLeido();
          }}
        >
          <Text className="text-lg font-bold text-textDark">{documento.titulo}</Text>
          <CuerpoDocumentoLegal documento={documento} />
        </ScrollView>
      </View>

      {!puedeAceptar ? (
        <Text testID="aviso-leer-terminos" className="text-[12px] text-textMuted text-center">
          {leidos[activo]
            ? `Falta leer: ${faltan.map((d) => d.tab || d.titulo).join(" y ")}.`
            : "Desliza hasta el final del documento para poder aceptar."}
        </Text>
      ) : null}

      {error ? <AlertaInline testID="aviso-registro" titulo={error.titulo} mensaje={error.mensaje} /> : null}

      {typeof children === "function" ? children({ puedeAceptar, faltan }) : children}
    </View>
  );
}
