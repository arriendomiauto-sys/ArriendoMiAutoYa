import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { Icon } from "./Icon";

export function Header({ onOpenNotifications }) {
  const { mode, toggleMode, currentUser } = useApp();
  const isDriver = mode === "conductor";

  return (
    <View style={styles.container}>
      {/* Role Switcher Pill (Variación 1b del Design Doc) */}
      <TouchableOpacity
        style={styles.modePill}
        onPress={toggleMode}
        activeOpacity={0.8}
      >
        <Icon
          name={isDriver ? "car" : "key"}
          size={16}
          color={colors.primary}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.modeText}>
          {isDriver ? "Dueño" : "Arrendatario"}
        </Text>
        <Icon name="arrow-down" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Brand & User Avatar */}
      <View style={styles.rightRow}>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={onOpenNotifications}
          activeOpacity={0.8}
        >
          <Icon name="bell" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatarCircle}
          onPress={toggleMode}
          activeOpacity={0.8}
        >
          <Image
            source={{
              uri:
                currentUser?.foto_perfil_url ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
            }}
            style={styles.avatarImg}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary100,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.primary200,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
});
