import React, { useState } from "react";
import {
  View, Text, Modal, TextInput, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors, theme, Icon, Button, Chip, SectionLabel, showAlert, msjError,
  ApiClient, CampoConSugerencias, buscarBancos, TIPOS_CUENTA_CHILE,
  useApp,
} from "@rentacar/mobile-shared";

const VACIO = { banco: "", tipo_cuenta: "", numero: "", titular: "", rut: "" };

export function CuentaCobroModal({
  visible,
  onClose,
  onGuardada,
  nombreTitular: propNombre,
  rutTitular: propRut,
  identidadVerificada: propVerificada,
}) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Si corre fuera de SafeAreaProvider (ej. tests unitarios)
  }
  let currentUser = null;
  try {
    const app = useApp();
    currentUser = app?.currentUser;
  } catch {
    // Fuera de contexto AppProvider (ej. tests unitarios)
  }

  const nombreTitular = (propNombre !== undefined ? propNombre : currentUser?.nombre) || "";
  const rutTitular = (propRut !== undefined ? propRut : currentUser?.rut) || "";
  const identidadVerificada = propVerificada !== undefined ? propVerificada : (currentUser?.estado_documentos === "verificado");

  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setForm(VACIO);
      setGuardando(false);
    } else {
      setForm((prev) => ({
        ...prev,
        titular: nombreTitular || prev.titular,
        rut: prev.rut || rutTitular,
      }));
    }
  }, [visible, nombreTitular, rutTitular]);

  const guardar = async () => {
    if (guardando) return;
    const titularFinal = (nombreTitular || form.titular || "").trim();
    if (!form.banco || !form.tipo_cuenta || !form.numero || !titularFinal || !form.rut) {
      showAlert("Datos incompletos", "Completa el banco, el tipo de cuenta, el número, el titular y su RUT.");
      return;
    }
    setGuardando(true);
    try {
      const cuenta = await ApiClient.agregarCuentaCobro({
        ...form,
        titular: titularFinal,
      });
      onGuardada?.(cuenta);
      onClose?.();
    } catch (err) {
      showAlert("No se pudo guardar", msjError(err, "Verifica el RUT e inténtalo de nuevo."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-[#061E1F]/60 justify-end" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View
          className="bg-white rounded-t-3xl p-5 gap-2 max-h-[92%]"
          style={{ paddingBottom: Math.max(insets?.bottom || 0, 20) + 12 }}
        >
          <View className="w-10 h-1 rounded-full bg-gray-300 self-center" />
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-textDark">Nueva cuenta de cobro</Text>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text className="text-[12.5px] text-textMuted leading-[17px] mb-2">
            La cuenta de débito o vista donde recibes tus pagos. ¿Tienes CuentaRUT? Tu número de cuenta es tu RUT sin el dígito verificador.
          </Text>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            <View className="mb-4">
              <CampoConSugerencias
                etiqueta="Banco"
                valor={form.banco}
                onChange={(v) => setForm((p) => ({ ...p, banco: v }))}
                buscar={buscarBancos}
                placeholder="Escribe y elige de la lista"
              />
            </View>
            <View className="gap-2 mb-4">
              <SectionLabel>Tipo de cuenta</SectionLabel>
              <View className="flex-row flex-wrap gap-2">
                {TIPOS_CUENTA_CHILE.map((tipo) => (
                  <Chip key={tipo} label={tipo} selected={form.tipo_cuenta === tipo}
                        onPress={() => setForm((p) => ({ ...p, tipo_cuenta: tipo }))} />
                ))}
              </View>
            </View>

            {/* Número de cuenta */}
            <View className="gap-1.5 mb-4">
              <SectionLabel>Número de cuenta</SectionLabel>
              <TextInput
                className="h-12 border-[1.5px] border-gray-200 rounded-xl px-4 text-[15px] text-textDark bg-white justify-center"
                value={form.numero}
                onChangeText={(v) => setForm((p) => ({ ...p, numero: v }))}
                placeholder=""
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                accessibilityLabel="Número de cuenta"
              />
            </View>

            {/* Nombre del titular: bloqueado con el nombre oficial del registro y carnet KYC */}
            <View className="gap-1.5 mb-4">
              <SectionLabel>Nombre del titular</SectionLabel>
              {nombreTitular ? (
                <View className="h-12 border-[1.5px] border-gray-200 rounded-xl px-4 flex-row items-center justify-between bg-slate-100">
                  <Text className="text-[15px] font-semibold text-textDark">{nombreTitular}</Text>
                  <Icon
                    name={identidadVerificada ? "check-circle" : "lock"}
                    size={16}
                    color={colors.primary}
                  />
                </View>
              ) : (
                <TextInput
                  className="h-12 border-[1.5px] border-gray-200 rounded-xl px-4 text-[15px] text-textDark bg-white justify-center"
                  value={form.titular}
                  onChangeText={(v) => setForm((p) => ({ ...p, titular: v }))}
                  placeholder="Como aparece en tu cuenta"
                  placeholderTextColor={colors.textPlaceholder}
                  accessibilityLabel="Nombre del titular"
                />
              )}
              {nombreTitular ? (
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Icon
                    name={identidadVerificada ? "check-circle" : "shield"}
                    size={12}
                    color={identidadVerificada ? colors.primary : colors.accent700}
                  />
                  <Text className={`text-xs leading-4 flex-1 ${identidadVerificada ? "text-primary" : "text-textMuted"}`}>
                    {identidadVerificada
                      ? "Nombre validado con tu carnet de identidad (KYC)."
                      : "Nombre de tu registro. Debe coincidir con tu carnet de identidad."}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* RUT del titular */}
            <View className="gap-1.5 mb-4">
              <SectionLabel>RUT del titular</SectionLabel>
              <TextInput
                className="h-12 border-[1.5px] border-gray-200 rounded-xl px-4 text-[15px] text-textDark bg-white justify-center"
                value={form.rut}
                onChangeText={(v) => setForm((p) => ({ ...p, rut: v }))}
                placeholder="12.345.678-9"
                placeholderTextColor={colors.textPlaceholder}
                accessibilityLabel="RUT del titular"
              />
            </View>
          </ScrollView>
          <Button label="Guardar cuenta" onPress={guardar} loading={guardando} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
