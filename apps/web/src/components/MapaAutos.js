import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  OverlayViewF,
  OverlayView,
  InfoWindowF,
  CircleF,
} from "@react-google-maps/api";
import { LocateFixed } from "lucide-react";
import { MapSkeleton } from "./Skeleton";

/**
 * Mapa de autos disponibles con Google Maps.
 *
 * La API key se lee de `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (definida en Vercel /
 * en `.env.local` para desarrollo). Sin key, el componente muestra un aviso en
 * vez de romper. Solo se dibujan los autos que traen `latitud` y `longitud`
 * (endpoint GET /autos).
 */

const API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_GOOGLE_MAPS_API_KEY ||
  "AIzaSyDlTxzYR7A5vqKB4lCuvIdTyTBDfqwqrdU";
const LIBRARIES = []; // constante estable: evita recargas del loader

const DEFAULT_CENTER = { lat: -33.45, lng: -70.66 }; // Región Metropolitana
const DEFAULT_ZOOM = 11;

// Zoom aproximado para que un círculo de `radioKm` entre justo en el mapa.
const zoomParaRadio = (km) => {
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  if (km <= 25) return 11;
  if (km <= 50) return 10;
  return 9;
};

const CIRCLE_OPTIONS = {
  strokeColor: "#14a07c",
  strokeOpacity: 0.5,
  strokeWeight: 1,
  fillColor: "#14a07c",
  fillOpacity: 0.06,
  clickable: false,
};

// Estilo claro tipo "silver", a tono con el sitio blanco.
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f2" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a84" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f0f0ec" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e6e6e1" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dfeee6" }] },
];

const MAP_OPTIONS = {
  styles: MAP_STYLE,
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "cooperative",
  clickableIcons: false,
};

const tieneCoords = (a) =>
  typeof a?.latitud === "number" &&
  typeof a?.longitud === "number" &&
  !Number.isNaN(a.latitud) &&
  !Number.isNaN(a.longitud);

const fmtCLP = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const fmtCorto = (n) => `$${Math.round(Number(n || 0) / 1000)}K`;

