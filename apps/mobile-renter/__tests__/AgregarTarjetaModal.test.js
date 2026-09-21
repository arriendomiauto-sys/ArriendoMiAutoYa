import React from "react";
import { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { AgregarTarjetaModal } from "@rentacar/mobile-shared";
import { VistaTarjeta } from "@rentacar/mobile-shared/components/VistaTarjeta";
import { renderTree, textOf } from "../test-utils";

let mockConfigMP = { publicKey: "", tienePublicKey: false, modoPrueba: true, puedeContactarMP: false };
const mockConsultarMetodoPago = jest.fn();

jest.mock("@rentacar/mobile-shared/api/mercadopago", () => ({
  configMercadoPago: () => mockConfigMP,
  consultarMetodoPago: (...a) => mockConsultarMetodoPago(...a),
  crearCardToken: jest.fn(),
}));

const asentar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const escribirNumero = async (tr, texto) => {
  const campo = tr.root.findAllByType(TextInput).find((i) => i.props.placeholder === "4242 4242 4242 4242");
  await act(async () => {
    campo.props.onChangeText(texto);
  });
  await asentar();
};

describe("VistaTarjeta", () => {
  it("completa con puntos lo que falta del número y avisa el formato del vencimiento", () => {
    const t = textOf(renderTree(<VistaTarjeta numero="" vencimiento="" titular="" />));
    expect(t).toContain("•••• •••• •••• ••••");
    expect(t).toContain("MM/AA");
  });

  it("muestra la marca, el número tecleado, el titular en mayúsculas y el vencimiento", () => {
    const t = textOf(
      renderTree(<VistaTarjeta numero="4242 4242" vencimiento="08/28" titular="Camila Rojas Fuentes" />)
    );
    expect(t).toContain("VISA");
    expect(t).toContain("4242 4242 •••• ••••");
    expect(t).toContain("CAMILA ROJAS FUENTES");
    expect(t).toContain("08/28");
  });

  it("no inventa marca mientras el prefijo no la delata", () => {
    const t = textOf(renderTree(<VistaTarjeta numero="" vencimiento="" titular="" />));
    expect(t).not.toContain("VISA");
    expect(t).toContain("TARJETA");
  });
});

describe("AgregarTarjetaModal · tarjeta en vivo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigMP = { publicKey: "", tienePublicKey: false, modoPrueba: true, puedeContactarMP: false };
    mockConsultarMetodoPago.mockResolvedValue(null);
  });

  it("dibuja la tarjeta con el titular verificado y sigue lo que se escribe", async () => {
    const tr = renderTree(
      <AgregarTarjetaModal visible onClose={() => {}} onAgregar={jest.fn()} nombreTitular="Camila Rojas Fuentes" />
    );
    await asentar();
    expect(textOf(tr)).toContain("CAMILA ROJAS FUENTES");

    await escribirNumero(tr, "4242424242424242");
    expect(textOf(tr)).toContain("4242 4242 4242 4242");
  });
});

describe("AgregarTarjetaModal · tipo detectado por Mercado Pago", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigMP = { publicKey: "TEST-abc", tienePublicKey: true, modoPrueba: true, puedeContactarMP: true };
  });

  it("consulta el tipo con los primeros dígitos y lo muestra como detectado", async () => {
    mockConsultarMetodoPago.mockResolvedValue({ payment_method_id: "debvisa", tipo: "debito" });
    const tr = renderTree(<AgregarTarjetaModal visible onClose={() => {}} onAgregar={jest.fn()} nombreTitular="Camila" />);
    await asentar();
    await escribirNumero(tr, "4242424242424242");

    expect(mockConsultarMetodoPago).toHaveBeenCalledTimes(1);
    expect(mockConsultarMetodoPago.mock.calls[0][0]).toBe("42424242");
    expect(textOf(tr)).toContain("Débito · detectado");
  });

  it("no consulta hasta tener 6 dígitos", async () => {
    const tr = renderTree(<AgregarTarjetaModal visible onClose={() => {}} onAgregar={jest.fn()} nombreTitular="Camila" />);
    await asentar();
    await escribirNumero(tr, "42424");
    expect(mockConsultarMetodoPago).not.toHaveBeenCalled();
    expect(textOf(tr)).not.toContain("detectado");
  });

  it("no marca nada como detectado si Mercado Pago no reconoce la tarjeta", async () => {
    mockConsultarMetodoPago.mockResolvedValue(null);
    const tr = renderTree(<AgregarTarjetaModal visible onClose={() => {}} onAgregar={jest.fn()} nombreTitular="Camila" />);
    await asentar();
    await escribirNumero(tr, "4242424242424242");
    expect(mockConsultarMetodoPago).toHaveBeenCalled();
    expect(textOf(tr)).not.toContain("detectado");
  });

  it("aclara que los datos viajan directo a Mercado Pago", async () => {
    mockConsultarMetodoPago.mockResolvedValue(null);
    const tr = renderTree(<AgregarTarjetaModal visible onClose={() => {}} onAgregar={jest.fn()} nombreTitular="Camila" />);
    await asentar();
    expect(textOf(tr)).toContain("viajan directo a Mercado Pago");
  });

  it("sin pasarela (modo simulado) no promete lo que no ocurre ni consulta nada", async () => {
    mockConfigMP = { publicKey: "", tienePublicKey: false, modoPrueba: true, puedeContactarMP: false };
    const tr = renderTree(<AgregarTarjetaModal visible onClose={() => {}} onAgregar={jest.fn()} nombreTitular="Camila" />);
    await asentar();
    await escribirNumero(tr, "4242424242424242");
    expect(mockConsultarMetodoPago).not.toHaveBeenCalled();
    expect(textOf(tr)).not.toContain("viajan directo a Mercado Pago");
  });
});
