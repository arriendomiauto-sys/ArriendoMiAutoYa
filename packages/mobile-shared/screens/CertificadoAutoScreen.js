import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, Linking } from "react-native";
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Verificar mi auto" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.auto}>
          {auto.marca} {auto.modelo}
        </Text>
        <Text style={styles.patente}>{auto.patente}</Text>

        {estaAprobado ? (
          <Card padded style={styles.cardAprobado}>
            <View style={styles.filaTitulo}>
              <Icon name="check" size={20} color={colors.accentDark} />
              <Text style={styles.tituloAprobado}>Documento validado y aprobado</Text>
            </View>
            <Text style={styles.textoAprobado}>
              Este vehículo ya cuenta con su verificación aprobada. La opción para volver a subir o modificar este certificado ha quedado invalidada.
            </Text>
          </Card>
        ) : (
          <>
            <Text style={styles.intro}>
              Para ofrecer tu auto necesitamos el Certificado de anotaciones vigentes del Registro Civil: muestra que la patente
              es tuya y que no tiene prohibiciones ni embargos. Se descarga en registrocivil.cl con tu ClaveÚnica.
            </Text>
            <Button
              label="Abrir registrocivil.cl"
              variant="secondary"
              fullWidth={false}
              style={{ alignSelf: "flex-start" }}
              onPress={() => Linking.openURL(URL_REGISTRO_CIVIL)}
            />

            <TouchableOpacity
              style={styles.consentimiento}
              onPress={() => {
                if (!estaAprobado) setConsiente((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consiente }}
              activeOpacity={estaAprobado ? 1 : 0.8}
              disabled={estaAprobado}
            >
              <View style={[styles.caja, consiente && styles.cajaMarcada]}>
                {consiente ? <Icon name="check" size={14} color={colors.textWhite} /> : null}
              </View>
              <Text style={styles.consentimientoTexto}>
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
          <Card padded style={{ gap: theme.spacing.sm }}>
            <View style={styles.filaTitulo}>
              <Text style={styles.titulo}>Certificado de anotaciones</Text>
              <Badge variant={badge.variant} label={badge.label} />
            </View>
            {resultado.motivo ? <Text style={styles.motivo}>{resultado.motivo}</Text> : null}
            {resultado.estado === "revision" ? (
              <Text style={styles.nota}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  auto: { fontSize: 20, fontWeight: "800", color: colors.text },
  patente: { fontSize: 14, fontWeight: "700", color: colors.textMuted, marginTop: -theme.spacing.sm },
  intro: { fontSize: 14, color: colors.text, lineHeight: 20 },
  consentimiento: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  caja: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cajaMarcada: { backgroundColor: colors.primary },
  consentimientoTexto: { flex: 1, fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },
  filaTitulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  titulo: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  motivo: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
  nota: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },
  cardAprobado: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
  tituloAprobado: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accentDark,
    flex: 1,
  },
  textoAprobado: {
    fontSize: 13,
    color: "#065F46",
    lineHeight: 18,
  },
});
