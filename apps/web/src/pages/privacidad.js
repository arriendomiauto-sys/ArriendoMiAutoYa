import React from "react";
import Seo from "../components/Seo";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Lock, Shield, Eye, FileCheck } from "lucide-react";

export default function PrivacidadPage() {
  return (
    <>
      <Seo
        title="Política de Privacidad y Datos"
        description="Conoce cómo protegemos tus datos personales y documentos en ArriendoMiAutoYa conforme a la Ley 19.628 de Chile."
        path="/privacidad"
        ogType="article"
      />

      <Navbar />

      <main className="min-h-screen bg-[#061E1F] text-white pt-32 pb-24 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-24 right-1/3 w-[600px] h-[350px] bg-[#2FBF9B]/10 rounded-full filter blur-[120px] pointer-events-none" />

        <div className="container max-w-4xl mx-auto px-4 sm:px-6 relative z-10 space-y-12">
          
          {/* Header */}
          <div className="text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBF9B]/30 bg-[#2FBF9B]/10 px-3.5 py-1 text-xs font-bold text-[#2FBF9B]">
              <Lock className="h-3.5 w-3.5" />
              LEY N° 19.628 (CHILE)
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Política de Privacidad
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Compromiso de confidencialidad y tratamiento seguro de información · Los Ángeles, Región del Biobío.
            </p>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-5 space-y-2 shadow-lg">
              <Shield className="h-5 w-5 text-[#2FBF9B]" />
              <h3 className="text-sm font-bold text-white">Encriptación SSL</h3>
              <p className="text-xs text-slate-300">
                Transmisión segura de cédulas, licencias y datos de pago con protocolos de alta seguridad.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-5 space-y-2 shadow-lg">
              <Eye className="h-5 w-5 text-[#2FBF9B]" />
              <h3 className="text-sm font-bold text-white">Cero Comercialización</h3>
              <p className="text-xs text-slate-300">
                Nunca vendemos ni compartimos tus datos de contacto con fines publicitarios de terceros.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E3736] border border-[#2FBF9B]/20 p-5 space-y-2 shadow-lg">
              <FileCheck className="h-5 w-5 text-[#2FBF9B]" />
              <h3 className="text-sm font-bold text-white">Custodia Fotográfica</h3>
              <p className="text-xs text-slate-300">
                Las 9 fotos de checklist se custodian exclusivamente para el respaldo pericial de tu arriendo.
              </p>
            </div>
          </div>

          {/* Detailed Clauses */}
          <div className="rounded-3xl bg-[#0E3736] border border-[#2FBF9B]/20 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-2xl">
            
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">1.</span> Responsable del Tratamiento
              </h2>
              <p>
                <strong>ArriendoMiAutoYa Chile SpA</strong>, domiciliada en la comuna de Los Ángeles, Región del Biobío,
                es la entidad responsable de la custodia y administración de las bases de datos generadas a través de su
                aplicación móvil y plataforma web, en estricto cumplimiento de la Ley N° 19.628 sobre Protección de la Vida Privada.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">2.</span> Información que Recopilamos
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Datos de Identificación:</strong> Nombre completo, RUT/Cédula de Identidad chilena y fecha de nacimiento.</li>
                <li><strong>Documentos de Conducción:</strong> Fotografía y datos de Licencia de Conducir Clase B para validación de habilitación legal.</li>
                <li><strong>Datos de Contacto:</strong> Número telefónico móvil y correo electrónico.</li>
                <li><strong>Registro Fotográfico de Checklist:</strong> Las 9 fotografías obligatorias del estado inicial y final del vehículo.</li>
                <li><strong>Datos Transaccionales:</strong> Tokens seguros de procesamiento de pago provistos por pasarelas certificadas (no almacenamos números de tarjetas de crédito).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">3.</span> Finalidad del Uso de Datos
              </h2>
              <p>La información recopilada se destina exclusivamente a:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Validar la identidad y habilitación legal para conducir en territorio chileno.</li>
                <li>Generar y suscribir el contrato de arriendo de vehículo motorizado entre dueño y conductor.</li>
                <li>Emitir la póliza de seguro y canalizar denuncias de siniestros ante la compañía aseguradora.</li>
                <li>Garantizar la restitución del vehículo en las condiciones convenidas mediante el checklist auditado.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-[#2FBF9B]">4.</span> Derechos del Titular (ARCO)
              </h2>
              <p>
                El usuario tiene derecho a solicitar el acceso, rectificación, cancelación u oposición al tratamiento
                de sus datos personales en cualquier momento, enviando una comunicación al canal de soporte o en la
                sucursal Los Ángeles, siempre que no existan obligaciones legales o contractuales pendientes de resolución.
              </p>
            </section>

          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
