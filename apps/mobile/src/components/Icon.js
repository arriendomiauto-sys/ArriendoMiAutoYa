import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";

export function Icon({ name, size = 18, color = colors.primary, style }) {
  const s = size;

  switch (name) {
    case "search":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.65,
              height: s * 0.65,
              borderRadius: s * 0.35,
              borderWidth: 1.8,
              borderColor: color,
              position: "relative",
            }}
          >
            <View
              style={{
                position: "absolute",
                bottom: -s * 0.22,
                right: -s * 0.18,
                width: 1.8,
                height: s * 0.35,
                backgroundColor: color,
                transform: [{ rotate: "-45deg" }],
              }}
            />
          </View>
        </View>
      );

    case "car":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.9,
              height: s * 0.48,
              borderRadius: 3,
              borderWidth: 1.6,
              borderColor: color,
              position: "relative",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -s * 0.22,
                left: s * 0.15,
                width: s * 0.55,
                height: s * 0.25,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                borderWidth: 1.4,
                borderColor: color,
                borderBottomWidth: 0,
              }}
            />
            {/* Wheels */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, marginBottom: -s * 0.12 }}>
              <View style={{ width: s * 0.2, height: s * 0.2, borderRadius: s * 0.1, backgroundColor: color }} />
              <View style={{ width: s * 0.2, height: s * 0.2, borderRadius: s * 0.1, backgroundColor: color }} />
            </View>
          </View>
        </View>
      );

    case "user":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.42,
              height: s * 0.42,
              borderRadius: s * 0.21,
              borderWidth: 1.6,
              borderColor: color,
              marginBottom: 1.5,
            }}
          />
          <View
            style={{
              width: s * 0.75,
              height: s * 0.35,
              borderTopLeftRadius: s * 0.2,
              borderTopRightRadius: s * 0.2,
              borderWidth: 1.6,
              borderColor: color,
              borderBottomWidth: 0,
            }}
          />
        </View>
      );

    case "key":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: s * 0.45,
                height: s * 0.45,
                borderRadius: s * 0.23,
                borderWidth: 1.6,
                borderColor: color,
              }}
            />
            <View
              style={{
                width: s * 0.4,
                height: 1.8,
                backgroundColor: color,
                marginLeft: -1,
              }}
            />
            <View
              style={{
                width: 1.8,
                height: s * 0.18,
                backgroundColor: color,
                marginLeft: -3,
                marginTop: s * 0.08,
              }}
            />
          </View>
        </View>
      );

    case "shield":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.75,
              height: s * 0.85,
              borderTopLeftRadius: s * 0.35,
              borderTopRightRadius: s * 0.35,
              borderBottomLeftRadius: s * 0.4,
              borderBottomRightRadius: s * 0.4,
              borderWidth: 1.6,
              borderColor: color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ width: 1.4, height: s * 0.4, backgroundColor: color }} />
          </View>
        </View>
      );

    case "card":
    case "wallet":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.85,
              height: s * 0.58,
              borderRadius: 3,
              borderWidth: 1.6,
              borderColor: color,
              justifyContent: "flex-start",
              paddingTop: 2,
            }}
          >
            <View style={{ width: "100%", height: 1.8, backgroundColor: color, marginVertical: 1 }} />
            <View style={{ width: s * 0.2, height: 1.6, backgroundColor: color, marginLeft: 2, marginTop: 2 }} />
          </View>
        </View>
      );

    case "dollar":
    case "earnings":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.82,
              height: s * 0.82,
              borderRadius: s * 0.41,
              borderWidth: 1.6,
              borderColor: color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color, fontSize: s * 0.55, fontWeight: "900", lineHeight: s * 0.65 }}>$</Text>
          </View>
        </View>
      );

    case "bell":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.65,
              height: s * 0.6,
              borderTopLeftRadius: s * 0.35,
              borderTopRightRadius: s * 0.35,
              borderWidth: 1.6,
              borderColor: color,
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <View style={{ width: s * 0.85, height: 1.8, backgroundColor: color, marginBottom: -1 }} />
          </View>
          <View style={{ width: s * 0.2, height: s * 0.12, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: color, marginTop: 1 }} />
        </View>
      );

    case "history":
    case "receipt":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.68,
              height: s * 0.85,
              borderRadius: 2,
              borderWidth: 1.6,
              borderColor: color,
              padding: 2,
              justifyContent: "space-around",
            }}
          >
            <View style={{ width: "75%", height: 1.4, backgroundColor: color }} />
            <View style={{ width: "60%", height: 1.4, backgroundColor: color }} />
            <View style={{ width: "80%", height: 1.4, backgroundColor: color }} />
          </View>
        </View>
      );

    case "chat":
    case "support":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.8,
              height: s * 0.6,
              borderRadius: 3,
              borderWidth: 1.6,
              borderColor: color,
              position: "relative",
            }}
          >
            <View
              style={{
                position: "absolute",
                bottom: -3.5,
                left: 3,
                width: 0,
                height: 0,
                borderLeftWidth: 3.5,
                borderRightWidth: 3.5,
                borderTopWidth: 3.5,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: color,
              }}
            />
          </View>
        </View>
      );

    case "location":
    case "pin":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.52,
              height: s * 0.52,
              borderRadius: s * 0.26,
              borderWidth: 1.6,
              borderColor: color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ width: s * 0.16, height: s * 0.16, borderRadius: s * 0.08, backgroundColor: color }} />
          </View>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 2.5,
              borderRightWidth: 2.5,
              borderTopWidth: 4,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: color,
              marginTop: -0.5,
            }}
          />
        </View>
      );

    case "star":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.6,
              height: s * 0.6,
              backgroundColor: color,
              transform: [{ rotate: "45deg" }],
              borderRadius: 1,
            }}
          />
        </View>
      );

    case "check":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.55,
              height: s * 0.3,
              borderLeftWidth: 2,
              borderBottomWidth: 2,
              borderColor: color,
              transform: [{ rotate: "-45deg" }],
              marginBottom: s * 0.1,
            }}
          />
        </View>
      );

    case "close":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View style={{ width: s * 0.65, height: 1.8, backgroundColor: color, transform: [{ rotate: "45deg" }], position: "absolute" }} />
          <View style={{ width: s * 0.65, height: 1.8, backgroundColor: color, transform: [{ rotate: "-45deg" }], position: "absolute" }} />
        </View>
      );

    case "arrow-right":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View style={{ width: s * 0.5, height: 1.8, backgroundColor: color, position: "absolute" }} />
          <View
            style={{
              width: s * 0.28,
              height: s * 0.28,
              borderRightWidth: 1.8,
              borderTopWidth: 1.8,
              borderColor: color,
              transform: [{ rotate: "45deg" }],
              marginLeft: s * 0.2,
            }}
          />
        </View>
      );

    case "arrow-left":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View style={{ width: s * 0.5, height: 1.8, backgroundColor: color, position: "absolute" }} />
          <View
            style={{
              width: s * 0.28,
              height: s * 0.28,
              borderLeftWidth: 1.8,
              borderBottomWidth: 1.8,
              borderColor: color,
              transform: [{ rotate: "45deg" }],
              marginRight: s * 0.2,
            }}
          />
        </View>
      );

    case "calendar":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.8,
              height: s * 0.75,
              borderRadius: 2.5,
              borderWidth: 1.6,
              borderColor: color,
              paddingTop: 3,
            }}
          >
            <View style={{ width: "100%", height: 1.5, backgroundColor: color }} />
          </View>
        </View>
      );

    case "gear":
      return (
        <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
          <View
            style={{
              width: s * 0.7,
              height: s * 0.7,
              borderRadius: s * 0.35,
              borderWidth: 1.6,
              borderColor: color,
              borderStyle: "dashed",
            }}
          />
        </View>
      );

    default:
      return (
        <View
          style={[
            {
              width: s * 0.45,
              height: s * 0.45,
              borderRadius: s * 0.22,
              backgroundColor: color,
            },
            style,
          ]}
        />
      );
  }
}
