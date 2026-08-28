import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "./ui/button";
import { Menu, X, MapPin } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/#catalogo", label: "Catálogo" },
    { href: "/#como-funciona", label: "Cómo funciona" },
    { href: "/#propietarios", label: "Dueños" },
    { href: "/cotizador", label: "Cotizador" },
    { href: "/simulador-duenos", label: "Simulador" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#061E1F]/90 backdrop-blur-xl border-b border-[#2FBF9B]/20 shadow-2xl py-3"
          : "bg-transparent py-4"
      }`}
    >
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Brand - Logo intacto */}
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="ArriendoMiAutoYa"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl object-cover shadow-lg transition-transform group-hover:scale-105"
          />
          <span className="text-xl font-black tracking-tight text-white">
            ARRIENDO<span className="text-[#2FBF9B]">MIAUTOYA</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-300 hover:text-[#2FBF9B] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:block">
          <Link href="/#descargar-app">
            <Button
              size="sm"
              className="rounded-full px-5 py-2.5 text-xs font-bold bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] shadow-md shadow-[#2FBF9B]/25 transition-all hover:scale-105"
            >
              Descargar App
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl bg-white/5 text-white hover:bg-white/10 border border-white/10 focus:outline-none"
          aria-label="Abrir Menú"
        >
          {mobileMenuOpen ? <X className="h-5 w-5 text-[#2FBF9B]" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#061E1F]/98 border-b border-[#2FBF9B]/20 backdrop-blur-2xl px-6 py-6 space-y-3 mt-2 shadow-2xl">
          <div className="flex items-center gap-2 pb-3 text-xs font-semibold text-[#92E3CB] border-b border-white/10">
            <MapPin className="h-3.5 w-3.5 text-[#2FBF9B]" />
            <span>Los Ángeles, Región del Biobío</span>
          </div>

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-white hover:text-[#2FBF9B] transition-colors"
            >
              {link.label}
            </Link>
          ))}

          <div className="pt-2 border-t border-white/10 space-y-2">
            <Link href="/garantias" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-sm text-slate-300 hover:text-[#2FBF9B]">
              Garantías y Seguro
            </Link>
          </div>

          <div className="pt-3 border-t border-white/10 space-y-1">
            <Link href="/manager" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-xs text-slate-400 hover:text-white">
              Panel Sucursal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
