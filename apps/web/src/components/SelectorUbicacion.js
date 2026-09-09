import React, { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Loader2, ChevronDown, X } from "lucide-react";
import {
  COMUNAS,
  comunaMasCercana,
  solicitarUbicacionGPS,
  estadoPermisoUbicacion,
} from "../lib/geo";

// ============================================================================
// Control de ubicación para el mapa de autos.
// - Botón "usar mi ubicación" (solo se pide el permiso al hacer clic).
// - Lista de comunas como alternativa (o si el navegador niega el permiso).
// - Selector de radio de búsqueda cuando hay una ubicación activa.
// ============================================================================

const RADIOS_KM = [5, 10, 25, 50, 100];

export default function SelectorUbicacion({
  ubicacion, // { lat, lng, label, fuente } | null
  radioKm,
  totalEnZona,
  onUbicacion,
  onRadio,
  onLimpiar,
}) {
  const [estado, setEstado] = useState("idle"); // idle | cargando | error
  const [errorMsg, setErrorMsg] = useState("");
  const [permiso, setPermiso] = useState("desconocido");
  const [comunasAbierto, setComunasAbierto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    estadoPermisoUbicacion().then(setPermiso);
  }, []);

  // Cerrar el desplegable de comunas al hacer clic fuera.
  useEffect(() => {
    if (!comunasAbierto) return;
    const fuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setComunasAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [comunasAbierto]);

  const usarMiUbicacion = async () => {
    setEstado("cargando");
    setErrorMsg("");
    try {
      const pos = await solicitarUbicacionGPS();
      const cerca = comunaMasCercana(pos);
      onUbicacion({
        lat: pos.lat,
        lng: pos.lng,
        label: cerca?.distanciaKm < 25 ? cerca.nombre : "tu ubicación",
        fuente: "gps",
      });
      setEstado("idle");
      setPermiso("granted");
    } catch (err) {
      setEstado("error");
      setErrorMsg(err?.mensaje || "No se pudo obtener tu ubicación.");
      if (err?.code === "denegado") setPermiso("denied");
    }
  };

  const elegirComuna = (c) => {
    onUbicacion({ lat: c.lat, lng: c.lng, label: c.nombre, fuente: "comuna" });
    setComunasAbierto(false);
    setEstado("idle");
    setErrorMsg("");
  };

  const cargando = estado === "cargando";

  // ---- Estado ACTIVO: ya hay una ubicación ---------------------------------
  if (ubicacion) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <MapPin className="h-4 w-4 text-brand-tealInk" />
          Autos cerca de <span className="text-brand-tealInk">{ubicacion.label}</span>
          <span className="font-normal text-[#63645f]">
            · {totalEnZona} {totalEnZona === 1 ? "auto" : "autos"} a {radioKm} km
          </span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-medium text-[#63645f]">Radio</label>
          <select
            value={radioKm}
            onChange={(e) => onRadio(Number(e.target.value))}
            className="rounded-lg border border-brand-line bg-white px-2 py-1.5 text-xs font-semibold text-brand-ink focus:border-brand-teal focus:outline-none"
            aria-label="Radio de búsqueda en kilómetros"
          >
            {RADIOS_KM.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onLimpiar}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-line px-2.5 py-1.5 text-xs font-semibold text-[#63645f] hover:border-brand-ink hover:text-brand-ink"
          >
            <X className="h-3.5 w-3.5" /> Ver todo Chile
          </button>
        </div>
      </div>
    );
  }

  // ---- Estado INICIAL: pedir ubicación o elegir comuna ---------------------
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-brand-ink">¿Dónde estás?</span>
        <span className="text-xs text-[#63645f]">
          Te mostramos los autos publicados más cerca tuyo.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {permiso !== "denied" && (
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {cargando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            {cargando ? "Buscando…" : "Usar mi ubicación"}
          </button>
        )}

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setComunasAbierto((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all ${
              permiso === "denied"
                ? "bg-brand-teal text-[#04231b] hover:bg-[#12b78d] shadow-sm"
                : "border border-brand-line text-brand-ink hover:border-brand-ink"
            }`}
            aria-haspopup="listbox"
            aria-expanded={comunasAbierto}
          >
            {permiso === "denied" ? "Elige tu comuna" : "o elige tu comuna"}
            <ChevronDown className={`h-4 w-4 transition-transform ${comunasAbierto ? "rotate-180" : ""}`} />
          </button>

          {comunasAbierto && (
            <ul
              role="listbox"
              className="absolute right-0 z-30 mt-2 max-h-72 w-56 overflow-auto rounded-xl border border-brand-line bg-white py-1 shadow-lg"
            >
              {COMUNAS.map((c) => (
                <li key={`${c.nombre}-${c.region}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => elegirComuna(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-brand-soft"
                  >
                    <span className="font-medium text-brand-ink">{c.nombre}</span>
                    <span className="text-[11px] text-[#63645f]">{c.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {estado === "error" && errorMsg && (
        <div className="w-full sm:basis-full flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <span>{errorMsg} Por favor elige tu comuna de la lista arriba.</span>
        </div>
      )}
    </div>
  );
}
