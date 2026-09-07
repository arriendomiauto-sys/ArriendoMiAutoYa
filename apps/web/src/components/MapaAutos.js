import React, { useEffect, useRef, useState } from "react";

/**
 * Mapa de autos disponibles (Leaflet + tiles claros de CARTO).
 *
 * Se carga Leaflet desde CDN en el cliente para no sumar dependencias al
 * bundle: el mapa es puramente decorativo/informativo y no debe frenar el
 * build ni el SSR. Los autos vienen del endpoint GET /autos (prop `autos`);
 * solo se dibujan los que traen `latitud` y `longitud`.
 */

const LEAFLET_VER = "1.9.4";
const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Centro por defecto si ningún auto trae coordenadas (Región Metropolitana).
const DEFAULT_CENTER = [-33.45, -70.66];
const DEFAULT_ZOOM = 11;

function cargarLeaflet() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if (window.L) return resolve(window.L);

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.css`;
      document.head.appendChild(link);
    }

    const existente = document.getElementById("leaflet-js");
    if (existente) {
      existente.addEventListener("load", () => resolve(window.L));
      existente.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.js`;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

const tieneCoords = (a) =>
  typeof a?.latitud === "number" &&
  typeof a?.longitud === "number" &&
  !Number.isNaN(a.latitud) &&
  !Number.isNaN(a.longitud);

const fmtCLP = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const fmtCorto = (n) => `$${Math.round(Number(n || 0) / 1000)}K`;

export default function MapaAutos({ autos = [], activoId }) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error

  const conCoords = autos.filter(tieneCoords);

  useEffect(() => {
    let cancelado = false;

    cargarLeaflet()
      .then((L) => {
        if (cancelado || !contenedorRef.current || mapaRef.current) return;

        const mapa = L.map(contenedorRef.current, {
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(mapa);

        mapaRef.current = { L, mapa, capa: L.layerGroup().addTo(mapa) };
        setEstado("listo");
      })
      .catch(() => !cancelado && setEstado("error"));

    return () => {
      cancelado = true;
      if (mapaRef.current) {
        mapaRef.current.mapa.remove();
        mapaRef.current = null;
      }
    };
  }, []);

  // Dibuja / redibuja los pines cuando cambian los autos o el destacado.
  useEffect(() => {
    if (!mapaRef.current) return;
    const { L, mapa, capa } = mapaRef.current;
    capa.clearLayers();

    if (conCoords.length === 0) {
      mapa.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const puntos = [];
    conCoords.forEach((auto) => {
      const activo = activoId ? auto.id === activoId : false;
      const icon = L.divIcon({
        className: "",
        html: `<div class="amay-pin ${activo ? "amay-pin--active" : ""}">${fmtCorto(auto.tarifa_dia)}</div>`,
        iconSize: null,
      });
      const rating = auto.rating_promedio ? `★ ${auto.rating_promedio}` : "Auto verificado";
      const marker = L.marker([auto.latitud, auto.longitud], { icon }).bindPopup(
        `<strong style="font-family:'Space Grotesk',sans-serif">${auto.marca} ${auto.modelo}</strong><br>` +
          `<span style="color:#63645f;font-size:12px">${auto.ubicacion_base || ""}</span><br>` +
          `<span style="color:#0b6b52;font-weight:600;font-size:13px">${fmtCLP(auto.tarifa_dia)} / día · ${rating}</span>`
      );
      marker.addTo(capa);
      puntos.push([auto.latitud, auto.longitud]);
    });

    if (puntos.length === 1) {
      mapa.setView(puntos[0], 14);
    } else {
      mapa.fitBounds(puntos, { padding: [48, 48], maxZoom: 14 });
    }
  }, [autos, activoId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-[380px] sm:h-[520px] w-full bg-brand-soft">
      <div ref={contenedorRef} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute left-4 top-4 z-[500] inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-semibold shadow-sm">
        <span className="h-2 w-2 rounded-full bg-brand-teal" />
        {estado === "listo"
          ? `${conCoords.length} de ${autos.length} autos con ubicación`
          : estado === "error"
          ? "No se pudo cargar el mapa"
          : "Cargando mapa…"}
      </div>
    </div>
  );
}
