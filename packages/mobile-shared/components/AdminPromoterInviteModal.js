import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

export function AdminPromoterInviteModal({ visible, onClose }) {
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [invitaciones, setInvitaciones] = useState([]);
  const [ultimaInvitacion, setUltimaInvitacion] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  useEffect(() => {
    if (visible) {
      cargarInvitaciones();
    } else {
      setUltimaInvitacion(null);
    }
  }, [visible]);

  const cargarInvitaciones = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const items = await ApiClient.getInvitacionesPromotores();
      setInvitaciones(items || []);
    } catch (err) {
      console.warn("No se pudo cargar el historial de invitaciones:", err);
      setErrorCarga(msjError(err, "No se pudo cargar el historial de invitaciones."));
    } finally {
      setCargando(false);
    }
  };

  const generarCodigo = async () => {
    setGenerando(true);
    try {
      const res = await ApiClient.crearInvitacionPromotor("Invitación desde app móvil");
      setUltimaInvitacion(res);
      await cargarInvitaciones();
    } catch (err) {
      showAlert("Error al generar", msjError(err, "No se pudo crear la invitación."));
    } finally {
      setGenerando(false);
    }
  };

  const copiarLink = async (link) => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartir = (inv) => {
    if (!inv) return;
    Share.share({
      message:
        `¡Has sido invitado como Promotor Oficial en Arriendo Mi Auto Ya!\n\n` +
        `Tendrás acceso al panel de colaboradores para invitar a nuevos usuarios y obtener beneficios exclusivos.\n\n` +
        `Usa este enlace de un solo uso para registrarte y activar tu rol:\n${inv.link}\n` +
        `O ingresa el código: ${inv.codigo}`,
    }).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[85%] pb-6">
          {/* Header */}
          <View className="flex-row items-center px-5 pt-5 pb-3.5 border-b border-slate-100">
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-slate-900">Invitar Promotores</Text>
              <Text className="text-[13px] text-slate-500 mt-0.5">
                Genera códigos de un solo uso para nombrar nuevos promotores.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-slate-50">
              <Icon name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false}>
            {/* Botón Acción Principal */}
            <View className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
              <Button
                label={generando ? "Generando código..." : "Generar invitación de Promotor"}
                iconLeft="plus"
                tone="dark"
                onPress={generarCodigo}
                disabled={generando}
              />
              <Text className="text-xs text-slate-500 leading-4 mt-2.5 text-center">
                Cada enlace es de un solo uso y activará automáticamente el rol de promotor en ambas apps (owner y renter) a la persona invitada.
              </Text>
            </View>

            {/* Código Recién Generado */}
            {ultimaInvitacion ? (
              <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Icon name="check-circle" size={16} color="#0F3D3E" />
                  <Text className="text-[13px] font-bold text-emerald-800">Invitación activa generada</Text>
                </View>
                <Text className="text-2xl font-black text-primary-900 tracking-wider mb-1">{ultimaInvitacion.codigo}</Text>
                <Text className="text-xs text-emerald-800 mb-3" numberOfLines={1}>{ultimaInvitacion.link}</Text>

                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center bg-white border border-primary-900 py-2.5 rounded-xl gap-1.5"
                    onPress={() => copiarLink(ultimaInvitacion.link)}
                  >
                    <Icon name={copiado ? "check" : "copy"} size={14} color="#0F3D3E" />
                    <Text className="text-[13px] font-bold text-primary-900">
                      {copiado ? "Copiado" : "Copiar Link"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center bg-primary-900 py-2.5 rounded-xl gap-1.5"
                    onPress={() => compartir(ultimaInvitacion)}
                  >
                    <Icon name="share" size={14} color="#FFFFFF" />
                    <Text className="text-[13px] font-bold text-white">Compartir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Historial de Invitaciones */}
            <View className="mt-2 mb-6">
              <Text className="text-sm font-bold text-slate-700 mb-3">Historial de invitaciones a promotores</Text>

              {cargando ? (
                <ActivityIndicator size="small" color="#0F3D3E" className="my-4" />
              ) : errorCarga ? (
                <View className="flex-row items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                  <Icon name="alert" size={16} color={colors.dangerText} />
                  <View className="flex-1 gap-2">
                    <Text className="text-[12.5px] text-red-700 leading-[17px]">{errorCarga}</Text>
                    <TouchableOpacity onPress={cargarInvitaciones} className="self-start">
                      <Text className="text-[12.5px] font-bold text-primary-900">Reintentar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : invitaciones.length === 0 ? (
                <Text className="text-[13px] text-slate-400 italic text-center my-3">
                  Aún no has generado códigos de promotor.
                </Text>
              ) : (
                invitaciones.map((inv) => (
                  <View key={inv.id || inv.codigo} className="flex-row items-center bg-white border border-slate-200 rounded-xl p-3 mb-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-extrabold text-slate-900 tracking-wide">{inv.codigo}</Text>
                        <View
                          className={`px-2 py-0.5 rounded-lg ${
                            inv.usado ? "bg-slate-100" : "bg-emerald-100"
                          }`}
                        >
                          <Text
                            className={`text-[11px] font-bold ${
                              inv.usado ? "text-slate-500" : "text-emerald-800"
                            }`}
                          >
                            {inv.usado ? "Canjeado" : "Disponible"}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-slate-500 mt-0.5">
                        {inv.usado
                          ? `Usado por ${inv.usado_por_nombre || "Usuario"}`
                          : "Pendiente de registro"}
                      </Text>
                    </View>

                    {!inv.usado ? (
                      <TouchableOpacity
                        className="p-2 rounded-lg bg-slate-50"
                        onPress={() => compartir(inv)}
                      >
                        <Icon name="share" size={16} color="#0F3D3E" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
