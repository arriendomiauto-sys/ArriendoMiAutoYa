import * as FileSystem from "expo-file-system";

/**
 * `true` cuando la app corre bajo un test E2E automatizado (Maestro). En ese
 * modo, pantallas que normalmente abren la cámara nativa (sin robot que
 * pueda apuntarla a nada real) usan una foto fija en su lugar — ver
 * `fotoFixtureE2E()`. Se activa con `EXPO_PUBLIC_E2E_TEST=true` en el `.env`
 * usado para compilar el development build de testing, nunca en producción.
 */
export const E2E_TEST_MODE = process.env.EXPO_PUBLIC_E2E_TEST === "true";

// JPEG mínimo válido (2x2 gris). Solo hace falta que sea una imagen real que
// el backend pueda recibir y optimizar — no que se vea a algo en particular.
const FIXTURE_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

let cachedPath = null;

/** Ruta local a una foto fija, sin tocar cámara ni galería. Se escribe una sola vez por proceso. */
export async function fotoFixtureE2E() {
  if (cachedPath) return cachedPath;
  const path = `${FileSystem.cacheDirectory}e2e-fixture.jpg`;
  await FileSystem.writeAsStringAsync(path, FIXTURE_JPEG_BASE64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  cachedPath = path;
  return path;
}
