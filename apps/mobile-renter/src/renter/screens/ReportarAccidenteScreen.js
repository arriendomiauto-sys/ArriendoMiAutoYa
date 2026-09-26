import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import {
  Icon, Button, Card, ScreenHeader, SectionLabel, Checkbox, Field, BottomBar,
  showAlert, msjError, elegirImagen, subirImagenOptimizada, colors,
} from "@rentacar/mobile-shared";
import { reportarSiniestro } from "@rentacar/mobile-shared/siniestros/api";
import { CasoSiniestroCard } from "@rentacar/mobile-shared/siniestros/CasoSiniestroCard";

const EMERGENCIAS = [
  { numero: "131", label: "SAMU (ambulancia)" },
  { numero: "133", label: "Carabineros" },
  { numero: "132", label: "Bomberos" },
];

/**
 * "Tuve un accidente": primero la seguridad (números de emergencia), después
 * el reporte con fotos. Al enviarlo se abre el caso con el soporte 24/7, se
 * avisa al dueño y la garantía queda asegurada hasta que se resuelva.
 */
export function ReportarAccidenteScreen({ reservation, onBack, onReportado }) {
  const [paso, setPaso] = useState("seguridad"); // seguridad | reporte | listo
  const [lesionados, setLesionados] = useState(false);
  const [terceros, setTerceros] = useState(false);
  const [noCircula, setNoCircula] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [partePolicial, setPartePolicial] = useState("");
  const [datosTercero, setDatosTercero] = useState("");
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [caso, setCaso] = useState(null);

  const agregarFoto = async (origen) => {
    const uri = await elegirImagen({ origen, motivoPermiso: "Necesitamos la cámara para registrar el accidente." });
    if (!uri) return;
    setSubiendo(true);
    try {
      // Optimizada: en la calle y con mala señal, sube en segundos.
      const url = await subirImagenOptimizada(uri, { filename: `accidente-${Date.now()}.jpg`, bucket: "evidencias" });
      setFotos((p) => [...p, url]);
    } catch (err) {
      showAlert("No se pudo subir la foto", msjError(err, "Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setSubiendo(false);
    }
  };

  const ubicacionActual = async () => {
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (!permiso.granted) return {};
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
    } catch {
      return {}; // Sin ubicación el reporte igual sirve.
    }
  };

  const enviar = async () => {
    if (enviando) return;
    if (descripcion.trim().length < 10) {
      showAlert("Cuéntanos qué pasó", "Describe el accidente en al menos una frase.");
      return;
    }
    if (!fotos.length && !lesionados) {
      showAlert("Falta una foto", "Adjunta al menos una foto del auto o del lugar.");
      return;
    }
    setEnviando(true);
    try {
      const creado = await reportarSiniestro(reservation.id, {
        descripcion: descripcion.trim(),
        hubo_lesionados: lesionados,
        hay_terceros: terceros,
        auto_puede_circular: !noCircula,
        parte_policial: partePolicial.trim() || null,
        datos_tercero: terceros ? datosTercero.trim() || null : null,
        fotos,
        ...(await ubicacionActual()),
      });
      setCaso(creado);
      setPaso("listo");
      onReportado?.(creado);
    } catch (err) {
      showAlert("No se pudo enviar el reporte", msjError(err, "Intenta de nuevo. Si no hay señal, llama a Carabineros y reintenta después."));
    } finally {
      setEnviando(false);
    }
  };

  if (paso === "listo" && caso) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Accidente reportado" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4">
          <Card padded className="gap-2 items-center">
            <Icon name="check" size={28} color={colors.primary} />
            <Text className="text-lg font-extrabold text-textDark text-center">Tu caso es el {caso.codigo}</Text>
            <Text className="text-[13px] text-textMuted text-center">
              Un agente de soporte 24/7 te va a contactar en los próximos minutos. Ya le avisamos al dueño del auto.
            </Text>
          </Card>
          <Card padded className="gap-2">
            <SectionLabel>Mientras tanto</SectionLabel>
            <Text className="text-[13px] text-textDark">• No firmes acuerdos ni reconozcas culpa con terceros.</Text>
            <Text className="text-[13px] text-textDark">• No dejes el auto sin avisarle a soporte.</Text>
            <Text className="text-[13px] text-textDark">• Guarda cualquier documento que te entreguen (parte, datos del otro conductor).</Text>
          </Card>
          <CasoSiniestroCard reservaId={reservation.id} caso={caso} />
        </ScrollView>
        <BottomBar>
          <Button label="Volver al arriendo" onPress={onBack} />
        </BottomBar>
      </View>
    );
  }

  if (paso === "seguridad") {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Tuve un accidente" subtitle="Primero, tu seguridad" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4">
          <Card padded className="gap-2 bg-red-50 border border-red-200">
            <Text className="text-[15px] font-bold text-textDark">¿Hay personas heridas?</Text>
            <Text className="text-[13px] text-textMuted">
              Llama a emergencias antes de cualquier otra cosa. Si puedes, pon el triángulo y aléjate del tránsito.
            </Text>
          </Card>
          {EMERGENCIAS.map((e) => (
            <Button
              key={e.numero}
              variant={e.numero === "131" ? "danger" : "secondary"}
              iconLeft="phone"
              label={`Llamar al ${e.numero} · ${e.label}`}
              onPress={() => Linking.openURL(`tel:${e.numero}`)}
            />
          ))}
          <Card padded className="gap-1">
            <Text className="text-[13px] text-textMuted">
              Si hubo lesionados o daños a terceros, pide la constancia de Carabineros: después te preguntamos el número.
            </Text>
          </Card>
        </ScrollView>
        <BottomBar>
          <Button label="Estoy a salvo, reportar el accidente" iconRight="arrow-right" onPress={() => setPaso("reporte")} />
        </BottomBar>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Reportar el accidente" subtitle="Le llega al soporte 24/7 y al dueño" onBack={() => setPaso("seguridad")} />
      <ScrollView contentContainerClassName="p-4 gap-4" keyboardShouldPersistTaps="handled">
        <Card padded className="gap-3">
          <Checkbox checked={lesionados} onToggle={() => setLesionados((v) => !v)} label="Hubo personas lesionadas" />
          <Checkbox checked={terceros} onToggle={() => setTerceros((v) => !v)} label="Hay otro vehículo o terceros involucrados" />
          <Checkbox checked={noCircula} onToggle={() => setNoCircula((v) => !v)} label="El auto no puede seguir circulando" />
        </Card>

        <Field
          label="¿Qué pasó?"
          placeholder="Ej: me chocaron por atrás en un semáforo en Av. Collao"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          maxLength={3000}
        />
        {terceros && (
          <Field
            label="Datos del otro vehículo"
            placeholder="Patente, nombre del conductor, su aseguradora"
            value={datosTercero}
            onChangeText={setDatosTercero}
            multiline
            maxLength={1000}
          />
        )}
        <Field
          label="N° de parte o constancia (opcional)"
          placeholder="Si Carabineros te dio uno"
          value={partePolicial}
          onChangeText={setPartePolicial}
          maxLength={100}
        />

        <Card padded className="gap-3">
          <View className="flex-row items-center justify-between">
            <SectionLabel>Fotos del auto y del lugar</SectionLabel>
            {subiendo && <ActivityIndicator color={colors.primary} />}
          </View>
          {fotos.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {fotos.map((uri, i) => (
                <TouchableOpacity
                  key={uri + i}
                  onPress={() => setFotos((p) => p.filter((_, j) => j !== i))}
                  accessibilityLabel={`Quitar foto ${i + 1}`}
                >
                  <Image source={{ uri }} className="w-16 h-16 rounded-lg bg-border" />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View className="flex-row gap-2">
            <Button variant="secondary" size="sm" iconLeft="camera" label="Tomar foto" onPress={() => agregarFoto("camera")} disabled={subiendo} className="flex-1" />
            <Button variant="secondary" size="sm" iconLeft="image" label="Galería" onPress={() => agregarFoto("gallery")} disabled={subiendo} className="flex-1" />
          </View>
          <Text className="text-[12px] text-textMuted">
            Daños del auto, la patente del otro vehículo y el lugar. Toca una foto para quitarla.
          </Text>
        </Card>
      </ScrollView>
      <BottomBar>
        <Button variant="danger" label="Enviar reporte a soporte 24/7" onPress={enviar} loading={enviando} disabled={enviando || subiendo} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}
