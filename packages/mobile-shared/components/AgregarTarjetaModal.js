import React from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Button, Chip } from "./ui";
import { FormularioTarjeta, validarFormularioTarjeta } from "./FormularioTarjeta";
import { VistaTarjeta } from "./VistaTarjeta";
import { configMercadoPago, consultarMetodoPago } from "../api/mercadopago";

const VACIO = { numero: "", vencimiento: "", cvv: "", nombre: "" };

/**
 * Alta de una tarjeta al vault. Tokeniza contra Mercado Pago en el dispositivo
 * (vía `onAgregar`, que viene de `useTarjetas`) — el número nunca toca nuestro
 * backend. El nombre del titular queda fijo al del KYC.
 *
 * @param onAgregar  ({ numero, vencimiento, cvv, titular, rut, tipoManual }) =>
 *                    Promise<{ ok, tarjeta } | { ok:false, codigo, campo, titularDetectado, mensaje }>
 * @param onAgregada (tarjeta) => void   — se llamó bien, cerrar
 * @param nombreTitular  nombre verificado del KYC (bloquea el campo)
 * @param rut            RUT verificado del KYC (para identification de MP)
 * @param tipoPreferido  "debito" | "credito" — preselecciona el toggle en modo prueba
 */
export function AgregarTarjetaModal({
  visible,
  onClose,
  onAgregar,
  onAgregada,
  nombreTitular,
  rut,
  tipoPreferido,
}) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const { puedeContactarMP, modoPrueba } = configMercadoPago();
  const [tarjeta, setTarjeta] = React.useState(VACIO);
  const [tipoManual, setTipoManual] = React.useState(tipoPreferido || "credito");
  const [intentado, setIntentado] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [errorRemoto, setErrorRemoto] = React.useState(null); // { campo, mensaje }
  const [detectada, setDetectada] = React.useState(null); // "credito" | "debito" | null

  // Con los primeros dígitos (BIN) Mercado Pago dice si la tarjeta es de crédito
  // o de débito: se consulta una vez por BIN, no en cada tecla.
  const bin = tarjeta.numero.replace(/\D/g, "").slice(0, 8);
  React.useEffect(() => {
    if (!puedeContactarMP || bin.length < 6) {
      setDetectada(null);
      return undefined;
    }
    let vivo = true;
    consultarMetodoPago(bin).then((metodo) => {
      if (!vivo) return;
      setDetectada(metodo?.tipo || null);
      if (metodo?.tipo) setTipoManual(metodo.tipo);
    });
    return () => {
      vivo = false;
    };
  }, [bin, puedeContactarMP]);

  React.useEffect(() => {
    // Al abrir Y al cerrar se limpia todo: no queremos número ni CVV vivos en
    // memoria mientras el modal está oculto.
    setTarjeta(VACIO);
    setTipoManual(tipoPreferido || "credito");
    setIntentado(false);
    setGuardando(false);
    setErrorRemoto(null);
  }, [visible, tipoPreferido]);

  const erroresLocales = validarFormularioTarjeta(tarjeta);

  const guardar = async () => {
    if (guardando) return;
    setIntentado(true);
    setErrorRemoto(null);
    if (Object.keys(erroresLocales).length > 0) return;

    setGuardando(true);
    try {
      const res = await onAgregar({
        numero: tarjeta.numero,
        vencimiento: tarjeta.vencimiento,
        cvv: tarjeta.cvv,
        titular: nombreTitular,
        rut,
        tipoManual: tipoManual || tipoPreferido || "credito",
      });
      if (res?.ok) {
        // Borra el número y el CVV de memoria apenas se tokenizó.
        setTarjeta(VACIO);
        onAgregada?.(res.tarjeta);
        onClose?.();
        return;
      }

      let mensaje = res?.mensaje;
      if (res?.codigo === "NOMBRE_NO_COINCIDE") {
        mensaje = `Esta tarjeta figura a nombre de ${res.titularDetectado || "otra persona"}. Por seguridad solo puedes usar tarjetas a tu propio nombre (${nombreTitular || "el de tu cédula"}).`;
      } else if (res?.codigo === "TARJETA_DUPLICADA") {
        mensaje = "Ya tienes esta tarjeta registrada en tu cuenta.";
      } else if (res?.codigo === "TARJETA_TIPO_DESCONOCIDO") {
        mensaje = "No pudimos determinar el tipo de tarjeta. Selecciona si es Crédito o Débito arriba y vuelve a intentar.";
      } else if (res?.codigo === "TARJETA_INVALIDA") {
        mensaje = res?.mensaje || "La tarjeta no se pudo validar con el banco. Revisa los datos o prueba con otra.";
      } else if (res?.codigo === "TARJETA_TIPO_INVALIDO") {
        mensaje = res?.mensaje || "El tipo de tarjeta no coincide con lo requerido.";
      } else if (!mensaje || (typeof mensaje === "string" && mensaje.startsWith("{"))) {
        mensaje = "No se pudo guardar la tarjeta. Revisa los datos e intenta nuevamente.";
      }

      setErrorRemoto({
        campo: res?.campo || null,
        mensaje,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-slate-900/80 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="bg-surface rounded-t-3xl max-h-[92%] p-6 pb-8 gap-2" style={{ paddingBottom: Math.max(insets?.bottom || 0, 32) }}>
          <View className="w-10 h-1 rounded-full bg-border self-center" />
          <View className="flex-row items-center justify-between pb-2">
            <Text className="text-lg font-extrabold text-textDark">Agregar tarjeta</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="p-1">
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16, gap: 16 }}
          >
            {modoPrueba ? (
              <View className="flex-row items-center gap-2 bg-amber-50 rounded-xl p-3">
                <Icon name="alert" size={15} color={colors.warningText} />
                <Text className="flex-1 text-[12.5px] text-amber-800 leading-[17px]">
                  {puedeContactarMP
                    ? "Modo prueba: usa una tarjeta de prueba de Mercado Pago."
                    : "Modo prueba sin pasarela: se guarda una tarjeta simulada."}
                </Text>
              </View>
            ) : null}

            <VistaTarjeta
              numero={tarjeta.numero}
              vencimiento={tarjeta.vencimiento}
              titular={tarjeta.nombre || nombreTitular}
            />

            <View className="gap-1.5">
              <Text className="text-xs font-bold text-textMuted tracking-wider">Tipo de tarjeta</Text>
              <View className="flex-row gap-2">
                <Chip
                  label="Crédito"
                  selected={tipoManual === "credito"}
                  onPress={() => setTipoManual("credito")}
                />
                <Chip
                  label="Débito"
                  selected={tipoManual === "debito"}
                  onPress={() => setTipoManual("debito")}
                />
              </View>
              {detectada ? (
                <View className="flex-row items-center self-start gap-1.5 bg-accent-100 rounded-full py-0.5 px-2.5">
                  <Icon name="check" size={13} color={colors.accentText} />
                  <Text className="text-[11.5px] font-semibold text-accent-800">
                    {detectada === "credito" ? "Crédito" : "Débito"} · detectado
                  </Text>
                </View>
              ) : null}
              <Text className="text-[11.5px] text-textMuted leading-[15px]">
                {tipoManual === "credito"
                  ? "Crédito: se usa para la garantía retenida (hold) y el arriendo."
                  : "Débito: se usa para el cobro del arriendo."}
              </Text>
            </View>

            {errorRemoto ? (
              <View className="flex-row items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <Icon name="alert" size={16} color={colors.dangerText} />
                <Text className="flex-1 text-[12.5px] text-red-700 leading-[17px]">{errorRemoto.mensaje}</Text>
              </View>
            ) : null}

            <FormularioTarjeta
              valor={tarjeta}
              onChange={(v) => {
                setTarjeta(v);
                if (errorRemoto) setErrorRemoto(null);
              }}
              errores={{
                ...erroresLocales,
                ...(errorRemoto?.campo ? { [errorRemoto.campo]: errorRemoto.mensaje } : {}),
                mostrarTodos: intentado,
              }}
              nombreTitular={nombreTitular}
            />
            {puedeContactarMP ? (
              <View className="flex-row items-start gap-2">
                <Icon name="shield" size={14} color={colors.accentDark} />
                <Text className="flex-1 text-[11.5px] text-textMuted leading-4">
                  Tus datos viajan directo a Mercado Pago. Nuestros servidores solo reciben un código de un solo uso.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View className="gap-2 pt-2">
            <Button label="Guardar tarjeta" onPress={guardar} loading={guardando} />
            <Button variant="ghost" label="Cancelar" onPress={onClose} disabled={guardando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
