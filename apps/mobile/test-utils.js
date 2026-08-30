/* Utilidades mínimas de test sobre react-test-renderer (sin RNTL). */
import TestRenderer, { act } from "react-test-renderer";

export function renderTree(element) {
  let tr;
  act(() => {
    tr = TestRenderer.create(element);
  });
  return tr;
}

// Concatena todo el texto (children string) del árbol renderizado.
export function textOf(testRenderer) {
  const out = [];
  const walk = (node) => {
    if (node == null) return;
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.children) walk(node.children);
  };
  walk(testRenderer.toJSON());
  return out.join("").replace(/\s+/g, " ").trim();
}

// Busca el primer nodo cuyo texto plano contiene `needle` y le dispara onPress.
export function pressText(testRenderer, needle) {
  const flat = (c) => (Array.isArray(c) ? c.filter((x) => typeof x === "string").join("") : c);
  const match = testRenderer.root.findAll((n) => {
    const c = flat(n.props?.children);
    return typeof c === "string" && c.includes(needle);
  });
  // sube hasta el ancestro con onPress
  let node = match[0];
  while (node && !node.props?.onPress) node = node.parent;
  if (!node) throw new Error(`No hay onPress cerca de "${needle}"`);
  const deshabilitado =
    node.props.disabled === true || node.props.accessibilityState?.disabled === true;
  if (deshabilitado) return; // un TouchableOpacity disabled ignora el press
  act(() => node.props.onPress());
}
