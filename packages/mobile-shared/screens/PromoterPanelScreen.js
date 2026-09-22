import React, { useEffect, useState } from "react";
import {
  View,
  Text,
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
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Programa de Colaboradores" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View className="bg-primary-900 rounded-2xl p-6 items-center gap-2">
          {/* Badge de Nivel */}
          {nivel ? (
            <View
              className="flex-row items-center gap-1.5 py-1 px-3 rounded-full border mb-1"
              style={{ backgroundColor: estiloNivel.bg, borderColor: estiloNivel.borde }}
            >
              <Icon name="award" size={14} color={estiloNivel.icono} />
              <Text className="text-xs font-bold" style={{ color: estiloNivel.texto }}>
                Nivel {nivel.nivel} · {nivel.titulo}
              </Text>
            </View>
          ) : null}

          <Text className="text-[13px] text-gray-300 font-semibold">Tu código de colaborador activo</Text>
          <Text className="text-4xl font-extrabold tracking-widest text-accent-400">{cargando ? "······" : datos?.codigo || "—"}</Text>

          <View className="flex-row items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/35 py-1 px-3 rounded-xl mb-2">
            <Icon name="shield" size={12} color="#6EE7B7" />
            <Text className="text-[11.5px] font-semibold text-emerald-300">
              Código de un solo uso · Se renueva tras registrar a tu invitado
            </Text>
          </View>

          <TouchableOpacity
            className="flex-row items-center gap-2 bg-white/10 rounded-xl py-2.5 px-3 max-w-full"
            onPress={copiarLink}
            activeOpacity={0.75}
            disabled={!datos?.link}
          >
            <Text className="text-gray-300 text-xs shrink" numberOfLines={1}>
              {datos?.link || " "}
            </Text>
            <Icon name={copiado ? "check" : "copy"} size={15} color={colors.accent400} />
          </TouchableOpacity>

          <View className="flex-row items-center gap-2.5 w-full mt-1">
            <Button
              label="Compartir"
              iconLeft="share"
              tone="dark"
              onPress={compartir}
              disabled={!datos?.codigo}
              className="flex-1"
            />
            <TouchableOpacity
              className="w-12 h-12 rounded-xl bg-white/15 items-center justify-center"
              onPress={() => setModalQrVisible(true)}
              disabled={!datos?.link}
              activeOpacity={0.8}
            >
              <Icon name="qr" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta de Beneficios Exclusivos */}
        <View className="bg-surface rounded-2xl border border-border p-4 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center">
              <Icon name="gift" size={18} color="#0F3D3E" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-textDark">Tus beneficios exclusivos</Text>
              <Text className="text-xs text-textMuted">
                Por traer usuarios a la comunidad de Arriendo Mi Auto Ya
              </Text>
            </View>
          </View>

          <View className="gap-2 mt-1">
            {(nivel?.beneficios || [
              "Comisión de plataforma reducida",
              "Bono extra en ganancias",
              "Descuento de bienvenida del 15% para tus invitados",
            ]).map((b, idx) => (
              <View key={idx} className="flex-row items-center gap-2">
                <Icon name="check" size={14} color="#10B981" strokeWidth={2.5} />
                <Text className="text-[13px] text-textDark">{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Barra de Progreso al Próximo Nivel */}
        {nivel?.proximo_nivel ? (
          <View className="bg-surface rounded-2xl border border-border p-4 gap-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-[13.5px] font-bold text-textDark">Progreso hacia Nivel {nivel.proximo_nivel}</Text>
              <Text className="text-xs font-semibold text-primary-700">
                Faltan {nivel.faltantes_proximo_nivel} {nivel.faltantes_proximo_nivel === 1 ? "invitado" : "invitados"}
              </Text>
            </View>
            <View className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <View
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      10,
                      (nivel.referidos_activos /
                        (nivel.referidos_activos + nivel.faltantes_proximo_nivel)) *
                        100
                    )
                  )}%`,
                }}
              />
            </View>
            <Text className="text-[11.5px] text-textMuted leading-4">
              Alcanza el nivel {nivel.proximo_nivel} para reducir la comisión de tus autos y aumentar tus bonos de retiro.
            </Text>
          </View>
        ) : null}

        {/* Estadísticas Clave */}
        <View className="flex-row bg-surface rounded-2xl border border-border py-4">
          <View className="flex-1 items-center gap-1">
            <Text className="text-[22px] font-extrabold text-textDark">{cargando ? "—" : datos?.referidos_totales ?? 0}</Text>
            <Text className="text-[11.5px] text-textMuted text-center">
              {datos?.referidos_totales === 1 ? "invitado activo" : "invitados activos"}
            </Text>
          </View>
          <View className="w-[1px] bg-border" />
          <View className="flex-1 items-center gap-1">
            <Text className="text-[22px] font-extrabold text-textDark">
              {cargando ? "—" : `${nivel?.comision_plataforma_pct ?? 15}%`}
            </Text>
            <Text className="text-[11.5px] text-textMuted text-center">comisión plataforma</Text>
          </View>
          <View className="w-[1px] bg-border" />
          <View className="flex-1 items-center gap-1">
            <Text className="text-[22px] font-extrabold text-textDark">
              {cargando ? "—" : `${datos?.bono_pct_vigente ?? 8}%`}
            </Text>
            <Text className="text-[11.5px] text-textMuted text-center">bono vigente</Text>
          </View>
        </View>

        {/* Lista de Últimos Referidos */}
        {datos?.ultimos_referidos?.length > 0 ? (
          <View className="bg-surface rounded-2xl border border-border p-4 gap-3">
            <Text className="text-sm font-bold text-textDark">Tus invitados recientes</Text>
            {datos.ultimos_referidos.map((r, i) => (
              <View key={i} className="flex-row items-center gap-3 py-1">
                <View className="w-9 h-9 rounded-full bg-primary-900 items-center justify-center">
                  <Text className="text-white text-xs font-bold">{r.iniciales}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-textDark">Usuario {r.iniciales}</Text>
                  <Text className="text-[11.5px] text-textMuted">
                    Registrado {new Date(r.fecha_registro).toLocaleDateString("es-CL")}
                  </Text>
                </View>
                <View className="px-2 py-1 rounded-md bg-emerald-50">
                  <Text className="text-[11px] font-semibold text-emerald-600">{r.estado}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Explicación del funcionamiento */}
        <View className="gap-2">
          <Text className="text-[15px] font-bold text-textDark">Cómo funciona el enlace de colaborador</Text>
          <Text className="text-[13px] text-textMuted leading-5">
            Al enviar tu enlace único, tus invitados pueden descargar la app directamente. Si ya la
            tienen instalada, se abre en el registro con tu código pre-cargado de forma automática.
          </Text>
          <Text className="text-[13px] text-textMuted leading-5">
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
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View className="w-full max-w-[340px] bg-white rounded-3xl p-6 items-center gap-3">
            <View className="flex-row justify-between items-center w-full">
              <Text className="text-lg font-bold text-slate-900">Escanea para unirte</Text>
              <TouchableOpacity
                onPress={() => setModalQrVisible(false)}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-[13px] text-slate-500 text-center leading-[18px]">
              Pide a tu invitado que escanee este código con la cámara de su celular.
            </Text>

            <View className="w-[200px] h-[200px] bg-slate-50 rounded-2xl items-center justify-center border border-slate-200 my-2">
              {urlQr ? (
                <Image
                  source={{ uri: urlQr }}
                  className="w-[180px] h-[180px]"
                  resizeMode="contain"
                />
              ) : (
                <ActivityIndicator color="#0F3D3E" size="large" />
              )}
            </View>

            <View className="items-center bg-slate-100 py-1.5 px-4 rounded-xl">
              <Text className="text-[11px] text-slate-500 font-semibold">Código aplicado</Text>
              <Text className="text-base font-extrabold text-primary-900 tracking-wider">{datos?.codigo}</Text>
            </View>

            <Button
              label="Cerrar"
              tone="dark"
              onPress={() => setModalQrVisible(false)}
              className="w-full mt-3"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

