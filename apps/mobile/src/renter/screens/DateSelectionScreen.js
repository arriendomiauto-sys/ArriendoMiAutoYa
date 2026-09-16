import React from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar } from "react-native";
import {
  colors,
  theme,
  Card,
  ScreenHeader,
  Button,
  DateTimeField,
  formatearFechaHora,
} from "@rentacar/mobile-shared";

const precioCLP = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

/**
 * Pantalla dedicada a elegir retiro y devolución — separada de la ficha del
 * auto (Lote de rediseño: la ficha solo muestra auto + anfitrión, y "Siguiente"
 * trae al usuario acá antes de pasar al resumen de la reserva).
 */
export function DateSelectionScreen({
  car,
  fechaInicio,
  fechaFin,
  onChangeInicio,
  onChangeFin,
  ahora,
  minimumDateFin,
  rangosOcupados,
  disponibilidadError,
  dias,
  montoCobro,
  dateError,
  onBack,
  onConfirm,
}) {
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Elige tus fechas" subtitle={nombreAuto || "Vehículo"} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {disponibilidadError && (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>No pudimos verificar disponibilidad</Text>
            <Text style={styles.warnText}>
              Reintenta antes de elegir fechas — así evitamos que reserves un día ya tomado.
            </Text>
          </View>
        )}

        <View style={styles.datesRow}>
          <DateTimeField
            label="Retiro"
            value={fechaInicio}
            onChange={onChangeInicio}
            minimumDate={ahora}
            rangosBloqueados={rangosOcupados}
            disabled={disponibilidadError}
          />
          <DateTimeField
            label="Devolución"
            value={fechaFin}
            onChange={onChangeFin}
            minimumDate={minimumDateFin}
            rangosBloqueados={rangosOcupados}
            disabled={disponibilidadError}
          />
        </View>

        {dateError && (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Fechas inválidas</Text>
            <Text style={styles.warnText}>{dateError}</Text>
          </View>
        )}

        <Card style={styles.subtotalCard} padded>
          <View style={{ flex: 1 }}>
            <Text style={styles.subtotalTitle}>
              {dias > 0 ? `${dias} ${dias === 1 ? "día" : "días"} de arriendo` : "Elige fechas válidas"}
            </Text>
            {dias > 0 && (
              <Text style={styles.subtotalRange}>
                {formatearFechaHora(fechaInicio)} → {formatearFechaHora(fechaFin)}
              </Text>
            )}
          </View>
          <Text style={styles.subtotalValue}>{precioCLP(montoCobro)}</Text>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Confirmar fechas"
          iconRight="arrow-right"
          onPress={onConfirm}
          disabled={dias === 0 || disponibilidadError}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },

  datesRow: { flexDirection: "row", gap: theme.spacing.md },
  warnBox: { backgroundColor: colors.warningBg, borderRadius: theme.radius.field, padding: theme.spacing.lg, gap: 4 },
  warnTitle: { fontSize: 14, fontWeight: "700", color: colors.warningText },
  warnText: { fontSize: 13, color: colors.warningText, lineHeight: 19 },

  subtotalCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  subtotalTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  subtotalRange: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  subtotalValue: { fontSize: 18, fontWeight: "700", color: colors.text },

  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
