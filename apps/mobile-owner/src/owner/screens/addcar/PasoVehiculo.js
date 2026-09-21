import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
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
import { validarPatenteChilena } from "@rentacar/shared-schemas";
import { MAPA, PUNTO_INICIAL } from "./useCarWizard";
import { Tarjeta, TituloPaso, MensajeError, TRANSMISIONES, COMBUSTIBLES, EQUIPAMIENTO } from "./comun";
import { SelectorAnioModal } from "./SelectorAnioModal";
import { SelectorCategoria } from "./SelectorCategoria";

const { MapView, Marker } = MAPA;

export function PasoVehiculo({ wizard }) {
  const { form, setForm, setField, errorDe, tienePunto, tipos, elegirCategoria } = wizard;
  const [modalAnioAbierto, setModalAnioAbierto] = useState(false);
  const anioActual = new Date().getFullYear();

  const setEquip = (key) =>
    setForm((prev) => ({
      ...prev,
      equipamiento: { ...prev.equipamiento, [key]: !prev.equipamiento[key] },
    }));

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <TituloPaso titulo="Empecemos por tu auto" bajada="Los datos que verá quien lo arriende." />

      {/* Qué necesitas — dicho antes de empezar */}
      <View className="gap-2 p-3.5 rounded-xl bg-primary-100 border border-primary-200">
        <Text className="text-sm font-bold text-primary">Ten a mano antes de empezar</Text>
        {[
          { icon: "camera", t: "9 fotos del auto, guiadas paso a paso" },
          { icon: "document", t: "Padrón, permiso de circulación, SOAP y revisión técnica" },
          { icon: "clock", t: "Unos 5 minutos. Puedes salir y retomar después" },
        ].map((it) => (
          <View key={it.icon} className="flex-row items-center gap-2">
            <Icon name={it.icon} size={16} color={colors.primary} />
            <Text className="flex-1 text-[13px] text-textDark leading-[18px]">{it.t}</Text>
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

        <View className="flex-row gap-3">
          <View className="flex-1 gap-1.5">
            <View className="flex-row justify-between items-center mb-0.5">
              <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Año</Text>
              <TouchableOpacity
                onPress={() => setModalAnioAbierto(true)}
                hitSlop={theme.control.hitSlop}
                accessibilityLabel="Elegir año de la lista"
              >
                <Text className="text-[11px] font-bold text-primary">
                  Elegir de lista
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className={`bg-white rounded-xl px-3.5 h-12 border-[1.5px] border-gray-200 flex-row items-center justify-between ${
                errorDe("anio") ? "border-red-500" : ""
              }`}
              onPress={() => setModalAnioAbierto(true)}
              activeOpacity={0.8}
              accessibilityRole="combobox"
              accessibilityLabel="Año de fabricación"
            >
              <TextInput
                className="flex-1 h-12 text-[15px] font-bold text-textDark"
                placeholder={String(anioActual)}
                placeholderTextColor={colors.textPlaceholder}
                value={form.anio}
                onChangeText={(t) => setField("anio", t)}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Icon name="chevronDown" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <MensajeError texto={errorDe("anio")} />
          </View>

          <View className="flex-1 gap-1.5">
            <View className="flex-row justify-between items-center mb-0.5">
              <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Patente</Text>
              {validarPatenteChilena(form.patente) ? (
                <Text className="text-[10.5px] font-bold text-accent-700">
                  ✓ Válida
                </Text>
              ) : null}
            </View>
            <TextInput
              className={`bg-white rounded-xl px-3.5 h-12 border-[1.5px] border-gray-200 text-[15px] text-textDark tracking-widest font-extrabold ${
                errorDe("patente") ? "border-red-500" : validarPatenteChilena(form.patente) ? "border-accent-700" : ""
              }`}
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
        <Text className="text-[15px] font-bold text-textDark">Categoría</Text>
        <SelectorCategoria tipos={tipos} seleccionado={form.categoria} onSelect={elegirCategoria} />
        <MensajeError texto={errorDe("categoria")} />
      </Tarjeta>

      <Tarjeta>
        <Text className="text-[15px] font-bold text-textDark">Ficha técnica</Text>

        <View className="gap-1.5">
          <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Transmisión</Text>
          <View className="flex-row flex-wrap gap-2">
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

        <View className="gap-1.5">
          <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Combustible</Text>
          <View className="flex-row flex-wrap gap-2">
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

        <View className="gap-1.5">
          <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Asientos</Text>
          <View className="flex-row flex-wrap gap-2">
            {["2", "4", "5", "7", "8"].map((num) => (
              <Chip
                key={num}
                label={`${num} asientos`}
                selected={String(form.asientos) === num}
                onPress={() => setField("asientos", num)}
              />
            ))}
          </View>
        </View>

        <View className="gap-1.5">
          <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Puertas</Text>
          <View className="flex-row flex-wrap gap-2">
            {["2", "3", "4", "5"].map((num) => (
              <Chip
                key={num}
                label={`${num} puertas`}
                selected={String(form.puertas) === num}
                onPress={() => setField("puertas", num)}
              />
            ))}
          </View>
        </View>
      </Tarjeta>

      <SelectorAnioModal
        visible={modalAnioAbierto}
        anioSeleccionado={form.anio}
        onSelect={(anio) => setField("anio", anio)}
        onClose={() => setModalAnioAbierto(false)}
      />

      <Tarjeta>
        <Text className="text-[15px] font-bold text-textDark">Equipamiento</Text>
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
        <Text className="text-[15px] font-bold text-textDark">¿Dónde lo entregas?</Text>
        <View className="flex-row gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <Icon name="shield" size={17} color={colors.accentDark} />
          <Text className="flex-1 text-xs text-accent-700 leading-[17px]">
            Elige un punto público y concurrido: cerca de un Metro, servicentro o mall.
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted">Referencia del punto</Text>
          <TouchableOpacity
            className="flex-row items-center gap-1 py-1 px-2.5 rounded-lg bg-accent/15"
            onPress={wizard.usarUbicacionActual}
            disabled={wizard.locatingGps}
            activeOpacity={0.8}
          >
            {wizard.locatingGps ? (
              <ActivityIndicator size="small" color={colors.accentDark} />
            ) : (
              <>
                <Icon name="pin" size={13} color={colors.accentDark} />
                <Text className="text-accent-700 text-xs font-bold">Usar mi ubicación</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          className={`bg-white rounded-xl px-3.5 h-12 border-[1.5px] border-gray-200 text-[15px] text-textDark ${
            errorDe("ubicacion_base") ? "border-red-500" : ""
          }`}
          placeholder="Av. Alemania 6370, Temuco, Araucanía"
          placeholderTextColor={colors.textPlaceholder}
          value={form.ubicacion_base}
          onChangeText={wizard.setReferencia}
        />
        <Text className="text-[11px] text-textMuted leading-[15px] mt-1">
          Formato: calle y número, ciudad, comuna (si aplica), región. Se completa
          solo al fijar el punto o usar tu ubicación.
        </Text>
        <MensajeError texto={errorDe("ubicacion_base")} />

        {MapView ? (
          <View className="h-[170px] rounded-xl overflow-hidden border border-gray-200">
            <MapView
              ref={wizard.mapaRef}
              className="w-full h-full"
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
            <View className={`absolute bottom-2 self-center flex-row items-center gap-1.5 py-1 px-2.5 rounded-full ${
              tienePunto ? "bg-accent-700" : "bg-[#061E1F]/80"
            }`}>
              <Icon name={tienePunto ? "check" : "pin"} size={12} color="#FFFFFF" />
              <Text className="text-white text-[11px] font-semibold">
                {tienePunto
                  ? `Punto fijado en ${form.latitud.toFixed(5)}, ${form.longitud.toFixed(5)}`
                  : "Toca el mapa para fijar el punto de entrega"}
              </Text>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 bg-surface-subtle p-3 rounded-xl border border-gray-200">
            <Icon name="pin" size={18} color={colors.primary} />
            <Text className="flex-1 text-textMuted text-[13px]">
              {tienePunto
                ? `Coordenadas fijadas: ${form.latitud.toFixed(5)}, ${form.longitud.toFixed(5)}`
                : 'Usa "Usar mi ubicación" para fijar el punto de entrega.'}
            </Text>
          </View>
        )}
        <MensajeError texto={errorDe("punto")} />
      </Tarjeta>
    </ScrollView>
  );
}
