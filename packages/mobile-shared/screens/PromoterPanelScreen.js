import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Share,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { ScreenHeader, Button } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

const COLORES_NIVEL = {
  Oro: { bg: "#FEF3C7", texto: "#B45309", borde: "#FDE68A", icono: "#D97706" },
  Plata: { bg: "#F1F5F9", texto: "#334155", borde: "#E2E8F0", icono: "#64748B" },
  Bronce: { bg: "#FFEDD5", texto: "#9A3412", borde: "#FED7AA", icono: "#C2410C" },
};

/**
 * Panel de Colaborador y Programa de Invitación.
 * Muestra el nivel del colaborador (Bronce, Plata, Oro), beneficios exclusivos,
 * código y enlace personal, estadísticas, progreso al siguiente nivel y modal QR.
 */
export function PromoterPanelScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [modalQrVisible, setModalQrVisible] = useState(false);

  useEffect(() => {
    let vivo = true;
    ApiClient.getProgramaReferidos()
      .then((d) => vivo && setDatos(d))
      .catch((err) =>
        vivo && showAlert("No se pudo cargar", msjError(err, "Intenta de nuevo en unos segundos."))
      )
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const compartir = () => {
    if (!datos?.codigo) return;
    Share.share({
      message:
        `¡Únete a ArriendoMiAutoYa! Arrienda o publica tu auto con 15% de descuento en tu primer viaje. ` +
        `Usa mi código de colaborador ${datos.codigo} o descarga directo desde: ${datos.link}`,
    }).catch(() => {});
  };

  const copiarLink = async () => {
    if (!datos?.link) return;
    await Clipboard.setStringAsync(datos.link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const nivel = datos?.nivel_colaborador;
  const estiloNivel = COLORES_NIVEL[nivel?.nivel] || COLORES_NIVEL.Bronce;

  const urlQr = datos?.link
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        datos.link
      )}`
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Programa de Colaboradores" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.hero}>
          {/* Badge de Nivel */}
          {nivel ? (
            <View
              style={[
                styles.badgeNivel,
                { backgroundColor: estiloNivel.bg, borderColor: estiloNivel.borde },
              ]}
            >
              <Icon name="award" size={14} color={estiloNivel.icono} />
              <Text style={[styles.badgeNivelTexto, { color: estiloNivel.texto }]}>
                Nivel {nivel.nivel} · {nivel.titulo}
              </Text>
            </View>
          ) : null}

          <Text style={styles.heroLabel}>Tu código de colaborador activo</Text>
          <Text style={styles.heroCodigo}>{cargando ? "······" : datos?.codigo || "—"}</Text>

          <View style={styles.badgeUnSoloUso}>
            <Icon name="shield" size={12} color="#6EE7B7" />
            <Text style={styles.badgeUnSoloUsoTexto}>
              Código de un solo uso · Se renueva tras registrar a tu invitado
            </Text>
          </View>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={copiarLink}
            activeOpacity={0.75}
            disabled={!datos?.link}
          >
            <Text style={styles.linkTexto} numberOfLines={1}>
              {datos?.link || " "}
            </Text>
            <Icon name={copiado ? "check" : "copy"} size={15} color={colors.accent400} />
          </TouchableOpacity>

          <View style={styles.heroBotonesFila}>
            <Button
              label="Compartir"
              iconLeft="share"
              tone="dark"
              onPress={compartir}
              disabled={!datos?.codigo}
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              style={styles.btnQrIcono}
              onPress={() => setModalQrVisible(true)}
              disabled={!datos?.link}
              activeOpacity={0.8}
            >
              <Icon name="qr" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta de Beneficios Exclusivos */}
        <View style={styles.beneficiosCard}>
          <View style={styles.beneficiosHeader}>
            <View style={styles.beneficiosIconoCaja}>
              <Icon name="gift" size={18} color="#0F3D3E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.beneficiosTitulo}>Tus beneficios exclusivos</Text>
              <Text style={styles.beneficiosSubtitulo}>
                Por traer usuarios a la comunidad de Arriendo Mi Auto Ya
              </Text>
            </View>
          </View>

          <View style={styles.beneficiosLista}>
            {(nivel?.beneficios || [
              "Comisión de plataforma reducida",
              "Bono extra en ganancias",
              "Descuento de bienvenida del 15% para tus invitados",
            ]).map((b, idx) => (
              <View key={idx} style={styles.beneficioItem}>
                <Icon name="check" size={14} color="#10B981" strokeWidth={2.5} />
                <Text style={styles.beneficioTexto}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Barra de Progreso al Próximo Nivel */}
        {nivel?.proximo_nivel ? (
          <View style={styles.progresoCard}>
            <View style={styles.progresoCabecera}>
              <Text style={styles.progresoTitulo}>Progreso hacia Nivel {nivel.proximo_nivel}</Text>
              <Text style={styles.progresoFaltan}>
                Faltan {nivel.faltantes_proximo_nivel} {nivel.faltantes_proximo_nivel === 1 ? "invitado" : "invitados"}
              </Text>
            </View>
            <View style={styles.progresoTrack}>
              <View
                style={[
                  styles.progresoFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(
                        10,
                        (nivel.referidos_activos /
                          (nivel.referidos_activos + nivel.faltantes_proximo_nivel)) *
                          100
                      )
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progresoNota}>
              Alcanza el nivel {nivel.proximo_nivel} para reducir la comisión de tus autos y aumentar tus bonos de retiro.
            </Text>
          </View>
        ) : null}

        {/* Estadísticas Clave */}
        <View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Text style={styles.statValor}>{cargando ? "—" : datos?.referidos_totales ?? 0}</Text>
            <Text style={styles.statLabel}>
              {datos?.referidos_totales === 1 ? "invitado activo" : "invitados activos"}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValor}>
              {cargando ? "—" : `${nivel?.comision_plataforma_pct ?? 15}%`}
            </Text>
            <Text style={styles.statLabel}>comisión plataforma</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValor}>
              {cargando ? "—" : `${datos?.bono_pct_vigente ?? 8}%`}
            </Text>
            <Text style={styles.statLabel}>bono vigente</Text>
          </View>
        </View>

        {/* Lista de Últimos Referidos */}
        {datos?.ultimos_referidos?.length > 0 ? (
          <View style={styles.ultimosCard}>
            <Text style={styles.ultimosTitulo}>Tus invitados recientes</Text>
            {datos.ultimos_referidos.map((r, i) => (
              <View key={i} style={styles.referidoFila}>
                <View style={styles.avatarReferido}>
                  <Text style={styles.avatarTexto}>{r.iniciales}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referidoNombre}>Usuario {r.iniciales}</Text>
                  <Text style={styles.referidoFecha}>
                    Registrado {new Date(r.fecha_registro).toLocaleDateString("es-CL")}
                  </Text>
                </View>
                <View style={styles.badgeEstado}>
                  <Text style={styles.badgeEstadoTexto}>{r.estado}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Explicación del funcionamiento */}
        <View style={styles.explica}>
          <Text style={styles.explicaTitulo}>Cómo funciona el enlace de colaborador</Text>
          <Text style={styles.explicaTexto}>
            Al enviar tu enlace único, tus invitados pueden descargar la app directamente. Si ya la
            tienen instalada, se abre en el registro con tu código pre-cargado de forma automática.
          </Text>
          <Text style={styles.explicaTexto}>
            Tus invitados reciben un 15% de descuento en su primer arriendo. A medida que sumas
            referidos activos, subes de nivel (Bronce → Plata → Oro), disminuyendo permanentemente
            la comisión que la plataforma retiene al arrendar tus autos y aumentando tus ganancias.
          </Text>
        </View>
      </ScrollView>

      {/* Modal de Código QR para compartir en persona */}
      <Modal
        visible={modalQrVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalQrVisible(false)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Escanea para unirte</Text>
              <TouchableOpacity
                onPress={() => setModalQrVisible(false)}
                style={styles.modalCerrar}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitulo}>
              Pide a tu invitado que escanee este código con la cámara de su celular.
            </Text>

            <View style={styles.qrContenedor}>
              {urlQr ? (
                <Image
                  source={{ uri: urlQr }}
                  style={styles.qrImagen}
                  resizeMode="contain"
                />
              ) : (
                <ActivityIndicator color="#0F3D3E" size="large" />
              )}
            </View>

            <View style={styles.modalCodigoBadge}>
              <Text style={styles.modalCodigoLabel}>Código aplicado</Text>
              <Text style={styles.modalCodigoValor}>{datos?.codigo}</Text>
            </View>

            <Button
              label="Cerrar"
              tone="dark"
              onPress={() => setModalQrVisible(false)}
              style={{ alignSelf: "stretch", marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },

  hero: {
    backgroundColor: colors.primary900,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  badgeNivel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  badgeNivelTexto: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroLabel: { fontSize: 13, color: colors.darkTextMuted, fontWeight: "600" },
  heroCodigo: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.accent400,
  },
  badgeUnSoloUso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  badgeUnSoloUsoTexto: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6EE7B7",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: theme.radius.field,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    maxWidth: "100%",
  },
  linkTexto: { color: colors.darkTextMuted, fontSize: 12, flexShrink: 1 },
  heroBotonesFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: theme.spacing.xs,
  },
  btnQrIcono: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.field,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  beneficiosCard: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.lg,
    gap: 12,
  },
  beneficiosHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beneficiosIconoCaja: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiosTitulo: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  beneficiosSubtitulo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  beneficiosLista: {
    gap: 8,
    marginTop: 4,
  },
  beneficioItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  beneficioTexto: {
    fontSize: 13,
    color: colors.textDark,
  },

  progresoCard: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.lg,
    gap: 8,
  },
  progresoCabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progresoTitulo: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  progresoFaltan: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary700,
  },
  progresoTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  progresoFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 4,
  },
  progresoNota: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
  },

  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: theme.spacing.lg,
  },
  statBlock: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValor: { fontSize: 22, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11.5, color: colors.textMuted, textAlign: "center" },

  ultimosCard: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.lg,
    gap: 12,
  },
  ultimosTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  referidoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  avatarReferido: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0F3D3E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  referidoNombre: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  referidoFecha: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  badgeEstado: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
  },
  badgeEstadoTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },

  explica: { gap: theme.spacing.sm },
  explicaTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
  explicaTexto: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCaja: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalCerrar: {
    padding: 4,
  },
  modalSubtitulo: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  qrContenedor: {
    width: 200,
    height: 200,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 8,
  },
  qrImagen: {
    width: 180,
    height: 180,
  },
  modalCodigoBadge: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalCodigoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  modalCodigoValor: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F3D3E",
    letterSpacing: 2,
  },
});

