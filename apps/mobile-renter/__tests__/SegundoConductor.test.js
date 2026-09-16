import React from "react";
import renderer, { act } from "react-test-renderer";
import { ConductorAdicionalSchema } from "@rentacar/shared-schemas";
import { ApiClient } from "@rentacar/mobile-shared";
import { SegundoConductorModal } from "@rentacar/mobile-shared";

describe("Segundo Conductor - Schemas", () => {
  it("valida un conductor chileno con datos correctos", () => {
    const data = {
      nombre: "Carlos Conductor Segundo",
      email: "carlos@rentacar.cl",
      telefono: "+56912345678",
      tipo_documento: "rut",
      rut: "18.456.789-K",
      fecha_nacimiento: "1994-05-10",
      licencia_pais_emisor: "CL",
      licencia_numero: "18.456.789-K",
      licencia_clase: "B",
      licencia_vencimiento: "2028-12-31",
      carnet_frontal_url: "https://storage.supabase.co/doc/carnet-frente.jpg",
      carnet_trasero_url: "https://storage.supabase.co/doc/carnet-dorso.jpg",
      licencia_url: "https://storage.supabase.co/doc/licencia.jpg",
      selfie_url: "https://storage.supabase.co/doc/selfie.jpg",
    };

    const parsed = ConductorAdicionalSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it("rechaza un RUT chileno con dígito verificador inválido", () => {
    const data = {
      nombre: "Conductor RUT Malo",
      tipo_documento: "rut",
      rut: "18.456.789-0", // DV incorrecto
    };

    const parsed = ConductorAdicionalSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });

  it("acepta un conductor extranjero con pasaporte", () => {
    const data = {
      nombre: "John Doe Foreigner",
      tipo_documento: "pasaporte",
      numero_documento: "P12345678",
      pais_documento: "US",
      licencia_pais_emisor: "US",
      licencia_numero: "DL987654",
      licencia_clase: "C",
      licencia_vencimiento: "2027-01-01",
    };

    const parsed = ConductorAdicionalSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });
});

describe("Segundo Conductor - ApiClient", () => {
  beforeEach(() => {
    jest.spyOn(ApiClient, "request").mockImplementation(async (path, options) => {
      if (path === "/reservas/res-123/segundo-conductor" && options?.method === "POST") {
        return {
          id: "sc-001",
          reserva_id: "res-123",
          nombre: "Segundo Conductor",
          estado_kyc: "verificado",
        };
      }
      if (path === "/reservas/res-123/segundo-conductor" && !options) {
        return {
          id: "sc-001",
          reserva_id: "res-123",
          nombre: "Segundo Conductor",
          estado_kyc: "verificado",
        };
      }
      if (path === "/reservas/res-123/segundo-conductor" && options?.method === "DELETE") {
        return { mensaje: "Eliminado" };
      }
      return {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("llama a asignarSegundoConductor correctamente", async () => {
    const res = await ApiClient.asignarSegundoConductor("res-123", {
      nombre: "Segundo Conductor",
    });
    expect(res.estado_kyc).toBe("verificado");
    expect(ApiClient.request).toHaveBeenCalledWith(
      "/reservas/res-123/segundo-conductor",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("llama a obtenerSegundoConductor correctamente", async () => {
    const res = await ApiClient.obtenerSegundoConductor("res-123");
    expect(res.id).toBe("sc-001");
  });

  it("llama a eliminarSegundoConductor correctamente", async () => {
    const res = await ApiClient.eliminarSegundoConductor("res-123");
    expect(res.mensaje).toBe("Eliminado");
  });
});

describe("Segundo Conductor - Modal UI", () => {
  it("se renderiza sin crashear", () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SegundoConductorModal
          visible={true}
          reservaId="res-123"
          onClose={() => {}}
        />
      );
    });
    expect(tree.toJSON()).toBeTruthy();
  });
});
