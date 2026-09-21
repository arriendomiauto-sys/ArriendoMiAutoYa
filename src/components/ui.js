import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";

export const formatoCLP = (n) => "$" + Math.round(n || 0).toLocaleString("es-CL");

// ── encabezado de página ─────────────────────────────────────────────────
export function PageIntro({ title, children, actions }) {
  return (
    <div className="page-intro">
      <div className="pi-text">
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8 }}>{actions}</div> : null}
    </div>
  );
}

// ── KPI ──────────────────────────────────────────────────────────────────
export function Kpi({ icon: Icon, label, value, sub, dir }) {
  return (
    <div className="kpi">
      <div className="k-label">{Icon ? <Icon /> : null}{label}</div>
      <div className="k-value tnum">{value}</div>
      {sub ? (
        <div className="k-sub">
          {dir ? <b className={dir}>{dir === "up" ? "▲" : "▼"}</b> : null} {sub}
        </div>
      ) : null}
    </div>
  );
}

// ── chip de estado ───────────────────────────────────────────────────────
const CHIP = {
  verificado: ["ok", "Verificado"], requiere_revision_manual: ["warn", "En revisión"],
  rechazado: ["danger", "Rechazado"], pendiente: ["neutral", "Pendiente"],
  verificada: ["ok", "Licencia OK"], revision: ["warn", "En revisión"], rechazada: ["danger", "Rechazada"],
  en_curso: ["info", "En curso"], finalizada: ["neutral", "Finalizada"], confirmada: ["ok", "Confirmada"],
  pendiente_pago: ["warn", "Pendiente de pago"], esperando_dueno: ["warn", "Esperando al dueño"], disputada: ["danger", "En disputa"], cancelada: ["neutral", "Cancelada"],
  activo: ["ok", "Activo"], pausado: ["neutral", "Pausado"], pendiente_docs: ["warn", "Doc. pendiente"],
  aprobado: ["ok", "Docs OK"],
  abierta: ["warn", "Abierta"], resuelta: ["ok", "Resuelta"], en_revision: ["warn", "En revisión"],
  abierto: ["warn", "Abierto"], cerrado: ["neutral", "Cerrado"],
  capturado: ["ok", "Capturado"], liberado: ["neutral", "Liberado"], fallido: ["danger", "Fallido"],
  reembolsado: ["info", "Reembolsado"], pagado: ["ok", "Pagado"], pagada: ["ok", "Pagada"], suspendido: ["danger", "Suspendida"],
};
export function Chip({ estado, tone, children }) {
  const [c, l] = CHIP[estado] || [tone || "neutral", children || estado || "—"];
  return <span className={`chip ${c}`}><span className="dot" />{l}</span>;
}

// ── mensajes de estado ───────────────────────────────────────────────────
export function StateMsg({ kind = "err", children }) {
  const Icon = kind === "ok" ? CheckCircle2 : AlertTriangle;
  return <div className={`state-msg ${kind}`}><Icon size={16} /><span>{children}</span></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <Icon />
      <b>{title}</b>
      {children ? <div style={{ maxWidth: 360, margin: "0 auto" }}>{children}</div> : null}
    </div>
  );
}

// ── segmentado (filtro) ──────────────────────────────────────────────────
export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <button key={v} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
        );
      })}
    </div>
  );
}

// ── tabs simples ─────────────────────────────────────────────────────────
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.key} className={t.key === value ? "on" : ""} onClick={() => onChange(t.key)}>
            {Icon ? <Icon size={14} /> : null}
            {t.label}
            {t.badge != null ? <span className="b">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ── drawer (slide-over) ──────────────────────────────────────────────────
export function Drawer({ open, onOpenChange, title, sub, children, footer }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drw-overlay" />
        <Dialog.Content className="drw-content" aria-describedby={undefined}>
          <div className="drw-head">
            <div className="d-title">
              <Dialog.Title asChild><h3>{title}</h3></Dialog.Title>
              {sub ? <div className="sub">{sub}</div> : null}
            </div>
            <Dialog.Close asChild><button className="x" aria-label="Cerrar"><X size={16} /></button></Dialog.Close>
          </div>
          <div className="drw-body">{children}</div>
          {footer ? <div className="drw-foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── carga async simple ───────────────────────────────────────────────────
export function useAsync(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const recargar = useCallback(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    Promise.resolve(run())
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setError(e.message || "No se pudo cargar."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [run]);

  useEffect(() => recargar(), [recargar]);

  return { data, error, cargando, recargar, setData };
}
