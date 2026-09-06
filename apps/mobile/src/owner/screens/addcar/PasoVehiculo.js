import React from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import {
  colors,
  theme,
  Icon,
  Chip,
  Checkbox,
  CampoConSugerencias,
} from "@rentacar/mobile-shared";
import {
  buscarMarcas,
  buscarModelos,
  esMarcaConocida,
  normalizarMarca,
} from "@rentacar/mobile-shared/vehiculo/catalogo";
import { MAPA, PUNTO_INICIAL } from "./useCarWizard";
import { Tarjeta, TituloPaso, MensajeError, comun, TRANSMISIONES, COMBUSTIBLES, EQUIPAMIENTO } from "./comun";

const { MapView, Marker } = MAPA;

export function PasoVehiculo({ wizard }) {
  const { form, setForm, setField, errorDe, tienePunto } = wizard;

  const setEquip = (key) =>
    setForm((prev) => ({
      ...prev,
      equipamiento: { ...prev.equipamiento, [key]: !prev.equipamiento[key] },
    }));

  return (
    <ScrollView
      contentContainerStyle={estilos.scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <TituloPaso titulo="Empecemos por tu auto" bajada="Los datos que verá quien lo arriende." />

      {/* Qué necesitas — dicho antes de empezar */}
      <View style={estilos.necesitas}>
        <Text style={estilos.necesitasTitulo}>Ten a mano antes de empezar</Text>
        {[
          { icon: "camera", t: "9 fotos del auto, guiadas paso a paso" },
          { icon: "document", t: "Padrón, permiso de circulación, SOAP y revisión técnica" },
          { icon: "clock", t: "Unos 5 minutos. Puedes salir y retomar después" },
        ].map((it) => (
          <View key={it.icon} style={estilos.necesitasFila}>
            <Icon name={it.icon} size={16} color={colors.primary} />
            <Text style={estilos.necesitasTexto}>{it.t}</Text>
          </View>
        ))}
      </View>

      <Tarjeta>
        <CampoConSugerencias
          etiqueta="Marca"
          valor={form.marca}
          onChange={(t) =>
            setForm((prev) => ({
              ...prev,
              marca: t,
              modelo: normalizarMarca(t) === normalizarMarca(prev.marca) ? prev.modelo : "",
            }))
          }
          buscar={buscarMarcas}
          placeholder="Escribe y elige de la lista"
          error={errorDe("marca")}
        />
        <MensajeError texto={errorDe("marca")} />

        <CampoConSugerencias
          etiqueta="Modelo"
          valor={form.modelo}
          onChange={(t) => setField("modelo", t)}
          buscar={(q) => buscarModelos(form.marca, q)}
          placeholder={esMarcaConocida(form.marca) ? "Elige el modelo" : "ej. RAV4, Tucson, Swift"}
          ayuda={esMarcaConocida(form.marca) ? null : "Elige primero la marca y te sugerimos sus modelos."}
          error={errorDe("modelo")}
        />
        <MensajeError texto={errorDe("modelo")} />

        <View style={comun.row}>
          <View style={[comun.field, { flex: 1 }]}>
            <Text style={comun.fieldLabel}>Año</Text>
            <TextInput
              style={[comun.input, errorDe("anio") && comun.inputError]}
              placeholder="2023"
              placeholderTextColor={colors.textPlaceholder}
              value={form.anio}
              onChangeText={(t) => setField("anio", t)}
              keyboardType="number-pad"
            />
            <MensajeError texto={errorDe("anio")} />
          </View>
          <View style={[comun.field, { flex: 1 }]}>
            <Text style={comun.fieldLabel}>Patente</Text>
            <TextInput
              style={[comun.input, { letterSpacing: 3, fontWeight: "700" }, errorDe("patente") && comun.inputError]}
              placeholder="ABCD-12"
              placeholderTextColor={colors.textPlaceholder}
              value={form.patente}
              onChangeText={(t) => setField("patente", t)}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9}
            />
            <MensajeError texto={errorDe("patente")} />
          </View>
        </View>
      </Tarjeta>

      <Tarjeta>
        <Text style={comun.cardTitle}>Ficha técnica</Text>

        <View style={comun.field}>
          <Text style={comun.fieldLabel}>Transmisión</Text>
          <View style={comun.chipsRow}>
            {TRANSMISIONES.map((o) => (
              <Chip
                key={o.v}
                label={o.label}
                selected={form.transmision === o.v}
                onPress={() => setField("transmision", o.v)}
              />
            ))}
          </View>
        </View>

        <View style={comun.field}>
          <Text style={comun.fieldLabel}>Combustible</Text>
          <View style={comun.chipsRow}>
            {COMBUSTIBLES.map((o) => (
              <Chip
                key={o.v}
                label={o.label}
                selected={form.combustible === o.v}
                onPress={() => setField("combustible", o.v)}
              />
            ))}
          </View>
        </View>

        <View style={comun.row}>
          {["asientos", "puertas"].map((campo) => (
            <View key={campo} style={[comun.field, { flex: 1 }]}>
              <Text style={comun.fieldLabel}>{campo === "asientos" ? "Asientos" : "Puertas"}</Text>
              <TextInput
                style={comun.input}
                value={form[campo]}
                onChangeText={(t) => setField(campo, t)}
                keyboardType="number-pad"
                placeholder={campo === "asientos" ? "5" : "4"}
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>
          ))}
        </View>
      </Tarjeta>

      <Tarjeta>
        <Text style={comun.cardTitle}>Equipamiento</Text>
        {EQUIPAMIENTO.map((it) => (
          <Checkbox
            key={it.key}
            label={it.label}
            checked={!!form.equipamiento[it.key]}
            onToggle={() => setEquip(it.key)}
          />
        ))}
      </Tarjeta>

      <Tarjeta>
        <Text style={comun.cardTitle}>¿Dónde lo entregas?</Text>
        <View style={estilos.tip}>
          <Icon name="shield" size={17} color={colors.accentDark} />
          <Text style={estilos.tipTexto}>
            Elige un punto público y concurrido: cerca de un Metro, servicentro o mall.
          </Text>
        </View>

        <View style={estilos.refFila}>
          <Text style={comun.fieldLabel}>Referencia del punto</Text>
          <TouchableOpacity
            style={estilos.gpsBtn}
            onPress={wizard.usarUbicacionActual}
            disabled={wizard.locatingGps}
            activeOpacity={0.8}
          >
            {wizard.locatingGps ? (
              <ActivityIndicator size="small" color={colors.accentDark} />
            ) : (
              <>
                <Icon name="pin" size={13} color={colors.accentDark} />
                <Text style={estilos.gpsBtnText}>Mi ubicación GPS</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={[comun.input, errorDe("ubicacion_base") && comun.inputError]}
          placeholder="ej. Copec Av. Alemania / Plaza de Armas"
          placeholderTextColor={colors.textPlaceholder}
          value={form.ubicacion_base}
          onChangeText={wizard.setReferencia}
        />
        <MensajeError texto={errorDe("ubicacion_base")} />

        {MapView ? (
          <View style={estilos.mapa}>
            <MapView
              ref={wizard.mapaRef}
              style={estilos.mapaVista}
              initialRegion={{
                latitude: form.latitud ?? PUNTO_INICIAL.latitude,
                longitude: form.longitud ?? PUNTO_INICIAL.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              onPress={wizard.onMapPress}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {Marker && tienePunto ? (
                <Marker
                  coordinate={{ latitude: form.latitud, longitude: form.longitud }}
                  draggable
                  onDragEnd={wizard.onMapPress}
                  title={form.ubicacion_base || "Punto de entrega"}
                />
              ) : null}
            </MapView>
            <View style={[estilos.mapaHint, tienePunto && estilos.mapaHintOk]}>
              <Icon name={tienePunto ? "check" : "pin"} size={12} color="#FFFFFF" />
              <Text style={estilos.mapaHintTexto}>
                {tienePunto
                  ? `Punto fijado en ${form.latitud.toFixed(5)}, ${form.longitud.toFixed(5)}`
                  : "Toca el mapa para fijar el punto de entrega"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={estilos.sinMapa}>
            <Icon name="pin" size={18} color={colors.primary} />
            <Text style={estilos.sinMapaTexto}>
              {tienePunto
                ? `Coordenadas fijadas: ${form.latitud.toFixed(5)}, ${form.longitud.toFixed(5)}`
                : 'Usa "Mi ubicación GPS" para fijar el punto de entrega.'}
            </Text>
          </View>
        )}
        <MensajeError texto={errorDe("punto")} />
      </Tarjeta>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  scroll: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    paddingBottom: 40,
    gap: theme.spacing.lg,
  },
  necesitas: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary100,
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  necesitasTitulo: { fontSize: 14, fontWeight: "700", color: colors.primary },
  necesitasFila: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  necesitasTexto: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  tip: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.accent100,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  tipTexto: { flex: 1, fontSize: 12, color: colors.accentDark, lineHeight: 17 },
  refFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: colors.accent100,
  },
  gpsBtnText: { color: colors.accentDark, fontSize: 12, fontWeight: "700" },
  mapa: {
    height: 170,
    borderRadius: theme.radius.field,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapaVista: { width: "100%", height: "100%" },
  mapaHint: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(6,30,31,0.82)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  mapaHintOk: { backgroundColor: colors.accentDark },
  mapaHintTexto: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  sinMapa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sinMapaTexto: { flex: 1, color: colors.textMuted, fontSize: 13 },
});
