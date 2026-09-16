import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  useApp,
  Icon,
  AvatarFoto,
  MenuList,
  MenuRow,
  ApiClient,
  showAlert,
  msjError,
  LegalModal,
  ReadinessBand,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, oc, OWNER_PREMIUM_BG, OWNER_PREMIUM_LINE } from "../comun";

/**
 * Perfil del dueño. Mismo enfoque que el del arrendatario: primero "¿puedo
 * publicar?", después los ajustes en una lista. El bloque premium (teal casi
 * negro) es el hero, con los stats adentro — no una tarjeta suelta más.
 */
export function OwnerProfileScreen({
  cars,
  noLeidos,
  onOpenChat,
  onOpenEditProfile,
  onOpenDisputes,
  onOpenNotifications,
  onOpenSupport,
  onOpenEnrolment,
  onOpenTarjeta,
  onOpenPromoterPanel,
}) {
  const insets = useSafeAreaInsets();
  const { currentUser, logout } = useApp();
  const [calificaciones, setCalificaciones] = useState([]);
  const [showLegal, setShowLegal] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    ApiClient.getCalificaciones(currentUser.id)
      .then(setCalificaciones)
      .catch(() => {});
  }, [currentUser?.id]);

  const user = currentUser || {};
  const nombre = user.nombre || user.email || "Mi cuenta";

  const handleKycPress = () => {
    if (user.estado_documentos === "verificado") {
      showAlert(
        "Identidad verificada",
        "Tus documentos de identidad ya están aprobados. Tu cuenta de dueño está 100% habilitada para publicar vehículos."
      );
      return;
    }
    if (user.estado_documentos === "requiere_revision_manual") {
      showAlert(
        "Documentos en revisión",
        "Tus documentos están siendo revisados por nuestro equipo. Te notificaremos cuando tu cuenta quede lista."
      );
      return;
    }
    onOpenEnrolment?.();
  };

  const resolverEstado = (tipo) => (tipo === "identidad" ? handleKycPress() : onOpenTarjeta?.());

  const ratingNum = calificaciones.length
    ? calificaciones.reduce((sum, c) => sum + (c.puntaje || 0), 0) / calificaciones.length
    : null;
  const totalAutos = cars?.length || 0;

  const identidadMeta =
    user.estado_documentos === "verificado"
      ? "Verificada"
      : user.estado_documentos === "requiere_revision_manual"
        ? "En revisión"
        : "Pendiente";
  const tarjetaMeta = user.tarjeta_ultimos4
    ? `•• ${user.tarjeta_ultimos4}`
    : user.tarjeta_estado === "validada"
      ? "Listo"
      : "Agregar";

  const handleLogout = () => {
    showAlert("Cerrar sesión", "¿Seguro que quieres salir de tu cuenta de dueño?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  const solicitarEliminacion = async () => {
    setEliminando(true);
    try {
      const res = await ApiClient.solicitarEliminacionCuenta();
      showAlert("Solicitud enviada", res?.mensaje || "Recibimos tu solicitud.");
    } catch (err) {
      if (err?.status === 409) {
        showAlert("Todavía no puedes eliminar tu cuenta", msjError(err, "Intenta de nuevo en unos segundos."));
      } else {
        showAlert("No se pudo enviar", msjError(err, "Inténtalo de nuevo en unos segundos."));
      }
    } finally {
      setEliminando(false);
    }
  };

  const handleEliminarCuenta = () => {
    showAlert(
      "Eliminar mi cuenta",
      "Si tienes arriendos o reservas de tu flota en curso, no podremos procesar la baja todavía — te lo diremos de inmediato. Si no, tu solicitud queda registrada y te confirmamos por correo dentro de 48 horas. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Solicitar eliminación", style: "destructive", onPress: solicitarEliminacion },
      ]
    );
  };

  return (
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner titulo="Mi perfil" noLeidos={noLeidos} onMensajes={onOpenChat} />

      <ScrollView
        contentContainerStyle={[oc.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Hero premium: teal casi negro + hairline menta, con los stats dentro */}
        <View style={styles.premium}>
          <TouchableOpacity
            style={styles.premiumHead}
            onPress={onOpenEditProfile}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            <AvatarFoto size={64} iconSize={26} style={styles.premiumAvatar} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.premiumName} numberOfLines={1}>
                {nombre}
              </Text>
              <Text style={styles.premiumSub} numberOfLines={1}>
                {user.estado_documentos === "verificado" ? "Anfitrión verificado" : "Cuenta de dueño"}
              </Text>
            </View>
            <View style={styles.premiumEdit}>
              <Icon name="pencil" size={15} color={colors.accent200} />
            </View>
          </TouchableOpacity>

          <View style={styles.premiumHair} />

          <View style={styles.premiumStats}>
            <Stat value={String(totalAutos)} label={totalAutos === 1 ? "Auto" : "Autos"} />
            <Stat value={String(calificaciones.length)} label="Calificaciones" bordered />
            <Stat
              value={ratingNum ? ratingNum.toFixed(1).replace(".", ",") : "—"}
              label="Rating"
              star={!!ratingNum}
              bordered
            />
          </View>
        </View>

        <ReadinessBand
          estadoDocumentos={user.estado_documentos}
          tarjetaEstado={user.tarjeta_estado}
          rol="owner"
          onResolver={resolverEstado}
          standalone
        />

        <View>
          <Text style={styles.section}>Cuenta</Text>
          <MenuList>
            <MenuRow tile tileTone="menta" icon="shield" label="Identidad" meta={identidadMeta} onPress={handleKycPress} />
            <MenuRow tile tileTone="menta" icon="card" label="Medios de pago" meta={tarjetaMeta} onPress={onOpenTarjeta} />
            <MenuRow tile icon="shield" label="Garantías y reclamos" onPress={onOpenDisputes} />
            <MenuRow tile tileTone="menta" icon="star" label="Invita y gana" onPress={onOpenPromoterPanel} />
            <MenuRow tile icon="bell" label="Notificaciones" onPress={onOpenNotifications} />
            <MenuRow tile icon="help" label="Soporte para anfitriones" onPress={onOpenSupport} />
            <MenuRow tile icon="document" label="Términos y condiciones" onPress={() => setShowLegal(true)} />
            <MenuRow tile tileTone="danger" icon="logout" label="Cerrar sesión" danger onPress={handleLogout} />
          </MenuList>
        </View>

        <TouchableOpacity
          onPress={handleEliminarCuenta}
          disabled={eliminando}
          hitSlop={theme.control.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Eliminar mi cuenta"
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteText}>{eliminando ? "Enviando solicitud…" : "Eliminar mi cuenta"}</Text>
        </TouchableOpacity>
      </ScrollView>

      <LegalModal visible={showLegal} doc="terminos" onClose={() => setShowLegal(false)} />
    </View>
  );
}

