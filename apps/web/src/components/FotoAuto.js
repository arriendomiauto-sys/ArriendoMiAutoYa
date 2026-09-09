import React, { useState } from "react";
import { Car } from "lucide-react";
import { cn } from "../lib/utils";

// ============================================================================
// Imagen de un auto. Si no hay foto o la URL falla, muestra un marcador
// neutro (fondo claro + ícono) — nunca una foto de ejemplo de otro auto.
// ============================================================================
export default function FotoAuto({ src, alt, className, imgClassName, priority = false }) {
  const [falló, setFalló] = useState(false);
  const mostrar = src && !falló;

  return (
    <div className={cn("relative overflow-hidden bg-brand-soft", className)}>
      {mostrar ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFalló(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Car className="h-8 w-8 text-brand-dash" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
