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
                Al operar como dueño en nuestra plataforma, nos otorgas el mandato para intermediar el arriendo de tu vehículo con total seguridad.
              </Text>
            </View>

            {/* Condiciones Clave */}
            <Card padded style={styles.card}>
              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>Recibes el 85% neto de cada arriendo</Text>
                  <Text style={styles.itemDesc}>
                    El 85% del valor diario acordado se transfiere directamente a tu cuenta bancaria. Tu ganancia neta es clara y garantizada.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>2</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>15% Comisión de la plataforma</Text>
                  <Text style={styles.itemDesc}>
                    La comisión del 15% financia la plataforma, soporte 24/7, verificación de identidad biométrica KYC y la cobertura de seguro en cada viaje.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>3</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>100% de los cargos adicionales para ti</Text>
                  <Text style={styles.itemDesc}>
                    Si el auto es devuelto con retraso, falta de combustible o suciedad, el 100% de esos cargos se transfiere íntegro a tu cuenta.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.badgeNumber}><Text style={styles.badgeText}>4</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>Garantía retenida y seguro activo</Text>
                  <Text style={styles.itemDesc}>
                    Ningún arrendatario puede retirar tu auto sin una garantía autorizada de $800.000 a $1.200.000 y contrato digital firmado.
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
                He leído y autorizo a la plataforma a intermediar el arriendo de mi vehículo bajo estas condiciones (85% para mí como dueño / 15% comisión plataforma).
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
