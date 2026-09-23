import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
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
import { colors, Icon, Button, Badge, ApiClient, showAlert, msjError, CarPhotoThumb, usePhotoViewer } from "@rentacar/mobile-shared";
import { CabeceraOwner } from "../comun";
import { DOCS } from "./addcar/useCarWizard";

// Los 5 documentos legales que se piden al publicar el auto (ver PasoDocumentos
// / router de creación). Se leen directo de las URLs que ya trae `car` -- el
// backend solo se las devuelve al dueño o a un admin (_sanear_auto_out), así
// que acá siempre hay permiso de verlas.
const DOCUMENTOS_LEGALES = [
  { key: "doc_inscripcion_url", nombre: "Padrón / Certificado de inscripción" },
  { key: "doc_permiso_circulacion_url", nombre: "Permiso de circulación" },
  { key: "doc_soap_url", nombre: "SOAP" },
  { key: "doc_revision_tecnica_url", nombre: "Revisión técnica" },
  { key: "doc_certificado_gases_url", nombre: "Certificado de emisión de gases" },
];

// Estado del documento según lo que leyó el OCR al subirlo (car.documentos_ocr).
// `vence` viene como "AAAA-MM-DD": se ancla a mediodía para que el huso
// horario no lo corra un día al formatearlo.
function estadoDocumento(ocr) {
  if (!ocr?.vence) return { variant: "success", label: "Subido", vence: null };
  const vence = new Date(`${ocr.vence}T12:00:00`);
  const dias = Math.ceil((vence - new Date()) / 86400000);
  if (ocr.vencido || dias < 0) return { variant: "danger", label: "Vencido", vence };
  if (dias <= 30) return { variant: "warning", label: "Por vencer", vence };
  return { variant: "success", label: "Vigente", vence };
}

function SeccionDocumentosVehiculo({ car }) {
  const abrirVisor = usePhotoViewer();
  return (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm mb-4">
      <View>
        <Text className="text-base font-bold text-primary">Documentos del vehículo</Text>
        <Text className="text-[12px] text-textMuted mt-0.5">
          Los que subiste al publicarlo. Tócalos para verlos en grande.
        </Text>
      </View>
      {DOCUMENTOS_LEGALES.map((d, i) => {
        const uri = car?.[d.key];
        const ocr = car?.documentos_ocr?.[d.key];
        const estado = estadoDocumento(ocr);
        return (
          <TouchableOpacity
            key={d.key}
            className={`flex-row items-center gap-3 py-2.5 ${
              i < DOCUMENTOS_LEGALES.length - 1 ? "border-b border-gray-100" : ""
            }`}
            disabled={!uri}
            onPress={() => uri && abrirVisor([uri])}
            activeOpacity={0.75}
            accessibilityRole={uri ? "button" : undefined}
            accessibilityLabel={uri ? `Ver ${d.nombre}` : `${d.nombre}, no subido`}
          >
            <CarPhotoThumb uri={uri} className="w-12 h-12 rounded-lg" iconSize={18} resizeMode="cover" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-textDark">{d.nombre}</Text>
              {uri && estado.vence ? (
                <Text className="text-xs text-textMuted mt-0.5">Vence: {fmtFecha(estado.vence)}</Text>
              ) : null}
              {uri && ocr?.folio ? (
                <Text className="text-xs text-textMuted mt-0.5">Folio: {ocr.folio}</Text>
              ) : null}
              {!uri || (!estado.vence && !ocr?.folio) ? (
                <Text className="text-xs text-textMuted mt-0.5">
                  {uri ? "Toca para ver el documento" : "Todavía no lo subiste"}
                </Text>
              ) : null}
            </View>
            {uri ? (
              <Badge variant={estado.variant} label={estado.label} />
            ) : (
              <Badge variant="neutral" label="Falta" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function fmtFecha(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Documentos que el dueño subió al enrolar el auto (padrón, permiso de
 * circulación, SOAP, revisión técnica…). Viven en el propio auto como
 * `doc_*_url`, no en la tabla de mantenciones, así que se listan aparte de
 * los registros que se agregan a mano — pero en la misma sección, que es
 * donde el dueño los va a buscar.
 */
function DocumentosDelAuto({ car, onVer }) {
  const subidos = DOCS.map((doc) => ({ doc, url: car?.[doc.key] })).filter((d) => d.url);

  if (subidos.length === 0) {
    return (
      <Text className="text-[13px] text-textMuted py-1.5">
        Este auto no tiene documentos cargados desde el enrolamiento.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {subidos.map(({ doc, url }, i) => (
        <TouchableOpacity
          key={doc.key}
          className={`flex-row items-center gap-3 py-2.5 ${
            i < subidos.length - 1 ? "border-b border-gray-100" : ""
          }`}
          onPress={() => onVer(url)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${doc.titulo} en grande`}
        >
          <Image source={{ uri: url }} className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-textDark">{doc.titulo}</Text>
            <Text className="text-xs text-textMuted mt-0.5">Subido al enrolar el auto</Text>
          </View>
          <Icon name="search" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SeccionMantencion({ titulo, lista, render, onAdd, ctaLabel, children }) {
  return (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-2 shadow-sm mb-4">
      <Text className="text-base font-bold text-primary">{titulo}</Text>
      {children}
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
  const [docVisor, setDocVisor] = useState(null);

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
            <SeccionDocumentosVehiculo car={car} />
            <SeccionMantencion
              titulo="Otros vencimientos y documentos"
              lista={documentos}
              render={(d) => (d.fecha_vencimiento ? `Vence: ${fmtFecha(d.fecha_vencimiento)}` : "Sin fecha de vencimiento")}
              onAdd={() => setForm({ tipo: "documento_legal" })}
              ctaLabel="Registrar documento"
            >
              <DocumentosDelAuto car={car} onVer={setDocVisor} />
              <Text className="text-[11px] font-bold tracking-wider text-textMuted uppercase mt-2">
                Registrados a mano
              </Text>
            </SeccionMantencion>
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

      {/* Visor simple, a propósito sin zoom: un documento legal se revisa
          entero (que esté el que corresponde y se vea vigente), no en
          detalle, y el pellizco solo estorbaba. Para el zoom está PhotoViewer,
          que se usa en las fotos del auto. */}
      <Modal visible={!!docVisor} transparent animationType="fade" onRequestClose={() => setDocVisor(null)}>
        <View className="flex-1 bg-black/90">
          <View className="flex-row justify-end px-4" style={{ paddingTop: Math.max(insets.top, 12) }}>
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
              onPress={() => setDocVisor(null)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar el documento"
            >
              <Icon name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {docVisor ? (
            <Image source={{ uri: docVisor }} className="flex-1 w-full" resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

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
