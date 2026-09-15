import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard, Calendar, Users, Car, ShieldCheck, Gavel, LifeBuoy,
  Wallet, Settings, LogOut, ChevronRight, Search, KeyRound, Sun, Moon,
} from "lucide-react";
import RequireAuth from "./RequireAuth";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";

const NAV = [
  {
    group: "Operación",
    items: [
      { href: "/", label: "Panorama", icon: LayoutDashboard },
      { href: "/reservas", label: "Reservas", icon: Calendar },
      { href: "/usuarios", label: "Usuarios", icon: Users },
      { href: "/flota", label: "Flota", icon: Car },
    ],
  },
  {
    group: "Verificación",
    items: [
      { href: "/kyc", label: "Verificación & KYC", icon: ShieldCheck },
      { href: "/disputas", label: "Disputas", icon: Gavel },
      { href: "/soporte", label: "Soporte", icon: LifeBuoy },
    ],
  },
  {
    group: "Plataforma",
    items: [
      { href: "/finanzas", label: "Finanzas", icon: Wallet },
      { href: "/configuracion", label: "Configuración", icon: Settings, soloAdmin: true },
    ],
  },
];

/**
 * Marco de todas las pantallas del panel: sidebar blanco con navegación
 * agrupada + barra superior. Envuelve `RequireAuth` para que las páginas
 * solo hagan `<Shell title="…">…</Shell>`.
 *
 * `counts` (opcional): { kyc: 5, disputas: 2, soporte: 4 } — globo en la nav.
 */
export default function Shell({ title, crumb = "Consola", counts = {}, actions, children }) {
  const { usuario, esAdmin, logout } = useAuth();
  const router = useRouter();
  const [tema, setTema] = useState("light");

  useEffect(() => {
    const t = localStorage.getItem("rentacar_admin_theme") || "light";
    setTema(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggleTema = () => {
    const nuevo = tema === "dark" ? "light" : "dark";
    setTema(nuevo);
    localStorage.setItem("rentacar_admin_theme", nuevo);
    document.documentElement.setAttribute("data-theme", nuevo);
  };

  return (
    <RequireAuth>
      <div className="app">
        <aside className="side">
          <div className="side-brand">
            <span className="logo"><KeyRound size={17} /></span>
            <div>
              <b>RentACar</b>
              <span>Consola de operaciones</span>
            </div>
          </div>

          <nav className="side-nav">
            {NAV.map((g) => (
              <div className="side-group" key={g.group}>
                <div className="side-group-label">{g.group}</div>
                {g.items
                  .filter((it) => !it.soloAdmin || esAdmin)
                  .map((it) => {
                    const activo = router.pathname === it.href || (it.href !== "/" && router.pathname.startsWith(it.href));
                    const Icon = it.icon;
                    const c = counts[it.href.slice(1) || "dashboard"];
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`nav-item ${activo ? "is-active" : ""}`}
                      >
                        <Icon />
                        {it.label}
                        {c ? <span className={`count ${it.href === "/disputas" || it.href === "/kyc" ? "warn" : ""}`}>{c}</span> : null}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>

          <div className="side-foot">
            <span className="av">{initials(usuario?.nombre || usuario?.email)}</span>
            <div className="who">
              <b>{usuario?.nombre || usuario?.email || "—"}</b>
              <span>{(usuario?.roles_activos || []).filter((r) => ["admin", "manager", "soporte"].includes(r)).map((r) => ({ admin: "Admin", manager: "Manager", soporte: "Soporte" }[r])).join(" · ") || "—"}</span>
            </div>
            <button
              className="theme-toggle-btn"
              onClick={toggleTema}
              aria-label="Cambiar tema claro/oscuro"
              title={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {tema === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="logout" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={15} /></button>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <span className="crumb">{crumb}</span>
            <ChevronRight size={12} style={{ color: "var(--muted)" }} />
            <h1>{title}</h1>
            <div className="search" style={{ width: 260 }} title="Próximamente">
              <Search size={14} />
              <input placeholder="Buscar en toda la consola…" disabled />
            </div>
            {actions}
          </div>
          <div className="page">{children}</div>
        </div>
      </div>
    </RequireAuth>
  );
}
