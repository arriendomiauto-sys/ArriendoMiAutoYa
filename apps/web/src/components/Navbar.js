import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Car, Smartphone, LayoutDashboard, Building2 } from "lucide-react";

export default function Navbar() {
  const router = useRouter();

  const isActive = (path) => {
    if (path === "/" && router.pathname === "/") return true;
    if (path !== "/" && router.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/80 bg-[#111827]/90 backdrop-blur-md">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand with Official Icon */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <img
            src="/logo.png"
            alt="ArriendaTuAuto Icon"
            className="h-10 w-10 rounded-xl object-cover border border-[#A8E637]/30 shadow-md shadow-[#A8E637]/10"
          />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-white">
              Arrienda<span className="text-[#A8E637]">TuAuto</span>
            </span>
          </div>
          <span className="ml-1 hidden rounded-md border border-[#A8E637]/40 bg-[#0F223D] px-2.5 py-0.5 text-[11px] font-bold text-[#A8E637] sm:inline-flex">
            Los Ángeles, Biobío
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/">
            <Button
              variant={isActive("/") ? "secondary" : "ghost"}
              size="sm"
              className={
                isActive("/")
                  ? "bg-[#0F223D] text-[#A8E637] font-bold border border-[#A8E637]/30 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-[#0F223D]/50"
              }
            >
              <Car className="mr-1.5 h-4 w-4" />
              Catálogo
            </Button>
          </Link>

          <Link href="/manager">
            <Button
              variant={isActive("/manager") ? "secondary" : "ghost"}
              size="sm"
              className={
                isActive("/manager")
                  ? "bg-[#0F223D] text-[#A8E637] font-bold border border-[#A8E637]/30 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-[#0F223D]/50"
              }
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Panel Sucursal
            </Button>
          </Link>

          <Link href="/admin">
            <Button
              variant={isActive("/admin") ? "secondary" : "ghost"}
              size="sm"
              className={
                isActive("/admin")
                  ? "bg-[#0F223D] text-[#A8E637] font-bold border border-[#A8E637]/30 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-[#0F223D]/50"
              }
            >
              <LayoutDashboard className="mr-1.5 h-4 w-4" />
              Panel Admin
            </Button>
          </Link>

          <div className="ml-2 hidden md:block">
            <a href="#descargar-app">
              <Button
                size="sm"
                className="gap-1.5 bg-[#A8E637] text-[#111827] font-bold hover:bg-[#93D129] shadow-md shadow-[#A8E637]/20"
              >
                <Smartphone className="h-4 w-4" />
                Abrir App Móvil
              </Button>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
