import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";

export function ContractModal({ visible, onClose, reservation }) {
  const { currentUser } = useApp();

  const res = reservation || {
    id: "reserva-demo-1",
    auto: {
      marca: "Toyota",
      modelo: "RAV4 Limited 4x4",
      patente: "BBCL-10",
      anio: 2023,
    },
    fecha_inicio: new Date().toLocaleDateString("es-CL"),
    lugar_entrega_acordado: "Plaza de Armas, Los Ángeles",
    monto_hold: 114000,
  };

  const auto = res.auto || { marca: "Toyota", modelo: "RAV4", patente: "BBCL-10" };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.contractTitle}>CONTRATO DIGITAL DE ARRIENDO</Text>
              <Text style={styles.contractSub}>
                Válido ante Carabineros de Chile y Compañía Aseguradora
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contractBody} showsVerticalScrollIndicator={false}>
            <View style={styles.legalBox}>
              <Text style={styles.legalCode}>
                FOLIO DIGITAL N°: {res.id?.toUpperCase() || "RES-CL-2026-88"}
              </Text>
              <Text style={styles.legalDate}>
                Ciudad de Los Ángeles, Región del Biobío, Chile.
              </Text>

              <Text style={styles.clauseHeader}>COMPARECEN:</Text>
              <Text style={styles.clauseText}>
                1. <Text style={{ fontWeight: "800" }}>ARRENDATARIO:</Text>{" "}
                {currentUser?.nombre || "Carlos Mendoza"}, Cédula Nacional de Identidad{" "}
                {currentUser?.rut || "15.892.341-6"}, con domicilio registrado en Los Ángeles, Chile.
                {"\n"}
                2. <Text style={{ fontWeight: "800" }}>VEHÍCULO:</Text> Tipo {auto.marca}{" "}
                {auto.modelo}, Placa Patente Única {auto.patente}, Año {auto.anio || 2023}.
                {"\n"}
                3. <Text style={{ fontWeight: "800" }}>PLATAFORMA:</Text> Arrienda Tu Auto SpA, RUT 77.892.120-K.
              </Text>

              <Text style={styles.clauseHeader}>CLÁUSULA PRIMERA (OBJETO Y ENTREGA):</Text>
              <Text style={styles.clauseText}>
                El Arrendador entrega en arriendo el vehículo individualizado. La entrega y restitución se perfecciona mediante la validación del código QR y el registro fotográfico obligatorio de 9 imágenes del checklist inicial y final.
              </Text>

              <Text style={styles.clauseHeader}>CLÁUSULA SEGUNDA (SEGURO Y DEDUCIBLE):</Text>
              <Text style={styles.clauseText}>
                El vehículo cuenta con Seguro Full Cobertura con deducible estipulado de 15 UF (~$562.500 CLP). En caso de siniestro culpable o daño imputable, el deducible se distribuirá en un 50% con cargo al Arrendatario y 50% con cargo a la Empresa.
              </Text>

              <Text style={styles.clauseHeader}>CLÁUSULA TERCERA (DEVOLUCIÓN Y LIMPIEZA):</Text>
              <Text style={styles.clauseText}>
                El Arrendatario se obliga a restituir el vehículo en idénticas condiciones de aseo y combustible. Se fija una compensación por lavado de $15.000 CLP (suciedad estándar) o $35.000 CLP (tapiz manchado) y $15.000 CLP por cada cuarto de estanque faltante, transferidos íntegramente al dueño.
              </Text>

              <Text style={styles.clauseHeader}>CLÁUSULA CUARTA (HOLD DE GARANTÍA):</Text>
              <Text style={styles.clauseText}>
                Se autoriza la retención de garantía (hold) en la tarjeta de crédito/débito registrada por la suma de ${((res.monto_hold || 114000)).toLocaleString("es-CL")} CLP, liberable tras la inspección de devolución sin novedades.
              </Text>

              <View style={styles.stampCard}>
                <Icon name="shield" size={20} color={colors.success} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.stampTitle}>FIRMA ELECTRÓNICA AVANZADA</Text>
                  <Text style={styles.stampHash}>
                    HASH: SHA-256: 8f9b7c6a5d4e3f210987654321fedcba
                  </Text>
                  <Text style={styles.stampTimestamp}>
                    Timestamp: {new Date().toISOString()} • Los Ángeles, Chile
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() =>
                Alert.alert(
                  "Descargar Contrato",
                  "Copia certificada en PDF descargada en tu dispositivo para portar en el vehículo."
                )
              }
            >
              <Text style={styles.downloadBtnText}>Descargar Copia PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.okBtn} onPress={onClose}>
              <Text style={styles.okBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightCardBorder,
  },
  contractTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textDark,
  },
  contractSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  contractBody: {
    marginVertical: 8,
  },
  legalBox: {
    backgroundColor: colors.lightSurface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  legalCode: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },
  legalDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 12,
  },
  clauseHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textDark,
    marginTop: 8,
    marginBottom: 3,
  },
  clauseText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    textAlign: "justify",
  },
  stampCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  stampTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.success,
  },
  stampHash: {
    fontSize: 8,
    fontFamily: "monospace",
    color: colors.textSecondary,
    marginTop: 1,
  },
  stampTimestamp: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  modalFooter: {
    flexDirection: "row",
    marginTop: 12,
  },
  downloadBtn: {
    flex: 1.5,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 6,
  },
  downloadBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 12,
  },
  okBtn: {
    flex: 1,
    backgroundColor: colors.lightSurface,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  okBtnText: {
    color: colors.textDark,
    fontWeight: "700",
    fontSize: 12,
  },
});
