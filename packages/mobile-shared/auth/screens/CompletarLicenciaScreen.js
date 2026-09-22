import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";
import { BackButton } from "../../components/ui";
import { DocumentCameraModal } from "../../components/DocumentCameraModal";
import { ApiClient } from "../../api/client";
import { subirImagenOptimizada, AJUSTES_DOCUMENTO } from "../../utils/imagenes";
import { showAlert } from "../../utils/alert";
import { msjError } from "../../utils/msjError";

function cargarEscanerDocumento() {
  try {
    const mod = require("react-native-document-scanner-plugin");
    const scanner = mod?.default ?? mod;
    if (typeof scanner?.scanDocument !== "function") return null;
    return {
      scanDocument: (opts) => scanner.scanDocument(opts),
      ResponseType: mod.ResponseType,
      Estado: mod.ScanDocumentResponseStatus,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Mini-flujo de licencia para un usuario YA verificado (típicamente se
 * enroló como dueño, que no pide licencia) que ahora quiere arrendar.
 *
 * Reusa la identidad que ya tiene en ficha: acá va solo la licencia de
 * conducir —y, para extranjeros, el Permiso Internacional (PIC) y la
 * residencia—. No repite cédula, selfie ni tarjeta, y no cobra ningún hold.
 *
 * Props:
 *  - onDone(): la licencia quedó validada o en revisión; volver a lo que
 *    el usuario estaba haciendo (normalmente, reservar).
 *  - onCancel(): salió sin completar.
 */
export function CompletarLicenciaScreen({ onDone, onCancel }) {
  const { currentUser, syncProfile } = useApp();
  const esExtranjero = !!currentUser?.tipo_documento && currentUser.tipo_documento !== "rut";

  const [licenciaUrl, setLicenciaUrl] = useState(null);
  const [picUrl, setPicUrl] = useState(null);
  const [esResidente, setEsResidente] = useState(!!currentUser?.es_residente_chile);
  const [paisLicencia, setPaisLicencia] = useState(
    (currentUser?.licencia_pais_emisor || currentUser?.pais_documento || "").toUpperCase()
  );
  const [camara, setCamara] = useState(null); // "licencia" | "pic" | null
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enRevision = currentUser?.licencia_estado === "revision";

  const escanearSlot = async (slot) => {
    const escaner = cargarEscanerDocumento();
    if (!escaner) {
      setCamara(slot);
      return;
    }
    setSubiendo(true);
    try {
      const resultado = await escaner.scanDocument({
        responseType: escaner.ResponseType.ImageFilePath,
        croppedImageQuality: 90,
      });
      if (resultado.status !== escaner.Estado.Success || !resultado.scannedImages?.[0]) {
        return;
      }
      const url = await subirImagenOptimizada(resultado.scannedImages[0], {
        filename: `${slot === "pic" ? "permiso_internacional" : "licencia_conducir"}_${Date.now()}.jpg`,
        bucket: "documentos-kyc",
        ...AJUSTES_DOCUMENTO,
      });
      if (slot === "pic") setPicUrl(url);
      else setLicenciaUrl(url);
    } catch (err) {
      showAlert("No se pudo escanear", msjError(err, "Inténtalo de nuevo."));
    } finally {
      setSubiendo(false);
    }
  };

  const handleCaptura = async (uri) => {
    const slot = camara || "licencia";
    setCamara(null);
    if (!uri) return;
    setSubiendo(true);
    try {
      const url = await subirImagenOptimizada(uri, {
        filename: `${slot === "pic" ? "permiso_internacional" : "licencia_conducir"}_${Date.now()}.jpg`,
        bucket: "documentos-kyc",
        ...AJUSTES_DOCUMENTO,
      });
      if (slot === "pic") setPicUrl(url);
      else setLicenciaUrl(url);
    } catch (err) {
      showAlert("No se pudo subir la foto", msjError(err, "Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async () => {
    if (!licenciaUrl) {
      showAlert("Falta tu licencia", "Fotografía tu licencia de conducir para continuar.");
      return;
    }
    if (esExtranjero && paisLicencia.trim().length !== 2) {
      showAlert(
        "Falta el país de la licencia",
        "Indica el país que la emitió con su código de 2 letras (ej. AR, PE, VE)."
      );
      return;
    }
    setEnviando(true);
    try {
      const perfil = await ApiClient.completarLicencia({
        licencia_url: licenciaUrl,
        pic_url: picUrl || undefined,
        licencia_pais_emisor: esExtranjero ? paisLicencia.trim().toUpperCase() : "CL",
        es_residente_chile: esExtranjero ? esResidente : undefined,
      });
      await syncProfile();
      if (perfil?.licencia_estado === "verificada") {
        showAlert("Licencia validada", "Ya puedes reservar autos.", [
          { text: "Continuar", onPress: onDone },
        ]);
      } else {
        showAlert(
          "Licencia en revisión",
          "Un ejecutivo la revisa a mano. Te avisamos apenas puedas reservar (normalmente dentro de unas horas).",
          [{ text: "Entendido", onPress: onDone }]
        );
      }
    } catch (err) {
      showAlert(
        "No se pudo validar tu licencia",
        msjError(err, "Revisa tu conexión e inténtalo de nuevo.")
      );
    } finally {
      setEnviando(false);
    }
  };

  if (enRevision) {
    return (
      <View className="flex-1 bg-surface px-5 pt-4">
        <View className="flex-1 items-center justify-center gap-4">
          <View className="w-[72px] h-[72px] rounded-full bg-amber-100 items-center justify-center">
            <Icon name="clock" size={36} color="#D97706" />
          </View>
          <Text className="text-[21px] font-bold text-gray-900 text-center">Tu licencia está en revisión</Text>
          <Text className="text-sm text-gray-500 text-center leading-[21px] px-2">
            Ya recibimos tu licencia. Un ejecutivo la está revisando — te avisamos
            apenas puedas reservar.
          </Text>
          <TouchableOpacity className="w-full h-[54px] rounded-xl bg-primary-700 items-center justify-center" onPress={onDone}>
            <Text className="text-white text-base font-bold">Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface px-5 pt-4"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <BackButton onPress={onCancel} className="self-start mb-2" />

      <ScrollView contentContainerStyle={{ paddingBottom: 48, alignItems: "center", gap: 16 }} keyboardShouldPersistTaps="handled">
        <View className="w-[68px] h-[68px] rounded-full bg-accent-500 items-center justify-center mt-2">
          <Icon name="camera" size={30} color="#FFFFFF" />
        </View>
        <Text className="text-[21px] font-bold text-gray-900 text-center">Valida tu licencia para arrendar</Text>
        <Text className="text-sm text-gray-500 text-center leading-[21px] px-2">
          Tu identidad ya está verificada. Solo falta tu licencia de conducir —
          fotografíala completa, plana y sin reflejos.
        </Text>

        <View className="w-full bg-white rounded-2xl border border-gray-200 p-4 gap-3">
          <TouchableOpacity
            className={`flex-row items-center gap-2.5 border-[1.5px] rounded-xl px-3.5 py-3.5 ${
              licenciaUrl ? "border-accent-500 bg-accent-500/10" : "border-gray-200"
            }`}
            onPress={() => escanearSlot("licencia")}
            disabled={subiendo || enviando}
            activeOpacity={0.85}
          >
            <Icon
              name={licenciaUrl ? "check" : "camera"}
              size={18}
              color={licenciaUrl ? colors.accent : colors.primary}
            />
            <Text className="flex-1 text-sm font-semibold text-gray-900">
              {licenciaUrl ? "Licencia capturada" : "Fotografiar licencia de conducir"}
            </Text>
          </TouchableOpacity>

          {esExtranjero && (
            <>
              <View className="gap-1.5">
                <Text className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">PAÍS QUE EMITIÓ LA LICENCIA (2 LETRAS)</Text>
                <View className="h-12 border-[1.5px] border-gray-200 rounded-lg bg-surface px-3.5 justify-center">
                  <TextInput
                    className="text-[15px] text-gray-900"
                    value={paisLicencia}
                    onChangeText={(t) => setPaisLicencia(t.toUpperCase().slice(0, 2))}
                    placeholder="Ej. AR"
                    placeholderTextColor={colors.textPlaceholder}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>

              <TouchableOpacity
                className={`flex-row items-center gap-2.5 border-[1.5px] rounded-xl px-3.5 py-3.5 ${
                  esResidente ? "border-accent-500 bg-accent-500/10" : "border-gray-200"
                }`}
                onPress={() => setEsResidente((v) => !v)}
                activeOpacity={0.85}
              >
                <Icon name={esResidente ? "check" : "shield"} size={18} color={colors.primary} />
                <Text className="flex-1 text-sm font-semibold text-gray-900">
                  {esResidente ? "Soy residente en Chile ✓" : "¿Eres residente en Chile?"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-row items-center gap-2.5 border-[1.5px] rounded-xl px-3.5 py-3.5 ${
                  picUrl ? "border-accent-500 bg-accent-500/10" : "border-gray-200"
                }`}
                onPress={() => escanearSlot("pic")}
                disabled={subiendo || enviando}
                activeOpacity={0.85}
              >
                <Icon name={picUrl ? "check" : "camera"} size={18} color={colors.primary} />
                <Text className="flex-1 text-sm font-semibold text-gray-900">
                  {picUrl
                    ? "Permiso Internacional capturado"
                    : "Agregar Permiso Internacional (PIC), si tu país lo requiere"}
                </Text>
              </TouchableOpacity>

              <Text className="text-xs leading-[17px] text-gray-500">
                Si tu país no adhirió al Convenio de Viena, además de la licencia
                necesitas el PIC vigente. Un ejecutivo lo confirma.
              </Text>
            </>
          )}
        </View>

        {subiendo ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-[13px] text-gray-500">Subiendo…</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className={`w-full h-[54px] rounded-xl bg-primary-700 items-center justify-center ${
            !licenciaUrl || enviando || subiendo ? "opacity-50" : ""
          }`}
          onPress={enviar}
          disabled={!licenciaUrl || enviando || subiendo}
          activeOpacity={0.85}
        >
          {enviando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-bold">Validar licencia</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <DocumentCameraModal
        visible={!!camara}
        variant="licencia"
        config={
          camara === "pic"
            ? {
                titulo: "Permiso Internacional (PIC)",
                hint: "Fotografía la página con tu foto y tus datos, plana y sin reflejos.",
              }
            : undefined
        }
        onClose={() => setCamara(null)}
        onCaptured={handleCaptura}
      />
    </KeyboardAvoidingView>
  );
}
