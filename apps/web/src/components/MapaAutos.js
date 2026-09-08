import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  OverlayViewF,
  OverlayView,
  InfoWindowF,
} from "@react-google-maps/api";

/**
 * Mapa de autos disponibles con Google Maps.
 *
 * La API key se lee de `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (definida en Vercel /
 * en `.env.local` para desarrollo). Sin key, el componente muestra un aviso en
 * vez de romper. Solo se dibujan los autos que traen `latitud` y `longitud`
 * (endpoint GET /autos).
 */

const API_KEY = process.env.NEXT_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LIBRARIES = []; // constante estable: evita recargas del loader

const DEFAULT_CENTER = { lat: -33.45, lng: -70.66 }; // Región Metropolitana
const DEFAULT_ZOOM = 11;

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

function Aviso({ children }) {
  return (
    <div className="flex h-[380px] w-full items-center justify-center bg-brand-soft p-6 text-center text-sm text-[#63645f] sm:h-[520px]">
      {children}
    </div>
  );
}

export default function MapaAutos({ autos = [], activoId }) {
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
      if (!map || conCoords.length === 0) return;
      if (conCoords.length === 1) {
        map.setCenter({ lat: conCoords[0].latitud, lng: conCoords[0].longitud });
        map.setZoom(14);
        return;
      }
      const bounds = new window.google.maps.LatLngBounds();
      conCoords.forEach((a) => bounds.extend({ lat: a.latitud, lng: a.longitud }));
      map.fitBounds(bounds, 64);
    },
    [conCoords]
  );

  const onLoad = useCallback(
    (map) => {
      mapRef.current = map;
      ajustarVista(map);
    },
    [ajustarVista]
  );

  if (!API_KEY) {
    return <Aviso>Configura <code className="mx-1 rounded bg-white px-1 py-0.5 text-xs">NEXT_GOOGLE_MAPS_API_KEY</code> para ver el mapa.</Aviso>;
  }
  if (loadError) return <Aviso>No se pudo cargar Google Maps.</Aviso>;
  if (!isLoaded) return <Aviso>Cargando mapa…</Aviso>;

  return (
    <div className="relative h-[380px] w-full sm:h-[520px]">
      <GoogleMap
        mapContainerClassName="absolute inset-0"
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onClick={() => setSeleccionado(null)}
      >
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
              </div>
            </InfoWindowF>
          );
        })()}
      </GoogleMap>

      <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-semibold shadow-sm">
        <span className="h-2 w-2 rounded-full bg-brand-teal" />
        {conCoords.length} de {autos.length} autos con ubicación
      </div>
    </div>
  );
}
