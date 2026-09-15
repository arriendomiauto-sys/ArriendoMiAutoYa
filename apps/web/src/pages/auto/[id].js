import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Seo from "../../components/Seo";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import FotoAuto from "../../components/FotoAuto";
import { Button } from "../../components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Star,
  ShieldCheck,
  Camera,
  Lock,
  Gauge,
  Fuel,
  Users,
  Settings2,
} from "lucide-react";
import { obtenerAutoPorId, fotoDeAuto, extraerIdDeParametro } from "../../lib/autos";
import { SITE_URL } from "../../lib/seo";

const fmtCLP = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

const GARANTIAS = [
  { icon: ShieldCheck, t: "Seguro con deducible 15 UF, repartido 50 / 50" },
  { icon: Camera, t: "Checklist fotográfico de 9 ángulos en la entrega y la devolución" },
  { icon: Lock, t: "Hold de garantía de $800.000, liberado al devolver el auto conforme" },
];

export async function getServerSideProps({ params, res }) {
  const auto = await obtenerAutoPorId(extraerIdDeParametro(params.id));
  if (!auto) return { notFound: true };
  // Cache en el edge: la ficha cambia poco; se revalida en segundo plano.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return { props: { auto } };
}

export default function AutoDetalle({ auto }) {
  const router = useRouter();
  const [fotoActiva, setFotoActiva] = React.useState(0);

  const nombre = [auto.marca, auto.modelo].filter(Boolean).join(" ") || "Vehículo particular";
  const fotos = Array.isArray(auto.fotos) && auto.fotos.length ? auto.fotos : [fotoDeAuto(auto)].filter(Boolean);
  const especificaciones = [
    { icon: Settings2, label: "Transmisión", value: auto.transmision },
    { icon: Fuel, label: "Combustible", value: auto.combustible },
    { icon: Users, label: "Capacidad", value: auto.asientos ? `${auto.asientos} asientos` : null },
    { icon: Gauge, label: "Categoría", value: auto.categoria },
  ].filter((e) => e.value);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: nombre,
    brand: auto.marca || undefined,
    model: auto.modelo || undefined,
    vehicleModelDate: auto.anio ? String(auto.anio) : undefined,
    fuelType: auto.combustible || undefined,
    vehicleTransmission: auto.transmision || undefined,
    seatingCapacity: auto.asientos || undefined,
    image: fotos.filter((f) => typeof f === "string" && f.startsWith("http")),
    ...(auto.rating_promedio
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: auto.rating_promedio,
            reviewCount: auto.rating_cantidad || 1,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "CLP",
      price: auto.tarifa_dia || undefined,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: auto.tarifa_dia || undefined,
        priceCurrency: "CLP",
        unitCode: "DAY",
      },
      availability: "https://schema.org/InStock",
      areaServed: auto.ubicacion_base || "Chile",
      url: `${SITE_URL}${router.asPath.split("?")[0]}`,
    },
  };

  return (
    <>
      <Seo
        title={`${nombre}${auto.anio ? ` ${auto.anio}` : ""} en arriendo — ${fmtCLP(auto.tarifa_dia)}/día`}
        description={`Arrienda un ${nombre} particular${auto.ubicacion_base ? ` en ${auto.ubicacion_base}` : ""} por ${fmtCLP(auto.tarifa_dia)} al día. Seguro con deducible 15 UF, verificación de identidad y entrega con código QR.`}
        image={fotos.find((f) => typeof f === "string" && f.startsWith("http")) || undefined}
        jsonLd={jsonLd}
      />
      <Navbar />

      <main className="bg-white pt-[74px] text-[#17181a]">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <button
            onClick={() => (router.query.from === "catalogo" ? router.back() : router.push("/#catalogo"))}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#63645f] hover:text-brand-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </button>

          <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
            {/* Galería */}
            <div>
              <FotoAuto
                src={fotos[fotoActiva]}
                alt={`${nombre} — foto ${fotoActiva + 1}`}
                priority
                className="aspect-[4/3] w-full rounded-3xl border border-brand-line"
              />
              {fotos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {fotos.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setFotoActiva(i)}
                      aria-label={`Ver foto ${i + 1}`}
                      className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                        i === fotoActiva ? "border-brand-teal" : "border-brand-line"
                      }`}
                    >
                      <FotoAuto src={f} alt="" className="h-full w-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info + CTA */}
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">
                  {nombre} {auto.anio ? <span className="text-[#63645f]">{auto.anio}</span> : null}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#63645f]">
                  {auto.ubicacion_base && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-brand-tealInk" /> {auto.ubicacion_base}
                    </span>
                  )}
                  {auto.rating_promedio && (
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-tealInk">
                      <Star className="h-4 w-4 fill-brand-teal text-brand-teal" /> {auto.rating_promedio}
                      {auto.rating_cantidad ? ` · ${auto.rating_cantidad} viajes` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-brand-line bg-brand-soft p-5">
                <div className="flex items-end gap-1">
                  <span className="font-display text-3xl font-bold text-brand-ink">{fmtCLP(auto.tarifa_dia)}</span>
                  <span className="pb-1 text-sm text-[#63645f]">CLP / día</span>
                </div>
                <Link href="/#descargar-app" className="mt-4 block">
                  <Button className="w-full rounded-xl bg-brand-teal py-6 text-[15px] font-semibold text-[#04231b] hover:bg-[#12b78d]">
                    Reservar en la app <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/cotizador" className="mt-2 block">
                  <Button variant="outline" className="w-full rounded-xl border-brand-line text-sm font-semibold text-brand-ink hover:border-brand-ink">
                    Calcular el total de mi arriendo
                  </Button>
                </Link>
              </div>

              {especificaciones.length > 0 && (
                <dl className="grid grid-cols-2 gap-3">
                  {especificaciones.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-2xl border border-brand-line p-3">
                      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#63645f]">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold capitalize text-brand-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <ul className="flex flex-col gap-2.5 rounded-2xl border border-brand-line bg-white p-4">
                {GARANTIAS.map(({ icon: Icon, t }) => (
                  <li key={t} className="flex gap-2.5 text-[13.5px] text-[#3d3d39]">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-tealInk" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
