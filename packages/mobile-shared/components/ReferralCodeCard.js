import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Share, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { ApiClient } from "../api/client";
import { useApp } from "../context/AppContext";
import { urlWeb } from "../utils/webUrl";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

/**
 * Código propio para invitar amigos (compartir) + campo para ingresar el
 * código de quien invitó a este usuario, si todavía no aplicó uno. El
 * propio se genera solo (perezosamente) la primera vez que se pide
 * GET /usuarios/me, así que si `currentUser` todavía no lo trae, se
 * refresca acá.
 */
export function ReferralCodeCard({ className = "", style }) {
  const { currentUser, setCurrentUser } = useApp();
  const [codigo, setCodigo] = useState(currentUser?.codigo_referido || null);
  const [yaTieneReferente, setYaTieneReferente] = useState(!!currentUser?.referido_por_id);
  const [cargando, setCargando] = useState(!currentUser?.codigo_referido);
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (currentUser?.codigo_referido) {
      setCodigo(currentUser.codigo_referido);
      setYaTieneReferente(!!currentUser.referido_por_id);
      setCargando(false);
      return;
    }
    let cancelado = false;
    if (typeof ApiClient?.getMe === "function") {
      ApiClient.getMe()
        .then((perfil) => {
          if (cancelado) return;
          setCodigo(perfil?.codigo_referido || null);
          setYaTieneReferente(!!perfil?.referido_por_id);
          setCurrentUser?.(perfil);
        })
        .catch(() => {})
        .finally(() => !cancelado && setCargando(false));
    } else {
      setCargando(false);
    }
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compartir = () => {
    if (!codigo) return;
    Share.share({
      message:
        `Arrienda o publica tu auto en ArriendoMiAutoYa y ambos ganamos un descuento/bono. ` +
        `Usa mi código ${codigo} al registrarte: ${urlWeb()}`,
    }).catch(() => {});
  };

  const aplicarCodigo = async () => {
    const limpio = codigoIngresado.trim();
    if (!limpio || aplicando) return;
    setAplicando(true);
    try {
      const perfil = await ApiClient.aplicarCodigoReferido(limpio);
      setCurrentUser(perfil);
      setYaTieneReferente(true);
      showAlert("¡Listo!", "Código de invitación registrado.");
    } catch (err) {
      showAlert("No se pudo registrar el código", msjError(err, "Revisa el código e inténtalo de nuevo."));
    } finally {
      setAplicando(false);
    }
  };

  return (
    <View className={`bg-surface rounded-2xl border border-border p-4 gap-2 ${className}`} style={style}>
      <View className="flex-row items-center gap-2">
        <Icon name="star" size={20} color={colors.accent700} />
        <Text className="text-base font-bold text-text">Invita y gana</Text>
      </View>
      <Text className="text-[13px] text-textMuted leading-[18px]">
        Comparte tu código: quien lo use y tú reciben un descuento o un extra en sus ganancias que
        va bajando con el tiempo, así que conviene compartirlo pronto.
      </Text>

      <View className="bg-surfaceSubtle rounded-xl border border-border py-3 items-center">
        <Text className="text-xl font-extrabold tracking-widest text-primary">{cargando ? "..." : codigo || "—"}</Text>
      </View>

      <TouchableOpacity
        className={`mt-1 h-11 rounded-xl bg-accent-500 flex-row items-center justify-center gap-2 ${!codigo ? "opacity-50" : ""}`}
        onPress={compartir}
        disabled={!codigo}
        activeOpacity={0.85}
      >
        <Icon name="share" size={16} color="#FFFFFF" />
        <Text className="text-white font-bold text-[15px]">Compartir código</Text>
      </TouchableOpacity>

      {!cargando && !yaTieneReferente ? (
        <View className="mt-2 gap-2 border-t border-border pt-2">
          <Text className="text-[13px] text-textMuted">¿Alguien te invitó? Ingresa su código</Text>
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 h-11 border-[1.5px] border-border rounded-xl px-3 text-[15px] text-text bg-surface"
              value={codigoIngresado}
              onChangeText={(t) => setCodigoIngresado(t.toUpperCase())}
              placeholder="Código de 6 letras/números"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="characters"
              maxLength={12}
            />
            <TouchableOpacity
              className={`h-11 min-w-[68px] rounded-xl bg-primary items-center justify-center px-3.5 ${(!codigoIngresado.trim() || aplicando) ? "opacity-50" : ""}`}
              onPress={aplicarCodigo}
              disabled={!codigoIngresado.trim() || aplicando}
              activeOpacity={0.85}
            >
              {aplicando ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text className="text-white font-bold text-sm">Usar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}
