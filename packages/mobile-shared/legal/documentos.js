/**
 * Textos legales que el usuario acepta al crear su cuenta.
 *
 * Van embebidos en la app (y no solo como link al sitio) porque el registro
 * exige aceptarlos: tienen que poder leerse ahí mismo, sin conexión y sin
 * salir del flujo. `url` apunta a la versión canónica publicada en el sitio,
 * que es la que manda si alguna vez difieren.
 */

// Edad mínima para arrendar. Los T&C publicados exigen "ser mayor de 21 años
// al momento de solicitar el arriendo", es decir 22 cumplidos. Vive acá para
// que el copy del registro y la validación contra la cédula no se separen.
export const EDAD_MINIMA_ARRENDATARIO = 22;

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "https://www.arriendomiautoya.cl/").replace(/\/$/, "");

export const DOCUMENTOS_LEGALES = {
  terminos: {
    id: "terminos",
    tab: "Términos",
    titulo: "Términos y Condiciones",
    subtitulo: "Marco legal y operativo · Los Ángeles, Región del Biobío",
    actualizado: "Última actualización: agosto de 2026",
    url: `${WEB_URL}/terminos`,
    secciones: [
      {
        h: "1. Naturaleza del servicio y objeto",
        p:
          "ArriendoMiAutoYa Chile SpA opera una plataforma tecnológica de economía colaborativa " +
          "(car-sharing P2P) que conecta a propietarios de vehículos particulares con conductores " +
          "validados para celebrar contratos de arriendo a corto y mediano plazo en la comuna de " +
          "Los Ángeles, Región del Biobío.",
      },
      {
        h: "2. Requisitos para arrendatarios",
        items: [
          `Ser mayor de ${EDAD_MINIMA_ARRENDATARIO - 1} años al momento de solicitar el arriendo.`,
          "Cédula Nacional de Identidad chilena vigente y sin órdenes pendientes, o pasaporte/documento de identidad extranjero verificado.",
          "Licencia de Conducir Clase B con al menos 1 año de antigüedad demostrable.",
          "Conductores extranjeros: si el país emisor de la licencia no adhirió al Convenio de Viena de 1968, se exige además el Permiso Internacional de Conducir (PIC) vigente. Con más de un año de residencia continua en Chile se requiere licencia chilena.",
          "Tarjeta de crédito bancaria a nombre del conductor titular para constituir el hold de garantía.",
        ],
      },
      {
        h: "3. Seguro, siniestros y deducible 15 UF (50/50)",
        p:
          "Todos los vehículos cuentan con cobertura de seguro comercial durante el período de " +
          "arriendo. Ante un siniestro calificado (colisión, choque, robo o daño material):",
        items: [
          "El deducible de 15 UF se comparte por partes iguales: 50% del arrendatario y 50% de la empresa o dueño, según corresponda.",
          "El arrendatario debe dejar constancia policial inmediata ante Carabineros de Chile y reportar el evento en la plataforma antes de 2 horas.",
        ],
      },
      {
        h: "4. Hold de garantía ($800.000 CLP) y devolución",
        p:
          "Antes de la entrega del vehículo se realiza una retención temporal (hold) de $800.000 CLP. " +
          "No es un cobro ni una transferencia, sino una pre-autorización bancaria. Se libera " +
          "completa y de forma automática tras el check-out fotográfico conforme, siempre que no " +
          "existan multas de tránsito impagas, combustible no repuesto o daños no cubiertos.",
      },
      {
        h: "5. Checklist obligatorio de 9 fotos",
        p:
          "En la entrega (check-in) y en la recepción (check-out), arrendatario y propietario deben " +
          "registrar en la app las 9 fotografías auditadas: frontal/patente, trasera/luces, lateral " +
          "izquierdo, lateral derecho, odómetro, nivel de combustible, asientos delanteros, asientos " +
          "traseros y rueda de repuesto. Este registro digital tiene carácter de prueba vinculante.",
      },
      {
        h: "6. Kilometraje, combustible y TAG",
        items: [
          "Kilometraje: cada arriendo incluye 250 km libres por día; el km adicional cuesta $120 CLP.",
          "Combustible: el vehículo se restituye con el mismo nivel de estanque recibido.",
          "Peajes, TAG y fotomultas: son de exclusiva responsabilidad del arrendatario. Como se notifican a nombre del titular de la patente semanas después, el arrendatario autoriza su cobro posterior a la tarjeta registrada, por los eventos ocurridos durante su arriendo y contra la boleta de la concesionaria o el parte cursado.",
        ],
      },
      {
        h: "7. Cancelaciones y modificaciones",
        p:
          "Las reservas se cancelan sin costo hasta 24 horas antes de la hora de inicio pactada. " +
          "Después de ese plazo se retiene un día de tarifa base como compensación al propietario.",
      },
    ],
  },

  gps: {
    id: "gps",
    tab: "GPS",
    titulo: "Consentimiento de Monitoreo GPS",
    subtitulo: "Enrolamiento del vehículo · Propietarios",
    actualizado: "Última actualización: septiembre de 2026",
    url: `${WEB_URL}/terminos`,
    secciones: [
      {
        h: "1. Instalación del dispositivo",
        p:
          "Para publicar un vehículo en la plataforma, el propietario autoriza expresamente la " +
          "instalación de un dispositivo de rastreo GPS en su vehículo. El equipo se entrega en " +
          "comodato: sigue siendo propiedad del proveedor del servicio y su uso está incluido en " +
          "la suscripción mensual de la flota, sin costo inicial para el dueño.",
      },
      {
        h: "2. Qué datos se registran y quién los ve",
        items: [
          "Posición del vehículo, velocidad y estado del equipo mientras el auto está enrolado.",
          "El propietario puede consultar la posición de su propio vehículo desde la app.",
          "El equipo de la plataforma accede a esos datos solo para resolver incidentes, disputas y recuperación del vehículo.",
        ],
      },
      {
        h: "3. Corte remoto de motor",
        p:
          "El corte remoto de motor es un recurso de última instancia frente a la no devolución del " +
          "vehículo o a una disputa formal abierta. Solo puede ordenarlo un administrador de la " +
          "plataforma, con motivo registrado y auditable, y el proveedor lo ejecuta únicamente con " +
          "el vehículo detenido. Nunca se activa desde la app del dueño ni con el auto en marcha.",
      },
      {
        h: "4. Retiro del dispositivo",
        p:
          "Si el propietario retira su vehículo de la plataforma, puede solicitar la desinstalación " +
          "del equipo sin costo. El retiro lo coordina la plataforma con el proveedor y, hecha la " +
          "desinstalación, cesa todo registro de posición del vehículo.",
      },
      {
        h: "5. Revocación del consentimiento",
        p:
          "El propietario puede revocar este consentimiento en cualquier momento. Revocarlo implica " +
          "pausar la publicación del vehículo, porque el monitoreo es condición para operar en la " +
          "plataforma. Las reservas ya confirmadas se mantienen hasta su término.",
      },
    ],
  },

  privacidad: {
    id: "privacidad",
    tab: "Privacidad",
    titulo: "Política de Privacidad",
    subtitulo: "Ley N° 19.628 sobre Protección de la Vida Privada (Chile)",
    actualizado: "Última actualización: agosto de 2026",
    url: `${WEB_URL}/privacidad`,
    secciones: [
      {
        h: "1. Responsable del tratamiento",
        p:
          "ArriendoMiAutoYa Chile SpA, domiciliada en la comuna de Los Ángeles, Región del Biobío, " +
          "es responsable de la custodia y administración de las bases de datos generadas por su " +
          "aplicación móvil y su plataforma web, conforme a la Ley N° 19.628.",
      },
      {
        h: "2. Información que recopilamos",
        items: [
          "Datos de identificación: nombre completo, RUT/cédula de identidad chilena y fecha de nacimiento.",
          "Documentos de conducción: fotografía y datos de la licencia clase B para validar la habilitación legal.",
          "Datos de contacto: número de teléfono móvil y correo electrónico.",
          "Registro fotográfico del checklist: las 9 fotos obligatorias del estado inicial y final del vehículo.",
          "Datos transaccionales: tokens seguros de la pasarela de pago (no almacenamos números de tarjeta).",
          "Datos de ubicación del vehículo: posición reportada por el dispositivo GPS instalado con consentimiento del propietario.",
        ],
      },
      {
        h: "3. Finalidad del uso de datos",
        p: "La información recopilada se destina exclusivamente a:",
        items: [
          "Validar la identidad y la habilitación legal para conducir en Chile.",
          "Generar y suscribir el contrato de arriendo entre dueño y conductor.",
          "Emitir la póliza de seguro y canalizar denuncias de siniestros ante la aseguradora.",
          "Garantizar la restitución del vehículo en las condiciones convenidas mediante el checklist auditado.",
        ],
      },
      {
        h: "4. Derechos del titular (ARCO)",
        p:
          "Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento de tus " +
          "datos personales en cualquier momento, escribiendo al canal de soporte o en la sucursal " +
          "de Los Ángeles, siempre que no existan obligaciones legales o contractuales pendientes.",
      },
    ],
  },
};
