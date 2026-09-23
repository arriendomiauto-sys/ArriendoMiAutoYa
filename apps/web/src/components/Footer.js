import React from "react";
import Link from "next/link";
import Image from "next/image";
import { FaEnvelope } from "react-icons/fa";

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
        ArriendoMiAutoYa
      </span>

      <div className="container relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-10 border-b border-[#2c2c29] pb-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3.5 flex items-center gap-2.5">
              <Image src="/logo.png" alt="ArriendoMiAutoYa" width={64} height={64} className="h-8 w-8 rounded-lg object-cover" />
              <span className="font-display text-base font-bold text-white">ArriendoMiAutoYa</span>
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
          <span>© 2026 ARRIENDO MI AUTO SpA. Todos los derechos reservados.</span>
          <a
            href="mailto:soporte@arriendomiautoya.cl"
            className="inline-flex items-center gap-2 rounded-full bg-[#1f1f1d] px-3.5 py-2 transition-colors hover:text-brand-tealBright text-white"
          >
            <FaEnvelope className="h-4 w-4 text-brand-tealBright" />
            soporte@arriendomiautoya.cl
          </a>
        </div>
      </div>
    </footer>
  );
}
