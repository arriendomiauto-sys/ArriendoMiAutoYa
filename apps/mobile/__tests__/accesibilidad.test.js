/**
 * Accesibilidad de los componentes compartidos.
 *
 * Son los ladrillos de toda la app: un botón sin rol ni etiqueta acá se
 * multiplica por cada pantalla. Estos casos fijan lo mínimo para que un lector
 * de pantalla pueda operar la app y para que los estados (cargando, marcado,
 * seleccionado, error) no vivan solo en el color.
 */
import React from "react";
import { Button, Chip, Checkbox, ScreenHeader, MenuRow, Field } from "@rentacar/mobile-shared";
import { renderTree } from "../test-utils";

// Devuelve el primer nodo con rol de accesibilidad `rol`.
const porRol = (tr, rol) =>
  tr.root.findAll((n) => n.props?.accessibilityRole === rol && typeof n.props?.onPress === "function")[0];

describe("Button", () => {
  it("se anuncia como botón con su etiqueta", () => {
    const tr = renderTree(<Button label="Publicar auto" onPress={() => {}} />);
    const btn = porRol(tr, "button");

    expect(btn.props.accessibilityLabel).toBe("Publicar auto");
    expect(btn.props.accessibilityState.disabled).toBe(false);
  });

  it("mientras carga conserva la etiqueta y avisa que está ocupado", () => {
    // Es el caso crítico: el texto se reemplaza por el spinner, así que sin
    // accessibilityLabel el botón quedaba mudo justo durante la espera.
    const tr = renderTree(<Button label="Subiendo fotos" onPress={() => {}} loading />);
    const btn = porRol(tr, "button");

    expect(btn.props.accessibilityLabel).toBe("Subiendo fotos");
    expect(btn.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it("un botón deshabilitado lo declara", () => {
    const tr = renderTree(<Button label="Continuar" onPress={() => {}} disabled />);
    expect(porRol(tr, "button").props.accessibilityState.disabled).toBe(true);
  });
});

describe("Chip", () => {
  it("declara si el filtro está seleccionado, no solo con color", () => {
    const activo = renderTree(<Chip label="SUV" selected onPress={() => {}} />);
    const inactivo = renderTree(<Chip label="SUV" onPress={() => {}} />);

    expect(porRol(activo, "button").props.accessibilityState.selected).toBe(true);
    expect(porRol(inactivo, "button").props.accessibilityState.selected).toBe(false);
  });

  it("amplía el área táctil, porque mide menos de 44 px de alto", () => {
    const tr = renderTree(<Chip label="SUV" onPress={() => {}} />);
    expect(porRol(tr, "button").props.hitSlop).toBeTruthy();
  });
});

describe("Checkbox", () => {
  it("se anuncia como casilla y expone si está marcada", () => {
    const tr = renderTree(<Checkbox checked label="Acepto los términos" onToggle={() => {}} />);
    const caja = porRol(tr, "checkbox");

    expect(caja.props.accessibilityLabel).toBe("Acepto los términos");
    expect(caja.props.accessibilityState.checked).toBe(true);
  });
});

describe("ScreenHeader", () => {
  it("el botón de volver, que solo tiene un icono, lleva nombre", () => {
    const tr = renderTree(<ScreenHeader title="Mis autos" onBack={() => {}} />);
    expect(porRol(tr, "button").props.accessibilityLabel).toBe("Volver");
  });
});

describe("MenuRow", () => {
  it("anuncia la etiqueta junto con su dato de la derecha", () => {
    const tr = renderTree(<MenuRow icon="car" label="Mis autos" meta="3" onPress={() => {}} />);
    expect(porRol(tr, "button").props.accessibilityLabel).toBe("Mis autos, 3");
  });
});

describe("Field", () => {
  it("reenvía la ref al input, que es lo que permite saltar de campo", () => {
    const ref = React.createRef();
    renderTree(<Field label="Correo" value="" onChangeText={() => {}} ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it("el error se anuncia, no queda solo en rojo", () => {
    const tr = renderTree(
      <Field label="Correo" value="" onChangeText={() => {}} error="Correo inválido" />
    );
    const alerta = tr.root.findAll((n) => n.props?.accessibilityRole === "alert")[0];
    expect(alerta).toBeTruthy();
  });

  it("el ojo de la contraseña dice qué hace", () => {
    const tr = renderTree(<Field label="Clave" value="" onChangeText={() => {}} secure />);
    const ojo = porRol(tr, "button");
    expect(ojo.props.accessibilityLabel).toBe("Mostrar la contraseña");
  });
});
