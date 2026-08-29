import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { colors, useApp, Icon, showAlert, ApiClient } from "@rentacar/mobile-shared";

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function formatCLP(monto) {
  return `$${Math.abs(monto).toLocaleString("es-CL")} CLP`;
}

function formatFecha(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EarningsScreen({ onBack, onOpenDisputes }) {
  const { bankAccount, updateBankAccount } = useApp();
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [banco, setBanco] = useState(bankAccount?.banco || "");
  const [tipoCuenta, setTipoCuenta] = useState(bankAccount?.tipo_cuenta || "");
  const [numeroCuenta, setNumeroCuenta] = useState(bankAccount?.numero || "");
  const [titular, setTitular] = useState(bankAccount?.titular || "");
  const [rutTitular, setRutTitular] = useState(bankAccount?.rut || "");
  const [savingBank, setSavingBank] = useState(false);

  const [ganancias, setGanancias] = useState(null);
  const [loadingGanancias, setLoadingGanancias] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const cargarGanancias = useCallback(async () => {
    setLoadingGanancias(true);
    try {
      const data = await ApiClient.getMisGanancias();
      setGanancias(data);
    } catch (err) {
      console.warn("[EarningsScreen] No se pudo cargar ganancias:", err.message);
    } finally {
      setLoadingGanancias(false);
    }
  }, []);

  useEffect(() => {
    cargarGanancias();
  }, [cargarGanancias]);

  const handleSaveBank = async () => {
    if (!numeroCuenta || !titular || !rutTitular) {
      showAlert("Datos Incompletos", "Por favor completa todos los datos bancarios.");
      return;
    }
    setSavingBank(true);
    try {
      await updateBankAccount({
        banco,
        tipo_cuenta: tipoCuenta,
        numero: numeroCuenta,
        titular,
        rut: rutTitular,
      });
      setBankModalVisible(false);
      showAlert("Cuenta Guardada", "Tus liquidaciones se depositarán en esta cuenta.");
    } catch (err) {
      showAlert("No se pudo guardar", err.message || "Verifica el RUT ingresado e intenta de nuevo.");
    } finally {
      setSavingBank(false);
    }
  };

  const handleRequestPayout = () => {
    if (!bankAccount) {
      showAlert("Falta tu cuenta bancaria", "Configura una cuenta de depósito antes de solicitar el retiro.");
      setBankModalVisible(true);
      return;
    }
    if (!ganancias || ganancias.saldo_disponible_clp <= 0) {
      showAlert("Sin saldo disponible", "No tienes liquidaciones pendientes de pago por retirar.");
      return;
    }
    showAlert(
      "Solicitar Retiro Inmediato",
      `Se solicitará la transferencia de ${formatCLP(ganancias.saldo_disponible_clp)} a tu ${bankAccount.banco} N° ${bankAccount.numero}. Nuestro equipo de soporte procesará la solicitud manualmente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar Solicitud",
          onPress: async () => {
            setRequestingPayout(true);
            try {
              await ApiClient.crearTicketSoporte(
                "Solicitud de retiro inmediato",
                `Solicito la transferencia inmediata de mi saldo disponible (${formatCLP(ganancias.saldo_disponible_clp)}) a mi cuenta registrada: ${bankAccount.banco}, ${bankAccount.tipo_cuenta} N° ${bankAccount.numero}, titular ${bankAccount.titular} (${bankAccount.rut}).`
              );
              showAlert("Solicitud Enviada", "Tu solicitud quedó registrada y nuestro equipo de soporte gestionará la transferencia.");
            } catch (err) {
              showAlert("No se pudo enviar la solicitud", err.message || "Intenta de nuevo más tarde.");
            } finally {
              setRequestingPayout(false);
            }
          },
        },
      ]
    );
  };

  const saldoDisponible = ganancias?.saldo_disponible_clp ?? 0;
  const historial = ganancias?.historial ?? [];

  const hoy = new Date();
  const barras = Array.from({ length: 7 }).map((_, idx) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - (6 - idx));
    const totalDia = historial
      .filter((h) => {
        const fechaLiq = new Date(h.timestamp);
        return (
          fechaLiq.getFullYear() === dia.getFullYear() &&
          fechaLiq.getMonth() === dia.getMonth() &&
          fechaLiq.getDate() === dia.getDate()
        );
      })
      .reduce((sum, h) => sum + h.monto, 0);
    return { dia: DIAS_SEMANA[dia.getDay()], monto: totalDia };
  });
  const maxBarra = Math.max(...barras.map((b) => b.monto), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="arrow-left" size={20} color={colors.textWhite} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Panel Financiero y Ganancias</Text>
          {onOpenDisputes && (
            <TouchableOpacity onPress={onOpenDisputes} style={styles.disputesLink}>
              <Text style={styles.disputesLinkText}>Disputas</Text>
            </TouchableOpacity>
          )}
        </View>
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
        {loadingGanancias ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
        ) : (
          <Text style={styles.balanceAmount}>
            {formatCLP(saldoDisponible)} <Text style={styles.currency}>CLP</Text>
          </Text>
        )}
        <Text style={styles.balanceSub}>
          {ganancias
            ? `${ganancias.cantidad_liquidaciones} liquidación(es) registrada(s) en total`
            : "Cargando tus liquidaciones..."}
        </Text>

        <View style={styles.balanceButtonsRow}>
          <TouchableOpacity
            style={[styles.payoutBtn, requestingPayout && { opacity: 0.6 }]}
            onPress={handleRequestPayout}
            activeOpacity={0.85}
            disabled={requestingPayout}
          >
            <Text style={styles.payoutBtnText}>
              {requestingPayout ? "Enviando solicitud..." : "Solicitar Retiro Inmediato →"}
            </Text>
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

      {/* Gráfico Semanal (liquidaciones reales de los últimos 7 días) */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Liquidaciones de los Últimos 7 Días</Text>
        </View>

        <View style={styles.barsContainer}>
          {barras.map((bar, idx) => (
            <View key={idx} style={styles.barColumn}>
              <View
                style={[
                  styles.barFill,
                  { height: Math.max((bar.monto / maxBarra) * 100, bar.monto > 0 ? 6 : 2) },
                ]}
              />
              <Text style={styles.barDay}>{bar.dia}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Desglose de Liquidaciones */}
      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Últimas Liquidaciones</Text>

        {loadingGanancias ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
        ) : historial.length === 0 ? (
          <Text style={styles.bankDetails}>
            Aún no tienes liquidaciones. Aparecerán aquí cuando termines tu primer arriendo.
          </Text>
        ) : (
          historial.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyConcept}>
                  Liquidación de arriendo{item.reserva_id ? ` (reserva ${item.reserva_id.slice(0, 8)})` : ""}
                </Text>
                <Text style={styles.historyDate}>
                  {formatFecha(item.timestamp)} • {item.estado === "pagado" ? "Pagada" : "Pendiente de pago"}
                </Text>
              </View>
              <Text
                style={[
                  styles.historyAmount,
                  item.estado === "pagado" ? styles.textAccent : styles.textMuted,
                ]}
              >
                +{formatCLP(item.monto)}
              </Text>
            </View>
          ))
        )}
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

            <TouchableOpacity
              style={[styles.saveBankBtn, savingBank && { opacity: 0.6 }]}
              onPress={handleSaveBank}
              disabled={savingBank}
            >
              <Text style={styles.saveBankBtnText}>
                {savingBank ? "Guardando..." : "Guardar Cuenta de Depósito →"}
              </Text>
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
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  disputesLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  disputesLinkText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
  },
  title: {
    flex: 1,
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
  textMuted: {
    color: colors.textMuted,
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
