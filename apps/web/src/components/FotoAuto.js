import React, { useState } from "react";
import Image from "next/image";
import { Car } from "lucide-react";
import { cn } from "../lib/utils";

// ============================================================================
// Imagen de un auto. Si no hay foto o la URL falla, muestra un marcador
// neutro (fondo claro + ícono) — nunca una foto de ejemplo de otro auto.
// El contenedor debe definir su tamaño (el padre es `relative`): la imagen usa
// `fill` + `object-cover`, igual que el antiguo <img>.
// ============================================================================
export default function FotoAuto({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}) {
  const [falló, setFalló] = useState(false);
  const mostrar = src && !falló;

  return (
    <div className={cn("relative overflow-hidden bg-brand-soft", className)}>
      {mostrar ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          onError={() => setFalló(true)}
          className={cn("object-cover", imgClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Car className="h-8 w-8 text-brand-dash" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
