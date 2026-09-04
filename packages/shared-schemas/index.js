const { z } = require("zod");

/**
 * Algoritmo oficial Módulo 11 para validación de RUT chileno.
 * @param {string} rutCompleto - RUT con o sin puntos y con guion (ej. "18.456.789-0" o "18456789-0")
 * @returns {boolean}
 */
function validarRutChileno(rutCompleto) {
  if (!rutCompleto || typeof rutCompleto !== "string") return false;

  // Limpiar puntos, espacios y guiones
  const valorLimpio = rutCompleto.replace(/[\.\-\s]/g, "").toUpperCase();
  if (valorLimpio.length < 8 || valorLimpio.length > 9) return false;

  const cuerpo = valorLimpio.slice(0, -1);
  const dv = valorLimpio.slice(-1);

  // Verificar que el cuerpo contenga solo dígitos
  if (!/^\d+$/.test(cuerpo)) return false;

  // Calcular dígito verificador según Módulo 11
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvEsperado = 11 - resto;

  let dvCalculado = "";
  if (dvEsperado === 11) {
    dvCalculado = "0";
  } else if (dvEsperado === 10) {
    dvCalculado = "K";
  } else {
    dvCalculado = dvEsperado.toString();
  }

  return dv === dvCalculado;
}

/**
 * Validador de formato de patente chilena (nueva de 4 letras o antigua de 2 letras).
 * @param {string} patente
 * @returns {boolean}
 */
function validarPatenteChilena(patente) {
  if (!patente || typeof patente !== "string") return false;
  const limpia = patente.replace(/[\-\s]/g, "").toUpperCase();
  
  // Nueva patente: 4 letras + 2 dígitos (ej. BBCL10)
  const regexNueva = /^[BCDFGHJKLPRSTVWXYZ]{4}\d{2}$/;
  // Antigua patente: 2 letras + 4 dígitos (ej. AB1234)
  const regexAntigua = /^[A-Z]{2}\d{4}$/;

  return regexNueva.test(limpia) || regexAntigua.test(limpia);
}

/**
 * Validador de teléfono móvil chileno.
 */
const telefonoChilenoRegex = /^(\+?56)?(\s?)(9)(\s?)[0-9]{8}$/;

// ==============================================================================
// ESQUEMAS ZOD
// ==============================================================================

const EnrolamientoSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  rut: z.string().refine(validarRutChileno, {
    message: "RUT chileno inválido (verifique el dígito verificador)",
  }),
  email: z.string().email("Correo electrónico inválido"),
  telefono: z.string().regex(telefonoChilenoRegex, "Teléfono inválido. Formato: +56 9 1234 5678"),
  carnet_frontal_url: z.string().url("URL de carnet frontal requerida").optional(),
  carnet_trasero_url: z.string().url("URL de carnet trasero requerida").optional(),
  licencia_url: z.string().url("URL de licencia requerida").optional(),
  tarjeta_token: z.string().optional(),
});

const PublicarAutoSchema = z.object({
  marca: z.string().min(2, "Marca requerida"),
  modelo: z.string().min(2, "Modelo requerido"),
  anio: z.number().int().min(2000, "El auto debe ser del año 2000 o posterior"),
  patente: z.string().refine(validarPatenteChilena, {
    message: "Patente chilena inválida (ej. ABCD-12 o AB-12-34)",
  }),
  tarifa_dia: z.number().positive("La tarifa diaria debe ser mayor a 0"),
  ubicacion_base: z.string().min(3, "Ubicación base requerida en Los Ángeles"),
  fotos: z.array(z.string().url()).min(1, "Debe incluir al menos una foto del vehículo").optional(),
});

const EditarAutoSchema = z.object({
  tarifa_dia: z.number().positive("La tarifa debe ser positiva").optional(),
  estado: z.enum(["activo", "pausado", "mantenimiento"]).optional(),
  ubicacion_base: z.string().min(3).optional(),
  fotos: z.array(z.string().url()).optional(),
});

const CrearReservaSchema = z.object({
  auto_id: z.string().min(1, "Auto requerido"),
  cliente_id: z.string().optional(),
  fecha_inicio: z.string().or(z.date()),
  fecha_fin: z.string().or(z.date()),
  lugar_entrega_acordado: z.string().min(3, "Lugar de entrega requerido en Los Ángeles"),
}).refine((data) => {
  const inicio = new Date(data.fecha_inicio).getTime();
  const fin = new Date(data.fecha_fin).getTime();
  return fin > inicio;
}, {
  message: "La fecha de fin debe ser posterior a la fecha de inicio",
  path: ["fecha_fin"]
});

