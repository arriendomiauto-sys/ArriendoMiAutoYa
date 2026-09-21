import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
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
import { CabeceraOwner } from "../comun";

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
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <CabeceraOwner titulo="Mi perfil" noLeidos={noLeidos} onMensajes={onOpenChat} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}
        className="px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View className="flex-col gap-4">
          {/* Hero premium: oscuro + hairline menta, con los stats dentro */}
          <View className="bg-[#101928] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
            <TouchableOpacity
              className="flex-row items-center gap-3 p-4"
              onPress={onOpenEditProfile}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Editar perfil"
            >
              <AvatarFoto size={64} iconSize={26} className="border-2 border-accent/40" />
              <View className="flex-1 min-w-0">
                <Text className="text-xl font-bold text-white -tracking-tight" numberOfLines={1}>
                  {nombre}
                </Text>
                <Text className="text-[12.5px] text-accent-200 mt-0.5" numberOfLines={1}>
                  {user.estado_documentos === "verificado" ? "Anfitrión verificado" : "Cuenta de dueño"}
                </Text>
              </View>
              <View className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center">
                <Icon name="pencil" size={15} color={colors.accent200} />
              </View>
            </TouchableOpacity>

            <View className="h-[1px] bg-white/10 mx-4" />

            <View className="flex-row py-4">
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
            <Text className="text-[13px] font-bold text-textMuted mb-2 ml-1">Cuenta</Text>
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
            className="self-center py-1.5 px-3"
          >
            <Text className="text-[13px] text-red-500 font-semibold">
              {eliminando ? "Enviando solicitud…" : "Eliminar mi cuenta"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LegalModal visible={showLegal} doc="terminos" onClose={() => setShowLegal(false)} />
    </View>
  );
}

function Stat({ value, label, star, bordered }) {
  return (
    <View className={`flex-1 items-center px-1 gap-1 ${bordered ? "border-l border-accent/20" : ""}`}>
      <View className="flex-row items-center gap-1">
        {star ? <Icon name="star" size={13} color={colors.accent500} fill={colors.accent500} /> : null}
        <Text className="text-[19px] font-bold text-white -tracking-tight" numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text className="text-[10.5px] text-white/60 text-center">{label}</Text>
    </View>
  );
}
