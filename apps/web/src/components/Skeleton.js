import React from "react";
import { cn } from "../lib/utils";

// ============================================================================
// Placeholders de carga (skeletons). El sitio nunca muestra datos de ejemplo:
// mientras el catálogo llega desde la API se ven estos bloques con pulso.
// ============================================================================

/** Bloque gris con animación de pulso. Respeta prefers-reduced-motion vía CSS. */
export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn("amay-skeleton rounded-md bg-brand-soft", className)}
      {...props}
    />
  );
}

/** Tarjeta de auto en estado de carga — misma silueta que la real. */
export function CarCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-brand-line bg-white">
      <Skeleton className="h-52 w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-brand-line pt-3">
          <Skeleton className="h-3.5 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-14 rounded-xl" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fila compacta (lista "más pedidos" junto al mapa). */
export function CarRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5">
      <Skeleton className="h-[60px] w-[78px] shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-12" />
    </div>
  );
}

/** Relleno del mapa mientras aún no hay autos que dibujar. */
export function MapSkeleton() {
  return (
    <div className="relative h-[380px] w-full overflow-hidden bg-white sm:h-[520px]">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute left-4 top-4 h-7 w-40 rounded-full bg-white/80" />
    </div>
  );
}
