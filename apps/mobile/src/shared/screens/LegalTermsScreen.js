import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../components/Icon";

const LEGAL_SECTIONS = [
  {
    id: "seguro",
    titulo: "1. Póliza de Seguro Full Cobertura (15 UF)",
    contenido:
      "Todo vehículo arrendado a través de Arrienda Tu Auto cuenta con Seguro Full Cobertura contratado con aseguradora autorizada por la CMF. En caso de siniestro culpable o daño imputable, el deducible estipulado es de 15 UF (~$562.500 CLP), el cual se distribuye solidariamente en un 50% con cargo al Arrendatario y 50% con cargo a la Empresa. El monto máximo a pagar por el cliente bajo cualquier circunstancia con culpa acreditada no superará los $281.250 CLP.",
  },
  {
    id: "transito",
    titulo: "2. Ley de Tránsito 18.290 y Responsabilidad Vial",
    contenido:
      "El arrendatario debe portar licencia de conducir vigente Clase B. Todas las infracciones de tránsito (empadronadas o personales), cobros de peajes/TAG y estacionamientos devengados durante el período del arriendo son de exclusiva responsabilidad del arrendatario y podrán ser descontados del hold de garantía previa notificación de la multa cursada por Carabineros o Juzgado de Policía Local de Los Ángeles.",
  },
  {
    id: "entrega_devolucion",
    titulo: "3. Entrega, Checklist de 9 Fotos e Higiene",
    contenido:
      "El perfeccionamiento de la entrega y restitución se valida mediante el escaneo del código QR y el registro fotográfico obligatorio de 9 imágenes. El vehículo debe restituirse con idéntico nivel de combustible (cobro de $15.000 CLP por cada cuarto de estanque faltante) y en condiciones de aseo óptimas (cargo de $15.000 CLP por suciedad exterior/barro y $35.000 CLP por manchas en tapiz). Estos montos son transferidos íntegramente al dueño.",
  },
  {
    id: "datos",
    titulo: "4. Protección de Datos Personales (Ley 19.628)",
    contenido:
      "Arrienda Tu Auto SpA resguarda la privacidad de las cédulas de identidad y licencias de conducir mediante encriptación AES-256. Las imágenes son procesadas exclusivamente mediante la API de Google Cloud Vision para verificar la autenticidad del documento y jamás son comercializadas ni expuestas a terceros.",
  },
  {
    id: "consumidor",
    titulo: "5. Derechos del Consumidor (Ley 19.496)",
    contenido:
      "Las reservas pueden ser canceladas sin costo hasta 24 horas antes de la hora de entrega acordada. Por cada arriendo completado se emite la correspondiente Boleta Electrónica exenta/afecta de conformidad a las normativas del Servicio de Impuestos Internos (SII).",
  },
];

export function LegalTermsScreen({ onBack }) {
  const { mode } = useApp();
  const isDriver = mode === "conductor";
  const [selectedSection, setSelectedSection] = useState(null);

  return (
    <ScrollView
      style={[styles.container, isDriver ? styles.bgDriver : styles.bgPassenger]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={isDriver ? colors.textWhite : colors.textDark} style={{ marginRight: 4 }} />
        <Text style={[styles.backBtnText, isDriver ? styles.textWhite : styles.textDark]}>
          Volver
        </Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>MARCO LEGAL CHILENO</Text>
        </View>
        <Text style={[styles.title, isDriver ? styles.textWhite : styles.textDark]}>
          Términos, Seguros y Leyes
        </Text>
        <Text style={[styles.subtitle, isDriver ? styles.textSilver : styles.textSecondary]}>
          Regulación jurídica de Arrienda Tu Auto SpA en Los Ángeles, Región del Biobío
        </Text>
      </View>

      {/* Secciones Legales */}
      {LEGAL_SECTIONS.map((sec) => {
        const isOpen = selectedSection === sec.id;
        return (
          <TouchableOpacity
            key={sec.id}
            style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}
            onPress={() => setSelectedSection(isOpen ? null : sec.id)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
                {sec.titulo}
              </Text>
              <Text style={styles.toggleIcon}>{isOpen ? "▲" : "▼"}</Text>
            </View>
            {isOpen && (
              <Text style={[styles.cardBody, isDriver ? styles.textSilver : styles.textSecondary]}>
                {sec.contenido}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Resumen de Jurisdicción */}
      <View style={[styles.jurisdictionBox, isDriver ? styles.boxDriver : styles.boxPassenger]}>
        <Icon name="shield" size={16} color={colors.primary} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.jurisdictionTitle, isDriver ? styles.textWhite : styles.textDark]}>
            Tribunales y Jurisdicción
          </Text>
          <Text style={[styles.jurisdictionText, isDriver ? styles.textSilver : styles.textSecondary]}>
            Para todos los efectos legales y controversias derivadas del contrato de arriendo, las partes fijan su domicilio en la ciudad de Los Ángeles, Región del Biobío, Chile.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  bgPassenger: {
    backgroundColor: colors.lightBg,
  },
  bgDriver: {
    backgroundColor: colors.darkBg,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: colors.primaryMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  cardPassenger: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightCardBorder,
  },
  cardDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  toggleIcon: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 8,
  },
  cardBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.06)",
    textAlign: "justify",
  },
  jurisdictionBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  boxPassenger: {
    backgroundColor: colors.lightSurface,
    borderColor: colors.lightCardBorder,
  },
  boxDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
  },
  jurisdictionTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  jurisdictionText: {
    fontSize: 10,
    lineHeight: 14,
  },
  textWhite: { color: colors.textWhite },
  textDark: { color: colors.textDark },
  textSilver: { color: colors.textSilver },
  textSecondary: { color: colors.textSecondary },
});
