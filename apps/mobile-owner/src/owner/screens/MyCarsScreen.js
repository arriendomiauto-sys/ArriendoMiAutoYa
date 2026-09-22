import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  Button,
  EmptyState,
  Skeleton,
  ApiClient,
  showAlert,
  msjError,
  VerifyIdentityBanner,
  useCatalogoPrecios,
  obtenerConfiguracionTipo,
  clampTarifa,
  calcularDesgloseIva,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, FranjaResumen, oc } from "../comun";
import { ControlTarifa } from "./addcar/ControlTarifa";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

// Miniatura del auto usando NativeWind
function CarroThumb({ uri }) {
  const [cargando, setCargando] = useState(!!uri);
  if (!uri) {
    return (
      <View className="w-full h-full items-center justify-center bg-primary-100">
        <Icon name="car" size={44} color={colors.primary200} />
      </View>
    );
  }
  return (
    <>
      {cargando && <Skeleton style={{ width: "100%", height: "100%" }} />}
      <Image
        source={{ uri }}
        className="w-full h-full"
        resizeMode="cover"
        onLoadEnd={() => setCargando(false)}
        onError={() => setCargando(false)}
      />
    </>
  );
}

export function MyCarsScreen({
  cars,
  setCars,
  error,
  loading = false,
  onRetry,
  onAddNewCar,
  onOpenCalendar,
  onOpenMaintenance,
  onOpenVerificacion,
  onOpenChat,
  onOpenEarnings,
  noLeidos,
  identidadVerificada,
  onVerifyIdentity,
}) {
  const insets = useSafeAreaInsets();
  const tipos = useCatalogoPrecios();
  const [editingCar, setEditingCar] = useState(null);
  const [tarifaSeleccionada, setTarifaSeleccionada] = useState(0);
  const [saving, setSaving] = useState(false);

  const tipoConfig = obtenerConfiguracionTipo(editingCar?.categoria, tipos);
  const desgloseTarifa = calcularDesgloseIva(tarifaSeleccionada);

  const disponibles = (cars || []).filter((c) => c.estado === "activo").length;
  const potencialDia = (cars || [])
    .filter((c) => c.estado === "activo")
    .reduce((s, c) => s + Math.round((c.tarifa_dia || 0) * 0.85), 0);

  const toggleCarAvailability = async (car) => {
    if (!car.documentos_verificados || car.estado === "pendiente") {
      showAlert(
        "Documentos pendientes de aprobación",
        "Tu vehículo no puede activarse en el sistema porque sus documentos aún no han sido verificados por el equipo."
      );
      return;
    }
    const nuevoEstado = car.estado === "pausado" ? "activo" : "pausado";
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, estado: nuevoEstado } : c)));
    try {
      await ApiClient.actualizarAuto(car.id, { estado: nuevoEstado });
    } catch (err) {
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, estado: car.estado } : c)));
      showAlert("No se pudo actualizar", msjError(err, "Intenta de nuevo en unos segundos."));
    }
  };

  const handleOpenEdit = (car) => {
    const cat = obtenerConfiguracionTipo(car?.categoria, tipos);
    const inicial = clampTarifa(car?.tarifa_dia || cat.base, cat);
    setEditingCar(car);
    setTarifaSeleccionada(inicial);
  };

  const handleAjustarTarifa = (delta) => {
    setTarifaSeleccionada((prev) => clampTarifa(prev + delta, tipoConfig));
  };

  const handleFijarTarifa = (precio) => {
    setTarifaSeleccionada(clampTarifa(precio, tipoConfig));
  };

  const handleSaveRate = async () => {
    if (saving || !editingCar) return;
    const tarifaNum = clampTarifa(tarifaSeleccionada, tipoConfig);
    setSaving(true);
    try {
      const actualizado = await ApiClient.actualizarAuto(editingCar.id, { tarifa_dia: tarifaNum });
      setCars((prev) => prev.map((c) => (c.id === editingCar.id ? actualizado : c)));
      setEditingCar(null);
      showAlert("Tarifa actualizada", `Nueva tarifa: ${fmt(tarifaNum)} por día.`);
    } catch (err) {
      showAlert("No se pudo guardar la tarifa", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setSaving(false);
    }
  };

  const renderCar = ({ item }) => {
    const docsOk = Boolean(item.documentos_verificados);
    const esPendiente = item.estado === "pendiente" || !docsOk;
    const disponible = item.estado === "activo" && docsOk;
    const tarifa = item.tarifa_dia || 0;
    const ganancia = Math.round(tarifa * 0.85);

    return (
      <View className="bg-surface rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-0">
        <View className="h-[150px] bg-surface-secondary relative">
          <CarroThumb uri={item.fotos?.[0]} />
          <View className="absolute top-3 left-3 bg-white/95 rounded-full py-1 px-2.5 flex-row items-center gap-1.5 shadow-sm">
            <View
              className={`w-1.5 h-1.5 rounded-full ${
                esPendiente ? "bg-amber-500" : disponible ? "bg-accent-500" : "bg-gray-400"
              }`}
            />
            <Text
              className={`text-xs font-bold ${
                esPendiente ? "text-amber-700" : disponible ? "text-accent-700" : "text-gray-500"
              }`}
            >
              {esPendiente ? "Pendiente" : disponible ? "Disponible" : "Pausado"}
            </Text>
          </View>
        </View>

        <View className="p-4 gap-3.5">
          <View>
            <Text className="text-base font-bold text-textDark">
              {item.marca} {item.modelo} {item.anio || ""}
            </Text>
            <Text className="text-[13px] text-textMuted mt-0.5">
              {item.ubicacion_base || "Los Ángeles"} · {item.patente || "—"}
            </Text>
          </View>

          {!docsOk && (
            <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
              <Icon name="warning" size={14} color={colors.warning} />
              <Text className="text-xs text-amber-800 font-semibold">Documentos en revisión</Text>
            </View>
          )}

          <View className="flex-row items-center gap-3 p-3.5 rounded-xl bg-primary-100">
            <View className="flex-1">
              <Text className="text-[11px] text-textMuted font-semibold">Tarifa / día</Text>
              <Text className="text-[15px] font-extrabold text-textDark mt-0.5">{fmt(tarifa)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-textMuted font-semibold">Recibes (85%)</Text>
              <Text className="text-[15px] font-extrabold text-accent-700 mt-0.5">{fmt(ganancia)}</Text>
            </View>
            <TouchableOpacity
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-lg bg-primary active:opacity-80"
              onPress={() => handleOpenEdit(item)}
              accessibilityRole="button"
              accessibilityLabel={`Editar tarifa de ${item.marca} ${item.modelo}`}
              hitSlop={theme.control.hitSlop}
            >
              <Icon name="settings" size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Editar</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between items-center pt-3 border-t border-gray-200">
            <Text className="text-[13px] text-textDark font-medium">Disponible para arriendos</Text>
            <Switch
              value={disponible}
              disabled={esPendiente}
              onValueChange={() => toggleCarAvailability(item)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-surface-subtle py-2.5 rounded-xl border border-gray-200 active:opacity-75"
              onPress={() => onOpenCalendar?.(item)}
              activeOpacity={0.8}
              hitSlop={theme.control.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Calendario de ${item.marca} ${item.modelo}`}
            >
              <Icon name="calendar" size={15} color={colors.primary} />
              <Text className="text-xs font-semibold text-textDark">Calendario</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-surface-subtle py-2.5 rounded-xl border border-gray-200 active:opacity-75"
              onPress={() => onOpenMaintenance?.(item)}
              activeOpacity={0.8}
              hitSlop={theme.control.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={`Mantenciones de ${item.marca} ${item.modelo}`}
            >
              <Icon name="settings" size={15} color={colors.primary} />
              <Text className="text-xs font-semibold text-textDark">Mantenciones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border ${
                docsOk ? "bg-emerald-50 border-emerald-300" : "bg-surface-subtle border-gray-200 active:opacity-75"
              }`}
              onPress={() => {
                if (docsOk) {
                  showAlert("Documentos validados", "Los documentos de este vehículo ya están verificados y aprobados.");
                  return;
                }
                onOpenVerificacion?.(item);
              }}
              activeOpacity={docsOk ? 0.9 : 0.8}
              hitSlop={theme.control.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={docsOk ? `Documentos validados de ${item.marca} ${item.modelo}` : `Verificar ${item.marca} ${item.modelo}`}
            >
              <Icon name={docsOk ? "check" : "shield"} size={15} color={docsOk ? colors.accentDark : colors.primary} />
              <Text className={`text-xs font-semibold ${docsOk ? "text-accent-700 font-bold" : "text-textDark"}`}>
                {docsOk ? "Validado" : "Verificar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <CabeceraOwner
        titulo="Mi flota"
        subtitulo={
          cars?.length
            ? `${cars.length} ${cars.length === 1 ? "vehículo" : "vehículos"} · ${disponibles} disponible${disponibles === 1 ? "" : "s"}`
            : error
              ? "No pudimos cargar tu flota"
              : loading
                ? "Cargando tu flota..."
                : "Publica tu primer auto"
        }
        noLeidos={noLeidos}
        onMensajes={onOpenChat}
      />

      {!identidadVerificada && (
        <View className="px-4 pb-3">
          <VerifyIdentityBanner role="owner" onPress={onVerifyIdentity} />
        </View>
      )}

      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 gap-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          cars?.length ? (
            <TouchableOpacity onPress={onOpenEarnings} activeOpacity={0.9} accessibilityRole="button">
              <FranjaResumen
                items={[
                  { value: cars.length, label: "Autos" },
                  { value: disponibles, label: "Disponibles" },
                  { value: `$${Math.round(potencialDia / 1000)}k`, label: "Potencial / día" },
                ]}
              />
            </TouchableOpacity>
          ) : null
        }
        renderItem={renderCar}
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center gap-3 py-10">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-sm text-textMuted">Cargando tu flota...</Text>
            </View>
          ) : error ? (
            <EmptyState
              icon="alert"
              title="No pudimos cargar tu flota"
              message={`${error} Tus autos siguen publicados; vuelve a intentarlo.`}
              action="Reintentar"
              onAction={onRetry}
            />
          ) : (
            <EmptyState
              icon="car"
              title="Todavía no tienes autos publicados"
              message="Publica tu vehículo con fotos y documentos para empezar a recibir arriendos."
              action="Publicar un auto"
              onAction={onAddNewCar}
            />
          )
        }
      />

      <Modal visible={!!editingCar} transparent animationType="fade" onRequestClose={() => setEditingCar(null)}>
        <KeyboardAvoidingView className="flex-1 bg-black/45 justify-center p-6" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="bg-surface rounded-2xl p-6 border border-gray-200 gap-4 max-h-[90%] shadow-2xl">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[17px] font-bold text-textDark">Ajustar tarifa diaria</Text>
                <Text className="text-[13px] text-textMuted mt-0.5">
                  {editingCar?.marca} {editingCar?.modelo} · {editingCar?.patente}
                </Text>
              </View>
              <View className="bg-primary-100 border border-primary-200 px-2.5 py-1 rounded-lg">
                <Text className="text-xs font-bold text-primary">{tipoConfig?.labelCorto || tipoConfig?.label}</Text>
              </View>
            </View>

            <ScrollView
              className="max-h-[440px]"
              contentContainerClassName="gap-4 py-1"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ControlTarifa
                tipo={tipoConfig}
                valor={tarifaSeleccionada}
                desglose={desgloseTarifa}
                onAjustar={handleAjustarTarifa}
                onFijar={handleFijarTarifa}
              />
            </ScrollView>

            <View className="flex-row gap-3.5 mt-1">
              <Button variant="secondary" label="Cancelar" onPress={() => setEditingCar(null)} style={{ flex: 1 }} />
              <Button label="Guardar tarifa" onPress={handleSaveRate} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