const RechazoVerificacionSchema = z.object({
  motivo_rechazo: z.string().min(10, "Debe explicar el motivo del rechazo en al menos 10 caracteres"),
  foto_evidencia_url: z.string().url("Debe adjuntar una foto de evidencia").optional(),
});

const ChecklistAutoSchema = z.object({
  kilometraje: z.number().int().positive("Kilometraje debe ser positivo"),
  nivel_combustible: z.enum(["lleno", "3/4", "1/2", "1/4", "vacio"]),
  estado_limpieza: z.enum(["limpio", "sucio_estandar", "sucio_profundo"]).default("limpio"),
  cargo_limpieza_clp: z.number().int().nonnegative().optional(),
  notas: z.string().optional(),
  fotos: z.array(z.string().url()).min(9, "Debe incluir las 9 fotos obligatorias: 4 exterior (frontal, trasera, laterales), 3 interior (asientos, maletero), 1 tablero (combustible/kms) y 1 limpieza"),
});

const ConfiguracionPlataformaSchema = z.object({
  valor_uf_clp: z.number().positive("Valor UF debe ser positivo"),
  comision_plataforma_pct: z.number().min(0).max(100),
  hold_enrolamiento_clp: z.number().int().positive(),
  cargo_limpieza_estandar_clp: z.number().int().nonnegative(),
  cargo_limpieza_profunda_clp: z.number().int().nonnegative(),
  cargo_combustible_cuarto_clp: z.number().int().nonnegative(),
  cargo_km_extra_clp: z.number().int().nonnegative(),
  km_diarios_incluidos: z.number().int().positive(),
  periodo_gracia_minutos: z.number().int().nonnegative(),
});

const DisputaSchema = z.object({
  reserva_id: z.string().min(1),
  tipo: z.enum(["no_coincidencia_identidad", "dano", "limpieza", "combustible", "atraso", "incumplimiento", "otro"]),
  motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
  foto_evidencia_url: z.string().url().optional(),
  evidencia_fotos: z.array(z.string().url()).optional(),
});

const ResolverDisputaSchema = z.object({
  resolucion: z.string().min(10, "La resolución debe tener al menos 10 caracteres"),
  accion_pago: z.enum([
    "reembolso_total",
    "cobro_cliente",
    "division_deducible_50_50",
    "cargo_limpieza_dueno",
    "cargo_combustible_dueno",
    "sin_cobro"
  ]),
});

const TicketSoporteSchema = z.object({
  asunto: z.string().min(5, "El asunto debe tener al menos 5 caracteres"),
  descripcion: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  sucursal_id: z.string().optional(),
});

const CalificacionSchema = z.object({
  reserva_id: z.string().min(1),
  destinatario_id: z.string().min(1),
  autor_rol: z.enum(["dueno", "cliente"]),
  puntaje: z.number().int().min(1).max(5),
  comentario: z.string().optional(),
});

const ConductorAdicionalSchema = z.object({
  nombre: z.string().min(3, "El nombre completo es requerido"),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  telefono: z.string().min(8, "Teléfono debe tener al menos 8 dígitos").optional().or(z.literal("")),
  tipo_documento: z.enum(["rut", "pasaporte", "dni_extranjero"]).default("rut"),
  rut: z.string().optional().refine((val) => !val || validarRutChileno(val), {
    message: "RUT chileno inválido (falla Módulo 11)",
  }),
  numero_documento: z.string().optional(),
  pais_documento: z.string().optional(),
  fecha_nacimiento: z.string().or(z.date()).optional(),
  licencia_pais_emisor: z.string().optional(),
  licencia_numero: z.string().optional(),
  licencia_clase: z.string().optional(),
  licencia_vencimiento: z.string().or(z.date()).optional(),
  pic_url: z.string().url().optional().or(z.literal("")),
  carnet_frontal_url: z.string().url().optional(),
  carnet_trasero_url: z.string().url().optional(),
  licencia_url: z.string().url().optional(),
  selfie_url: z.string().url().optional(),
});

module.exports = {
  validarRutChileno,
  validarPatenteChilena,
  EnrolamientoSchema,
  PublicarAutoSchema,
  EditarAutoSchema,
  CrearReservaSchema,
  RechazoVerificacionSchema,
  ChecklistAutoSchema,
  ConfiguracionPlataformaSchema,
  DisputaSchema,
  ResolverDisputaSchema,
  TicketSoporteSchema,
  CalificacionSchema,
  ConductorAdicionalSchema,
};
