import React from "react";
import Link from "next/link";

const cols = [
  {
    title: "Producto",
    links: [
      { href: "/#catalogo", label: "Buscar autos" },
      { href: "/#propietarios", label: "Publicar mi auto" },
      { href: "/#como-funciona", label: "Cómo funciona" },
      { href: "/garantias", label: "Seguro y garantías" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/#faq", label: "Preguntas frecuentes" },
      { href: "/simulador-duenos", label: "Simulador de ingresos" },
      { href: "/cotizador", label: "Cotizador" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Política de privacidad" },
      { href: "/garantias", label: "Política de seguro" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#0e0e0d] text-[#a7a7a1]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-10 whitespace-nowrap text-center font-display text-[16vw] font-bold leading-none tracking-tighter text-[#141412] select-none"
      >
        arriendomiautoya
      </span>

      <div className="container relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-10 border-b border-[#2c2c29] pb-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f1f1d]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ed9b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17h14M6 17l1.5-5h9L18 17M7.5 12l1-3.5A2 2 0 0 1 10.4 7h3.2a2 2 0 0 1 1.9 1.5l1 3.5" />
                  <circle cx="8" cy="17" r="1.6" />
                  <circle cx="16" cy="17" r="1.6" />
                </svg>
              </span>
              <span className="font-display text-base font-bold text-white">arriendomiautoya</span>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed">
              Arriendo de autos entre personas. Verificación de identidad, seguro y entrega con
              código QR en cada viaje.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5 text-[13.5px]">
              <span className="font-display font-semibold text-white">{col.title}</span>
              {col.links.map((l) => (
                <Link key={l.label} href={l.href} className="transition-colors hover:text-brand-tealBright">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 pt-7 text-[12.5px] sm:flex-row sm:items-center">
          <span>© 2026 ARRIENDOMIAUTOYA CHILE SpA. Todos los derechos reservados.</span>
          <a
            href="https://wa.me/56912345678"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#1f1f1d] px-3.5 py-2 transition-colors hover:text-brand-tealBright"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#3ed9b4">
              <path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.7-.6-2.9-1.3-4.8-4.3-5-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.9-.1 1.4Z" />
            </svg>
            Soporte por WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
