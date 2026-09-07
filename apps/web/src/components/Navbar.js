import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/#catalogo", label: "Autos" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#propietarios", label: "Publica tu auto" },
  { href: "/garantias", label: "Ayuda" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-brand-line bg-white/90 backdrop-blur-xl"
          : "bg-white/70 backdrop-blur-sm"
      }`}
    >
      <div className="container mx-auto flex h-[74px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-ink">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3ed9b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17h14M6 17l1.5-5h9L18 17M7.5 12l1-3.5A2 2 0 0 1 10.4 7h3.2a2 2 0 0 1 1.9 1.5l1 3.5" />
              <circle cx="8" cy="17" r="1.6" />
              <circle cx="16" cy="17" r="1.6" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-brand-ink">
            arriendomiautoya
          </span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-[#17181a] transition-colors hover:text-brand-tealInk"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/#descargar-app">
            <Button className="rounded-xl bg-brand-ink px-5 text-sm font-semibold text-white hover:bg-black">
              Descargar la app
            </Button>
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-xl border border-brand-line p-2 text-brand-ink md:hidden"
          aria-label="Abrir menú"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="space-y-1 border-b border-brand-line bg-white px-6 py-5 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-brand-ink hover:text-brand-tealInk"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/#descargar-app" onClick={() => setMobileMenuOpen(false)} className="block pt-3">
            <Button className="w-full rounded-xl bg-brand-ink text-sm font-semibold text-white hover:bg-black">
              Descargar la app
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