function OpenStreetMapFallback({ autos = [], userLocation, seleccionado, setSeleccionado, radioKm }) {
  const centerLat = userLocation?.lat ?? (autos[0]?.latitud ?? -33.45);
  const centerLng = userLocation?.lng ?? (autos[0]?.longitud ?? -70.66);
  const delta = radioKm ? Math.min(1.2, radioKm / 35) : 0.5;
  const bbox = `${(centerLng - delta).toFixed(4)},${(centerLat - delta * 0.7).toFixed(4)},${(centerLng + delta).toFixed(4)},${(centerLat + delta * 0.7).toFixed(4)}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-3xl bg-[#e8ece9] sm:h-[520px]">
      <iframe
        title="Mapa de autos disponibles"
        src={osmUrl}
        className="h-full w-full border-0"
        loading="lazy"
      />
      <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white/95 px-3.5 py-1.5 text-xs font-semibold shadow-sm">
        <span className="h-2 w-2 rounded-full bg-brand-teal" />
        {autos.length} {autos.length === 1 ? "auto disponible" : "autos disponibles"}
      </div>
      {autos.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex gap-2 overflow-x-auto pb-1">
          {autos.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSeleccionado(a.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-left shadow-md transition-all ${
                seleccionado === a.id ? "border-brand-teal ring-2 ring-brand-teal" : "border-brand-line hover:border-brand-ink"
              }`}
            >
              <div className="text-xs">
                <div className="font-bold text-brand-ink">{a.marca} {a.modelo}</div>
                <div className="text-[11px] text-[#63645f]">{a.ubicacion_base || "Chile"}</div>
              </div>
              <span className="rounded-lg bg-brand-tealTint px-2 py-1 text-xs font-bold text-brand-tealInk">
                {fmtCLP(a.tarifa_dia)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapaAutos({ autos = [], activoId, userLocation = null, radioKm = 25, cargando = false }) {
  const mapRef = useRef(null);
  const [seleccionado, setSeleccionado] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "gmaps-script",
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  const conCoords = useMemo(() => autos.filter(tieneCoords), [autos]);

  const ajustarVista = useCallback(
    (map) => {
      if (!map) return;
      if (userLocation) {
        map.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
        map.setZoom(zoomParaRadio(radioKm));
        return;
      }
      if (conCoords.length === 0) return;
      if (conCoords.length === 1) {
        map.setCenter({ lat: conCoords[0].latitud, lng: conCoords[0].longitud });
        map.setZoom(14);
        return;
      }
      if (window.google?.maps?.LatLngBounds) {
        const bounds = new window.google.maps.LatLngBounds();
        conCoords.forEach((a) => bounds.extend({ lat: a.latitud, lng: a.longitud }));
        map.fitBounds(bounds, 64);
      }
    },
    [conCoords, userLocation, radioKm]
  );

  const onLoad = useCallback(
    (map) => {
      mapRef.current = map;
      ajustarVista(map);
    },
    [ajustarVista]
  );

  useEffect(() => {
    if (mapRef.current) ajustarVista(mapRef.current);
  }, [ajustarVista]);

  const recentrar = useCallback(() => {
    if (mapRef.current) ajustarVista(mapRef.current);
  }, [ajustarVista]);

  if (loadError) {
    return (
      <OpenStreetMapFallback
        autos={conCoords}
        userLocation={userLocation}
        seleccionado={seleccionado}
        setSeleccionado={setSeleccionado}
        radioKm={radioKm}
      />
    );
  }

  if (!isLoaded || (cargando && autos.length === 0)) {
    return <MapSkeleton />;
  }

  return (
    <div className="relative h-[380px] w-full min-h-[380px] sm:h-[520px]">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%", minHeight: "380px" }}
        mapContainerClassName="w-full h-full absolute inset-0"
        center={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : DEFAULT_CENTER}
        zoom={userLocation ? zoomParaRadio(radioKm) : DEFAULT_ZOOM}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onClick={() => setSeleccionado(null)}
      >
        {/* Zona de búsqueda + marca "tú estás aquí" */}
        {userLocation && (
          <>
            <CircleF
              center={{ lat: userLocation.lat, lng: userLocation.lng }}
              radius={radioKm * 1000}
              options={CIRCLE_OPTIONS}
            />
            <OverlayViewF
              position={{ lat: userLocation.lat, lng: userLocation.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
            >
              <span className="amay-yo" title="Tu ubicación" />
            </OverlayViewF>
          </>
        )}

        {conCoords.map((auto) => {
          const activo = seleccionado === auto.id || (!seleccionado && auto.id === activoId);
          return (
            <OverlayViewF
              key={auto.id}
              position={{ lat: auto.latitud, lng: auto.longitud }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h })}
            >
              <button
                type="button"
                onClick={() => setSeleccionado(auto.id)}
                className={`amay-pin ${activo ? "amay-pin--active" : ""}`}
                aria-label={`${auto.marca} ${auto.modelo} — ${fmtCLP(auto.tarifa_dia)} por día${
                  auto.ubicacion_base ? ` en ${auto.ubicacion_base}` : ""
                }`}
              >
                {fmtCorto(auto.tarifa_dia)}
              </button>
            </OverlayViewF>
          );
        })}

        {seleccionado && (() => {
          const a = conCoords.find((x) => x.id === seleccionado);
          if (!a) return null;
          return (
            <InfoWindowF
              position={{ lat: a.latitud, lng: a.longitud }}
              onCloseClick={() => setSeleccionado(null)}
              options={{ pixelOffset: new window.google.maps.Size(0, -14) }}
            >
              <div className="min-w-[180px] font-body">
                <div className="font-display text-sm font-bold text-[#141414]">
                  {a.marca} {a.modelo}
                </div>
                <div className="text-[12px] text-[#63645f]">{a.ubicacion_base || ""}</div>
                <div className="mt-1 text-[13px] font-semibold text-[#0b6b52]">
                  {fmtCLP(a.tarifa_dia)} / día
                  {a.rating_promedio ? ` · ★ ${a.rating_promedio}` : ""}
                </div>
                {typeof a.distanciaKm === "number" && (
                  <div className="text-[11px] text-[#63645f]">
                    a {a.distanciaKm < 10 ? a.distanciaKm.toFixed(1).replace(".", ",") : Math.round(a.distanciaKm)} km de ti
                  </div>
                )}
              </div>
            </InfoWindowF>
          );
        })()}
      </GoogleMap>

      <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-semibold shadow-sm">
        <span className="h-2 w-2 rounded-full bg-brand-teal" />
        {userLocation
          ? `${conCoords.length} ${conCoords.length === 1 ? "auto" : "autos"} a ${radioKm} km`
          : `${conCoords.length} de ${autos.length} autos con ubicación`}
      </div>

      {userLocation && (
        <button
          type="button"
          onClick={recentrar}
          className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-sm hover:border-brand-ink"
        >
          <LocateFixed className="h-3.5 w-3.5 text-brand-tealInk" /> Centrar
        </button>
      )}

      {userLocation && conCoords.length === 0 && (
        <div className="pointer-events-none absolute inset-x-6 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-brand-line bg-white/95 p-4 text-center text-[13px] text-[#63645f] shadow-soft">
          No hay autos publicados a {radioKm} km de {userLocation.label || "ti"}. Prueba ampliando el radio.
        </div>
      )}
    </div>
  );
}
