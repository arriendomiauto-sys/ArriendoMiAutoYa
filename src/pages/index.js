import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  Users, Car, Calendar, Wallet, Gavel, Clock, ShieldCheck, LifeBuoy,
  ChevronRight, AlertTriangle,
} from "lucide-react";
import Shell from "../components/Shell";
import { Kpi, PageIntro, StateMsg, formatoCLP } from "../components/ui";
import { ApiClient } from "../lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [m, setM] = useState(null);
  const [f, setF] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      ApiClient.getMetricasGlobales().catch(() => null),
      ApiClient.getPanelFinanciero().catch(() => null),
    ])
      .then(([mm, ff]) => { setM(mm); setF(ff); if (!mm && !ff) setError("No se pudieron cargar las métricas."); })
      .catch((e) => setError(e.message));
  }, []);

  const num = (v) => (v ?? null) === null ? "—" : String(v);
  const disputasAbiertas = m?.total_disputas_abiertas ?? 0;
  const liqPend = f?.total_liquidaciones_pendientes_clp ?? 0;

  return (
    <Shell title="Panorama" counts={{ kyc: 0, disputas: disputasAbiertas || undefined }}>
      <PageIntro title="Panorama de hoy">
        Lo que está pasando en la plataforma ahora mismo y lo que necesita una decisión.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}

      <div className="grid g-6" style={{ marginBottom: 18 }}>
        <Kpi icon={Users} label="Usuarios" value={num(m?.total_usuarios)} />
        <Kpi icon={Car} label="Autos activos" value={num(m?.total_autos_activos)} />
        <Kpi icon={Calendar} label="Reservas" value={num(m?.total_reservas)} />
        <Kpi icon={Wallet} label="Comisión (mes)" value={f ? formatoCLP(f.total_cobros_finales_clp * 0.2) : "—"} sub="20% del GMV cobrado" />
        <Kpi icon={Gavel} label="Disputas abiertas" value={num(disputasAbiertas)} />
        <Kpi icon={Clock} label="Por liquidar" value={f ? formatoCLP(liqPend) : "—"} sub="a dueños" />
      </div>

      <div className="grid g-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-head">
            <AlertTriangle style={{ color: "var(--warn)" }} />
            <h3>Requiere atención</h3>
          </div>
          <div className="queue">
            <QueueRow icon={ShieldCheck} tone="warn" title="Documentos por revisar" sub="Identidades y autos en cola" onClick={() => router.push("/kyc")} />
            <QueueRow icon={Gavel} tone="danger" title="Disputas abiertas" sub={`${disputasAbiertas} caso${disputasAbiertas === 1 ? "" : "s"} sin resolver`} count={disputasAbiertas || undefined} onClick={() => router.push("/disputas")} />
            <QueueRow icon={LifeBuoy} tone="warn" title="Tickets de soporte" sub="Bandeja de soporte" onClick={() => router.push("/soporte")} />
            <QueueRow icon={Wallet} tone="info" title="Liquidaciones a dueños" sub={liqPend ? `Transferencias pendientes por ${formatoCLP(liqPend)}` : "Sin liquidaciones pendientes"} onClick={() => router.push("/finanzas")} />
            <QueueRow icon={Clock} tone="warn" title="Reservas pendientes de pago" sub="Con hold sin autorizar" onClick={() => router.push("/reservas")} />
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, flex: 1 }}>Actividad financiera</h3>
            <span className="chip neutral">Global</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
            <MiniStat label="Holds capturados" value={f ? formatoCLP(f.total_holds_capturados_clp) : "—"} />
            <MiniStat label="Cobros finales" value={f ? formatoCLP(f.total_cobros_finales_clp) : "—"} />
            <MiniStat label="Liquidaciones pagadas" value={f ? formatoCLP(f.total_liquidaciones_pagadas_clp) : "—"} />
            <MiniStat label="Transacciones" value={f ? String(f.cantidad_transacciones ?? "—") : "—"} />
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>
            Los montos son acumulados de toda la operación. El detalle transacción por transacción está en <button className="link" onClick={() => router.push("/finanzas")} style={{ background: "none", border: 0, color: "var(--mint-600)", fontWeight: 600, cursor: "pointer" }}>Finanzas</button>.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <Calendar />
          <h3>Reservas recientes</h3>
          <button className="link" onClick={() => router.push("/reservas")}>Ver todas</button>
        </div>
        <div style={{ padding: 18 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
            Entra a <b style={{ color: "var(--ink)" }}>Reservas</b> para ver el listado completo con filtros por estado, el desglose de dinero de cada reserva y las firmas de contrato.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function QueueRow({ icon: Icon, tone, title, sub, count, onClick }) {
  return (
    <button className="queue-row" onClick={onClick}>
      <span className="q-ic" style={{ background: `var(--${tone}-tint)`, color: `var(--${tone})` }}><Icon size={15} /></span>
      <span className="q-body"><b>{title}</b><span>{sub}</span></span>
      {count ? <span className="q-count">{count}</span> : null}
      <ChevronRight className="q-chev" />
    </button>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }} className="tnum">{value}</div>
    </div>
  );
}
