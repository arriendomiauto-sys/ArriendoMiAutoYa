import React, { useCallback, useEffect, useState } from "react";
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Antecedentes" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {datos ? (
          <View style={[styles.resumen, datos.estado === "limpio" && styles.resumenOk, bloqueado && styles.resumenMal]}>
            <Text style={styles.resumenTexto}>{RESUMEN[datos.estado] || RESUMEN.pendiente}</Text>
          </View>
        ) : null}

        <Text style={styles.intro}>
          Para reservar necesitamos dos certificados oficiales del Registro Civil. Son gratis: se descargan con tu
          ClaveÚnica en registrocivil.cl y se suben aquí en PDF.
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
          onPress={() => setConsiente((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consiente }}
          activeOpacity={0.8}
        >
          <View style={[styles.caja, consiente && styles.cajaMarcada]}>
            {consiente ? <Icon name="check" size={14} color={colors.textWhite} /> : null}
          </View>
          <Text style={styles.consentimientoTexto}>
            Autorizo a Arrienda Tu Auto a revisar estos certificados. Contienen datos personales sensibles: solo los ve
            un ejecutivo y se eliminan del sistema una vez resueltos.
          </Text>
        </TouchableOpacity>

        {error ? (
          <Card padded>
            <Text style={styles.errorTitulo}>{error}</Text>
            <Button label="Reintentar" variant="secondary" fullWidth={false} onPress={cargar} style={{ alignSelf: "flex-start" }} />
          </Card>
        ) : cargando ? (
          <Text style={styles.cargando}>Cargando…</Text>
        ) : (
          DOCUMENTOS.map((doc) => {
            const d = porTipo[doc.tipo] || { estado: "sin_subir" };
            const badge = BADGE[d.estado] || BADGE.sin_subir;
            const puedeSubir = d.estado !== "aprobado" && d.estado !== "revision" && !bloqueado;
            return (
              <Card key={doc.tipo} padded style={{ gap: theme.spacing.sm }}>
                <View style={styles.filaTitulo}>
                  <Text style={styles.titulo}>{doc.titulo}</Text>
                  <Badge variant={badge.variant} label={badge.label} />
                </View>
                <Text style={styles.ayuda}>{doc.ayuda}</Text>
                {d.motivo && d.estado === "rechazado" ? <Text style={styles.motivo}>{d.motivo}</Text> : null}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  cargando: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: theme.spacing.xl },
  intro: { fontSize: 14, color: colors.text, lineHeight: 20 },
  resumen: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  resumenOk: { backgroundColor: colors.successBg, borderColor: colors.successBg },
  resumenMal: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBg },
  resumenTexto: { fontSize: 14, fontWeight: "700", color: colors.text },
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
  ayuda: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },
  motivo: { fontSize: 12.5, color: colors.dangerText, lineHeight: 18 },
  errorTitulo: { fontSize: 14, color: colors.text, marginBottom: theme.spacing.sm },
});
