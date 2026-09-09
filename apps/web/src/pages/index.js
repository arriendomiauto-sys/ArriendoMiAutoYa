import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Seo from "../components/Seo";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  MapPin,
  ShieldCheck,
  Lock,
  Camera,
  FileText,
  Star,
  ChevronDown,
  Check,
  AlertTriangle,
  Wallet,
  Globe,
  ArrowRight,
  Smartphone,
} from "lucide-react";
import { FaApple, FaGooglePlay } from "react-icons/fa";

import { API_BASE_URL } from "../lib/api";
import { obtenerAutos, esAutoPublicable, autoHref } from "../lib/autos";
import {
  haversineKm,
  formatearDistancia,
  leerUbicacion,
  guardarUbicacion,
} from "../lib/geo";
import SelectorUbicacion from "../components/SelectorUbicacion";
import FotoAuto from "../components/FotoAuto";
import { CarCardSkeleton, CarRowSkeleton } from "../components/Skeleton";

const MapaAutos = dynamic(() => import("../components/MapaAutos"), { ssr: false });

const RADIO_DEFAULT_KM = 25;
const tieneCoords = (a) => typeof a?.latitud === "number" && typeof a?.longitud === "number";

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "economico", label: "Económicos" },
  { id: "suv", label: "SUV" },
  { id: "4x4", label: "4x4 / Camioneta" },
];

const PASOS = [
  { n: "1", title: "Explora y reserva", desc: "Busca en el mapa autos cerca tuyo, compara el precio por día y elige las fechas exactas que necesitas." },
  { n: "2", title: "Verifica tu identidad", desc: "Foto de tu cédula o pasaporte, tu licencia y una selfie. El sistema lo valida en 60 segundos. Solo la primera vez." },
  { n: "3", title: "Retira con QR", desc: "Te juntas con el dueño, revisan juntos el checklist de 9 fotos y escaneas el código QR para recibir las llaves." },
];

const GARANTIAS = [
  { icon: ShieldCheck, title: "Seguro con deducible 15 UF", desc: "Ante un siniestro cubierto, el deducible se reparte 50 / 50 entre quien arrienda y el dueño." },
  { icon: Lock, title: "Hold de garantía $800.000", desc: "Es una retención temporal en tu tarjeta, no un cobro. Se libera al devolver el auto conforme." },
  { icon: Camera, title: "Checklist de 9 fotos", desc: "Registro fotográfico en la entrega y la devolución. La patente se difumina automáticamente." },
  { icon: FileText, title: "Contrato digital firmado", desc: "Cada arriendo genera un contrato con tus datos verificados y la huella / Face ID de quien firma." },
];

const KYC_CL = [
  "Cédula de identidad vigente — foto de ambos lados",
  "RUT válido — lo validamos con el dígito verificador (Módulo 11)",
  "Licencia de conducir chilena Clase B, vigente",
  "Selfie con prueba de vida",
  "Tarjeta de crédito a tu nombre (garantía)",
  "Tener 21 años o más",
];

const KYC_EXT = [
  { t: "Pasaporte o documento de identidad de tu país + país emisor", warn: false },
  { t: "Licencia de conducir de tu país, vigente", warn: false },
  { t: "Permiso Internacional de Conducir (PIC) si tu país no adhiere al Convenio de Viena de 1968", warn: true },
  { t: "Selfie con prueba de vida y tarjeta de crédito internacional", warn: false },
  { t: "Tener 21 años o más", warn: false },
  { t: "Si resides hace más de 1 año en Chile, necesitas licencia chilena (España, Perú y Corea pueden homologar la suya)", warn: true },
];

