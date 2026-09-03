import React from "react";
import Seo from "../components/Seo";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ShieldCheck, FileText, Lock, Clock, AlertCircle } from "lucide-react";

export default function TerminosPage() {
  return (
    <>
      <Seo
        title="Términos y Condiciones del Servicio"
        description="Términos y condiciones legales de la plataforma de arriendo de vehículos ArriendoMiAutoYa en Los Ángeles, Región del Biobío."
        path="/terminos"
        ogType="article"
      />

      <Navbar />

      <main className="min-h-screen bg-[#061E1F] text-white pt-32 pb-24 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#2FBF9B]/10 rounded-full filter blur-[120px] pointer-events-none" />

        <div className="container max-w-4xl mx-auto px-4 sm:px-6 relative z-10 space-y-12">
          
          {/* Header */}
          <div className="text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#2FBF9B]/10 px-3.5 py-1 text-xs font-bold text-[#2FBF9B]">
              <FileText className="h-3.5 w-3.5" />
              MARCO LEGAL Y OPERATIVO
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Términos y Condiciones
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Última actualización: Agosto de 2026 · Válido para operaciones en Los Ángeles, Biobío.
            </p>
          </div>

          {/* Core Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-5 space-y-2 shadow-lg">
              <ShieldCheck className="h-5 w-5 text-[#2FBF9B]" />
              <h3 className="text-sm font-bold text-white">Deducible 15 UF (50/50)</h3>
              <p className="text-xs text-slate-300">
                Ante siniestros cubiertos por la póliza, el deducible de 15 UF se divide en partes iguales.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-5 space-y-2 shadow-lg">
              <Lock className="h-5 w-5 text-[#2FBF9B]" />
              <h3 className="text-sm font-bold text-white">Hold de $800.000 CLP</h3>
              <p className="text-xs text-slate-300">
                Pre-autorización bancaria de seguridad, liberada al retornar el vehículo conforme al checklist.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-5 space-y-2 shadow-lg">
              <Clock className="h-5 w-5 text-[#2FBF9B]" />
              <h3 className="text-sm font-bold text-white">Radio de 30 km</h3>
              <p className="text-xs text-slate-300">
                Operación y entregas centralizadas en la comuna de Los Ángeles, Región del Biobío.
              </p>
            </div>
          </div>

          {/* Legal Clauses Container */}
          <div className="rounded-3xl bg-[#0E3736] border border-[#2FBF9B]/20 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-2xl">
            
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">1.</span> Naturaleza del Servicio y Objeto
              </h2>
              <p>
                <strong>ArriendoMiAutoYa Chile SpA</strong> opera una plataforma tecnológica de economía colaborativa
                (Car-Sharing P2P) que conecta a propietarios de vehículos particulares con conductores validados
                para la celebración de contratos de arriendo a corto y mediano plazo en la comuna de Los Ángeles,
                Región del Biobío.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">2.</span> Requisitos para Arrendatarios
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Ser mayor de 21 años al momento de solicitar el arriendo.</li>
                <li>Cédula Nacional de Identidad chilena vigente y sin órdenes pendientes.</li>
                <li>Licencia de Conducir Clase B con al menos 1 año de antigüedad demostrable.</li>
                <li>Tarjeta de crédito bancaria a nombre del conductor titular para la constitución del Hold de garantía.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">3.</span> Seguro, Siniestros y Deducible 15 UF (50/50)
              </h2>
              <p>
                Todos los vehículos cuentan con cobertura de seguro comercial durante el período de arriendo. En caso de
                siniestro calificado (colisión, choque, robo o daño material):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>El deducible fijado de <strong>15 UF</strong> es compartido de forma equitativa: 50% de cargo del arrendatario y 50% asumido por la empresa/dueño según corresponda.</li>
                <li>Es obligación del arrendatario realizar la constancia policial inmediata ante Carabineros de Chile y reportar el evento en la plataforma en un plazo inferior a 2 horas.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">4.</span> Hold de Garantía ($800.000 CLP) y Devolución
              </h2>
              <p>
                Previo a la entrega del vehículo, se realiza una retención temporal (Hold) por un monto de <strong>$800.000 CLP</strong>.
                Este monto no constituye un cobro ni transferencia, sino una pre-autorización bancaria.
              </p>
              <p>
                El Hold se libera en su totalidad de forma automática tras completarse el Check-out fotográfico conforme,
                siempre que no existan multas de tránsito impagas, consumos de combustible no repuestos o daños no cubiertos.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">5.</span> Checklist Obligatorio de 9 Fotos e Inspección Inmutable
              </h2>
              <p>
                Tanto en la entrega (Check-in) como en la recepción (Check-out), arrendatario y propietario deben registrar
                obligatoriamente en la app las 9 fotografías auditadas: Frontal/Patente, Trasera/Luces, Lateral Izquierdo,
                Lateral Derecho, Odómetro/Kilometraje, Nivel de Combustible, Asientos Delanteros, Asientos Traseros y Rueda de Repuesto.
                Este registro digital tiene carácter de prueba vinculante e inalterable.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">6.</span> Kilometraje, Combustible y TAG
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Kilometraje libre:</strong> Cada arriendo incluye 250 km libres por día. El km adicional tiene un costo de $120 CLP/km.</li>
                <li><strong>Combustible:</strong> El vehículo debe restituirse con el mismo nivel de estanque recibido.</li>
                <li><strong>Peajes, TAG y fotomultas:</strong> Los peajes interurbanos, las pasadas por pórticos TAG y las infracciones cursadas por fotorradar son de exclusiva responsabilidad del arrendatario. Como se notifican a nombre del titular de la patente semanas después, el arrendatario autoriza su cobro posterior a la tarjeta registrada, por los eventos ocurridos durante su arriendo y contra la boleta o el parte de respaldo, dentro del plazo indicado en el contrato.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">7.</span> Cancelaciones y Modificaciones
              </h2>
              <p>
                Las reservas pueden cancelarse sin costo alguno hasta con <strong>24 horas de anticipación</strong> a la hora de inicio pactada.
                Cancelaciones posteriores estarán sujetas a la retención de un día de tarifa base en compensación al propietario.
              </p>
            </section>

            <div className="p-4 rounded-2xl bg-[#061E1F] border border-[#2FBF9B]/20 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#2FBF9B] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                ¿Tienes dudas sobre los términos o coberturas? Contáctanos a través de nuestro{" "}
                <Link href="/garantias" className="text-[#2FBF9B] font-bold hover:underline">
                  Centro de Garantías
                </Link>{" "}
                o en la sucursal de Los Ángeles, Región del Biobío.
              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
