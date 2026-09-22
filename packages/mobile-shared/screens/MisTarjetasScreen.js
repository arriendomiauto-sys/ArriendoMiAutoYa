import React from "react";
import { View, Text, StatusBar, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Button, Card, ScreenHeader, Badge, EmptyState } from "../components/ui";
import { AgregarTarjetaModal } from "../components/AgregarTarjetaModal";
import { useTarjetas } from "../hooks/useTarjetas";
import { useApp } from "../context/AppContext";
import { showAlert } from "../utils/alert";

const MARCA_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", diners: "Diners" };
const ESTADO_BADGE = {
  validada: { variant: "success", label: "Validada" },
  requiere_revision_manual: { variant: "warning", label: "En revisión" },
  rechazada: { variant: "danger", label: "Rechazada" },
};

function TarjetaFila({ tarjeta, onEliminar }) {
  const marca = MARCA_LABEL[tarjeta.marca] || "Tarjeta";
  const estado = ESTADO_BADGE[tarjeta.estado] || ESTADO_BADGE.requiere_revision_manual;
  return (
    <Card padded className="flex-row items-center gap-3">
      <View className="w-[38px] h-[38px] rounded-xl bg-primary-100 items-center justify-center">
        <Icon name="card" size={18} color={colors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-sm font-bold text-textDark">
            {marca} ·<Text className="font-bold text-textDark"> •••• {tarjeta.ultimos4}</Text>
          </Text>
          <View className="bg-accent-100 rounded-full py-0.5 px-2">
            <Text className="text-[11px] font-bold text-accent-800">{tarjeta.tipo === "debito" ? "Débito" : "Crédito"}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2 mt-1">
          {tarjeta.vencimiento ? <Text className="text-xs text-textMuted">Vence {tarjeta.vencimiento}</Text> : null}
          <Badge variant={estado.variant} label={estado.label} />
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onEliminar(tarjeta)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar la tarjeta terminada en ${tarjeta.ultimos4}`}
      >
        <Icon name="trash" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </Card>
  );
}

/**
 * "Mis tarjetas" — reemplaza a la vieja TarjetaScreen (una sola tarjeta).
 * El arrendatario necesita al menos una de DÉBITO (para el cobro del arriendo)
 * y una de CRÉDITO (para el hold de garantía). Mismo par de props que la
 * pantalla anterior: `onBack` y `onDone`.
 */
export function MisTarjetasScreen({ onBack, onDone }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const { tarjetas, cargando, error, recargar, agregar, eliminar, tieneDebito, tieneCredito } =
    useTarjetas();
  const [modalAbierto, setModalAbierto] = React.useState(false);

  const confirmarEliminar = (tarjeta) => {
    showAlert(
      "Eliminar tarjeta",
      `¿Quitar ${MARCA_LABEL[tarjeta.marca] || "la tarjeta"} terminada en ${tarjeta.ultimos4}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const res = await eliminar(tarjeta.id);
            if (!res.ok) {
              showAlert(
                "No se pudo eliminar",
                res.codigo === "TARJETA_EN_USO"
                  ? "Esta tarjeta está asociada a una reserva activa. Podrás quitarla cuando termine."
                  : res.mensaje
              );
            }
          },
        },
      ]
    );
  };

  const faltantes = [];
  if (!cargando && !tieneDebito) faltantes.push("una de débito para el arriendo");
  if (!cargando && !tieneCredito) faltantes.push("una de crédito para la garantía");

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Mis tarjetas" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {faltantes.length > 0 ? (
          <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <Icon name="alert" size={16} color={colors.warningText} />
            <Text className="flex-1 text-[12.5px] text-amber-800 leading-[17px]">
              Te falta {faltantes.join(" y ")}.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 gap-2">
            <Text className="text-sm font-bold text-red-800">No pudimos cargar tus tarjetas</Text>
            <Text className="text-[13px] text-red-700 leading-[18px]">{error}</Text>
            <Button label="Reintentar" variant="secondary" onPress={recargar} fullWidth={false} className="self-start" />
          </View>
        ) : cargando ? (
          <Text className="text-sm text-textMuted text-center py-6">Cargando…</Text>
        ) : tarjetas.length === 0 ? (
          <EmptyState
            icon="card"
            title="Aún no agregaste medios de pago"
            message="El arriendo se cobra a una tarjeta de débito y la garantía se retiene en una de crédito. Ambas deben estar a tu nombre."
          />
        ) : (
          <View className="gap-3">
            {tarjetas.map((t) => (
              <TarjetaFila key={t.id} tarjeta={t} onEliminar={confirmarEliminar} />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="px-4 pt-3 bg-surface border-t border-border gap-2" style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
        <Button label="Agregar tarjeta" onPress={() => setModalAbierto(true)} />
        {tarjetas.length > 0 && (onDone || onBack) ? (
          <Button variant="ghost" label="Listo" onPress={() => (onDone || onBack)()} />
        ) : null}
      </View>

      <AgregarTarjetaModal
        visible={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onAgregar={agregar}
        onAgregada={() => setModalAbierto(false)}
        nombreTitular={currentUser?.nombre}
        rut={currentUser?.rut}
        tipoPreferido={!tieneDebito ? "debito" : !tieneCredito ? "credito" : undefined}
      />
    </View>
  );
}
