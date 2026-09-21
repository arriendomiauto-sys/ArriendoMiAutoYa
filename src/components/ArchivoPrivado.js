import { useEffect, useState } from "react";
import { FileText, ImageOff, RefreshCw, ExternalLink } from "lucide-react";
import { ApiClient } from "../lib/api";

export const esPdf = (url) => /\.pdf(\?|$)/i.test(url || "");
const necesitaSesion = (url) => (url || "").includes("/storage/local/");

/**
 * Abre un archivo en una pestaña nueva. Los que están en el respaldo local privado exigen la sesión del
 * panel (Bearer), así que un enlace directo no sirve: se descargan con la sesión y se abren como objeto.
 */
export async function abrirArchivo(url) {
  if (!url) return;
  if (!necesitaSesion(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.open(await ApiClient.urlDeArchivoPrivado(url), "_blank", "noopener");
}

/**
 * Muestra la imagen de un bucket privado (o el acceso a un PDF) sin fallar en silencio.
 *
 * Antes las imágenes rotas se ocultaban con `onError` y el admin no sabía si el documento no había
 * llegado o si el enlace había caducado. Acá siempre se ve un estado: cargando, la imagen, o el error con
 * "Reintentar" y "Abrir enlace".
 */
export default function ArchivoPrivado({ url, alt = "", miniatura = false, style, className = "" }) {
  const [src, setSrc] = useState(null);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error
  const [intento, setIntento] = useState(0);
  const [errorAbrir, setErrorAbrir] = useState(null);

  useEffect(() => {
    let cancelado = false;
    let objeto = null;
    setSrc(null);
    setErrorAbrir(null);

    if (!url) {
      setEstado("error");
      return undefined;
    }
    if (esPdf(url)) {
      setEstado("listo"); // el PDF se abre a demanda
      return undefined;
    }
    setEstado("cargando");
    if (necesitaSesion(url)) {
      ApiClient.urlDeArchivoPrivado(url)
        .then((u) => {
          if (cancelado) return URL.revokeObjectURL(u);
          objeto = u;
          setSrc(u);
          setEstado("listo");
        })
        .catch(() => !cancelado && setEstado("error"));
    } else {
      setSrc(url); // <img> carga directo; onError lo pasa a "error"
    }
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [url, intento]);

  const caja = { display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6, textAlign: "center", ...style };

  if (esPdf(url)) {
    return (
      <div className={className} style={caja}>
        <FileText size={miniatura ? 18 : 34} />
        {miniatura ? null : (
          <>
            <span style={{ fontSize: 12 }}>Documento PDF</span>
            <button
              className="btn"
              onClick={() => abrirArchivo(url).catch((e) => setErrorAbrir(e.message))}
            >
              <ExternalLink size={14} />Abrir PDF
            </button>
            {errorAbrir ? <span style={{ fontSize: 11, color: "var(--danger, #f87171)" }}>{errorAbrir}</span> : null}
          </>
        )}
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className={className} style={caja} role="alert">
        <ImageOff size={miniatura ? 16 : 30} />
        {miniatura ? null : (
          <>
            <span style={{ fontSize: 12 }}>No se pudo cargar la imagen</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" onClick={() => setIntento((n) => n + 1)}><RefreshCw size={13} />Reintentar</button>
              {url ? <button className="btn" onClick={() => abrirArchivo(url).catch(() => {})}><ExternalLink size={13} />Abrir enlace</button> : null}
            </div>
          </>
        )}
      </div>
    );
  }

  if (estado === "cargando" && !src) {
    return (
      <div className={className} style={caja}>
        <RefreshCw size={miniatura ? 14 : 22} className="spin" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onLoad={() => setEstado("listo")}
      onError={() => setEstado("error")}
    />
  );
}
