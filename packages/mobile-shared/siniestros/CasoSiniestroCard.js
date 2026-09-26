import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Card, Badge } from "../components/ui";
import { Icon } from "../components/Icon";
import { usePhotoViewer } from "../components/PhotoViewer";
import { colors } from "../theme/colors";
import { verSiniestro, ESTADO_SINIESTRO } from "./api";

function fechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Caso de accidente de una reserva, para el arrendatario y para el dueño: el
 * número de caso, el estado y todo lo que soporte informó (lo mismo que les
 * llega a ambos por notificación y correo). No muestra nada si no hay caso.
 *
 * `caso` permite pasarlo ya cargado (recién reportado); si no, se consulta.
 */
export function CasoSiniestroCard({ reservaId, caso: casoInicial = null, className }) {
  const [caso, setCaso] = useState(casoInicial);
  const [cargando, setCargando] = useState(!casoInicial);
  const abrirVisor = usePhotoViewer();

  const cargar = useCallback(async () => {
    if (!reservaId) return;
    try {
      setCaso(await verSiniestro(reservaId));
    } catch {
      // Sin red se queda con lo que tenía: el caso igual llega por notificación.
    } finally {
      setCargando(false);
    }
  }, [reservaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return casoInicial ? null : <ActivityIndicator color={colors.primary} className="my-2" />;
  }
  if (!caso) return null;

  const estado = ESTADO_SINIESTRO[caso.estado] || ESTADO_SINIESTRO.reportado;
  const novedades = [...(caso.actualizaciones || [])].reverse();

  return (
    <Card padded className={`gap-3 border border-red-200 ${className || ""}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <Icon name="shield" size={18} color={colors.danger} />
          <Text className="text-[15px] font-bold text-textDark">Accidente · caso {caso.codigo}</Text>
        </View>
        <Badge variant={estado.variant} label={estado.label} />
      </View>

      <Text className="text-[13px] text-textMuted">{caso.descripcion}</Text>

      <View className="flex-row flex-wrap gap-2">
        {caso.hubo_lesionados && <Badge variant="danger" label="Con lesionados" />}
        {caso.hay_terceros && <Badge variant="warning" label="Terceros involucrados" />}
        {!caso.auto_puede_circular && <Badge variant="warning" label="El auto no circula" />}
        {caso.parte_policial ? <Badge variant="neutral" label={`Parte ${caso.parte_policial}`} /> : null}
      </View>

      {caso.fotos?.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {caso.fotos.map((uri, i) => (
            <TouchableOpacity
              key={uri + i}
              onPress={() => abrirVisor(caso.fotos, i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Ver foto ${i + 1} del accidente`}
            >
              <Image source={{ uri }} className="w-14 h-14 rounded-lg bg-border" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {caso.estado !== "cerrado" && (
        <Text className="text-[12px] text-textMuted">
          La garantía queda asegurada mientras se resuelve el caso. Todo lo que decida soporte te llega por
          escrito, igual que a la otra parte.
        </Text>
      )}

      {novedades.length > 0 && (
        <View className="gap-2">
          <View className="h-px bg-border" />
          <Text className="text-[12px] font-bold text-textMuted uppercase tracking-[0.5px]">Novedades del caso</Text>
          {novedades.map((n, i) => (
            <View key={`${n.fecha}-${i}`} className="gap-0.5">
              <Text className="text-[11px] text-textMuted">
                {fechaHora(n.fecha)} · {n.autor === "soporte" ? "Soporte" : "Sistema"}
              </Text>
              <Text className="text-[13px] text-textDark">{n.mensaje}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
