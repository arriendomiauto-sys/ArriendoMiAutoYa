import React, { useState } from "react";
import { View, Text, StatusBar, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Button, Card, ScreenHeader, Badge } from "../components/ui";
import { ApiClient } from "../api/client";
import { elegirPdf } from "../utils/documentoPdf";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

const URL_REGISTRO_CIVIL = "https://www.registrocivil.cl";

const BADGE = {
  revision: { variant: "warning", label: "En revisión" },
  aprobado: { variant: "success", label: "Aprobado" },
  rechazado: { variant: "danger", label: "Rechazado" },
};

/**
 * El dueño sube el Certificado de anotaciones vigentes de su auto (Registro Civil): muestra la
 * patente, el titular y si hay prohibiciones o embargos. Un ejecutivo confirma su código de
 * verificación y consulta el encargo por robo; recién ahí el auto queda verificado.
 */
export function CertificadoAutoScreen({ auto, onBack }) {
  const insets = useSafeAreaInsets();
  const yaValidado = Boolean(
    auto?.documentos_verificados || auto?.anotaciones_aprobadas_en || auto?.estado_anotaciones === "aprobado"
  );
  const [consiente, setConsiente] = useState(yaValidado);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState(
    yaValidado ? { estado: "aprobado", motivo: "Certificado revisado y aprobado exitosamente." } : null
  );

  const estaAprobado = yaValidado || resultado?.estado === "aprobado";

  const subir = async () => {
    if (estaAprobado || !consiente || subiendo) return;
    try {
      const pdf = await elegirPdf();
      if (pdf.cancelado) return;
      setSubiendo(true);
      setResultado(
        await ApiClient.subirCertificadoAnotaciones(auto.id, {
          archivo: { uri: pdf.uri, name: pdf.name },
          consentimiento: true,
        })
      );
    } catch (e) {
      showAlert("No se pudo subir", msjError(e, "Inténtalo de nuevo."));
    } finally {
      setSubiendo(false);
    }
  };

  const badge = resultado ? BADGE[resultado.estado] || BADGE.revision : null;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Verificar mi auto" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xl font-extrabold text-text">
          {auto.marca} {auto.modelo}
        </Text>
        <Text className="text-sm font-bold text-textMuted -mt-2">{auto.patente}</Text>

        {estaAprobado ? (
          <Card padded className="bg-emerald-50 border border-emerald-200 gap-2">
            <View className="flex-row items-center gap-2">
              <Icon name="check" size={20} color={colors.accentDark} />
              <Text className="text-[15px] font-bold text-accent-dark flex-1">Documento validado y aprobado</Text>
            </View>
            <Text className="text-[13px] text-emerald-800 leading-[18px]">
              Este vehículo ya cuenta con su verificación aprobada. La opción para volver a subir o modificar este certificado ha quedado invalidada.
            </Text>
          </Card>
        ) : (
          <>
            <Text className="text-sm text-text leading-5">
              Para ofrecer tu auto necesitamos el Certificado de anotaciones vigentes del Registro Civil: muestra que la patente
              es tuya y que no tiene prohibiciones ni embargos. Se descarga en registrocivil.cl con tu ClaveÚnica.
            </Text>
            <Button
              label="Abrir registrocivil.cl"
              variant="secondary"
              fullWidth={false}
              className="self-start"
              onPress={() => Linking.openURL(URL_REGISTRO_CIVIL)}
            />

            <TouchableOpacity
              className="flex-row items-start gap-3"
              onPress={() => {
                if (!estaAprobado) setConsiente((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consiente }}
              activeOpacity={estaAprobado ? 1 : 0.8}
              disabled={estaAprobado}
            >
              <View className={`w-[22px] h-[22px] rounded-md border-[1.5px] border-primary items-center justify-center mt-0.5 ${consiente ? "bg-primary" : ""}`}>
                {consiente ? <Icon name="check" size={14} color={colors.textWhite} /> : null}
              </View>
              <Text className="flex-1 text-[12.5px] text-textMuted leading-[18px]">
                Autorizo a Arrienda Tu Auto a revisar este certificado. Solo lo ve un ejecutivo y se elimina del sistema una vez
                resuelto.
              </Text>
            </TouchableOpacity>
          </>
        )}

        <Button
          label={estaAprobado ? "Certificado ya validado" : "Subir certificado"}
          onPress={subir}
          loading={subiendo}
          disabled={estaAprobado || !consiente}
          variant={estaAprobado ? "secondary" : "primary"}
        />

        {resultado && !yaValidado ? (
          <Card padded className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-[15px] font-bold text-text">Certificado de anotaciones</Text>
              <Badge variant={badge.variant} label={badge.label} />
            </View>
            {resultado.motivo ? <Text className="text-[12.5px] text-text leading-[18px]">{resultado.motivo}</Text> : null}
            {resultado.estado === "revision" ? (
              <Text className="text-[12.5px] text-textMuted leading-[18px]">
                Un ejecutivo lo revisa y consulta el encargo por robo de la patente. Te avisamos cuando tu auto quede
                verificado.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
