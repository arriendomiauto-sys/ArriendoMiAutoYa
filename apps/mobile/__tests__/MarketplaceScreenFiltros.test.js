/**
 * Filtros, orden y chips de limpieza rápida en el marketplace.
 *
 * Todo corre client-side sobre el catálogo que ya trajo el contexto — mismo
 * patrón que la categoría, que ya filtraba así: evita un round-trip al
 * backend por cada toque de filtro.
 */
import React from "react";
import { act } from "react-test-renderer";
import { MarketplaceScreen } from "../src/renter/screens/MarketplaceScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const AUTOS = [
  {
    id: "barato-manual",
    marca: "Suzuki",
    modelo: "Alto",
    anio: 2021,
    tarifa_dia: 20000,
    ubicacion_base: "Los Ángeles",
    transmision: "mecanica",
    combustible: "bencina",
    fotos: [],
    rating_promedio: 3.5,
    fecha_publicacion: "2026-01-01T00:00:00Z",
  },
  {
    id: "caro-automatico",
    marca: "Toyota",
    modelo: "RAV4",
    anio: 2023,
    tarifa_dia: 60000,
    ubicacion_base: "Los Ángeles",
    transmision: "automatica",
    combustible: "hibrido",
    fotos: [],
    rating_promedio: 4.9,
    fecha_publicacion: "2026-06-01T00:00:00Z",
  },
  {
    id: "medio-automatico",
    marca: "Hyundai",
    modelo: "Tucson",
    anio: 2022,
    tarifa_dia: 40000,
    ubicacion_base: "Los Ángeles",
    transmision: "automatica",
    combustible: "diesel",
    fotos: [],
    rating_promedio: null,
    fecha_publicacion: "2026-03-01T00:00:00Z",
  },
];

const mockContexto = {
  cars: AUTOS,
  carsError: null,
  currentUser: { estado_documentos: "verificado" },
  loadData: jest.fn(),
  loading: false,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const montar = () =>
  renderTree(<MarketplaceScreen onSelectCar={() => {}} onOpenMap={() => {}} onVerifyIdentity={() => {}} />);

const abrirFiltros = (tr) => {
  const boton = tr.root.findAll(
    (n) => n.props?.accessibilityLabel === "Filtros y orden" || /Filtros, \d+ activos/.test(n.props?.accessibilityLabel || "")
  )[0];
  act(() => boton.props.onPress());
};

describe("Marketplace · filtros y orden", () => {
  it("de entrada muestra los tres autos, sin filtros activos", () => {
    const t = textOf(montar());
    expect(t).toContain("3 autos disponibles");
    expect(t).not.toContain("Limpiar todo");
  });

  it("filtra por transmisión", () => {
    const tr = montar();
    abrirFiltros(tr);
    pressText(tr, "Mecánica");
    pressText(tr, "Aplicar");

    const t = textOf(tr);
    expect(t).toContain("1 auto disponible");
    expect(t).toContain("Suzuki Alto");
  });

  it("filtra por combustible", () => {
    const tr = montar();
    abrirFiltros(tr);
    pressText(tr, "Híbrido");
    pressText(tr, "Aplicar");

    const t = textOf(tr);
    expect(t).toContain("1 auto disponible");
    expect(t).toContain("Toyota RAV4");
  });

  it("filtra por tarifa máxima", () => {
    const tr = montar();
    abrirFiltros(tr);
    const input = tr.root.findAll(
      (n) => n.props?.placeholder === "Sin límite" && typeof n.props?.onChangeText === "function"
    )[0];
    act(() => input.props.onChangeText("45000"));
    pressText(tr, "Aplicar");

    const t = textOf(tr);
    expect(t).toContain("2 autos disponibles");
    expect(t).not.toContain("Toyota RAV4");
  });

  it("ordena por menor precio", () => {
    const tr = montar();
    abrirFiltros(tr);
    pressText(tr, "Menor precio");
    pressText(tr, "Aplicar");

    const t = textOf(tr);
    expect(t.indexOf("Suzuki")).toBeLessThan(t.indexOf("Toyota"));
  });

  it("ordena por mejor calificados, dejando los sin calificación al final", () => {
    const tr = montar();
    abrirFiltros(tr);
    pressText(tr, "Mejor calificados");
    pressText(tr, "Aplicar");

    const t = textOf(tr);
    // Toyota (4.9) primero; Hyundai (sin rating) al final, no arriba de nadie.
    expect(t.indexOf("Toyota")).toBeLessThan(t.indexOf("Suzuki"));
    expect(t.indexOf("Hyundai")).toBeGreaterThan(t.indexOf("Suzuki"));
  });

  it("el orden por defecto es el más reciente", () => {
    const t = textOf(montar());
    // Toyota se publicó en junio, Hyundai en marzo, Suzuki en enero.
    expect(t.indexOf("Toyota")).toBeLessThan(t.indexOf("Hyundai"));
    expect(t.indexOf("Hyundai")).toBeLessThan(t.indexOf("Suzuki"));
  });

  it("un chip de filtro activo se puede quitar con un toque, sin abrir el modal", () => {
    const tr = montar();
    abrirFiltros(tr);
    pressText(tr, "Mecánica");
    pressText(tr, "Aplicar");
    expect(textOf(tr)).toContain("Mecánica");

    pressText(tr, "Limpiar todo");
    expect(textOf(tr)).toContain("3 autos disponibles");
    expect(textOf(tr)).not.toContain("Limpiar todo");
  });

  it("Limpiar en el modal borra los filtros sin cerrar en un estado a medias", () => {
    const tr = montar();
    abrirFiltros(tr);
    pressText(tr, "Mecánica");
    pressText(tr, "Limpiar");

    expect(textOf(tr)).toContain("3 autos disponibles");
  });
});
