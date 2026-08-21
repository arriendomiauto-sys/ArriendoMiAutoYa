import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";

export function ReferralsPromoScreen({ onBack }) {
  const { mode, currentUser } = useApp();
  const isDriver = mode === "conductor";

  const [couponCode, setCouponCode] = useState("");
  const referralCode = "BIOBIO-CARLOS26";

  const handleCopyCode = () => {
    Alert.alert("Código Copiado", `Tu código ${referralCode} ha sido copiado al portapapeles.`);
  };

  const handleRedeemCoupon = () => {
    if (!couponCode.trim()) {
      Alert.alert("Ingresa un Cupón", "Escribe el código del cupón promocional.");
      return;
    }
    if (couponCode.toUpperCase() === "LOSANGELES10" || couponCode.toUpperCase() === "PRIMERARRIENDO") {
      Alert.alert(
        "Cupón Aplicado",
        "¡Felicidades! Se ha abonado un cupón de $10.000 CLP a tu billetera para tu próximo arriendo."
      );
      setCouponCode("");
    } else {
      Alert.alert("Cupón No Válido", "El código ingresado no existe o ha expirado.");
    }
  };

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
          <Text style={styles.badgePillText}>PROGRAMA DE BENEFICIOS</Text>
        </View>
        <Text style={[styles.title, isDriver ? styles.textWhite : styles.textDark]}>
          Invita Amigos y Gana
        </Text>
        <Text style={[styles.subtitle, isDriver ? styles.textSilver : styles.textSecondary]}>
          Comparte tu código y ambos recibirán $10.000 CLP de descuento
        </Text>
      </View>

      {/* Tarjeta de Código de Referido */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          Tu Código Único de Referido
        </Text>
        <Text style={[styles.cardDesc, isDriver ? styles.textSilver : styles.textSecondary]}>
          Tus amigos obtienen $10.000 CLP en su primer arriendo y tú recibes $10.000 CLP en saldo cuando completen su primer viaje en Los Ángeles.
        </Text>

        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{referralCode}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
            <Text style={styles.copyBtnText}>Copiar</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.shareBtn, isDriver ? styles.shareBtnDriver : styles.shareBtnPassenger]}
          onPress={() =>
            Alert.alert(
              "Compartir Invitación",
              `Usa mi código ${referralCode} en Arrienda Tu Auto Los Ángeles y obtén $10.000 CLP de descuento en tu primer arriendo.`
            )
          }
        >
          <Text style={[styles.shareBtnText, isDriver && { color: colors.dark }]}>
            Compartir Enlace con Amigos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Canjear Cupón Promocional */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          ¿Tienes un Cupón de Descuento?
        </Text>
        <Text style={[styles.cardDesc, isDriver ? styles.textSilver : styles.textSecondary]}>
          Ingresa códigos de convenios corporativos o promociones locales de Los Ángeles.
        </Text>

        <View style={styles.couponRow}>
          <TextInput
            style={[styles.couponInput, isDriver ? styles.inputDriver : styles.inputPassenger]}
            placeholder="ej. PRIMERARRIENDO"
            placeholderTextColor={colors.textMuted}
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.redeemBtn, isDriver ? styles.redeemBtnDriver : styles.redeemBtnPassenger]}
            onPress={handleRedeemCoupon}
          >
            <Text style={[styles.redeemBtnText, isDriver && { color: colors.dark }]}>Canjear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Historial de Referidos */}
      <View style={[styles.card, isDriver ? styles.cardDriver : styles.cardPassenger]}>
        <Text style={[styles.cardTitle, isDriver ? styles.textWhite : styles.textDark]}>
          Tus Referidos Registrados
        </Text>

        <View style={styles.referralStatsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, isDriver ? styles.textWhite : styles.textDark]}>3</Text>
            <Text style={styles.statLabel}>Amigos Registrados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.accent }]}>$20.000</Text>
            <Text style={styles.statLabel}>Saldo Ganado (CLP)</Text>
          </View>
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
    padding: 14,
    marginBottom: 12,
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
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  codeText: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 1,
  },
  copyBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.dark,
  },
  shareBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  shareBtnPassenger: {
    backgroundColor: colors.primary,
  },
  shareBtnDriver: {
    backgroundColor: colors.accent,
  },
  shareBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 12,
  },
  couponRow: {
    flexDirection: "row",
  },
  couponInput: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  inputPassenger: {
    backgroundColor: colors.lightSurface,
    borderColor: colors.lightCardBorder,
    color: colors.textDark,
  },
  inputDriver: {
    backgroundColor: colors.darkCardHover,
    borderColor: colors.darkBorder,
    color: colors.textWhite,
  },
  redeemBtn: {
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemBtnPassenger: {
    backgroundColor: colors.primary,
  },
  redeemBtnDriver: {
    backgroundColor: colors.accent,
  },
  redeemBtnText: {
    color: colors.textWhite,
    fontSize: 11,
    fontWeight: "800",
  },
  referralStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
  },
  statBox: {
    alignItems: "center",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  textWhite: { color: colors.textWhite },
  textDark: { color: colors.textDark },
  textSilver: { color: colors.textSilver },
  textSecondary: { color: colors.textSecondary },
});
