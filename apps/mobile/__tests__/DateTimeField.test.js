import React from "react";
import { DateTimeField, aISOLocal, formatearFechaHora } from "@rentacar/mobile-shared";
import { renderTree, textOf, pressText } from "../test-utils";

// Fecha fija para que el calendario no dependa del día en que corren los tests.
const VALOR = new Date(2026, 8, 15, 10, 0); // 15 de septiembre de 2026, 10:00

describe("DateTimeField", () => {
  it("muestra la fecha y la hora elegidas, sin pedir que se escriban", () => {
    const t = textOf(renderTree(<DateTimeField label="Retiro" value={VALOR} onChange={() => {}} />));
    expect(t).toContain("Retiro");
    expect(t).toContain("10:00");
    expect(t).not.toContain("AAAA-MM-DD");
    expect(t).not.toContain("HH:MM");
  });

  it("abre el calendario del mes del valor actual al tocar el campo", () => {
    const tr = renderTree(<DateTimeField label="Retiro" value={VALOR} onChange={() => {}} />);
    expect(textOf(tr)).not.toContain("Septiembre 2026");

    pressText(tr, "10:00");
    const t = textOf(tr);
    expect(t).toContain("Septiembre 2026");
    expect(t).toContain("Hora");
  });

  it("devuelve la fecha elegida en el calendario conservando la hora", () => {
    const onChange = jest.fn();
    const tr = renderTree(<DateTimeField label="Retiro" value={VALOR} onChange={onChange} />);

    pressText(tr, "10:00");
    pressText(tr, "22");
    pressText(tr, "Confirmar");

    expect(onChange).toHaveBeenCalledTimes(1);
    const elegida = onChange.mock.calls[0][0];
    expect(aISOLocal(elegida)).toBe("2026-09-22T10:00:00");
  });

  it("permite cambiar la hora desde la grilla de horarios", () => {
    const onChange = jest.fn();
    const tr = renderTree(<DateTimeField label="Retiro" value={VALOR} onChange={onChange} />);

    pressText(tr, "10:00");
    pressText(tr, "18:30");
    pressText(tr, "Confirmar");

    expect(aISOLocal(onChange.mock.calls[0][0])).toBe("2026-09-15T18:30:00");
  });

  it("no deja elegir días anteriores al mínimo", () => {
    const onChange = jest.fn();
    const tr = renderTree(
      <DateTimeField label="Devolución" value={VALOR} onChange={onChange} minimumDate={VALOR} />
    );

    pressText(tr, "10:00");
    pressText(tr, "14"); // día anterior al mínimo: el TouchableOpacity está disabled
    pressText(tr, "Confirmar");

    // La selección no se movió del valor original.
    expect(aISOLocal(onChange.mock.calls[0][0])).toBe("2026-09-15T10:00:00");
  });
});

describe("aISOLocal", () => {
  it("serializa en hora local, sin correr la reserva por el huso horario", () => {
    expect(aISOLocal(new Date(2026, 0, 5, 9, 5))).toBe("2026-01-05T09:05:00");
  });

  it("no explota con valores inválidos", () => {
    expect(aISOLocal(null)).toBeNull();
    expect(aISOLocal(new Date("no es fecha"))).toBeNull();
    expect(formatearFechaHora(undefined)).toBe("");
  });
});
