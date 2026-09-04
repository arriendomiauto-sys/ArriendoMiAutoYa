/**
 * Bancos y tipos de cuenta para el formulario de cuenta bancaria del dueño.
 *
 * Antes "Banco" y "Tipo de cuenta" eran texto libre: un dueño escribía
 * "bco estado" y otro "BancoEstado", y soporte tenía que descifrar a mano
 * a cuál banco real correspondía cada transferencia manual. El universo de
 * bancos con operación retail en Chile es finito (lo fija la CMF), así que
 * no hay razón para dejarlo abierto como si fuera el modelo de un auto.
 */

export const BANCOS_CHILE = [
  "Banco de Chile",
  "Banco Internacional",
  "Scotiabank Chile",
  "BCI",
  "Banco BICE",
  "HSBC Bank Chile",
  "Banco Santander Chile",
  "Banco Itaú Chile",
  "Banco Security",
  "Banco Falabella",
  "Banco Ripley",
  "Banco Consorcio",
  "Banco Estado",
  "Coopeuch",
  "Banco Edwards",
];

export function buscarBancos(consulta) {
  const q = (consulta || "").trim().toLowerCase();
  if (!q) return BANCOS_CHILE;
  const empiezan = BANCOS_CHILE.filter((b) => b.toLowerCase().startsWith(q));
  const contienen = BANCOS_CHILE.filter(
    (b) => !b.toLowerCase().startsWith(q) && b.toLowerCase().includes(q)
  );
  return [...empiezan, ...contienen];
}

export function esBancoConocido(banco) {
  return BANCOS_CHILE.some((b) => b.toLowerCase() === (banco || "").trim().toLowerCase());
}

/**
 * Tipos de cuenta bancaria chilena. A diferencia de los bancos, son solo
 * cuatro y se eligen, no se escriben — evita variantes como "corriente",
 * "Cta Cte" o "CC" para lo mismo.
 */
export const TIPOS_CUENTA_CHILE = ["Cuenta Corriente", "Cuenta Vista", "Cuenta RUT", "Cuenta de Ahorro"];