const FAQS = [
  {
    q: "¿Cómo puedo financiar la cuota de mi auto con ArriendoMiAutoYa?",
    a: "Si estás pagando un crédito automotriz, puedes publicar tu auto los días que no lo usas (por ejemplo 8 a 12 días al mes). Con una tarifa promedio de $35.000/día, generas entre $350.000 y $800.000 líquidos mensuales, cubriendo la cuota mensual de tu crédito, seguro y mantenciones con respaldo legal y seguro con deducible de 15 UF.",
  },
  {
    q: "¿Es más conveniente que un Rent a Car tradicional en Chile?",
    a: "Sí, arrendar un auto particular en ArriendoMiAutoYa es hasta un 40% más económico que las agencias tradicionales de Rent a Car. Encuentras tarifas desde $19.000/día, sin mesón ni cobros ocultos de última hora, con seguro incluido y entrega coordinada cerca de tu comuna o aeropuerto.",
  },
  {
    q: "¿Cómo funciona el seguro y el deducible de 15 UF?",
    a: "Cada arriendo incluye un seguro con deducible de 15 UF. Ante un siniestro cubierto, ese deducible se reparte 50 / 50 entre el arrendatario y el dueño, y la aseguradora cubre el resto. El detalle queda escrito en el contrato digital de cada reserva.",
  },
  {
    q: "¿El hold de $800.000 es un cobro?",
    a: "No. Es una retención temporal en tu tarjeta de crédito que se genera antes de entregarte las llaves. No se te descuenta el dinero: se libera al devolver el auto conforme al checklist de 9 fotos.",
  },
  {
    q: "Soy extranjero, ¿puedo arrendar?",
    a: "Sí. Necesitas tu pasaporte o documento de identidad indicando el país emisor, tu licencia de conducir vigente y, si tu país no adhiere al Convenio de Viena de 1968 (por ejemplo Colombia o Venezuela), un Permiso Internacional de Conducir (PIC) vigente. Si resides hace más de un año en Chile necesitas licencia chilena; España, Perú y Corea pueden homologar la suya sin rendir examen. La edad mínima es 21 años.",
  },
  {
    q: "¿Cuánto cuesta publicar mi auto y cuándo me pagan?",
    a: "Publicar es gratis. La plataforma cobra una comisión del 15% sobre los arriendos concretados; los cargos por lavado son 100% para el dueño. El pago llega por depósito bancario a tu cuenta después de cada viaje.",
  },
  {
    q: "¿Qué papeles necesita el auto para publicarse?",
    a: "Certificado de inscripción (padrón), permiso de circulación, SOAP y revisión técnica vigentes. Opcionalmente puedes cargar la póliza de seguro comercial. Los documentos se leen con OCR al instante y, si algo no queda claro, los revisa una persona sin frenar la publicación.",
  },
  {
    q: "¿Cómo es la entrega y la devolución del auto?",
    a: "Se coordinan con el dueño en el punto que acuerden. Revisan juntos el checklist de 9 fotos y se escanea un código QR para traspasar las llaves. A la devolución se repite el checklist para dejar registro del estado del vehículo.",
  },
  {
    q: "¿La app tiene costo?",
    a: "Descargar la app y publicar tu auto es gratis. Solo se cobra la comisión sobre los arriendos que efectivamente se concretan.",
  },
];

const fmtCLP = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const fotoDe = (a) => {
  const f = a?.fotos?.[0] || a?.foto;
  return typeof f === "string" && f.trim().length > 5 ? f.trim() : null;
};
const SKELETON_KEYS = [0, 1, 2, 3, 4, 5];

