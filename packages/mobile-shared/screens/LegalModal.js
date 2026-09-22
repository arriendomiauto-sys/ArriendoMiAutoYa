import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Chip } from "../components/ui";
import { DOCUMENTOS_LEGALES } from "../legal/documentos";
import { showAlert } from "../utils/alert";

/**
 * Texto de un documento legal: fecha de actualización, secciones y enlace a la
 * versión completa del sitio. Lo usa el visor modal y el paso "Términos" del
 * registro, para que se lea igual en los dos.
 */
export function CuerpoDocumentoLegal({ documento }) {
  const abrirEnElSitio = async () => {
    try {
      await WebBrowser.openBrowserAsync(documento.url);
    } catch {
      showAlert("No se pudo abrir el navegador", `Puedes leerlo en ${documento.url}`);
    }
  };

  return (
    <>
      <Text className="text-xs text-textMuted italic">{documento.actualizado}</Text>

      {documento.secciones.map((s) => (
        <View key={s.h} className="gap-1.5">
          <Text className="text-[15px] font-bold text-text">{s.h}</Text>
          {s.p ? <Text className="text-sm text-textSecondary leading-[21px]">{s.p}</Text> : null}
          {(s.items || []).map((item) => (
            <View key={item} className="flex-row gap-2 pl-1">
              <Text className="text-sm text-accent-dark leading-[21px]">•</Text>
              <Text className="flex-1 text-sm text-textSecondary leading-[21px]">{item}</Text>
            </View>
          ))}
        </View>
      ))}

      <TouchableOpacity className="flex-row items-center gap-2 py-2" onPress={abrirEnElSitio} activeOpacity={0.8}>
        <Icon name="document" size={15} color={colors.accentDark} />
        <Text className="text-sm font-semibold text-accent-dark">Ver la versión completa en el sitio</Text>
      </TouchableOpacity>
    </>
  );
}

/**
 * Visor de los documentos legales (términos y política de privacidad) que se
 * aceptan al crear la cuenta. Se abre desde el registro para poder leerlos
 * ANTES de marcar la casilla; `onAccept` deja aceptar desde acá mismo.
 */
export function LegalModal({ visible, doc = "terminos", onClose, onAccept }) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const [activo, setActivo] = useState(doc);
  const [ultimoDoc, setUltimoDoc] = useState(doc);
  // Al reabrirlo desde otro link se muestra el documento que se pidió.
  if (visible && doc !== ultimoDoc) {
    setUltimoDoc(doc);
    setActivo(doc);
  }

  const documento = DOCUMENTOS_LEGALES[activo] || DOCUMENTOS_LEGALES.terminos;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-[#061e1f]/55 justify-end">
        <View
          className="max-h-[90%] bg-surface rounded-t-2xl p-5 gap-3"
          style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }}
        >
          <View className="self-center w-11 h-1 rounded-full bg-border" />

          <View className="flex-row items-start gap-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-text">{documento.titulo}</Text>
              <Text className="text-[13px] text-textMuted mt-0.5">{documento.subtitulo}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} accessibilityLabel="Cerrar">
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-2">
            {Object.values(DOCUMENTOS_LEGALES).map((d) => (
              <Chip
                key={d.id}
                label={d.tab || d.titulo}
                selected={activo === d.id}
                onPress={() => setActivo(d.id)}
              />
            ))}
          </View>

          <ScrollView className="grow-0" contentContainerStyle={{ gap: 20, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            <CuerpoDocumentoLegal documento={documento} />
          </ScrollView>

          <View className="flex-row gap-3 pt-3 border-t border-border">
            {onAccept ? (
              <>
                <Button label="Cerrar" variant="secondary" onPress={onClose} fullWidth={false} className="flex-1" />
                <Button
                  label="Acepto"
                  onPress={() => {
                    onAccept();
                    onClose?.();
                  }}
                  fullWidth={false}
                  className="flex-1"
                />
              </>
            ) : (
              <Button label="Cerrar" onPress={onClose} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