function Stat({ value, label, star, bordered }) {
  return (
    <View style={[styles.stat, bordered && styles.statBordered]}>
      <View style={styles.statValueRow}>
        {star ? <Icon name="star" size={13} color={colors.accent500} fill={colors.accent500} /> : null}
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  premium: {
    backgroundColor: OWNER_PREMIUM_BG,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: OWNER_PREMIUM_LINE,
    overflow: "hidden",
    ...theme.shadow.lg,
  },
  premiumHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  premiumAvatar: {
    borderWidth: 2,
    borderColor: "rgba(47,191,155,0.4)",
  },
  premiumName: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.2 },
  premiumSub: { fontSize: 12.5, color: colors.accent200, marginTop: 2 },
  premiumEdit: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.field,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumHair: { height: 1, backgroundColor: OWNER_PREMIUM_LINE, marginHorizontal: theme.spacing.lg },
  premiumStats: { flexDirection: "row", paddingVertical: theme.spacing.lg },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 4, gap: 3 },
  statBordered: { borderLeftWidth: 1, borderLeftColor: "rgba(47,191,155,0.18)" },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  statValue: { fontSize: 19, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.2 },
  statLabel: { fontSize: 10.5, color: "rgba(255,255,255,0.56)", textAlign: "center" },

  section: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: theme.spacing.sm, marginLeft: 4 },

  deleteBtn: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: theme.spacing.md },
  deleteText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
});
