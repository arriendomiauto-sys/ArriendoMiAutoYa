import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Button, Card, ScreenHeader, ApiClient, Icon, showAlert, msjError } from "@rentacar/mobile-shared";
import { conectarChat } from "@rentacar/mobile-shared/api/chatSocket";

// 2 minutos de validez estricta (120 segundos)
const VIGENCIA_SEGUNDOS = 120;

export function MyQRCodeScreen({ reservation, onBack }) {
  const esDevolucion = reservation?.estado === "en_curso";
  const [codigo, setCodigo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(VIGENCIA_SEGUNDOS);
  const [expirado, setExpirado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const generar = useCallback(async (isSilent = false) => {
    if (!reservation?.id) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setExpirado(false);
    setCopiado(false);
    try {
      const r = await ApiClient.generarCodigoQR(reservation.id);
      setCodigo(r.codigo_qr_hash);
      const validez = r.validez_segundos || VIGENCIA_SEGUNDOS;
      setTimeLeft(validez);
    } catch (err) {
      setError(msjError(err, "No se pudo generar el código QR."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reservation?.id]);

  useEffect(() => {
    generar(false);
  }, [generar]);

  // Escucha en vivo (nunca envía nada) la sala de la reserva mientras el
  // código está en pantalla: si el dueño confirma la identidad, se avisa
  // sin obligar al cliente a salir y volver a entrar a la app.
  useEffect(() => {
    if (!reservation?.id || loading || error || expirado) return undefined;
    const canal = conectarChat(reservation.id, {
      onEntregaConfirmada: () => {
        showAlert(
          esDevolucion ? "Devolución confirmada" : "Entrega confirmada",
          "El dueño validó tu código. Puedes volver a tu arriendo.",
          [{ text: "Ver mi arriendo", onPress: onBack }]
        );
      },
    });
    return () => canal.cerrar();
  }, [reservation?.id, loading, error, expirado]);

  // Cuenta regresiva de 2 minutos
  useEffect(() => {
    if (loading || error || expirado) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setExpirado(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, error, expirado]);

  const copiarCodigo = async () => {
    if (!codigo) return;
    try {
      await Clipboard.setStringAsync(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      showAlert("No se pudo copiar", "Selecciona el código a mano e intenta de nuevo.");
    }
  };

  const auto = reservation?.auto || reservation?.car || {};
  const minutos = Math.floor(timeLeft / 60);
  const segundos = timeLeft % 60;
  const tiempoFormateado = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  const pctRestante = Math.max(0, Math.min(100, (timeLeft / VIGENCIA_SEGUNDOS) * 100));

  // Formatear código en grupos de 4 para dictado fácil (ej: ABCD - EF12 - 3456)
  const codigoLegible = codigo ? (codigo.match(/.{1,4}/g)?.join(" - ") || codigo) : "";

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={esDevolucion ? "Código de devolución" : "Código de entrega"}
        onBack={onBack}
      />

      <ScrollView contentContainerClassName="p-4 gap-4 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-sm leading-5 text-textMuted text-center">
          Muéstrale este código en persona a{" "}
          <Text className="font-bold text-textDark">
            {auto.marca ? `quien te entrega el ${auto.marca} ${auto.modelo}` : "el dueño"}
          </Text>{" "}
          para verificar tu identidad y {esDevolucion ? "cerrar el arriendo" : "comenzar el arriendo"}.
        </Text>

        {/* Tarjeta Principal del QR */}
        <View className="min-h-[260px] rounded-2xl border-[1.5px] border-teal-200 bg-white items-center justify-center p-5 gap-3 shadow-md">
          {loading && (
            <View className="items-center gap-3 py-10">
              <ActivityIndicator color="#0F766E" size="large" />
              <Text className="text-sm text-textMuted font-medium">Generando código seguro...</Text>
            </View>
          )}

          {!loading && error && (
            <View className="items-center gap-3 py-5">
              <Icon name="alert-triangle" size={32} color="#EF4444" />
              <Text className="text-sm text-danger text-center max-w-[260px]">{error}</Text>
              <Button label="Reintentar" onPress={() => generar(false)} fullWidth={false} size="sm" />
            </View>
          )}

          {/* Estado EXPIRADO (vencieron los 2 minutos) */}
          {!loading && !error && expirado && (
            <View className="items-center gap-3 py-5 w-full">
              <View className="w-[68px] h-[68px] rounded-full bg-amber-100 items-center justify-center mb-1">
                <Icon name="clock" size={36} color="#F59E0B" />
              </View>
              <Text className="text-lg font-bold text-textDark">Código expirado</Text>
              <Text className="text-[13.5px] text-textMuted text-center leading-[19px] px-4 mb-2">
                Por seguridad, el código tiene una validez de 2 minutos. Genera uno nuevo para que el dueño lo valide.
              </Text>
              <Button
                label="Generar nuevo código"
                iconLeft="refresh-cw"
                onPress={() => generar(false)}
                size="md"
              />
            </View>
          )}

          {/* Estado ACTIVO con QR y Cuenta Regresiva */}
          {!loading && !error && !expirado && codigo && (
            <>
              {/* Badge de Seguridad y Contador */}
              <View className={`flex-row items-center py-1.5 px-3.5 rounded-full border gap-2 ${timeLeft <= 30 ? "bg-amber-100 border-amber-500" : "bg-teal-50 border-teal-200"}`}>
                <View
                  className={`w-2 h-2 rounded-full ${
                    timeLeft <= 30 ? "bg-red-500" : refreshing ? "bg-amber-500" : "bg-primary"
                  }`}
                />
                <Text className={`text-[13px] font-bold ${timeLeft <= 30 ? "text-red-700" : "text-teal-800"}`}>
                  {refreshing ? "Actualizando..." : `Válido por ${tiempoFormateado}`}
                </Text>
              </View>

              {/* Barra de Tiempo Decreciente */}
              <View className="w-[200px] h-1 rounded-sm bg-slate-200 overflow-hidden">
                <View
                  className="h-full rounded-sm"
                  style={{
                    width: `${pctRestante}%`,
                    backgroundColor: timeLeft <= 30 ? "#F59E0B" : "#0F766E",
                  }}
                />
              </View>

              {/* Código QR */}
              <View className="p-3 bg-white rounded-xl border border-border shadow-sm">
                <QRCode
                  value={codigo}
                  size={195}
                  color="#0F766E"
                  backgroundColor="#FFFFFF"
                />
              </View>

              {/* Código Escrito para Dictar */}
              <View className="w-full items-center bg-slate-50 py-2.5 px-3 rounded-xl border border-border gap-1">
                <Text className="text-[11.5px] text-textMuted font-medium">Código para ingresar a mano:</Text>
                <TouchableOpacity
                  className="items-center gap-1"
                  onPress={copiarCodigo}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar código escrito"
                >
                  <Text testID="text-codigo-qr" className="text-base font-extrabold tracking-[1.5px] text-teal-900 text-center font-mono">{codigoLegible}</Text>
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <Icon name={copiado ? "check" : "copy"} size={13} color={copiado ? "#B45309" : "#0F766E"} />
                    <Text className={`text-[11.5px] font-medium ${copiado ? "text-amber-800 font-bold" : "text-primary"}`}>
                      {copiado ? "Copiado" : "Toca para copiar"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text className="text-[11.5px] text-textMuted text-center">
                Validez estricta de 2 minutos • Cambia dinámicamente
              </Text>
            </>
          )}
        </View>

        {/* Indicador de espera en vivo */}
        {!loading && !error && !expirado && codigo && (
          <View className="flex-row items-center justify-center gap-2 px-3">
            <View className="w-2 h-2 rounded-full bg-amber-500" />
            <Text className="text-[12.5px] text-textMuted text-center shrink">
              {esDevolucion
                ? "Esperando que el dueño escanee o escriba el código para cerrar..."
                : "Esperando que el dueño escanee o escriba el código para comenzar..."}
            </Text>
          </View>
        )}

        {/* Ficha Resumen del Vehículo y Entrega */}
        {reservation && (
          <Card padded className="gap-3">
            <View className="flex-row items-center gap-2 pb-1 border-b border-border">
              <Icon name="car" size={18} color="#0F766E" />
              <Text className="text-sm font-bold text-textDark">Detalles de la reserva</Text>
            </View>
            <Row label="Vehículo" value={[auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ")} />
            <Row label="Patente" value={auto.patente || "—"} isBadge />
            <Row label="Lugar acordado" value={reservation.lugar_entrega_acordado || "—"} />
            <Row label="Estado" value={esDevolucion ? "Devolución" : "Entrega inicial"} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, isBadge }) {
  return (
    <View className="flex-row justify-between items-center gap-3">
      <Text className="text-[13px] text-textMuted">{label}</Text>
      {isBadge ? (
        <View className="bg-slate-100 border border-border px-2 py-0.5 rounded-md">
          <Text className="text-[13px] font-extrabold text-textDark tracking-widest">{value}</Text>
        </View>
      ) : (
        <Text className="text-[13px] text-textDark font-semibold shrink text-right" numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

