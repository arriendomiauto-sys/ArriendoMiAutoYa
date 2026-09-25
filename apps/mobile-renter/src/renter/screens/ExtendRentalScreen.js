import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StatusBar, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApp,
  Button,
  Card,
  ScreenHeader,
  SectionLabel,
  ApiClient,
  showAlert,
  msjError,
  colors,
  useTarjetas,
  configMercadoPago,
  tokenizarTarjetaGuardada,
} from "@rentacar/mobile-shared";

const DIA_MS = 86400000;

export function ExtendRentalScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const { activeReservation, setActiveReservation } = useApp();
  const [dias, setDias] = useState(1);
  const [loading, setLoading] = useState(false);
  // Mercado Pago pide el CVV en cada cobro a una tarjeta guardada.
  const [cvv, setCvv] = useState("");
  const { validadas } = useTarjetas();

  const res = activeReservation || {};
  const auto = res.auto || res.car || {};
  const tarifa = auto.tarifa_dia || 0;
  const adicional = tarifa * dias;
  // La misma tarjeta que el backend va a cobrar: la del arriendo.
  const tarjeta = validadas.find((t) => t.id === res.tarjeta_cobro_id);
  const pedirCvv = configMercadoPago().puedeContactarMP && !!tarjeta;

  const finActual = new Date(res.fecha_fin || Date.now() + 2 * DIA_MS);
  const finNuevo = new Date(finActual.getTime() + dias * DIA_MS);
  const fmt = (d) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

  // Techo de la extensión: inicio de la próxima reserva del auto. Sin esto el
  // usuario sube los días y recién al mandar se come el 400 del backend
  // ("no disponible para esas fechas"). El arriendo actual arranca antes del
  // fin actual, así que un rango que empieza en `finActual` o después es
  // siempre OTRA reserva (incluida una back-to-back, que deja tope 0).
  const [proximaReserva, setProximaReserva] = useState(null);
  useEffect(() => {
    const autoId = auto?.id;
    if (!autoId || typeof ApiClient.getDisponibilidadAuto !== "function") return undefined;
    let vivo = true;
    ApiClient.getDisponibilidadAuto(autoId)
      .then((r) => {
        if (!vivo) return;
        const siguientes = (r?.rangos_ocupados || [])
          .map((x) => new Date(x.fecha_inicio))
          .filter((d) => !isNaN(d) && d.getTime() >= finActual.getTime())
          .sort((a, b) => a - b);
        setProximaReserva(siguientes[0] || null);
      })
      .catch((e) => {
        if (__DEV__) console.warn("[extender] no se pudo cargar disponibilidad:", e?.message || e);
      });
    return () => {
      vivo = false;
    };
  }, [auto?.id, res.fecha_fin]);

  // Días máximos que se pueden agregar sin pisar la próxima reserva. Extender
  // justo hasta el inicio de la siguiente (back-to-back) está permitido.
  const topeDias = proximaReserva
    ? Math.max(0, Math.floor((proximaReserva.getTime() - finActual.getTime()) / DIA_MS))
    : Infinity;
  const sinMargen = topeDias === 0;
  const colisiona = dias > topeDias;

  const handleExtender = async () => {
    if (loading || !res.id) return;
    if (sinMargen || colisiona) {
      showAlert(
        "No se puede extender tanto",
        proximaReserva
          ? `El auto tiene otra reserva desde el ${fmt(proximaReserva)}. Elige menos días.`
          : "El auto no está disponible para esas fechas.",
      );
      return;
    }
    if (pedirCvv && cvv.length < 3) {
      showAlert("Falta el código de seguridad", `Escribe el CVV de tu tarjeta •••• ${tarjeta.ultimos4}.`);
      return;
    }
    setLoading(true);
    try {
      const token_cobro = pedirCvv ? await tokenizarTarjetaGuardada({ cardId: tarjeta.mp_card_id, cvv }) : null;
      const actualizada = await ApiClient.extenderReserva(res.id, dias, { token_cobro });
      setActiveReservation({ ...actualizada, auto: res.auto });
      showAlert(
        "Arriendo extendido",
        `Ahora termina el ${fmt(new Date(actualizada.fecha_fin))}. Se cobraron $${adicional.toLocaleString("es-CL")} a tu tarjeta por los días adicionales.`,
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    } catch (err) {
      setCvv("");
      showAlert("No se pudo extender", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Extender arriendo" subtitle="Añade días a tu arriendo activo" onBack={onBack} />

      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        <Card padded className="gap-3">
          <View className="flex-row justify-between items-center gap-3">
            <View>
              <Text className="text-[15px] font-bold text-textDark">{auto.marca} {auto.modelo}</Text>
              <Text className="text-[13px] text-textMuted mt-0.5">Patente {auto.patente || "—"}</Text>
            </View>
            <Text className="text-[13px] font-bold text-primary">${tarifa.toLocaleString("es-CL")} / día</Text>
          </View>
          <View className="border-t border-border pt-3 flex-row justify-between">
            <Text className="text-[13px] text-textMuted">Devolución actual</Text>
            <Text className="text-[13px] font-semibold text-textDark">{fmt(finActual)} · 18:00</Text>
          </View>
        </Card>

        <Card padded className="gap-3">
          <SectionLabel>Tiempo adicional</SectionLabel>
          <View className="flex-row items-center bg-gray-50 rounded-xl border border-border overflow-hidden">
            <TouchableOpacity className="w-[52px] h-14 items-center justify-center bg-white" onPress={() => setDias(Math.max(1, dias - 1))}>
              <Text className="text-2xl font-bold text-primary">−</Text>
            </TouchableOpacity>
            <View className="flex-1 items-center gap-0.5">
              <Text className="text-base font-bold text-textDark">+{dias} {dias === 1 ? "día" : "días"}</Text>
              <Text className="text-xs text-textMuted">Nueva fecha: {fmt(finNuevo)}</Text>
            </View>
            <TouchableOpacity
              className={`w-[52px] h-14 items-center justify-center bg-white ${dias >= topeDias ? "opacity-35" : ""}`}
              onPress={() => setDias((d) => Math.min(d + 1, topeDias))}
              disabled={dias >= topeDias}
            >
              <Text className="text-2xl font-bold text-primary">+</Text>
            </TouchableOpacity>
          </View>
          {sinMargen ? (
            <Text className="text-[12.5px] text-danger font-semibold leading-[17px]">
              El auto ya tiene otra reserva justo después de tu devolución. No se puede extender.
            </Text>
          ) : proximaReserva ? (
            <Text className="text-xs text-textMuted leading-[17px]">
              Máximo hasta el {fmt(proximaReserva)}: el auto está reservado desde esa fecha.
            </Text>
          ) : null}
        </Card>

        <Card padded className="gap-2">
          <SectionLabel>Monto adicional</SectionLabel>
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-textMuted">
              {dias} {dias === 1 ? "día" : "días"} × ${tarifa.toLocaleString("es-CL")}
            </Text>
            <Text className="text-[13px] font-semibold text-textDark">${adicional.toLocaleString("es-CL")}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-textMuted">Seguro Full Cobertura</Text>
            <Text className="text-[13px] font-semibold text-emerald-600">Incluido</Text>
          </View>
          <View className="h-px bg-border my-0.5" />
          <View className="flex-row justify-between">
            <Text className="text-sm font-bold text-textDark">Se cobra ahora</Text>
            <Text className="text-base font-extrabold text-primary">${adicional.toLocaleString("es-CL")}</Text>
          </View>
          <Text className="text-xs text-textMuted leading-[17px] mt-1">
            El monto adicional se cobra de inmediato a la tarjeta con la que pagaste el arriendo. Tu garantía no cambia.
          </Text>
          {pedirCvv ? (
            <View className="flex-row items-center gap-3 mt-2">
              <Text className="flex-1 text-xs text-textMuted leading-4">
                Código de seguridad de la •••• {tarjeta.ultimos4}
              </Text>
              <TextInput
                testID="cvv-extension"
                className="w-[84px] h-11 border-[1.5px] border-gray-200 rounded-xl px-3 text-[15px] text-gray-900 bg-white text-center"
                value={cvv}
                onChangeText={(t) => setCvv(t.replace(/\D/g, "").slice(0, 4))}
                placeholder="CVV"
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                accessibilityLabel={`Código de seguridad de la tarjeta terminada en ${tarjeta.ultimos4}`}
              />
            </View>
          ) : null}
        </Card>
      </ScrollView>

      <View
        className="px-4 pt-3 bg-white border-t border-border"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        <Button
          label={
            sinMargen || colisiona
              ? "No disponible para esas fechas"
              : `Solicitar extensión · $${adicional.toLocaleString("es-CL")}`
          }
          onPress={handleExtender}
          loading={loading}
          disabled={!res.id || sinMargen || colisiona || (pedirCvv && cvv.length < 3)}
        />
      </View>
    </View>
  );
}

