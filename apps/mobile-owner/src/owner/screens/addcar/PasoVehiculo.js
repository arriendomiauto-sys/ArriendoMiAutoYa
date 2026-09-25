import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import {
  colors,
  theme,
  Icon,
  Chip,
  Checkbox,
  CampoConSugerencias,
  TOTAL_FOTOS_AUTO,
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

// Orden de validación (ver `errores` en useCarWizard.js) mapeado a la
// sección del paso donde vive cada campo, para poder hacer scroll a la
// primera que tenga un error.
const SECCION_DE_CAMPO = {
  marca: "datosBasicos",
  modelo: "datosBasicos",
  categoria: "categoria",
  anio: "datosBasicos",
  patente: "datosBasicos",
  ubicacion_base: "ubicacion",
  punto: "ubicacion",
};
const ORDEN_CAMPOS = ["marca", "modelo", "categoria", "anio", "patente", "ubicacion_base", "punto"];

export function PasoVehiculo({ wizard }) {
  const { form, setForm, setField, errorDe, errores, tienePunto, tipos, elegirCategoria, intentoFallidoTick } = wizard;
  const [modalAnioAbierto, setModalAnioAbierto] = useState(false);
  const anioActual = new Date().getFullYear();

  const scrollRef = useRef(null);
  const seccionesY = useRef({});
  const marcarSeccion = (nombre) => (e) => {
    seccionesY.current[nombre] = e.nativeEvent.layout.y;
  };

  // Al fallar "Siguiente" (ver intentoFallidoTick en useCarWizard.js), salta
  // a la sección del primer campo con error -- antes, si ese campo quedaba
  // más abajo del scroll, tocar "Siguiente" parecía no hacer nada.
  useEffect(() => {
    if (!intentoFallidoTick) return;
    const primerCampo = ORDEN_CAMPOS.find((c) => errores[c]);
    const seccion = primerCampo && SECCION_DE_CAMPO[primerCampo];
    const y = seccion ? seccionesY.current[seccion] : null;
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentoFallidoTick]);

  const setEquip = (key) =>
    setForm((prev) => ({
      ...prev,
      equipamiento: { ...prev.equipamiento, [key]: !prev.equipamiento[key] },
    }));

  return (
    <ScrollView
      ref={scrollRef}
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
          { icon: "camera", t: `${TOTAL_FOTOS_AUTO} fotos del auto, guiadas paso a paso` },
          { icon: "document", t: "Padrón, permiso de circulación, SOAP, revisión técnica y certificado de gases" },
          { icon: "clock", t: "Unos 5 minutos. Puedes salir y retomar después" },
        ].map((it) => (
          <View key={it.icon} className="flex-row items-center gap-2">
            <Icon name={it.icon} size={16} color={colors.primary} />
            <Text className="flex-1 text-[13px] text-textDark leading-[18px]">{it.t}</Text>
          </View>
        ))}
      </View>

      <View onLayout={marcarSeccion("datosBasicos")}>
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
            <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted mb-0.5">Año</Text>
            {/* Solo desplegable, sin escritura libre: antes competían un
                TextInput y el modal por el mismo toque. Un año se elige de
                una lista corta, no se escribe -- así no hace falta abrir el
                teclado ni pelear con dos formas de hacer lo mismo. */}
            <TouchableOpacity
              className={`bg-white rounded-xl px-3.5 h-12 border-[1.5px] border-gray-200 flex-row items-center justify-between ${
                errorDe("anio") ? "border-red-500" : ""
              }`}
              onPress={() => setModalAnioAbierto(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Año de fabricación, ${form.anio || "sin elegir"}`}
            >
              <Text className={`text-[15px] font-bold ${form.anio ? "text-textDark" : "text-textPlaceholder"}`}>
                {form.anio || String(anioActual)}
              </Text>
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
            {!errorDe("patente") ? (
              <Text className="text-[10.5px] text-textMuted leading-[14px]">
                Con o sin guion, como aparezca en tu padrón.
              </Text>
            ) : null}
            <MensajeError texto={errorDe("patente")} />
          </View>
        </View>
      </Tarjeta>
      </View>

      <View onLayout={marcarSeccion("categoria")}>
      <Tarjeta>
        <Text className="text-[15px] font-bold text-textDark">Categoría</Text>
        <SelectorCategoria tipos={tipos} seleccionado={form.categoria} onSelect={elegirCategoria} />
        <MensajeError texto={errorDe("categoria")} />
      </Tarjeta>
      </View>

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

      <View onLayout={marcarSeccion("ubicacion")}>
      <Tarjeta>
        <Text className="text-[15px] font-bold text-textDark">¿Dónde lo entregas?</Text>
        <View className="flex-row gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <Icon name="shield" size={17} color={colors.accentDark} />
          <Text className="flex-1 text-xs text-accent-700 leading-[17px]">
            Elige un punto público y concurrido: cerca de un Metro, servicentro o mall.
          </Text>
        </View>

        {/* El mapa va primero: es la forma principal de fijar el punto, no
            un anexo después del campo de texto -- antes quedaba al final de
            la tarjeta, abajo del todo. Más grande (340 en vez de 220) para
            tocar con más precisión y que se note como mapa (antes, sin
            tiles cargados, un mapa chico se leía como un cuadrado blanco
            vacío), con borde y sombra más marcados. El botón de GPS flota
            sobre el mapa (patrón común de apps de mapas) en vez de ocupar
            una fila aparte arriba del campo de texto. */}
        {MapView ? (
          <View className="h-[340px] rounded-2xl overflow-hidden border-[1.5px] border-gray-200 shadow-md">
            <MapView
              ref={wizard.mapaRef}
              className="w-full h-full"
                style={{ width: "100%", height: "100%" }}
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
            <TouchableOpacity
              className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white items-center justify-center shadow-md"
              onPress={wizard.usarUbicacionActual}
              disabled={wizard.locatingGps}
              accessibilityRole="button"
              accessibilityLabel="Centrar el mapa en mi ubicación actual"
            >
              {wizard.locatingGps ? (
                <ActivityIndicator size="small" color={colors.accentDark} />
              ) : (
                <Icon name="pin" size={19} color={colors.accentDark} />
              )}
            </TouchableOpacity>
            <View className={`absolute bottom-3 self-center flex-row items-center gap-1.5 py-1.5 px-3 rounded-full shadow-sm ${
              tienePunto ? "bg-accent-700" : "bg-[#061E1F]/85"
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
                : "Usa tu ubicación o busca la dirección abajo para fijar el punto."}
            </Text>
            <TouchableOpacity
              className="flex-row items-center gap-1 py-1.5 px-2.5 rounded-lg bg-accent/15"
              onPress={wizard.usarUbicacionActual}
              disabled={wizard.locatingGps}
              activeOpacity={0.8}
            >
              {wizard.locatingGps ? (
                <ActivityIndicator size="small" color={colors.accentDark} />
              ) : (
                <Text className="text-accent-700 text-xs font-bold">Usar mi ubicación</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        <MensajeError texto={errorDe("punto")} />

        <Text className="text-xs font-semibold tracking-wider uppercase text-textMuted mt-1">
          Referencia del punto
        </Text>
        <View className="flex-row gap-2">
          {/* Antes esto era de un solo sentido: tocar el mapa completaba el
              texto, pero escribir una dirección acá no movía el mapa para
              nada -- quien prefería escribir en vez de tocar el mapa no
              tenía forma de ubicar el punto. La lupa busca la dirección
              escrita y mueve el pin ahí. */}
          <TextInput
            className={`flex-1 bg-white rounded-xl px-3.5 h-12 border-[1.5px] border-gray-200 text-[15px] text-textDark ${
              errorDe("ubicacion_base") ? "border-red-500" : ""
            }`}
            placeholder="Av. Alemania 6370, Temuco, Araucanía"
            placeholderTextColor={colors.textPlaceholder}
            value={form.ubicacion_base}
            onChangeText={wizard.setReferencia}
            onSubmitEditing={wizard.buscarDireccionEnMapa}
            returnKeyType="search"
          />
          <TouchableOpacity
            className="w-12 h-12 rounded-xl bg-primary-100 items-center justify-center"
            onPress={wizard.buscarDireccionEnMapa}
            disabled={wizard.buscandoDireccion || !form.ubicacion_base?.trim()}
            accessibilityRole="button"
            accessibilityLabel="Buscar esta dirección en el mapa"
          >
            {wizard.buscandoDireccion ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="search" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-[11px] text-textMuted leading-[15px] mt-1">
          Escribe la dirección y toca la lupa para ubicarla, o marca el punto directo en el mapa --
          lo que sea más rápido. Formato: calle y número, ciudad, comuna (si aplica), región.
        </Text>
        <MensajeError texto={errorDe("ubicacion_base")} />
      </Tarjeta>
      </View>
    </ScrollView>
  );
}
