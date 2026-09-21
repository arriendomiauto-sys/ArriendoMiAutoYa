import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Chip } from "../../components/ui";
import { AlertaInline } from "../../components/AlertaInline";
import { CuerpoDocumentoLegal } from "../../screens/LegalModal";
import { DOCUMENTOS_LEGALES } from "../../legal/documentos";

/**
 * Paso "Términos" del registro: una pantalla aparte para leer los términos y
 * condiciones y la política de privacidad, con el botón de aceptar siempre a la
 * vista abajo. El botón lo pone cada app (`children`) para respetar su estilo;
 * tocarlo es aceptar los dos documentos, y por eso su rótulo lo dice.
 */
export function PasoTerminos({ error, children }) {
  const [activo, setActivo] = useState("terminos");
  const documento = DOCUMENTOS_LEGALES[activo] || DOCUMENTOS_LEGALES.terminos;

  return (
    <View className="flex-1 gap-3">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-textDark" style={{ letterSpacing: -0.5 }}>
          Términos y condiciones
        </Text>
        <Text className="text-[13px] leading-[18px] text-textMuted">
          Léelos antes de crear tu cuenta. Al continuar aceptas los términos de uso y la política de privacidad.
        </Text>
      </View>

      <View className="flex-row gap-2">
        {Object.values(DOCUMENTOS_LEGALES).map((d) => (
          <Chip key={d.id} label={d.tab || d.titulo} selected={activo === d.id} onPress={() => setActivo(d.id)} />
        ))}
      </View>

      <View className="flex-1 rounded-2xl border border-gray-200 bg-surface overflow-hidden">
        <ScrollView
          testID="documento-legal"
          contentContainerStyle={{ padding: 16, gap: 16 }}
          showsVerticalScrollIndicator
        >
          <Text className="text-lg font-bold text-textDark">{documento.titulo}</Text>
          <CuerpoDocumentoLegal documento={documento} />
        </ScrollView>
      </View>

      {error ? <AlertaInline testID="aviso-registro" titulo={error.titulo} mensaje={error.mensaje} /> : null}

      {children}
    </View>
  );
}
