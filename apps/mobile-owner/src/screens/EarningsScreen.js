import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { colors, useApp, Icon } from "@rentacar/mobile-shared";

export function EarningsScreen() {
  const { bankAccount, setBankAccount } = useApp();
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [banco, setBanco] = useState(bankAccount?.banco || "");
  const [tipoCuenta, setTipoCuenta] = useState(bankAccount?.tipo_cuenta || "");
  const [numeroCuenta, setNumeroCuenta] = useState(bankAccount?.numero || "");
  const [titular, setTitular] = useState(bankAccount?.titular || "");
  const [rutTitular, setRutTitular] = useState(bankAccount?.rut || "");

  const [filterPeriod, setFilterPeriod] = useState("semana");

  const handleSaveBank = () => {
    if (!numeroCuenta || !titular || !rutTitular) {
      Alert.alert("Datos Incompletos", "Por favor completa todos los datos bancarios.");
      return;
    }
    setBankAccount({
      banco,
      tipo_cuenta: tipoCuenta,
      numero: numeroCuenta,
      titular,
      rut: rutTitular,
    });
    setBankModalVisible(false);
    Alert.alert("Cuenta Guardada", "Tus transferencias semanales se depositarán en esta cuenta.");
  };

  const handleRequestPayout = () => {
    Alert.alert(
      "Solicitar Transferencia Inmediata",
      `Se transferirán $284.000 CLP netos a tu ${banco} N° ${numeroCuenta}. Plazo estimado: 15 minutos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar Transferencia",
          onPress: () =>
            Alert.alert("Transferencia en Proceso", "Comprobante emitido. Los fondos llegarán a tu cuenta bancaria."),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Panel Financiero y Ganancias</Text>
        <Text style={styles.subtitle}>
          80% neto de arriendos y 100% de compensaciones por combustible y aseo
        </Text>
      </View>

      {/* Saldo Principal */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>SALDO DISPONIBLE PARA RETIRO</Text>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>DISPONIBLE</Text>
          </View>
        </View>
        <Text style={styles.balanceAmount}>$284.000 <Text style={styles.currency}>CLP</Text></Text>
        <Text style={styles.balanceSub}>
          Próxima liquidación automática: Lunes 09:00 hrs
        </Text>

        <View style={styles.balanceButtonsRow}>
          <TouchableOpacity
            style={styles.payoutBtn}
            onPress={handleRequestPayout}
            activeOpacity={0.85}
          >
            <Text style={styles.payoutBtnText}>Solicitar Retiro Inmediato →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bankBtn}
            onPress={() => setBankModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.bankBtnText}>Cuenta Bancaria</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cuenta Bancaria Configurada */}
      <View style={styles.bankInfoCard}>
        <View style={styles.bankHeaderRow}>
          <View style={styles.bankTitleRow}>
            <Icon name="dollar" size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.bankTitle}>Cuenta de Depósito Registrada</Text>
          </View>
          <TouchableOpacity onPress={() => setBankModalVisible(true)}>
            <Text style={styles.bankEditLink}>Cambiar</Text>
          </TouchableOpacity>
        </View>
        {bankAccount ? (
          <>
            <Text style={styles.bankName}>{bankAccount.banco}</Text>
            <Text style={styles.bankDetails}>
              {bankAccount.tipo_cuenta} • N° {bankAccount.numero}
            </Text>
            <Text style={styles.bankOwner}>
              Titular: {bankAccount.titular} ({bankAccount.rut})
            </Text>
          </>
        ) : (
          <Text style={styles.bankDetails}>Aún no has configurado una cuenta de depósito.</Text>
        )}
      </View>

      {/* Gráfico Semanal Simplificado */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Rendimiento de Arriendos</Text>
          <View style={styles.periodRow}>
            {["semana", "mes"].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setFilterPeriod(p)}
                style={[
                  styles.periodBtn,
                  filterPeriod === p && styles.periodBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    filterPeriod === p && styles.periodBtnTextActive,
                  ]}
                >
                  {p === "semana" ? "Esta Semana" : "Este Mes"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.barsContainer}>
          {[
            { dia: "Lun", monto: 35000, h: 40 },
            { dia: "Mar", monto: 35000, h: 40 },
            { dia: "Mié", monto: 70000, h: 80 },
            { dia: "Jue", monto: 35000, h: 40 },
            { dia: "Vie", monto: 105000, h: 100 },
            { dia: "Sáb", monto: 70000, h: 80 },
            { dia: "Dom", monto: 35000, h: 40 },
          ].map((bar, idx) => (
            <View key={idx} style={styles.barColumn}>
              <View style={[styles.barFill, { height: bar.h }]} />
              <Text style={styles.barDay}>{bar.dia}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Desglose de Liquidaciones */}
      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Últimas Liquidaciones</Text>

        {[
          {
            id: "1",
            concepto: "Arriendo 3 días - Toyota RAV4 (BBCL-10)",
            fecha: "15 Ago 2026",
            neto: "+$89.600 CLP",
            tipo: "arriendo",
          },
          {
            id: "2",
            concepto: "Compensación Aseo Estándar ($15.000 CLP al 100%)",
            fecha: "14 Ago 2026",
            neto: "+$15.000 CLP",
            tipo: "extra",
          },
          {
            id: "3",
            concepto: "Transferencia a CuentaRUT Banco Estado",
            fecha: "11 Ago 2026",
            neto: "-$140.000 CLP",
            tipo: "retiro",
          },
        ].map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyConcept}>{item.concepto}</Text>
              <Text style={styles.historyDate}>{item.fecha}</Text>
            </View>
            <Text
              style={[
                styles.historyAmount,
                item.tipo === "retiro" ? styles.textRed : styles.textAccent,
              ]}
            >
              {item.neto}
            </Text>
          </View>
        ))}
      </View>

      {/* Modal Cuenta Bancaria */}
      <Modal visible={bankModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configurar Cuenta Bancaria</Text>
              <TouchableOpacity onPress={() => setBankModalVisible(false)}>
                <Icon name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Los fondos se transferirán a esta cuenta bancaria chilena.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Banco</Text>
              <TextInput
                style={styles.input}
                value={banco}
                onChangeText={setBanco}
                placeholder="ej. Banco Estado, Santander, BCI"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Cuenta</Text>
              <TextInput
                style={styles.input}
                value={tipoCuenta}
                onChangeText={setTipoCuenta}
                placeholder="CuentaRUT / Vista / Corriente"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Número de Cuenta</Text>
              <TextInput
                style={styles.input}
                value={numeroCuenta}
                onChangeText={setNumeroCuenta}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre del Titular</Text>
              <TextInput
                style={styles.input}
                value={titular}
                onChangeText={setTitular}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>RUT del Titular</Text>
              <TextInput
                style={styles.input}
                value={rutTitular}
                onChangeText={setRutTitular}
              />
            </View>

            <TouchableOpacity style={styles.saveBankBtn} onPress={handleSaveBank}>
              <Text style={styles.saveBankBtnText}>Guardar Cuenta de Depósito →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSilver,
    marginTop: 2,
  },
  balanceCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    marginBottom: 14,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textSilver,
    letterSpacing: 0.5,
  },
  badgePill: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgePillText: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: "900",
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.textWhite,
  },
  currency: {
    fontSize: 14,
    color: colors.accent,
  },
  balanceSub: {
    fontSize: 10,
    color: colors.textSilver,
    marginTop: 2,
    marginBottom: 14,
  },
  balanceButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  payoutBtn: {
    flex: 1.5,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginRight: 6,
  },
  payoutBtnText: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 12,
  },
  bankBtn: {
    flex: 1,
    backgroundColor: colors.darkCardHover,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  bankBtnText: {
    color: colors.textSilver,
    fontWeight: "700",
    fontSize: 12,
  },
  bankInfoCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 14,
  },
  bankHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  bankTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bankTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textWhite,
  },
  bankEditLink: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "700",
  },
  bankName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
  },
  bankDetails: {
    fontSize: 11,
    color: colors.textSilver,
    marginTop: 1,
  },
  bankOwner: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 14,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
  },
  periodRow: {
    flexDirection: "row",
  },
  periodBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  periodBtnActive: {
    backgroundColor: colors.accentMuted,
  },
  periodBtnText: {
    fontSize: 10,
    color: colors.textSilver,
    fontWeight: "600",
  },
  periodBtnTextActive: {
    color: colors.accent,
    fontWeight: "800",
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 110,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: "center",
    flex: 1,
  },
  barFill: {
    width: 14,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  barDay: {
    fontSize: 9,
    color: colors.textSilver,
    marginTop: 6,
    fontWeight: "600",
  },
  historyCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  historyConcept: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  historyDate: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  historyAmount: {
    fontSize: 12,
    fontWeight: "900",
  },
  textAccent: {
    color: colors.accent,
  },
  textRed: {
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.darkCard,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textWhite,
  },
  modalSub: {
    fontSize: 11,
    color: colors.textSilver,
    marginTop: 2,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSilver,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 13,
    color: colors.textWhite,
  },
  saveBankBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  saveBankBtnText: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 13,
  },
});
