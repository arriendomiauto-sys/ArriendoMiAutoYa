import { useMemo, useState } from "react";
import { Search, Car, MapPin } from "lucide-react";
import Shell from "../components/Shell";
import { PageIntro, Chip, Segmented, StateMsg, EmptyState, useAsync, formatoCLP } from "../components/ui";
import { ApiClient } from "../lib/api";

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "activo", label: "Activos" },
  { value: "pendiente_docs", label: "Doc. pendiente" },
  { value: "pausado", label: "Pausados" },
];

export default function Flota() {
  const { data, error, cargando } = useAsync(() => ApiClient.getFlota());
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");

  const autos = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const filtrados = useMemo(() => {
    const t = q.toLowerCase().trim();
    return autos.filter((a) => {
      if (filtro === "activo" && a.estado !== "activo") return false;
      if (filtro === "pausado" && a.estado !== "pausado") return false;
      if (filtro === "pendiente_docs" && a.documentos_verificados) return false;
      if (!t) return true;
      return [a.patente, a.marca, a.modelo, a.dueno_nombre].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [autos, filtro, q]);

  const activos = autos.filter((a) => a.estado === "activo").length;
  const pendientes = autos.filter((a) => !a.documentos_verificados).length;

  return (
    <Shell title="Flota">
      <PageIntro title="Flota">
        Vehículos publicados en la plataforma. Estado, documentación legal y rendimiento por auto.
      </PageIntro>

      {error ? <StateMsg>{error}</StateMsg> : null}

      <div className="filters">
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
        <div className="search fsearch"><Search size={14} /><input placeholder="Patente, marca o dueño…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="count-hint"><b>{activos}</b> activos · <b>{pendientes}</b> con doc. pendiente</span>
      </div>

      {cargando ? (
        <EmptyState icon={Car} title="Cargando flota…" />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={Car} title="No hay autos que coincidan" />
      ) : (
        <div className="grid g-3">
          {filtrados.map((a) => {
            const estado = a.estado === "activo" || a.estado === "pausado"
              ? (!a.documentos_verificados ? "pendiente_docs" : a.estado)
              : a.estado;
            return (
              <div className="card card-pad" key={a.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div className="avatar sq" style={{ width: 46, height: 46, borderRadius: 10 }}><Car size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13.5, display: "block" }}>
                      {a.marca} {a.modelo} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{a.anio}</span>
                    </b>
                    <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{a.patente}</span>
                  </div>
                  <Chip estado={estado} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip estado={a.documentos_verificados ? "aprobado" : "pendiente"}>{a.documentos_verificados ? "Docs OK" : "Docs pendientes"}</Chip>
                  {a.ubicacion_base ? <span className="chip neutral"><MapPin size={11} />{a.ubicacion_base}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 16, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <MiniCol label="TARIFA/DÍA" value={formatoCLP(a.tarifa_dia)} />
                  <MiniCol label="ESTADO" value={a.estado || "—"} />
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Dueño: <b style={{ color: "var(--ink)", fontWeight: 600 }}>{a.dueno_nombre || "—"}</b>
                  {a.dueno_rut ? <> · <span className="mono">{a.dueno_rut}</span></> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function MiniCol({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700 }} className="tnum">{value}</div>
    </div>
  );
}
