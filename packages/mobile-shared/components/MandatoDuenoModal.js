import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Button, Card, ScreenHeader } from "./ui";

const KEY_MANDATO_PREFIX = "@mandato_dueno_aceptado_";

export function MandatoDuenoModal({
  visible,
  onClose,
  onAccepted,
  userId = "default",
}) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const storageKey = `${KEY_MANDATO_PREFIX}${userId || "default"}`;

  const handleAceptar = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, new Date().toISOString());
      if (onAccepted) onAccepted();
      if (onClose) onClose();
    } catch (err) {
      console.warn("No se pudo guardar la aceptación del mandato:", err);
      if (onAccepted) onAccepted();
      if (onClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScreenHeader
            title="Mandato de Arriendo"
            subtitle="Condiciones de intermediación y comisiones"
            onBack={onClose}
          />

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            {/* Header Icon + Resumen */}
            <View style={styles.banner}>
              <View style={styles.iconWrap}>
                <Icon name="shield" size={28} color={colors.primary} />
              </View>
              <Text style={styles.bannerTitle}>
                Autorización para arrendar tu vehículo
              </Text>
              <Text style={styles.bannerSubtitle}>
                Mandato especial de administración e intermediación a ARRIENDO MI AUTO SpA (RUT 78.493.457-8) bajo las siguientes condiciones:
              </Text>
            </View>

            {/* Condiciones Clave */}
            <Card padded style={styles.card}>
              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>Recibes el 85% neto de cada arriendo</Text>
                  <Text style={styles.itemDesc}>
                    ARRIENDO MI AUTO SpA percibe el valor del arriendo a tu nombre y transfiere el 85% neto acordado directamente a tu cuenta bancaria registrada.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>2</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>15% Comisión de intermediación</Text>
                  <Text style={styles.itemDesc}>
                    La comisión del 15% financia la plataforma, soporte operativo, verificación biométrica KYC de conductores y el programa de protección frente a siniestros.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>3</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>100% de los cargos adicionales para ti</Text>
                  <Text style={styles.itemDesc}>
                    El 100% de los cobros accesorios por atraso, combustible faltante o suciedad/lavado se transfiere íntegro a tu cuenta para costear los gastos incurridos.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>4</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>Deducible 15 UF (50/50) y Garantía</Text>
                  <Text style={styles.itemDesc}>
                    Ningún arrendatario retira tu auto sin garantía retenida ($800.000) y contrato digital firmado. Ante siniestros cubiertos, el deducible de 15 UF se absorbe 50% por la plataforma y 50% por el dueño.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>5</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>Cobro y gestión de peajes TAG y multas</Text>
                  <Text style={styles.itemDesc}>
                    Facultas expresamente a ARRIENDO MI AUTO SpA para cobrar y percibir del arrendatario los peajes, pasadas por pórticos TAG y multas de tránsito generadas durante el arriendo, transfiriéndolos a tu cuenta previa acreditación del comprobante.
                  </Text>
                </View>
              </View>
            </Card>

            {/* Checkbox de Aceptación */}
            <TouchableOpacity
              style={styles.checkRow}
              activeOpacity={0.8}
              onPress={() => setChecked(!checked)}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Icon name="check" size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkText}>
                He leído y confiero mandato especial de administración e intermediación a ARRIENDO MI AUTO SpA (RUT 78.493.457-8) bajo las condiciones aquí estipuladas.
              </Text>
            </TouchableOpacity>

            {/* Botón de Confirmación */}
            <View style={{ marginTop: 16 }}>
              <Button
                label="Aceptar Mandato y Continuar"
                iconRight="arrow-right"
                disabled={!checked || saving}
                loading={saving}
                onPress={handleAceptar}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export async function verificarMandatoAceptado(userId = "default") {
  try {
    const key = `${KEY_MANDATO_PREFIX}${userId || "default"}`;
    const valor = await AsyncStorage.getItem(key);
    return !!valor;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "92%",
    flex: 1,
  },
  body: {
    flex: 1,
    marginTop: 8,
  },
  banner: {
    alignItems: "center",
    backgroundColor: colors.primary100,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary200,
    marginBottom: 16,
    marginTop: 4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  bannerSubtitle: {
    fontSize: 13,
    color: colors.primary700,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    gap: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  badgeNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  itemDesc: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