/* ───────────── COMPONENTE ───────────── */
export default function Home() {
  const [autos, setAutos] = useState([]);
  const [carga, setCarga] = useState("cargando"); // "cargando" | "ok" | "error"
  const [categoria, setCategoria] = useState("todos");
  const [query, setQuery] = useState("");
  const [modalAuto, setModalAuto] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [dias, setDias] = useState(12);

  // Ubicación elegida (GPS o comuna) y radio de búsqueda. Se recuerda entre visitas.
  const [ubicacion, setUbicacion] = useState(null);
  const [radioKm, setRadioKm] = useState(RADIO_DEFAULT_KM);

  useEffect(() => {
    const u = leerUbicacion();
    if (u) {
      setUbicacion(u);
      if (u.radioKm) setRadioKm(u.radioKm);
    }
  }, []);

  const cargarAutos = React.useCallback((signal) => {
    setCarga("cargando");
    obtenerAutos({ signal })
      .then((lista) => {
        if (signal?.aborted) return;
        setAutos(lista);
        setCarga("ok");
      })
      .catch(() => {
        if (signal?.aborted) return;
        setAutos([]);
        setCarga("error");
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    cargarAutos(ctrl.signal);
    return () => ctrl.abort();
  }, [cargarAutos]);

  const aplicarUbicacion = (u) => {
    setUbicacion(u);
    guardarUbicacion({ ...u, radioKm });
  };
  const aplicarRadio = (km) => {
    setRadioKm(km);
    if (ubicacion) guardarUbicacion({ ...ubicacion, radioKm: km });
  };
  const limpiarUbicacion = () => {
    setUbicacion(null);
    guardarUbicacion(null);
  };

  // Autos con la distancia a la ubicación elegida (o sin ella).
  const autosConDistancia = useMemo(() => {
    if (!ubicacion) return autos.map((a) => ({ ...a, distanciaKm: null }));
    return autos.map((a) => ({
      ...a,
      distanciaKm: tieneCoords(a) ? haversineKm(ubicacion, { lat: a.latitud, lng: a.longitud }) : null,
    }));
  }, [autos, ubicacion]);

  // Autos dentro del radio (si hay ubicación), ordenados por cercanía.
  const autosEnZona = useMemo(() => {
    if (!ubicacion) return autosConDistancia;
    return autosConDistancia
      .filter((a) => a.distanciaKm != null && a.distanciaKm <= radioKm)
      .sort((x, y) => x.distanciaKm - y.distanciaKm);
  }, [autosConDistancia, ubicacion, radioKm]);

  const filtrados = useMemo(() => {
    let r = [...autosEnZona];
    if (categoria !== "todos") r = r.filter((a) => a.categoria === categoria);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((a) =>
        [a.marca, a.modelo, a.ubicacion_base].filter(Boolean).some((v) => v.toLowerCase().includes(q))
      );
    }
    return r;
  }, [autosEnZona, categoria, query]);

  const tarifaNeta = Math.round(dias * 30000 * 0.85);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <Seo
        title="Arriendo de Autos en Chile · Financia la Cuota de tu Auto"
        description="Arrienda autos particulares desde $19.000/día o financia la cuota de tu auto ganando hasta $800.000/mes. Seguro con deducible 15 UF, sin mesón ni trámites en Chile."
        keywords="arriendo de autos chile, financia tu auto, rent a car santiago, pagar cuota auto arriendo, rent a car economico chile, arriendo autos particulares, ganar dinero con mi auto, financiamiento de autos, arriendomiautoya"
        path="/"
        jsonLd={faqJsonLd}
      />
      <Navbar />

      <main className="bg-white text-[#17181a]">

        {/* ══════════ HERO ══════════ */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-32 -top-40 h-[560px] w-[560px] rounded-full bg-brand-teal/10 blur-[10px]" />
          <div className="bg-dot-pattern pointer-events-none absolute left-0 top-32 h-72 w-72 opacity-60 [mask-image:linear-gradient(135deg,#000,transparent)]" />
          <div className="container relative mx-auto max-w-7xl px-4 pb-14 pt-28 sm:px-6 sm:pt-36">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
              <div className="flex flex-col gap-6">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-tealInk">
                  <MapPin className="h-3.5 w-3.5" />
                  Arriendo de autos en Chile · Financia la cuota de tu auto
                </span>
                <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]">
                  El auto que necesitas, con las llaves de{" "}
                  <span className="bg-[linear-gradient(180deg,transparent_62%,#e8f5f0_62%)]">alguien de tu barrio.</span>
                </h1>
                <p className="max-w-lg text-lg text-[#63645f]">
                  Arrienda autos particulares desde $19.000/día o financia la cuota de tu auto ganando hasta $800.000/mes.
                  Seguro con deducible de 15 UF, verificación de identidad en 60 segundos y entrega con código QR.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="#descargar-app">
                    <Button className="rounded-xl bg-brand-ink px-6 py-6 text-[15px] font-semibold text-white hover:bg-black">
                      <Smartphone className="mr-2 h-4 w-4" /> Descargar la app
                    </Button>
                  </Link>
                  <a href="#mapa">
                    <Button variant="outline" className="rounded-xl border-brand-line px-6 py-6 text-[15px] font-semibold text-brand-ink hover:border-brand-ink">
                      Ver autos cerca de ti
                    </Button>
                  </a>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  {[
                    { name: "App Store", Icon: FaApple },
                    { name: "Google Play", Icon: FaGooglePlay },
                  ].map(({ name, Icon }) => (
                    <span key={name} className="inline-flex items-center gap-2.5 rounded-xl bg-brand-ink px-4 py-2.5 text-white">
                      <Icon className="h-5 w-5" />
                      <span className="leading-none">
                        <span className="block text-[10px] uppercase tracking-wider opacity-70">Próximamente</span>
                        <span className="block font-display text-sm font-semibold">{name}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -bottom-6 -left-5 -right-6 top-6 rounded-[2rem] border-2 border-brand-tealTint" />
                <div className="pointer-events-none absolute -bottom-10 -right-12 h-56 w-56 rounded-full bg-brand-teal/15 blur-[10px]" />
                <div className="relative overflow-hidden rounded-3xl border border-brand-line shadow-soft">
                  <img src="/hero-car.jpg" alt="Auto particular listo para arrendar" className="h-[360px] w-full object-cover sm:h-[430px]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
                </div>
                <div className="absolute -left-6 bottom-10 flex items-center gap-3 rounded-2xl border border-brand-line bg-white p-4 shadow-soft">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tealTint">
                    <ShieldCheck className="h-5 w-5 text-brand-tealInk" />
                  </span>
                  <div>
                    <div className="font-display text-sm font-bold text-brand-ink">Seguro 15 UF incluido</div>
                    <div className="text-xs text-[#63645f]">Deducible compartido 50 / 50</div>
                  </div>
                </div>
                <div className="absolute -right-5 top-6 rounded-2xl border border-brand-line bg-white px-4 py-3 text-center shadow-soft">
                  <div className="font-display text-xl font-bold text-brand-ink">4,9</div>
                  <div className="text-[13px] tracking-[2px] text-brand-teal">★★★★★</div>
                  <div className="text-[10px] uppercase tracking-wide text-[#63645f]">valoración media</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ TRUST STRIP ══════════ */}
        <section className="container mx-auto max-w-7xl px-4 pb-10 sm:px-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-brand-line bg-brand-line md:grid-cols-4">
            {[
              ["+500", "viajes completados en Chile"],
              ["60 s", "verificación de identidad"],
              ["Hasta $800K", "para pagar la cuota de tu auto"],
              ["0 $", "publicar tu auto"],
            ].map(([big, small]) => (
              <div key={small} className="bg-brand-soft px-7 py-6">
                <div className="font-display text-2xl font-bold text-brand-ink">{big}</div>
                <div className="text-[13px] text-[#63645f]">{small}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════ CÓMO FUNCIONA ══════════ */}
        <section id="como-funciona" className="relative overflow-hidden border-y border-brand-line bg-brand-soft py-24">
          <div className="bg-dot-pattern pointer-events-none absolute bottom-0 right-0 h-64 w-80 opacity-60 [mask-image:linear-gradient(315deg,#000,transparent)]" />
          <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealInk">
              • Arrendar toma minutos
            </span>
            <h2 className="mt-3.5 max-w-2xl font-display text-3xl font-bold sm:text-4xl">Del teléfono al volante en tres pasos</h2>
            <div className="accent-rule mt-4" />

            <div className="relative mt-16">
              <div className="absolute left-[16.6%] right-[16.6%] top-7 hidden border-t-2 border-dashed border-brand-dash md:block" />
              <div className="grid gap-10 md:grid-cols-3">
                {PASOS.map((s, i) => (
                  <div key={s.n} className="flex flex-col items-center text-center">
                    <div className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand-teal font-display text-xl font-bold shadow-[0_0_0_8px_#e8f5f0] ${i === 0 ? "bg-brand-teal text-[#04231b]" : "bg-white text-brand-tealInk"}`}>
                      {s.n}
                    </div>
                    <div className="my-4 h-6 border-l-2 border-dashed border-brand-dash" />
                    <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 max-w-[290px] text-[15px] text-[#63645f]">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ MAPA + AUTOS ══════════ */}
        <section id="mapa" className="py-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealInk">• Disponibles ahora</span>
                <h2 className="mt-3.5 font-display text-3xl font-bold sm:text-4xl">
                  {ubicacion ? `Autos cerca de ${ubicacion.label}` : "Autos cerca tuyo, en el mapa"}
                </h2>
                <div className="accent-rule mt-4" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-semibold">
                <span className={`h-2 w-2 rounded-full ${carga === "ok" ? "bg-brand-teal ring-4 ring-brand-teal/20" : "amay-skeleton bg-brand-dash"}`} />
                {carga === "cargando" ? "Cargando catálogo…" : carga === "error" ? "Sin conexión con el catálogo" : "Datos en vivo desde la app"}
              </span>
            </div>

            <div className="mt-7">
              <SelectorUbicacion
                ubicacion={ubicacion}
                radioKm={radioKm}
                totalEnZona={autosEnZona.length}
                onUbicacion={aplicarUbicacion}
                onRadio={aplicarRadio}
                onLimpiar={limpiarUbicacion}
              />
            </div>

            <div className="mt-6 grid overflow-hidden rounded-3xl border border-brand-line shadow-soft lg:grid-cols-[1.55fr_1fr]">
              <MapaAutos
                autos={filtrados}
                activoId={filtrados[0]?.id}
                userLocation={ubicacion}
                radioKm={radioKm}
                cargando={carga === "cargando"}
              />
              <div className="flex flex-col gap-3.5 bg-white p-6" aria-busy={carga === "cargando"}>
                <div className="font-display text-sm font-semibold uppercase tracking-wider text-[#63645f]">
                  {ubicacion ? "Los más cercanos" : "Más pedidos"}
                </div>

                {carga === "cargando" && SKELETON_KEYS.slice(0, 4).map((k, i) => (
                  <React.Fragment key={`sk-${k}`}>
                    {i > 0 && <div className="h-px bg-brand-line" />}
                    <CarRowSkeleton />
                  </React.Fragment>
                ))}

                {carga !== "cargando" && filtrados.slice(0, 4).map((a, i) => (
                  <React.Fragment key={a.id}>
                    {i > 0 && <div className="h-px bg-brand-line" />}
                    <button onClick={() => setModalAuto(a)} className="flex items-center gap-3.5 rounded-xl p-1 text-left transition-colors hover:bg-brand-soft">
                      <FotoAuto
                        src={fotoDe(a)}
                        alt={`${a.marca} ${a.modelo}`}
                        className="h-[60px] w-[78px] shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold">{a.marca} {a.modelo}</div>
                        <div className="text-[12.5px] text-[#63645f]">
                          {formatearDistancia(a.distanciaKm) || (a.categoria ? a.categoria : "Auto")} · ★ {a.rating_promedio ?? "—"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <b className="font-display text-[15px] text-brand-ink">{fmtCLP(a.tarifa_dia)}</b>
                        <div className="text-[11px] text-[#63645f]">/ día</div>
                      </div>
                    </button>
                  </React.Fragment>
                ))}

                {carga === "error" && (
                  <div className="py-6 text-center">
                    <p className="text-[13px] text-[#63645f]">No pudimos cargar el catálogo.</p>
                    <Button size="sm" onClick={() => cargarAutos()} className="mt-3 rounded-xl bg-brand-ink text-white hover:bg-black">
                      Reintentar
                    </Button>
                  </div>
                )}

                {carga === "ok" && filtrados.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-[#63645f]">
                    {ubicacion
                      ? `Ningún auto a ${radioKm} km. Amplía el radio o mira todo el catálogo.`
                      : "No hay autos con esos filtros."}
                  </p>
                )}

                <a href="#catalogo">
                  <Button variant="outline" className="mt-1.5 w-full rounded-xl border-brand-line text-brand-ink hover:border-brand-ink">
                    Ver todo el catálogo
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ CATÁLOGO ══════════ */}
        <section id="catalogo" className="border-t border-brand-line bg-brand-soft py-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealInk">• Catálogo</span>
            <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold sm:text-4xl">
                  {ubicacion ? `A menos de ${radioKm} km de ${ubicacion.label}` : "Un auto para cada plan"}
                </h2>
                <div className="accent-rule mt-4" />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
                {CATEGORIAS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoria(c.id)}
                    aria-pressed={categoria === c.id}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      categoria === c.id
                        ? "border-brand-ink bg-brand-ink text-white"
                        : "border-brand-line bg-white text-[#17181a] hover:border-brand-ink"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy={carga === "cargando"}>
              {carga === "cargando" && SKELETON_KEYS.map((k) => <CarCardSkeleton key={`sk-${k}`} />)}

              {carga !== "cargando" && filtrados.map((a) => (
                <div key={a.id} className="group flex flex-col overflow-hidden rounded-3xl border border-brand-line bg-white shadow-soft transition-shadow hover:shadow-lg">
                  <Link href={autoHref(a)} className="relative block h-52">
                    <FotoAuto
                      src={fotoDe(a)}
                      alt={`${a.marca} ${a.modelo} ${a.anio || ""}`.trim()}
                      className="h-full w-full"
                      imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    {a.categoria && (
                      <span className="absolute left-3 top-3 rounded-full border border-brand-line bg-white px-2.5 py-1 text-[11px] font-semibold capitalize">
                        {a.categoria}
                      </span>
                    )}
                    {formatearDistancia(a.distanciaKm) && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        <MapPin className="h-3 w-3" /> {formatearDistancia(a.distanciaKm)}
                      </span>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-[17px] font-semibold">
                          <Link href={autoHref(a)} className="hover:text-brand-tealInk">{a.marca} {a.modelo}</Link>
                        </h3>
                        <p className="text-[13px] text-[#63645f]">
                          {[a.transmision, a.combustible, a.asientos ? `${a.asientos} asientos` : null].filter(Boolean).join(" · ") || (a.anio ? `Modelo ${a.anio}` : "Vehículo particular")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <b className="font-display text-[17px] text-brand-ink">{fmtCLP(a.tarifa_dia)}</b>
                        <div className="text-[11px] text-[#63645f]">CLP / día</div>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-brand-line pt-3">
                      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-brand-tealInk">
                        <Star className="h-3.5 w-3.5 fill-brand-teal text-brand-teal" />
                        {a.rating_promedio ?? "Nuevo"}{a.rating_cantidad ? ` · ${a.rating_cantidad} viajes` : ""}
                      </span>
                      <div className="flex gap-2">
                        <Link href={autoHref(a)}>
                          <Button variant="outline" size="sm" className="rounded-xl border-brand-line text-xs font-semibold text-brand-ink hover:border-brand-ink">
                            Ficha
                          </Button>
                        </Link>
                        <a href="#descargar-app">
                          <Button size="sm" className="rounded-xl bg-brand-teal text-xs font-semibold text-[#04231b] hover:bg-[#12b78d]">
                            Reservar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {carga === "error" && (
              <div className="py-16 text-center">
                <p className="text-sm text-[#63645f]">No pudimos cargar el catálogo. Revisa tu conexión.</p>
                <Button size="sm" onClick={() => cargarAutos()} className="mt-4 rounded-xl bg-brand-ink text-white hover:bg-black">
                  Reintentar
                </Button>
              </div>
            )}

            {carga === "ok" && filtrados.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-sm text-[#63645f]">
                  {ubicacion && autosEnZona.length === 0
                    ? `Todavía no hay autos publicados a ${radioKm} km de ${ubicacion.label}.`
                    : "No hay autos con esos filtros."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {ubicacion && autosEnZona.length === 0 && radioKm < 100 && (
                    <Button size="sm" onClick={() => aplicarRadio(Math.min(100, radioKm * 2))} className="rounded-xl bg-brand-ink text-white hover:bg-black">
                      Ampliar a {Math.min(100, radioKm * 2)} km
                    </Button>
                  )}
                  {ubicacion && (
                    <Button variant="outline" size="sm" onClick={limpiarUbicacion} className="rounded-xl border-brand-line">
                      Ver todo Chile
                    </Button>
                  )}
                  {(categoria !== "todos" || query) && (
                    <Button variant="outline" size="sm" onClick={() => { setCategoria("todos"); setQuery(""); }} className="rounded-xl border-brand-line">
                      Quitar filtros
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════ GARANTÍAS (PANEL OSCURO) ══════════ */}
        <section className="border-t border-brand-line bg-brand-soft p-10">
          <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[2.75rem] bg-brand-ink px-6 py-24 text-white sm:px-16">
            <div className="pointer-events-none absolute -left-44 -top-56 h-[620px] w-[620px] rounded-full bg-brand-tealBright/15 blur-[10px]" />
            <div className="pointer-events-none absolute -bottom-44 -right-28 h-[420px] w-[420px] rounded-full bg-brand-tealBright/10 blur-[10px]" />
            <div className="relative">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealBright">• Cada viaje protegido</span>
              <h2 className="mt-3.5 max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">Lo que hace segura una llave prestada</h2>
              <div className="accent-rule mt-4" />
              <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {GARANTIAS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex flex-col gap-3 rounded-3xl border border-[#2c2c29] bg-[#1f1f1d] p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tealBright/10">
                      <Icon className="h-5 w-5 text-brand-tealBright" />
                    </span>
                    <h3 className="font-display text-[17px] font-semibold text-white">{title}</h3>
                    <p className="text-[13.5px] text-[#a7a7a1]">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ PUBLICA TU AUTO ══════════ */}
        <section id="propietarios" className="relative overflow-hidden py-24">
          <div className="bg-dot-pattern pointer-events-none absolute left-0 top-20 h-72 w-64 opacity-60 [mask-image:linear-gradient(120deg,#000,transparent)]" />
          <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <div className="flex flex-col gap-5">
                <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealInk">• Financia tu auto</span>
                <h2 className="font-display text-3xl font-bold leading-[1.1] sm:text-[2.7rem]">Tu auto puede pagar la cuota de su crédito automotriz.</h2>
                <div className="accent-rule" />
                <p className="max-w-md text-[17px] text-[#63645f]">
                  Publicar es gratis. Si estás pagando un crédito o quieres rentabilizar tu vehículo, ponlo en arriendo los días que no lo usas. Con 10 a 12 días al mes cubres holgadamente tu cuota bancaria, seguro y mantenciones con respaldo legal.
                </p>
                <ul className="flex flex-col gap-3">
                  {[
                    "Verificación de cada arrendatario antes de entregar",
                    "Seguro comercial y hold de garantía en cada reserva",
                    "Peajes y multas se cargan a nombre de quien manejó",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2.5 text-[15px] font-medium">
                      <Check className="h-[18px] w-[18px] text-brand-tealInk" strokeWidth={2.4} />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-4">
                  <Link href="#descargar-app">
                    <Button className="rounded-xl bg-brand-ink px-6 py-6 text-[15px] font-semibold text-white hover:bg-black">
                      Publicar mi auto
                    </Button>
                  </Link>
                  <Link href="/simulador-duenos" className="text-[15px] font-semibold text-brand-tealInk hover:text-brand-teal">
                    Ver el simulador →
                  </Link>
                </div>
              </div>

              <div className="relative pt-3.5">
                <span className="absolute right-5 top-0 z-10 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-semibold shadow-soft">
                  <Wallet className="h-3.5 w-3.5 text-brand-tealInk" /> Pago por depósito bancario
                </span>
                <div className="-rotate-[1.4deg] rounded-3xl border border-[#cfe9e0] bg-[linear-gradient(165deg,#eefaf6,#f4faf8)] p-8 shadow-soft">
                  <div className="font-display text-xs font-semibold uppercase tracking-widest text-brand-tealInk">Ingreso mensual estimado</div>
                  <div className="mt-1.5 font-display text-5xl font-bold text-brand-ink">{fmtCLP(tarifaNeta)}</div>
                  <div className="text-[13px] text-[#63645f]">a tu cuenta bancaria, después de comisión</div>
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between text-[13px] font-semibold">
                      <span>Días arrendado al mes</span>
                      <span className="text-brand-tealInk">{dias} días</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="28"
                      value={dias}
                      onChange={(e) => setDias(Number(e.target.value))}
                      className="w-full accent-brand-teal"
                    />
                  </div>
                  <div className="mt-5 flex flex-col gap-2 border-t border-[#cfe9e0] pt-4 text-[13.5px]">
                    <div className="flex justify-between"><span className="text-[#63645f]">Arriendo bruto ({dias} × $30.000)</span><span className="font-semibold">{fmtCLP(dias * 30000)}</span></div>
                    <div className="flex justify-between"><span className="text-[#63645f]">Comisión plataforma (15%)</span><span className="font-semibold">− {fmtCLP(dias * 30000 * 0.15)}</span></div>
                    <div className="flex justify-between"><span className="text-[#63645f]">Cargos por lavado (100% tuyo)</span><span className="font-semibold text-brand-tealInk">incluido</span></div>
                  </div>
                  <p className="mt-3.5 text-[10.5px] text-[#63645f]">Estimación referencial. El ingreso real depende de tu auto, tu precio y la demanda.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ QUÉ NECESITAS (KYC) ══════════ */}
        <section id="verificacion" className="border-y border-brand-line bg-brand-soft py-24">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealInk">• Verificación de identidad</span>
            <h2 className="mt-3.5 font-display text-3xl font-bold sm:text-4xl">Qué necesitas para arrendar</h2>
            <div className="accent-rule mt-4" />
            <p className="mt-4 max-w-xl text-[16px] text-[#63645f]">
              Una sola verificación te habilita para arrendar y para publicar. Los documentos cambian según tu nacionalidad.
            </p>

            <div className="mt-11 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-brand-line bg-white p-8 shadow-soft">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-line bg-brand-soft">
                    <svg width="24" height="16" viewBox="0 0 30 20" className="rounded-[3px]">
                      <rect width="30" height="20" fill="#fff" />
                      <rect width="30" height="10" y="10" fill="#D52B1E" />
                      <rect width="10" height="10" fill="#0039A6" />
                      <path d="M5 2.3 6.03 5.4 3.4 3.5h3.2L3.97 5.4Z" fill="#fff" />
                    </svg>
                  </span>
                  <h3 className="font-display text-xl font-semibold">Si eres chileno</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {KYC_CL.map((t) => (
                    <li key={t} className="flex gap-3 text-[14.5px]">
                      <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-tealInk" strokeWidth={2.4} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-brand-line bg-white p-8 shadow-soft">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-ink">
                    <Globe className="h-5 w-5 text-brand-tealBright" />
                  </span>
                  <h3 className="font-display text-xl font-semibold">Si eres extranjero</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {KYC_EXT.map(({ t, warn }) => (
                    <li key={t} className="flex gap-3 text-[14.5px]">
                      {warn ? (
                        <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-amber" strokeWidth={2.2} />
                      ) : (
                        <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-tealInk" strokeWidth={2.4} />
                      )}
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-line bg-white px-5 py-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-tealInk" />
              <p className="text-[13.5px] text-[#63645f]">
                Al terminar la verificación se retiene un <b className="text-[#17181a]">hold de garantía de $800.000</b>. Es una
                retención en tu tarjeta, no un cobro, y se libera al devolver el auto conforme.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════ FAQ ══════════ */}
        <section id="faq" className="py-24">
          <div className="container mx-auto max-w-3xl px-4 sm:px-6">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealInk">• Dudas frecuentes</span>
            <h2 className="mt-3.5 font-display text-3xl font-bold sm:text-4xl">Todo lo que se suele preguntar</h2>
            <div className="accent-rule mb-9 mt-4" />
            <div className="flex flex-col gap-3">
              {FAQS.map((f, i) => (
                <div
                  key={f.q}
                  className={`rounded-2xl border bg-white ${openFaq === i ? "border-l-[3px] border-l-brand-teal border-brand-line" : "border-brand-line"}`}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-btn-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <h3 className="font-display text-[16.5px] font-semibold">{f.q}</h3>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${openFaq === i ? "bg-brand-tealTint" : "bg-brand-soft"}`}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === i ? "rotate-180 text-brand-tealInk" : "text-[#63645f]"}`} />
                    </span>
                  </button>
                  {openFaq === i && (
                    <p
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-btn-${i}`}
                      className="border-t border-brand-line px-6 py-4 text-[14.5px] leading-relaxed text-[#63645f]"
                    >
                      {f.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ DESCARGA (PANEL OSCURO) ══════════ */}
        <section id="descargar-app" className="bg-white px-10 pb-10">
          <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[2.75rem] bg-brand-ink px-6 py-24 text-white sm:px-16">
            <div className="pointer-events-none absolute -right-40 -top-52 h-[560px] w-[560px] rounded-full bg-brand-tealBright/15 blur-[10px]" />
            <div className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
              <div className="flex flex-col gap-6">
                <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-tealBright">• La app</span>
                <h2 className="font-display text-4xl font-bold leading-[1.06] text-white sm:text-5xl">Llevá el arriendo en el bolsillo.</h2>
                <div className="accent-rule" />
                <p className="max-w-md text-[17px] text-[#a7a7a1]">
                  Reserva, chatea con el dueño, escanea el QR de entrega y audita el checklist de 9 fotos. Todo desde el
                  teléfono, con notificaciones en tiempo real.
                </p>
                <div className="flex flex-wrap gap-3.5">
                  <span className="inline-flex items-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-brand-ink">
                    <FaApple className="h-5 w-5" />
                    <span className="leading-none">
                      <span className="block text-[10px] uppercase tracking-wider opacity-60">Próximamente</span>
                      <span className="block font-display text-sm font-semibold">App Store</span>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2.5 rounded-xl bg-brand-teal px-4 py-2.5 text-[#04231b]">
                    <FaGooglePlay className="h-5 w-5" />
                    <span className="leading-none">
                      <span className="block text-[10px] uppercase tracking-wider opacity-60">Próximamente</span>
                      <span className="block font-display text-sm font-semibold">Google Play</span>
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-[290px] rotate-[1.6deg] rounded-[2.75rem] border-[10px] border-[#2c2c29] bg-white p-4">
                  <div className="flex items-center justify-between px-1 pb-2 pt-1">
                    <span className="font-display text-[13px] font-bold text-brand-ink">Tu reserva</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-brand-line">
                    <img src="/hero-car.jpg" alt="" className="h-[88px] w-full object-cover" />
                    <div className="px-3 py-2.5">
                      <div className="text-[13.5px] font-semibold text-brand-ink">Toyota RAV4 Limited</div>
                      <div className="text-[11.5px] text-[#63645f]">Hoy 10:00 · a 6 cuadras</div>
                    </div>
                  </div>
                  <div className="my-3 rounded-2xl bg-brand-teal p-3.5 text-center text-[#04231b]">
                    <div className="text-[10px] font-bold uppercase tracking-widest">Código de entrega</div>
                    <div className="mx-auto mt-2 grid w-16 grid-cols-4 gap-0.5 rounded-lg bg-white p-2">
                      {[1,0,1,1,0,1,0,1,1,0,1,0,0,1,1,1].map((v, k) => (
                        <span key={k} className={`aspect-square ${v ? "bg-brand-ink" : "bg-transparent"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-brand-line p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#63645f]">Checklist de fotos</div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {[0,1,2,3,4,5].map((k) => (
                        <span key={k} className={`h-8 rounded-lg ${k === 4 ? "border border-brand-teal bg-brand-tealTint" : "bg-brand-soft"}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>



      {/* Modal ficha */}
      {modalAuto && (
        <Dialog open={!!modalAuto} onOpenChange={() => setModalAuto(null)}>
          <DialogContent className="max-w-lg rounded-3xl border border-brand-line bg-white p-6 text-[#17181a]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold">
                {modalAuto.marca} {modalAuto.modelo} {modalAuto.anio ? `(${modalAuto.anio})` : ""}
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5 text-xs text-[#63645f]">
                <MapPin className="h-3.5 w-3.5 text-brand-tealInk" /> {modalAuto.ubicacion_base || "Ubicación coordinada con el dueño"}
              </DialogDescription>
            </DialogHeader>
            <div className="my-2 space-y-4">
              <FotoAuto
                src={fotoDe(modalAuto)}
                alt={`${modalAuto.marca} ${modalAuto.modelo}`}
                className="h-48 w-full rounded-2xl border border-brand-line"
              />
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ["Transmisión", modalAuto.transmision || "—"],
                  ["Combustible", modalAuto.combustible || "—"],
                  ["Capacidad", modalAuto.asientos ? `${modalAuto.asientos} asientos` : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-brand-line bg-brand-soft p-3 text-center">
                    <span className="block text-[10px] text-[#63645f]">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 rounded-2xl border border-brand-line bg-brand-soft p-4 text-xs text-[#63645f]">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-brand-tealInk">
                  <ShieldCheck className="h-4 w-4" /> Incluido en cada arriendo
                </div>
                <p>· Seguro con deducible 15 UF (50 / 50)</p>
                <p>· Checklist fotográfico de 9 ángulos</p>
                <p>· Hold de garantía $800.000 liberado al retorno</p>
              </div>
            </div>
            <DialogFooter className="flex flex-col items-stretch justify-between gap-3 border-t border-brand-line pt-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-[10px] uppercase text-[#63645f]">Tarifa diaria</div>
                <div className="font-display text-lg font-bold text-brand-ink">{fmtCLP(modalAuto.tarifa_dia)} CLP</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={autoHref(modalAuto)} onClick={() => setModalAuto(null)}>
                  <Button variant="outline" className="w-full rounded-xl border-brand-line px-5 text-sm font-semibold text-brand-ink hover:border-brand-ink">
                    Ver ficha completa
                  </Button>
                </Link>
                <a href="#descargar-app" onClick={() => setModalAuto(null)} className="w-full sm:w-auto">
                  <Button className="w-full rounded-xl bg-brand-teal px-6 text-sm font-semibold text-[#04231b] hover:bg-[#12b78d]">
                    Reservar en la app
                  </Button>
                </a>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </>
  );
}
