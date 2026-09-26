import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  StatusBar,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApp, Icon, Button, Card, ScreenHeader, SectionLabel, Chip,
  ApiClient, showAlert, msjError, elegirImagen, subirImagenOptimizada,
} from "@rentacar/mobile-shared";

const TIPOS = [
  { id: "colision", label: "Colisión / choque" },
  { id: "panne", label: "Panne mecánica" },
  { id: "neumatico", label: "Pinchazo" },
  { id: "robo", label: "Robo / daño a terceros" },
];
const LABEL = Object.fromEntries(TIPOS.map((t) => [t.id, t.label]));
// Estos son siniestros: con el arriendo en curso van al reporte de accidente
// (caso con soporte 24/7, aviso al dueño y garantía asegurada), no a un ticket.
const ES_ACCIDENTE = new Set(["colision", "robo"]);

export function RoadsideClaimScreen({ onBack, onComplete, onReportarAccidente }) {
  const insets = useSafeAreaInsets();
  const { activeReservation } = useApp();
  const [tipo, setTipo] = useState("colision");
  const [descripcion, setDescripcion] = useState("");
  const [tercero, setTercero] = useState({ patente: "", conductor: "", aseguradora: "" });
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [solicitandoGrua, setSolicitandoGrua] = useState(false);
  const derivarAAccidente =
    ES_ACCIDENTE.has(tipo) && activeReservation?.estado === "en_curso" && Boolean(onReportarAccidente);

  const addFoto = async () => {
    const uri = await elegirImagen({
      origen: "camera",
      motivoPermiso: "Necesitamos la cámara para adjuntar el daño.",
    });
    if (!uri) return;

    setSubiendo(true);
    try {
      // Optimizada sube en segundos en vez de decenas: el usuario está en la
      // carretera y probablemente con mala señal.
      const url = await subirImagenOptimizada(uri, {
        filename: `siniestro-${Date.now()}.jpg`,
        bucket: "evidencias",
      });
      setFotos((p) => [...p, url]);
    } catch (err) {
      showAlert("No se pudo subir la foto", msjError(err, "Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setSubiendo(false);
    }
  };

  const solicitarGrua = async () => {
    if (solicitandoGrua) return;
    setSolicitandoGrua(true);
    try {
      await ApiClient.crearTicketSoporte(
        "Solicitud de grúa urgente",
        `Auxilio mecánico.${activeReservation?.id ? ` Reserva: ${activeReservation.id}.` : ""} Incidente: ${LABEL[tipo]}.`
      );
      showAlert("Solicitud enviada", "Se notificó a soporte para coordinar la grúa. Te contactarán a la brevedad.");
    } catch (err) {
      showAlert("No se pudo enviar", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setSolicitandoGrua(false);
    }
  };

  const enviarReporte = async () => {
    if (enviando) return;
    if (!descripcion.trim()) {
      showAlert("Falta la descripción", "Describe brevemente lo sucedido.");
      return;
    }
    setEnviando(true);
    try {
      const detalle = [
        `Tipo: ${LABEL[tipo]}`,
        activeReservation?.id ? `Reserva: ${activeReservation.id}` : null,
        `Descripción: ${descripcion.trim()}`,
        tercero.patente ? `Patente tercero: ${tercero.patente}` : null,
        tercero.conductor ? `Conductor tercero: ${tercero.conductor}` : null,
        tercero.aseguradora ? `Aseguradora tercero: ${tercero.aseguradora}` : null,
        fotos.length ? `Fotos: ${fotos.join(", ")}` : "Sin fotos adjuntas",
      ].filter(Boolean).join("\n");
      const ticket = await ApiClient.crearTicketSoporte("Auxilio en ruta / siniestro", detalle);
      showAlert(
        "Reporte ingresado",
        `Ticket #${ticket.id.slice(0, 8).toUpperCase()} creado. Soporte revisará tu caso y coordinará auxilio y/o aseguradora.`,
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    } catch (err) {
      showAlert("No se pudo enviar el reporte", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Auxilio en ruta" subtitle="Siniestros y asistencia 24/7" onBack={onBack} />

      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-2">
          <Button variant="danger" label="Solicitar grúa" iconLeft="shield" onPress={solicitarGrua} loading={solicitandoGrua} disabled={solicitandoGrua} className="flex-1" />
          <Button label="Carabineros 133" onPress={() => Linking.openURL("tel:133")} className="flex-1" />
        </View>

        <Card padded className="gap-3">
          <SectionLabel>Tipo de incidente</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {TIPOS.map((t) => (
              <Chip key={t.id} label={t.label} selected={tipo === t.id} onPress={() => setTipo(t.id)} />
            ))}
          </View>
        </Card>

        {derivarAAccidente ? (
          <Card padded className="gap-2 bg-red-50 border border-red-200">
            <Text className="text-[15px] font-bold text-textDark">Esto se reporta como accidente</Text>
            <Text className="text-[13px] text-textMuted">
              Se abre un caso con el soporte 24/7, le avisamos al dueño del auto y todo lo que se decida les llega
              por escrito a ambos. Primero te mostramos los números de emergencia.
            </Text>
          </Card>
        ) : (
        <>
        <Card padded className="gap-2">
          <SectionLabel>Detalle de lo ocurrido</SectionLabel>
          <TextInput
            className="min-h-[90px] border-[1.5px] border-border rounded-xl bg-white p-3.5 text-[15px] text-textDark"
            placeholder="Lugar exacto, calle, intersección y cómo ocurrió…"
            placeholderTextColor="#94A3B8"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            textAlignVertical="top"
          />
        </Card>

        {tipo === "colision" && (
          <Card padded className="gap-3">
            <SectionLabel>Tercero involucrado (opcional)</SectionLabel>
            {[
              { k: "patente", label: "Patente del otro auto", cap: "characters" },
              { k: "conductor", label: "Nombre del conductor" },
              { k: "aseguradora", label: "Aseguradora del tercero" },
            ].map((f) => (
              <View key={f.k} className="gap-1.5">
                <Text className="text-[13px] text-textMuted font-medium">{f.label}</Text>
                <TextInput
                  className="h-10 border-[1.5px] border-border rounded-xl bg-white px-3.5 text-[15px] text-textDark"
                  value={tercero[f.k]}
                  onChangeText={(v) => setTercero((p) => ({ ...p, [f.k]: v }))}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize={f.cap || "sentences"}
                />
              </View>
            ))}
          </Card>
        )}

        <Card padded className="gap-3">
          <SectionLabel>Registro fotográfico del daño</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {fotos.map((p, i) => (
              <Image key={i} source={{ uri: p }} className="w-16 h-16 rounded-lg" />
            ))}
            <TouchableOpacity className="w-16 h-16 rounded-lg border-[1.5px] border-dashed border-teal-200 items-center justify-center bg-teal-50" onPress={addFoto} disabled={subiendo}>
              {subiendo ? <ActivityIndicator size="small" color="#0F766E" /> : <Icon name="camera" size={20} color="#0F766E" />}
            </TouchableOpacity>
          </View>
        </Card>
        </>
        )}
      </ScrollView>

      <View
        className="px-4 pt-3 bg-white border-t border-border"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        {derivarAAccidente ? (
          <Button variant="danger" label="Reportar el accidente" iconRight="arrow-right" onPress={onReportarAccidente} />
        ) : (
          <Button label="Enviar solicitud de asistencia" iconRight="arrow-right" onPress={enviarReporte} loading={enviando} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

