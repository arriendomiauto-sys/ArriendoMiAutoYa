import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, Icon, Button, Badge, ApiClient, showAlert, msjError } from "@rentacar/mobile-shared";
import { CabeceraOwner } from "../comun";

function fmtFecha(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function SeccionMantencion({ titulo, lista, render, onAdd, ctaLabel }) {
  return (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-2 shadow-sm mb-4">
      <Text className="text-base font-bold text-primary">{titulo}</Text>
      {lista.length === 0 ? (
        <Text className="text-[13px] text-textMuted py-1.5">Sin registros todavía.</Text>
      ) : (
        lista.map((m, i) => (
          <View
            key={m.id}
            className={`flex-row items-center justify-between gap-3 py-2.5 ${
              i < lista.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <View className="flex-1">
              <Text className="text-sm font-semibold text-textDark">{m.nombre}</Text>
              <Text className="text-xs text-textMuted mt-0.5">{render(m)}</Text>
            </View>
            <Badge variant="success" label="Registrado" />
          </View>
        ))
      )}
      <TouchableOpacity
        className="flex-row items-center justify-center gap-1.5 mt-1 py-2.5 rounded-xl bg-surface-subtle border border-dashed border-gray-300"
        onPress={onAdd}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={15} color={colors.accentDark} />
        <Text className="text-accent-700 text-[13px] font-semibold">{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CarMaintenanceScreen({ car, onBack }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [f, setF] = useState({ nombre: "", fecha: "", km: "", notas: "" });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async (esRefresh = false) => {
    if (!car?.id) return;
    if (esRefresh) setRefrescando(true);
    else setLoading(true);
    setError(null);
    try {
      setItems((await ApiClient.getMantenciones(car.id)) || []);
    } catch (err) {
      setError(msjError(err, "No se pudieron cargar los mantenimientos."));
    } finally {
      if (esRefresh) setRefrescando(false);
      else setLoading(false);
    }
  }, [car?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { documentos, servicios } = useMemo(
    () => ({
      documentos: items.filter((m) => m.tipo === "documento_legal"),
      servicios: items.filter((m) => m.tipo === "servicio_mecanico"),
    }),
    [items]
  );

  const guardar = async () => {
    if (saving) return;
    if (!f.nombre.trim()) {
      showAlert("Falta el nombre", "Ingresa el nombre del documento o servicio.");
      return;
    }
    // Validación de fecha para documento legal
    let fechaIso = null;
    if (form.tipo === "documento_legal" && f.fecha && f.fecha.trim()) {
      const fechaLimpia = f.fecha.trim();
      const parsedDate = new Date(fechaLimpia);
      if (isNaN(parsedDate.getTime())) {
        showAlert("Fecha inválida", "Ingresa la fecha de vencimiento en formato AAAA-MM-DD (ej: 2027-05-30) o déjala en blanco.");
        return;
      }
      fechaIso = parsedDate.toISOString();
    }

    // Validación de kilometraje para servicio mecánico
    let kmNum = null;
    if (form.tipo === "servicio_mecanico" && f.km && f.km.trim()) {
      kmNum = parseInt(f.km.trim(), 10);
      if (isNaN(kmNum) || kmNum < 0) {
        showAlert("Kilometraje inválido", "El kilometraje debe ser un número entero mayor o igual a 0.");
        return;
      }
    }

    setSaving(true);
    try {
      const nuevo = await ApiClient.crearMantencion(car.id, {
        tipo: form.tipo,
        nombre: f.nombre.trim(),
        fecha_vencimiento: fechaIso,
        kilometraje: kmNum,
        notas: f.notas.trim() || null,
      });
      setForm(null);
      setF({ nombre: "", fecha: "", km: "", notas: "" });
      if (nuevo?.id) setItems((p) => [nuevo, ...p]);
      else cargar();
    } catch (err) {
      showAlert("No se pudo guardar", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <CabeceraOwner
        titulo="Mantenimientos"
        subtitulo={car ? `${car.marca} ${car.modelo} · ${car.patente || "—"}` : "Selecciona un auto"}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}
        className="px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} className="mt-8" />
        ) : error ? (
          <Text className="text-red-500 text-[13px] mt-5 text-center">{error}</Text>
        ) : (
          <>
            <SeccionMantencion
              titulo="Documentación legal"
              lista={documentos}
              render={(d) => (d.fecha_vencimiento ? `Vence: ${fmtFecha(d.fecha_vencimiento)}` : "Sin fecha de vencimiento")}
              onAdd={() => setForm({ tipo: "documento_legal" })}
              ctaLabel="Registrar documento"
            />
            <SeccionMantencion
              titulo="Bitácora de taller"
              lista={servicios}
              render={(m) => (m.kilometraje ? `A los ${m.kilometraje.toLocaleString("es-CL")} km` : fmtFecha(m.creado_en))}
              onAdd={() => setForm({ tipo: "servicio_mecanico" })}
              ctaLabel="Registrar mantención"
            />
          </>
        )}
      </ScrollView>

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView className="flex-1 bg-[#061E1F]/50 justify-center p-5" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="bg-white rounded-2xl p-5 border border-gray-100 gap-3 shadow-lg">
            <Text className="text-[17px] font-bold text-textDark">
              {form?.tipo === "documento_legal" ? "Nuevo documento legal" : "Nueva mantención"}
            </Text>
            <ScrollView
              className="max-h-[300px]"
              contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                className="bg-white rounded-xl px-3.5 py-3 text-[15px] text-textDark border-[1.5px] border-gray-200"
                placeholder={form?.tipo === "documento_legal" ? "ej. Revisión técnica" : "ej. Cambio de aceite"}
                placeholderTextColor={colors.textPlaceholder}
                value={f.nombre}
                onChangeText={(v) => setF((p) => ({ ...p, nombre: v }))}
              />
              {form?.tipo === "documento_legal" ? (
                <TextInput
                  className="bg-white rounded-xl px-3.5 py-3 text-[15px] text-textDark border-[1.5px] border-gray-200"
                  placeholder="Vencimiento (AAAA-MM-DD)"
                  placeholderTextColor={colors.textPlaceholder}
                  value={f.fecha}
                  onChangeText={(v) => setF((p) => ({ ...p, fecha: v }))}
                />
              ) : (
                <TextInput
                  className="bg-white rounded-xl px-3.5 py-3 text-[15px] text-textDark border-[1.5px] border-gray-200"
                  placeholder="Kilometraje (opcional)"
                  placeholderTextColor={colors.textPlaceholder}
                  value={f.km}
                  onChangeText={(v) => setF((p) => ({ ...p, km: v }))}
                  keyboardType="number-pad"
                />
              )}
              <TextInput
                className="bg-white rounded-xl px-3.5 py-3 text-[15px] text-textDark border-[1.5px] border-gray-200 min-h-[72px]"
                style={{ textAlignVertical: "top" }}
                placeholder="Notas (opcional)"
                placeholderTextColor={colors.textPlaceholder}
                value={f.notas}
                onChangeText={(v) => setF((p) => ({ ...p, notas: v }))}
                multiline
              />
            </ScrollView>
            <View className="flex-row gap-3 mt-1">
              <Button variant="secondary" label="Cancelar" onPress={() => setForm(null)} className="flex-1" />
              <Button label="Guardar" onPress={guardar} loading={saving} className="flex-1" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
