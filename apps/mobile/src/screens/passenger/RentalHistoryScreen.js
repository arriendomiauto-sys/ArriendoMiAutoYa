import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";

export function RentalHistoryScreen({ onSelectReservation, onBack }) {
  const [activeTab, setActiveTab] = useState("activas"); // 'activas' | 'proximas' | 'pasadas'

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Title Header (Pantalla 17) */}
      <View style={styles.titleArea}>
        <Text style={styles.screenTitle}>Mis reservas</Text>
      </View>

      {/* 3 Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "activas" && styles.tabBtnActive]}
          onPress={() => setActiveTab("activas")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "activas" && styles.tabTextActive,
            ]}
          >
            Activas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "proximas" && styles.tabBtnActive]}
          onPress={() => setActiveTab("proximas")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "proximas" && styles.tabTextActive,
            ]}
          >
            Próximas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "pasadas" && styles.tabBtnActive]}
          onPress={() => setActiveTab("pasadas")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "pasadas" && styles.tabTextActive,
            ]}
          >
            Pasadas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reservations List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* Card 1: En curso */}
        <View style={styles.rentalCard}>
          <View style={styles.cardMain}>
            <View style={styles.thumbBox} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.carName}>Suzuki Swift 2023</Text>
                <View style={styles.inCourseBadge}>
                  <Text style={styles.inCourseText}>En curso</Text>
                </View>
              </View>
              <Text style={styles.carSub}>Devuelve el sábado 16 a las 21:30</Text>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.guaranteeText}>Garantía retenida · $150.000</Text>
            <TouchableOpacity onPress={() => onSelectReservation({ status: "en_curso" })}>
              <Text style={styles.viewLinkText}>Ver</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 2: Por aprobar */}
        <View style={styles.rentalCardSimple}>
          <View style={styles.thumbBox} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.carName}>Toyota Yaris 2022</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Por aprobar</Text>
              </View>
            </View>
            <Text style={styles.carSub}>2 – 5 sep · Las Condes</Text>
          </View>
        </View>

        {/* Card 3: Finalizada */}
        <View style={[styles.rentalCardSimple, { opacity: 0.75 }]}>
          <View style={styles.thumbBox} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.carName}>Kia Morning 2021</Text>
              <View style={styles.finishedBadge}>
                <Text style={styles.finishedText}>Finalizada</Text>
              </View>
            </View>
            <Text style={styles.carSub}>14 – 17 jul · calificada 5,0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titleArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    paddingBottom: 10,
  },
  tabBtnActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  tabTextActive: {
    fontWeight: "600",
    color: colors.text,
  },
  listContent: {
    padding: 20,
    gap: 14,
  },
  rentalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardMain: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumbBox: {
    width: 76,
    height: 58,
    borderRadius: 10,
    backgroundColor: colors.primary100,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  carSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  inCourseBadge: {
    backgroundColor: colors.primary100,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  inCourseText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  guaranteeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  viewLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent700,
  },
  rentalCardSimple: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  pendingBadge: {
    backgroundColor: "#FFF8EC",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  finishedBadge: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  finishedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
});
