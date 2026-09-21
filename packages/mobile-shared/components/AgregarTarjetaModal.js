import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
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
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets?.bottom || 0, theme.spacing.xxl) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Agregar tarjeta</Text>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: theme.spacing.md, gap: theme.spacing.md }}
          >
            {modoPrueba ? (
              <View style={styles.pruebaNota}>
                <Icon name="alert" size={15} color={colors.warningText} />
                <Text style={styles.pruebaNotaTexto}>
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

            <View style={{ gap: 6 }}>
              <Text style={styles.tipoLabel}>Tipo de tarjeta</Text>
              <View style={styles.tipoRow}>
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
                <View style={styles.detectada}>
                  <Icon name="check" size={13} color={colors.accentText} />
                  <Text style={styles.detectadaTexto}>
                    {detectada === "credito" ? "Crédito" : "Débito"} · detectado
                  </Text>
                </View>
              ) : null}
              <Text style={styles.tipoAyuda}>
                {tipoManual === "credito"
                  ? "Crédito: se usa para la garantía retenida (hold) y el arriendo."
                  : "Débito: se usa para el cobro del arriendo."}
              </Text>
            </View>

            {errorRemoto ? (
              <View style={styles.errorRemoto}>
                <Icon name="alert" size={16} color={colors.dangerText} />
                <Text style={styles.errorRemotoTexto}>{errorRemoto.mensaje}</Text>
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
              <View style={styles.nota}>
                <Icon name="shield" size={14} color={colors.accentDark} />
                <Text style={styles.notaTexto}>
                  Tus datos viajan directo a Mercado Pago. Nuestros servidores solo reciben un código de un solo uso.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Guardar tarjeta" onPress={guardar} loading={guardando} />
            <Button variant="ghost" label="Cancelar" onPress={onClose} disabled={guardando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: "92%",
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: theme.spacing.sm,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  pruebaNota: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  pruebaNotaTexto: { flex: 1, fontSize: 12.5, color: colors.warningText, lineHeight: 17 },
  tipoLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.4 },
  tipoRow: { flexDirection: "row", gap: theme.spacing.sm },
  tipoAyuda: { fontSize: 11.5, color: colors.textMuted, lineHeight: 15 },
  detectada: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: colors.accentMuted,
    borderRadius: theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  detectadaTexto: { fontSize: 11.5, fontWeight: "600", color: colors.accentText },
  nota: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  notaTexto: { flex: 1, fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
  errorRemoto: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  errorRemotoTexto: { flex: 1, fontSize: 12.5, color: colors.dangerText, lineHeight: 17 },
  footer: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
});
