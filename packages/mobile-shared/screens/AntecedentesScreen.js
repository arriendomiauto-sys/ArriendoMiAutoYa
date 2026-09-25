import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StatusBar, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Card, ScreenHeader, Badge } from "../components/ui";
import { ApiClient } from "../api/client";
import { elegirPdf } from "../utils/documentoPdf";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

const URL_REGISTRO_CIVIL = "https://www.registrocivil.cl";

const DOCUMENTOS = [
  {
    tipo: "antecedentes",
    titulo: "Certificado de antecedentes",
    ayuda: "Registro Civil → Certificados → Certificado de antecedentes (fines particulares).",
    boton: "Subir antecedentes",
  },
  {
    tipo: "hoja_vida",
    titulo: "Hoja de vida del conductor",
    ayuda: "Registro Civil → Vehículos → Certificado hoja de vida del conductor.",
    boton: "Subir hoja de vida",
  },
];

const BADGE = {
  sin_subir: { variant: "neutral", label: "Sin subir" },
  revision: { variant: "warning", label: "En revisión" },
  aprobado: { variant: "success", label: "Aprobado" },
  rechazado: { variant: "danger", label: "Rechazado" },
};

// Cómo conseguirlos, en el orden en que se hace.
const PASOS = [
  "Entra a registrocivil.cl con tu ClaveÚnica.",
  "Descarga gratis los dos certificados en PDF.",
  "Súbelos aquí abajo: los revisa un ejecutivo.",
];

const RESUMEN = {
  limpio: "Antecedentes aprobados",
  revision: "Estamos revisando tus certificados",
  pendiente: "Faltan certificados por subir",
  bloqueado: "Tu cuenta está en revisión: contacta a soporte",
};

/**
 * Antecedentes del arrendatario. Se descargan gratis dos certificados oficiales con ClaveÚnica
 * en registrocivil.cl y se suben en PDF; un ejecutivo confirma su código de verificación.
 * Los datos penales son sensibles: no se sube nada sin el consentimiento explícito.
 */
export function AntecedentesScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [consiente, setConsiente] = useState(false);
  const [subiendo, setSubiendo] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await ApiClient.getEstadoAntecedentes());
      setError(null);
    } catch (e) {
      setError(msjError(e, "No pudimos cargar tus antecedentes."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const subir = async (tipo) => {
    if (!consiente || subiendo) return;
    try {
      const pdf = await elegirPdf();
      if (pdf.cancelado) return;
      setSubiendo(tipo);
      const res = await ApiClient.subirCertificadoAntecedente({
        tipo,
        archivo: { uri: pdf.uri, name: pdf.name },
        consentimiento: true,
      });
      if (res?.estado === "rechazado") {
        showAlert("No pudimos aceptar el certificado", res.motivo || "Revisa el documento y vuelve a subirlo.");
      }
      await cargar();
    } catch (e) {
      showAlert("No se pudo subir", msjError(e, "Inténtalo de nuevo."));
    } finally {
      setSubiendo(null);
    }
  };

  const porTipo = Object.fromEntries((datos?.documentos || []).map((d) => [d.tipo, d]));
  const bloqueado = datos?.estado === "bloqueado";

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Antecedentes y hoja de vida" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {datos ? (
          <View
            className={`border rounded-xl p-3 ${
              datos.estado === "limpio"
                ? "bg-emerald-50 border-emerald-200"
                : bloqueado
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <Text className="text-sm font-bold text-text">{RESUMEN[datos.estado] || RESUMEN.pendiente}</Text>
          </View>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-xl font-bold text-textDark" style={{ letterSpacing: -0.3 }}>
            Certificado de antecedentes y hoja de vida del conductor
          </Text>
          <Text className="text-sm text-textMuted leading-5">
            Para reservar necesitamos estos dos certificados oficiales del Registro Civil. Son gratis y toman un par
            de minutos.
          </Text>
        </View>

        <View className="gap-2.5">
          {PASOS.map((paso, i) => (
            <View key={paso} className="flex-row items-center gap-3">
              <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
                <Text className="text-[13px] font-bold text-white">{i + 1}</Text>
              </View>
              <Text className="flex-1 text-[13.5px] text-text leading-[19px]">{paso}</Text>
            </View>
          ))}
        </View>
        <Button
          label="Abrir registrocivil.cl"
          variant="secondary"
          fullWidth={false}
          className="self-start"
          onPress={() => Linking.openURL(URL_REGISTRO_CIVIL)}
        />

        <TouchableOpacity
          className="flex-row items-start gap-3"
          onPress={() => setConsiente((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consiente }}
          activeOpacity={0.8}
        >
          <View className={`w-[22px] h-[22px] rounded-md border-[1.5px] border-primary items-center justify-center mt-0.5 ${consiente ? "bg-primary" : ""}`}>
            {consiente ? <Icon name="check" size={14} color={colors.textWhite} /> : null}
          </View>
          <Text className="flex-1 text-[12.5px] text-textMuted leading-[18px]">
            Autorizo a Arrienda Tu Auto a revisar estos certificados. Contienen datos personales sensibles: solo los ve
            un ejecutivo y se eliminan del sistema una vez resueltos.
          </Text>
        </TouchableOpacity>

        {error ? (
          <Card padded>
            <Text className="text-sm text-text mb-2">{error}</Text>
            <Button label="Reintentar" variant="secondary" fullWidth={false} onPress={cargar} className="self-start" />
          </Card>
        ) : cargando ? (
          <Text className="text-sm text-textMuted text-center py-6">Cargando…</Text>
        ) : (
          DOCUMENTOS.map((doc) => {
            const d = porTipo[doc.tipo] || { estado: "sin_subir" };
            const badge = BADGE[d.estado] || BADGE.sin_subir;
            const puedeSubir = d.estado !== "aprobado" && d.estado !== "revision" && !bloqueado;
            return (
              <Card key={doc.tipo} padded className="gap-2">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[15px] font-bold text-text">{doc.titulo}</Text>
                  <Badge variant={badge.variant} label={badge.label} />
                </View>
                <Text className="text-[12.5px] text-textMuted leading-[18px]">{doc.ayuda}</Text>
                {d.motivo && d.estado === "rechazado" ? <Text className="text-[12.5px] text-red-600 leading-[18px]">{d.motivo}</Text> : null}
                {puedeSubir ? (
                  <Button
                    label={d.estado === "rechazado" ? "Subir de nuevo" : doc.boton}
                    onPress={() => subir(doc.tipo)}
                    loading={subiendo === doc.tipo}
                    disabled={!consiente}
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
