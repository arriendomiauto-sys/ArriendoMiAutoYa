import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  LifeBuoy,
  Gavel,
  ShieldCheck,
  Car,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/soporte", label: "Soporte", icon: LifeBuoy },
  { href: "/disputas", label: "Disputas", icon: Gavel },
  { href: "/kyc", label: "Revisión KYC", icon: ShieldCheck },
  { href: "/flota", label: "Flota", icon: Car },
  { href: "/configuracion", label: "Configuración", icon: Settings, soloAdmin: true },
];

export default function Layout({ children }) {
  const { usuario, esAdmin, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col justify-between bg-brand-tealDark text-white">
        <div>
          <div className="px-5 py-6 text-lg font-semibold tracking-tight">
            ArriendoMiAutoYa
            <div className="text-xs font-normal text-white/60">Panel de administrador</div>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {NAV.filter((item) => !item.soloAdmin || esAdmin).map((item) => {
              const activo = router.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    activo ? "bg-brand-mint text-brand-tealDark font-medium" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-white/10 px-5 py-4 text-xs">
          <div className="truncate text-white/70">{usuario?.email}</div>
          <div className="mb-2 text-white/40">{(usuario?.roles_activos || []).join(", ")}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-white/70 hover:text-white"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
