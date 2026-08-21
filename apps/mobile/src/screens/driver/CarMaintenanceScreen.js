import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";

export function CarMaintenanceScreen({ onBack }) {
  const { cars } = useApp();
  const [selectedCar] = useState(cars[0] || { marca: "Toyota", modelo: "RAV4", patente: "BBCL-10" });

  const docs = [
    {
      id: "rt",
      nombre: "Revisión Técnica (PRT Los Ángeles)",
      vence: "30 Noviembre 2026",
      estado: "vigente",
      diasRestantes: 106,
    },
    {
      id: "pc",
      nombre: "Permiso de Circulación (I. M. Los Ángeles)",
      vence: "31 Marzo 2027",
      estado: "vigente",
      diasRestantes: 227,
    },
    {
      id: "soap",
      nombre: "Seguro Obligatorio SOAP",
      vence: "31 Marzo 2027",
      estado: "vigente",
      diasRestantes: 227,
    },
    {
      id: "poliza",
      nombre: "Póliza Plataforma (Deducible 15 UF)",
      vence: "Renovación Automática",
      estado: "activa",
      diasRestantes: null,
    },
  ];

  const maintenanceItems = [
    {
      id: "aceite",
      item: "Cambio de Aceite y Filtro (5W-30 Sintético)",
      kmActual: "42.500 km",
      proximoKm: "47.500 km (en 5.000 km)",
      estado: "al_dia",
    },
    {
      id: "frenos",
      item: "Pastillas de Freno Delanteras y Traseras",
      vidaUtil: "75% restante",
      estado: "al_dia",
    },
    {
      id: "neumaticos",
      item: "Rotación y Balanceo de Neumáticos",
      kmActual: "40.000 km",
      estado: "al_dia",
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={colors.textWhite} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>DOCUMENTACIÓN Y TALLER</Text>
        </View>
        <Text style={styles.title}>Control de Mantenimientos</Text>
        <Text style={styles.subtitle}>
          {selectedCar.marca} {selectedCar.modelo} ({selectedCar.patente || "BBCL-10"})
        </Text>
      </View>

      {/* SECCIÓN 1: PAPELES Y REVISIÓN TÉCNICA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Documentación Legal del Vehículo</Text>

        {docs.map((d) => (
          <View key={d.id} style={styles.docRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>{d.nombre}</Text>
              <Text style={styles.docExpiry}>Vence: {d.vence}</Text>
            </View>
            <View style={styles.docStatusBadge}>
              <Text style={styles.docStatusText}>Vigente</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.uploadDocBtn}
          onPress={() => Alert.alert("Cargar Documento", "Se ha abierto el selector de archivos para actualizar el PDF del padrón o revisión técnica.")}
        >
          <Text style={styles.uploadDocBtnText}>+ Actualizar Documento PDF</Text>
        </TouchableOpacity>
      </View>

      {/* SECCIÓN 2: BITÁCORA DE TALLER Y MECÁNICA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bitácora de Taller y Kilometraje</Text>

        {maintenanceItems.map((m) => (
          <View key={m.id} style={styles.maintRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.maintItem}>{m.item}</Text>
              <Text style={styles.maintDetail}>
                {m.proximoKm ? `Próximo servicio: ${m.proximoKm}` : `Estado: ${m.vidaUtil}`}
              </Text>
            </View>
            <View style={styles.maintStatusBadge}>
              <Text style={styles.maintStatusText}>Al Día</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addMaintBtn}
          onPress={() => Alert.alert("Registrar Servicio", "Formulario de ingreso de boleta o mantención mecánica.")}
        >
          <Text style={styles.addMaintBtnText}>+ Registrar Nueva Mantención</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
    backgroundColor: colors.darkCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 10,
  },
  docRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  docName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  docExpiry: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  docStatusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  docStatusText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: "800",
  },
  uploadDocBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: colors.darkCardHover,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  uploadDocBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  maintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  maintItem: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  maintDetail: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  maintStatusBadge: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  maintStatusText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "800",
  },
  addMaintBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: colors.darkCardHover,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  addMaintBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
});
