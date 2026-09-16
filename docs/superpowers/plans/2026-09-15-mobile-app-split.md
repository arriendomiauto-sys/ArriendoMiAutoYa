# Separar RentACar-mobile en mobile-renter y mobile-owner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el binario único `apps/mobile` (que hoy muestra `RenterApp` u `OwnerApp` según un `mode` en memoria/AsyncStorage) en dos apps Expo independientes — `apps/mobile-renter` y `apps/mobile-owner` — cada una publicable por separado, compartiendo `packages/mobile-shared` sin duplicarlo.

**Architecture:** `apps/mobile` se renombra a `apps/mobile-renter` conservando su identidad de publicación (bundleId/scheme/proyecto EAS actuales) para no afectar usuarios ya instalados. `apps/mobile-owner` es un proyecto Expo nuevo con identidad propia. `packages/mobile-shared` no se mueve; se le agregan dos puntos de extensión mínimos y no disruptivos (`AuthFlow` con rol fijo opcional, `AppProvider` con modo inicial fijo opcional) para que cada app pueda arrancar siempre en un solo rol sin reescribir el mecanismo de transición/login que ya existe y que ambas apps siguen necesitando (login, logout, splash).

**Tech Stack:** Expo SDK 57, React Native 0.86.3, React 19.2.3, npm workspaces, Jest + jest-expo + react-test-renderer.

**Spec:** `docs/superpowers/specs/2026-09-15-mobile-app-split-design.md`

## Global Constraints

- La app arrendatario (`mobile-renter`) conserva EXACTAMENTE el `bundleIdentifier` (`cl.arriendatuauto.app`), `scheme` (`arriendatuauto`) y proyecto EAS (`2b05af04-600a-4544-bc16-85fe714c68fb`) que ya tiene hoy `apps/mobile` — cero cambios de identidad de publicación.
- `packages/mobile-shared` no se duplica ni se mueve de lugar; los cambios ahí deben ser aditivos y no romper el comportamiento por defecto (nada de lo que ya usa `apps/mobile` hoy puede cambiar de comportamiento sin pasar un prop nuevo explícito).
- No se toca `android/` (no está trackeado en git, es artefacto de `expo prebuild` — se regenera solo) ni se inventan valores de `EAS projectId` — ese id lo genera `eas init`/`eas build:configure` de verdad, no un plan.
- Todo comentario, mensaje de error y texto de UI nuevo va en español, seg��n la convención ya establecida en el repo.
- No commitear nada salvo que el usuario lo pida explícitamente (los pasos de "Commit" de este plan quedan preparados pero la ejecución real de `git commit` la confirma quien ejecuta el plan con el usuario primero, salvo que ya se haya acordado lo contrario).
- No se borra ni se reescribe el mecanismo `mode`/`transition`/`setMode` de `AppContext.js` — se decidió (ver "Decisión de diseño" abajo) dejarlo intacto y solo dejar de exponer su UI de cambio de rol en cada app, por riesgo/beneficio: ese mecanismo es también el que tapa las transiciones de login/logout (`SwitchingScreen`), no es exclusivo del selector de rol.

## Decisión de diseño (documentada, no está en el spec original tal cual)

El spec original decía "se elimina de AppContext... `mode`, `transition` y las funciones que lo manejan". Al investigar el código real se encontró que `transition`/`setTransition`/`SwitchingScreen` se reutilizan para TODAS las transiciones de cuenta (`login`, `loginConProveedor`, `logout`), no solo para el cambio de rol — eliminarlas de verdad implicaría reescribir la UX de login/logout de las dos apps como parte de esta migración, mucho más riesgo del que pide el objetivo real (que cada app muestre un solo rol, sin selector). Esta plan mantiene el mecanismo intacto en `mobile-shared` y en cada app nueva:

1. Fija el `mode` inicial de `AppContext` al valor correspondiente (`renter` u `owner`) vía un prop nuevo opcional (`initialMode`) que si no se pasa no cambia nada de lo que existe hoy.
2. Quita de cada app el botón/fila que deja cambiar al OTRO rol (`ModeSwitchRow` + el handler que lo dispara), que es la única parte que de verdad expone la funcionalidad de "selector de rol" al usuario.

`ModeSwitchRow` queda sin uso en `mobile-shared` tras esto — se deja así (no se borra) para no tocar un componente presentacional inofensivo en una migración ya grande; es candidato a limpieza en un pase aparte, no en este plan.

## File Structure

```
RentACar-mobile/
  package.json                          (MODIFICAR: scripts de start/android/ios/web)
  apps/
    mobile-renter/                      (RENOMBRADO desde apps/mobile, vía git mv)
      App.js                            (MODIFICAR: quita el switch de mode, monta solo RenterApp)
      app.json                          (SIN CAMBIOS)
      package.json                      (SIN CAMBIOS de contenido, salvo lo que ya traía)
      src/
        renter/                         (SIN CAMBIOS, se queda)
        owner/                          (SE ELIMINA de acá — se mueve a mobile-owner en la Task 6)
      __tests__/                        (quedan los tests RENTER + SHARED; los OWNER se mueven)
    mobile-owner/                       (NUEVO proyecto Expo)
      App.js                            (NUEVO: monta OwnerApp + gate de Mandato)
      app.json                          (NUEVO: identidad propia)
      package.json                      (NUEVO: mismas dependencias que mobile-renter)
      eas.json                          (NUEVO: copiado de mobile-renter)
      metro.config.js                   (NUEVO: copiado tal cual, ya es portable)
      index.js                          (NUEVO: copiado tal cual)
      jest-setup.js                     (NUEVO: copiado tal cual)
      test-utils.js                     (NUEVO: copiado tal cual)
      src/
        owner/                          (MOVIDO desde mobile-renter/src/owner)
      __tests__/                        (tests OWNER movidos + tests SHARED copiados)
      assets/                           (NUEVO: copiado de mobile-renter; íconos/splash a reemplazar después por el cliente)
  packages/
    mobile-shared/
      context/AppContext.js             (MODIFICAR: agrega `initialMode` opcional a AppProvider)
      auth/AuthFlow.js                  (MODIFICAR: agrega `fixedRole` opcional)
      auth/screens/WelcomeScreen.js     (MODIFICAR: si `fixedRole` viene, no muestra el selector de 2 tarjetas)
```

## Global test note

Cada `- [ ] Run tests` de este plan corre desde la carpeta de la app correspondiente:
```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
cd "RentACar-mobile/apps/mobile-owner" && npm test
```

---

### Task 1: Renombrar apps/mobile a apps/mobile-renter

**Files:**
- Move: `apps/mobile/**` → `apps/mobile-renter/**` (git mv, preserva historial)
- Modify: `package.json:10-13` (raíz del monorepo)

**Interfaces:**
- Produces: la carpeta `apps/mobile-renter` con el contenido idéntico a `apps/mobile` de hoy — todas las tasks siguientes parten de acá.

- [ ] **Step 1: Confirmar que no hay cambios sin commitear que se puedan perder**

```bash
cd "RentACar-mobile" && git status
```

Si hay cambios sin commitear de trabajo previo (por ejemplo el zoom de cámara, PhotoViewer, etc.), NO seguir sin confirmar con el usuario si hay que commitear eso primero — este plan asume que se parte de un working tree limpio o de cambios ya conocidos por el usuario.

- [ ] **Step 2: Renombrar el directorio con git mv**

```bash
cd "RentACar-mobile" && git mv apps/mobile apps/mobile-renter
```

- [ ] **Step 3: Actualizar los scripts del package.json raíz**

Editar `RentACar-mobile/package.json`, reemplazando el bloque `scripts`:

```json
  "scripts": {
    "start": "npm --prefix apps/mobile-renter start",
    "start:owner": "npm --prefix apps/mobile-owner start",
    "android": "npm --prefix apps/mobile-renter run android",
    "android:owner": "npm --prefix apps/mobile-owner run android",
    "ios": "npm --prefix apps/mobile-renter run ios",
    "ios:owner": "npm --prefix apps/mobile-owner run ios",
    "web": "npm --prefix apps/mobile-renter run web",
    "web:owner": "npm --prefix apps/mobile-owner run web",
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:maestro": "powershell -File .maestro/correr_todos_los_flujos.ps1"
  },
```

- [ ] **Step 4: Reinstalar dependencias del workspace (los symlinks de node_modules apuntaban al nombre viejo de carpeta)**

```bash
cd "RentACar-mobile" && npm install
```

- [ ] **Step 5: Correr la suite completa de mobile-renter para confirmar que el rename no rompió nada**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
```

Expected: 77 suites / 359 tests, igual que antes del rename (los tests todavía no se movieron, así que el número no cambia en esta task).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(mobile): renombra apps/mobile a apps/mobile-renter"
```

---

### Task 2: Agregar `initialMode` a AppProvider (mobile-shared)

**Files:**
- Modify: `packages/mobile-shared/context/AppContext.js:46-120`
- Test: `apps/mobile-renter/__tests__/AppContextModoFijo.test.js` (NUEVO)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `AppProvider({ children, initialMode })` — si `initialMode` es `"renter"` o `"owner"`, el contexto arranca y se queda fijo en ese modo, sin leer ni escribir `MODE_STORAGE_KEY`. Si `initialMode` es `undefined` (como hoy en `mobile-renter`... y en cualquier consumidor viejo), el comportamiento es IDÉNTICO al actual (lee de AsyncStorage, default `"renter"`).

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/mobile-renter/__tests__/AppContextModoFijo.test.js`:

```javascript
import React from "react";
import { act } from "react-test-renderer";
import { AppProvider, useApp } from "@rentacar/mobile-shared";
import { renderTree } from "../test-utils";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

function Sonda({ onListo }) {
  const { mode } = useApp();
  onListo(mode);
  return null;
}

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("AppProvider · modo inicial fijo", () => {
  it("con initialMode='owner' el contexto arranca y se queda en modo owner", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("@rentacar/mode", "renter");

    let modoVisto = null;
    renderTree(
      <AppProvider initialMode="owner">
        <Sonda onListo={(m) => { modoVisto = m; }} />
      </AppProvider>
    );
    await asentar();

    // Aunque el storage diga "renter" de una sesión vieja, initialMode manda.
    expect(modoVisto).toBe("owner");
  });

  it("sin initialMode, se comporta como siempre: lee el modo guardado", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("@rentacar/mode", "owner");

    let modoVisto = null;
    renderTree(
      <AppProvider>
        <Sonda onListo={(m) => { modoVisto = m; }} />
      </AppProvider>
    );
    await asentar();

    expect(modoVisto).toBe("owner");
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npx jest AppContextModoFijo --no-coverage
```

Expected: FAIL — `AppProvider` no acepta `initialMode` todavía, el primer caso da `modoVisto === "renter"` (el storage gana) en vez de `"owner"`.

- [ ] **Step 3: Implementar `initialMode` en AppContext.js**

En `packages/mobile-shared/context/AppContext.js`, modificar la firma y el estado inicial (reemplaza la línea 46 y 51):

```javascript
export function AppProvider({ children, initialMode }) {
```

```javascript
  const [mode, setModeState] = useState(initialMode || "renter");
```

Y el `modeRef` (línea 71):

```javascript
  const modeRef = useRef(initialMode || "renter");
```

Y el efecto de rehidratación (reemplazar el bloque completo de las líneas 97-120):

```javascript
  // Rehidrata el modo elegido en la sesión anterior y si ya se vio el
  // onboarding, antes de pintar la app. Si `initialMode` viene fijo (apps
  // separadas mobile-renter/mobile-owner, cada una con un solo rol posible),
  // el modo NUNCA se lee ni se sobreescribe desde el storage — evita que una
  // instalación vieja del binario único deje un valor guardado que no aplica.
  useEffect(() => {
    let alive = true;
    const claves = initialMode ? [ONBOARDING_STORAGE_KEY] : [MODE_STORAGE_KEY, ONBOARDING_STORAGE_KEY];
    AsyncStorage.multiGet(claves)
      .then((pares) => {
        if (!alive) return;
        const guardado = Object.fromEntries(pares);
        if (!initialMode) {
          const modoGuardado = guardado[MODE_STORAGE_KEY];
          if (VALID_MODES.includes(modoGuardado)) {
            modeRef.current = modoGuardado;
            setModeState(modoGuardado);
          }
        }
        setOnboardingVisto(guardado[ONBOARDING_STORAGE_KEY] === "1");
      })
      .catch(() => {
        // Si el almacenamiento falla se muestra el onboarding: es preferible
        // repetirlo a dejar la app trancada esperando una lectura que no llega.
        if (alive) setOnboardingVisto(false);
      });
    return () => {
      alive = false;
    };
  }, [initialMode]);
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npx jest AppContextModoFijo --no-coverage
```

Expected: PASS, ambos casos.

- [ ] **Step 5: Correr toda la suite de mobile-renter para confirmar que no se rompió nada del comportamiento por defecto**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
```

Expected: 78 suites / 361 tests (77+1 archivo nuevo, 359+2 tests nuevos).

- [ ] **Step 6: Commit**

```bash
git add packages/mobile-shared/context/AppContext.js apps/mobile-renter/__tests__/AppContextModoFijo.test.js
git commit -m "feat(mobile-shared): AppProvider acepta initialMode fijo, sin cambiar el comportamiento por defecto"
```

---

### Task 3: Agregar `fixedRole` a AuthFlow y WelcomeScreen (mobile-shared)

**Files:**
- Modify: `packages/mobile-shared/auth/AuthFlow.js:34-86`
- Modify: `packages/mobile-shared/auth/screens/WelcomeScreen.js:27-70`
- Test: `apps/mobile-renter/__tests__/AuthFlowRolFijo.test.js` (NUEVO)

**Interfaces:**
- Consumes: nada nuevo de otras tasks.
- Produces: `<AuthFlow fixedRole="owner" />` — cuando se pasa, `WelcomeScreen` no muestra el selector de 2 tarjetas (solo el copy y CTA del rol fijo) y el registro/login usan ese rol sin que el usuario pueda cambiarlo. Sin `fixedRole`, comportamiento idéntico al actual.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/mobile-renter/__tests__/AuthFlowRolFijo.test.js`:

```javascript
import React from "react";
import { act } from "react-test-renderer";
import { AuthFlow } from "@rentacar/mobile-shared";
import { renderTree, textOf } from "../test-utils";

const mockContexto = { onboardingVisto: true, marcarOnboardingVisto: jest.fn() };
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

function avanzar(ms) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe("AuthFlow · rol fijo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("con fixedRole='owner' la bienvenida no ofrece elegir el otro rol", () => {
    const tr = renderTree(<AuthFlow fixedRole="owner" />);
    avanzar(700);

    const t = textOf(tr);
    expect(t).toContain("Quiero publicar mi auto");
    expect(t).not.toContain("Quiero arrendar");
  });

  it("sin fixedRole, la bienvenida ofrece los dos roles como siempre", () => {
    const tr = renderTree(<AuthFlow />);
    avanzar(700);

    const t = textOf(tr);
    expect(t).toContain("Quiero arrendar");
    expect(t).toContain("Quiero publicar mi auto");
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npx jest AuthFlowRolFijo --no-coverage
```

Expected: FAIL en el primer caso — hoy `WelcomeScreen` siempre muestra las 2 tarjetas, `fixedRole` no existe.

- [ ] **Step 3: Implementar `fixedRole` en AuthFlow.js**

En `packages/mobile-shared/auth/AuthFlow.js`, cambiar la firma (línea 34) y el estado de `role` (línea 45):

```javascript
export function AuthFlow({ fixedRole }) {
```

```javascript
  // Rol elegido en la bienvenida: 'renter' (arrendar) | 'owner' (publicar).
  // Si `fixedRole` viene fijo (apps separadas), el rol nunca cambia y la
  // bienvenida no ofrece elegir el otro.
  const [role, setRole] = useState(fixedRole || "renter");
```

Y el paso `welcome` (reemplazar las líneas 75-86):

```javascript
  if (step === "welcome") {
    return (
      <WelcomeScreen
        role={role}
        fixedRole={fixedRole}
        onSelectRole={fixedRole ? undefined : setRole}
        onNavigate={(screen) => {
          if (screen === "login") setStep("login");
          else if (screen === "register") setStep("register");
        }}
      />
    );
  }
```

- [ ] **Step 4: Implementar `fixedRole` en WelcomeScreen.js**

En `packages/mobile-shared/auth/screens/WelcomeScreen.js`, cambiar la firma (línea 27):

```javascript
export function WelcomeScreen({ onNavigate, onSelectRole, role = "renter", fixedRole }) {
```

Y el bloque de selección de rol (reemplazar las líneas 45-70, el `<View style={styles.cardsContainer}>` completo):

```javascript
        {/* Selección de rol: define el modo con el que arranca la app.
            Con `fixedRole`, la app solo tiene un rol posible — se muestra
            nada más la tarjeta de ese rol, sin picker. */}
        <View style={styles.cardsContainer}>
          {ROLE_OPTIONS.filter((opt) => !fixedRole || opt.key === fixedRole).map((opt) => {
            const selected = role === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onSelectRole?.(opt.key)}
                activeOpacity={fixedRole ? 1 : 0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                disabled={!!fixedRole}
              >
                <Card
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  elevated={selected}
                >
                  <View style={styles.cardHeader}>
                    <Icon name={opt.cardIcon} size={24} color={colors.primary} />
                    <Text style={styles.cardTitle}>{opt.cardTitle}</Text>
                  </View>
                  <Text style={styles.cardDesc}>{opt.cardDesc}</Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npx jest AuthFlowRolFijo --no-coverage
```

Expected: PASS, ambos casos.

- [ ] **Step 6: Correr toda la suite de mobile-renter**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
```

Expected: 79 suites / 363 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/mobile-shared/auth/AuthFlow.js packages/mobile-shared/auth/screens/WelcomeScreen.js apps/mobile-renter/__tests__/AuthFlowRolFijo.test.js
git commit -m "feat(mobile-shared): AuthFlow/WelcomeScreen aceptan un rol fijo opcional"
```

---

### Task 4: Simplificar App.js de mobile-renter y quitar el selector de rol de su perfil

**Files:**
- Modify: `apps/mobile-renter/App.js` (reemplazo completo)
- Modify: `apps/mobile-renter/src/renter/screens/RenterProfileScreen.js:1-100` (quitar `ModeSwitchRow`/`handleSwitchToOwner`/`MandatoDuenoModal`)
- Test: correr la suite existente (no hay comportamiento nuevo que probar con un test propio; es remoción de UI ya cubierta indirectamente)

**Interfaces:**
- Consumes: `AppProvider({ initialMode })` de la Task 2, `AuthFlow({ fixedRole })` de la Task 3.
- Produces: `apps/mobile-renter` monta siempre `RenterApp`, nunca `OwnerApp` — el import de `OwnerApp` desaparece de este proyecto (bundle más chico, y de paso dueño no puede llegar a código de dueño desde este binario).

- [ ] **Step 1: Reemplazar App.js completo**

`apps/mobile-renter/App.js`:

```javascript
import React from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  AppProvider,
  useApp,
  colors,
  AuthFlow,
  SwitchingScreen,
  NetworkBanner,
  useNetworkStatus,
  ForceUpdateScreen,
  useVersionCheck,
} from "@rentacar/mobile-shared";
import { RenterApp } from "./src/renter/RenterApp";

// App del Arrendatario, separada de la de Dueño (mobile-owner). Cada una es
// un binario propio con su propio rol fijo — ver
// docs/superpowers/specs/2026-09-15-mobile-app-split-design.md.
function Root() {
  const { isLoggedIn, authLoading, transition } = useApp();
  const { bloqueado, urlStore } = useVersionCheck();

  if (bloqueado) {
    return <ForceUpdateScreen urlStore={urlStore} />;
  }

  if (authLoading) {
    return <SwitchingScreen mode="renter" title="Cargando tu sesión" subtitle="Un segundo, estamos abriendo la app." />;
  }

  return (
    <>
      {isLoggedIn ? <RenterApp /> : <AuthFlow fixedRole="renter" />}
      {transition ? (
        <SwitchingScreen
          overlay
          mode={transition.mode}
          title={transition.title}
          subtitle={transition.subtitle}
        />
      ) : null}
    </>
  );
}

function ThemedFrame() {
  const { isConnected } = useNetworkStatus();
  return (
    <>
      <StatusBar style="dark" translucent />
      <View style={[styles.outerFrame, { backgroundColor: colors.appOuter }]}>
        <SafeAreaView
          style={[styles.appContainer, { backgroundColor: colors.background }]}
          edges={["top", "left", "right"]}
        >
          <View style={styles.bodyContainer}>
            <Root />
            <NetworkBanner visible={!isConnected} />
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider initialMode="renter">
          <ThemedFrame />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  appContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
    elevation: 8,
  },
  bodyContainer: { flex: 1 },
});
```

- [ ] **Step 2: Quitar el selector de rol de RenterProfileScreen.js**

Leer `apps/mobile-renter/src/renter/screens/RenterProfileScreen.js` completo primero (los números de línea de esta task son referenciales, confirmar contra el archivo real antes de editar). Quitar:
- El import de `ModeSwitchRow`, `MandatoDuenoModal`, `verificarMandatoAceptado` de `@rentacar/mobile-shared` (dejar el resto de los imports de esa misma línea).
- `setMode` de la desestructuración de `useApp()`.
- El estado `showMandato` y la función `handleSwitchToOwner`.
- El bloque JSX `<ModeSwitchRow target="owner" .../>`.
- El `<MandatoDuenoModal ... />` renderizado al final del componente.

- [ ] **Step 3: Correr la suite completa de mobile-renter**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
```

Expected: 79 suites / 363 tests, todo en verde (ningún test existente dependía de `ModeSwitchRow` en `RenterProfileScreen` — `RenterProfileAcciones.test.js` es el que cubre esa pantalla, revisar si alguna de sus aserciones esperaba el texto "Cambiar a modo dueño"; si lo esperaba, quitar esa aserción puntual, es comportamiento que se elimina a propósito).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile-renter/App.js apps/mobile-renter/src/renter/screens/RenterProfileScreen.js
git commit -m "feat(mobile-renter): app fija en rol arrendatario, sin selector de modo"
```

---

### Task 5: Scaffold de apps/mobile-owner (proyecto Expo nuevo)

**Files:**
- Create: `apps/mobile-owner/package.json`
- Create: `apps/mobile-owner/app.json`
- Create: `apps/mobile-owner/eas.json`
- Create: `apps/mobile-owner/metro.config.js`
- Create: `apps/mobile-owner/index.js`
- Create: `apps/mobile-owner/jest-setup.js`
- Create: `apps/mobile-owner/test-utils.js`
- Copy: `apps/mobile-renter/assets/` → `apps/mobile-owner/assets/`

**Interfaces:**
- Produces: un proyecto Expo instalable (`npm install` + `npm test` corriendo, aunque todavía sin `src/owner` — eso es la Task 6) con su propia identidad de publicación.

- [ ] **Step 1: Crear `apps/mobile-owner/package.json`**

Copiar el `package.json` completo de `apps/mobile-renter/package.json` y aplicar estos cambios:
- `"name"`: `"arrienda-tu-auto-mobile-owner"` (era `"arrienda-tu-auto-mobile"`).
- Todo lo demás (`dependencies`, `devDependencies`, bloque `"jest"`) queda IGUAL — las dos apps comparten el mismo set de dependencias nativas por ahora; recortar lo que el lado dueño no use (por ejemplo si no usa mapas) queda fuera de este plan, es una optimización aparte.

- [ ] **Step 2: Crear `apps/mobile-owner/app.json`**

```json
{
  "expo": {
    "name": "ArriendoMiAutoYa Dueños",
    "slug": "arrienda-tu-auto-duenos",
    "scheme": "arriendatuautoduenos",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "cl.arriendatuauto.duenos",
      "config": {
        "usesNonExemptEncryption": false
      },
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "ArriendoMiAutoYa Dueños usa tu ubicación para fijar el punto de entrega de tu auto en el mapa.",
        "NSCameraUsageDescription": "ArriendoMiAutoYa Dueños necesita acceso a tu cámara para verificar tu identidad y fotografiar los documentos y fotos de tu auto.",
        "NSPhotoLibraryUsageDescription": "ArriendoMiAutoYa Dueños necesita acceso a tus fotos para publicar tu vehículo y sus documentos.",
        "NSPhotoLibraryAddUsageDescription": "ArriendoMiAutoYa Dueños guarda copias de seguridad de las fotos de entrega."
      }
    },
    "android": {
      "package": "cl.arriendatuauto.duenos",
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSyDDoQbqpICrFbaIkiJ4V3jQAw7USg1BN1c"
        }
      },
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FAFAF9"
      },
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT"
      ],
      "softwareKeyboardLayoutMode": "pan"
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash.png",
          "resizeMode": "contain",
          "backgroundColor": "#FAFAF9"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "ArriendoMiAutoYa Dueños necesita acceso a tus fotos para publicar tu vehículo y verificar tus documentos.",
          "cameraPermission": "ArriendoMiAutoYa Dueños necesita acceso a la cámara para fotografiar el vehículo durante la entrega."
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "ArriendoMiAutoYa Dueños necesita tu cámara para fotografiar tu cédula, tu licencia y tomar la selfie de verificación de identidad."
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "ArriendoMiAutoYa Dueños usa tu ubicación para fijar el punto de entrega de tu auto en el mapa."
        }
      ],
      "expo-web-browser",
      "expo-notifications",
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "ArriendoMiAutoYa Dueños usa Face ID para proteger el acceso a tu cuenta si activas el bloqueo biométrico."
        }
      ],
      [
        "react-native-document-scanner-plugin",
        {
          "cameraPermission": "ArriendoMiAutoYa Dueños necesita tu cámara para escanear tu cédula automáticamente."
        }
      ],
      "@sentry/react-native",
      "expo-secure-store"
    ],
    "owner": "arriendomiautoya"
  }
}
```

Nota: sin bloque `"extra": { "eas": { "projectId": ... } }` a propósito — lo escribe `eas init` (Step 6 de esta task), no se inventa acá. Los íconos/splash apuntan a los mismos archivos que mobile-renter hasta que el cliente entregue una identidad visual propia para la app de dueños (fuera de alcance de este plan, ya señalado en el spec).

- [ ] **Step 3: Copiar `eas.json`, `metro.config.js`, `index.js`, `jest-setup.js`, `test-utils.js`, `assets/`**

```bash
cd "RentACar-mobile/apps"
mkdir -p mobile-owner
cp mobile-renter/eas.json mobile-owner/eas.json
cp mobile-renter/metro.config.js mobile-owner/metro.config.js
cp mobile-renter/index.js mobile-owner/index.js
cp mobile-renter/jest-setup.js mobile-owner/jest-setup.js
cp mobile-renter/test-utils.js mobile-owner/test-utils.js
cp -r mobile-renter/assets mobile-owner/assets
```

- [ ] **Step 4: Copiar el `.env` local (no se commitea, cada dev lo arma con sus propias credenciales; se copia para que el proyecto arranque local ya)**

```bash
cp "RentACar-mobile/apps/mobile-renter/.env" "RentACar-mobile/apps/mobile-owner/.env"
```

- [ ] **Step 5: Instalar dependencias**

```bash
cd "RentACar-mobile" && npm install
```

- [ ] **Step 6: Crear el proyecto EAS real (paso manual, necesita login de `eas`)**

Esto NO se puede scriptear a ciegas — requiere que quien ejecute el plan esté logueado con `eas login` y tenga permiso para crear proyectos en la cuenta/organización `arriendomiautoya`:

```bash
cd "RentACar-mobile/apps/mobile-owner" && npx eas init
```

Esto agrega el bloque `"extra": { "eas": { "projectId": "..." } }` real a `app.json` solo. Si no se puede correr en este momento (sin login a mano), dejar esta task pendiente de ese paso y avisar al usuario — el resto del plan no depende de tener el projectId real todavía (no hace falta para correr tests ni para desarrollo local con Expo Go/dev client existente).

- [ ] **Step 7: Confirmar que el proyecto levanta**

```bash
cd "RentACar-mobile/apps/mobile-owner" && npx expo-doctor
```

Expected: sin errores de configuración (puede haber warnings menores, revisar que no sean bloqueantes).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile-owner package.json
git commit -m "feat(mobile-owner): scaffold del proyecto Expo nuevo (sin src/owner todavía)"
```

---

### Task 6: Mover src/owner y sus tests de mobile-renter a mobile-owner

**Files:**
- Move: `apps/mobile-renter/src/owner/**` → `apps/mobile-owner/src/owner/**`
- Move: los 15 tests OWNER (ver lista abajo) de `apps/mobile-renter/__tests__/` → `apps/mobile-owner/__tests__/`
- Copy: los tests SHARED (ver lista abajo) de `apps/mobile-renter/__tests__/` → `apps/mobile-owner/__tests__/` (se duplican a propósito, ver nota de Global Constraints — cada app testea el shared code que de verdad usa; no se armó un paquete de tests para `mobile-shared` en este plan por alcance)

**Lista de tests OWNER a mover:**
```
CarCalendarOptimista.test.js
CarCalendarReservaPendiente.test.js
CarCalendarScreenNavegacion.test.js
CuentaCobroModal.test.js
DisputesScreenPersistencia.test.js
DriverBookingsPrecheck.test.js
EarningsScreenCuentaBancaria.test.js
EarningsScreenCuentas.test.js
EarningsScreenFlota.test.js
MyCarsScreenPausa.test.js
MyCarsScreenTarifa.test.js
OwnerProfileEliminacion.test.js
PasoDocumentosSinGPS.test.js
enrolarAuto.test.js
fotosAuto.test.js
```

**Lista de tests SHARED a copiar (quedan en ambas apps):**
```
AppContextNotificaciones.test.js AppContextReservas.test.js ChatListScreen.test.js
CobroPosteriorModal.test.js CompletarLicenciaScreen.test.js DateTimeField.test.js
DeliveryScreenDisputa.test.js DeliveryScreenFeedbackQR.test.js DeliveryScreenFirma.test.js
DeliveryScreenFotosOffline.test.js DeliveryScreenSelfie.test.js EditProfileScreen.test.js
FormularioTarjeta.test.js FormularioTarjetaTitular.test.js OcultarPatenteAntesDeEntrega.test.js
RentalChatScreen.test.js ReportFineModal.test.js SegundoConductor.test.js
SegundoConductorDidit.test.js SignaturePad.test.js SwitchingScreen.test.js
accesibilidad.test.js apiClient.test.js authErrors.test.js biometria.test.js
catalogoVehiculos.test.js catalogosFinancieros.test.js chatSocketEntregaConfirmada.test.js
colaFotosOffline.test.js direccion.test.js edad.test.js formato.test.js imagenes.test.js
inicioApp.test.js legal.test.js msjError.test.js sesion.test.js sesionInvalida.test.js
shared-schemas.test.js subidaFotos.test.js subirLicenciaXHR.test.js ui.test.js
useConversaciones.test.js webUrl.test.js
```
(`AuthFlowRolFijo.test.js` y `AppContextModoFijo.test.js`, creados en las Tasks 2 y 3, también se copian a mobile-owner en este paso — prueban `mobile-shared`, no algo específico del renter.)

**Interfaces:**
- Consumes: `apps/mobile-owner` scaffoldeado (Task 5).
- Produces: `apps/mobile-owner` con su propio `src/owner` y su propia suite de tests corriendo de forma independiente.

- [ ] **Step 1: Mover el código de dueño**

```bash
cd "RentACar-mobile"
git mv apps/mobile-renter/src/owner apps/mobile-owner/src/owner
```

- [ ] **Step 2: Mover los tests OWNER**

```bash
cd "RentACar-mobile"
for f in CarCalendarOptimista CarCalendarReservaPendiente CarCalendarScreenNavegacion \
         CuentaCobroModal DisputesScreenPersistencia DriverBookingsPrecheck \
         EarningsScreenCuentaBancaria EarningsScreenCuentas EarningsScreenFlota \
         MyCarsScreenPausa MyCarsScreenTarifa OwnerProfileEliminacion \
         PasoDocumentosSinGPS enrolarAuto fotosAuto; do
  git mv "apps/mobile-renter/__tests__/${f}.test.js" "apps/mobile-owner/__tests__/${f}.test.js"
done
```

- [ ] **Step 3: Copiar (no mover) los tests SHARED, más los dos nuevos de las Tasks 2 y 3**

```bash
cd "RentACar-mobile"
for f in AppContextNotificaciones AppContextReservas ChatListScreen \
         CobroPosteriorModal CompletarLicenciaScreen DateTimeField \
         DeliveryScreenDisputa DeliveryScreenFeedbackQR DeliveryScreenFirma \
         DeliveryScreenFotosOffline DeliveryScreenSelfie EditProfileScreen \
         FormularioTarjeta FormularioTarjetaTitular OcultarPatenteAntesDeEntrega \
         RentalChatScreen ReportFineModal SegundoConductor \
         SegundoConductorDidit SignaturePad SwitchingScreen \
         accesibilidad apiClient authErrors biometria \
         catalogoVehiculos catalogosFinancieros chatSocketEntregaConfirmada \
         colaFotosOffline direccion edad formato imagenes \
         inicioApp legal msjError sesion sesionInvalida \
         shared-schemas subidaFotos subirLicenciaXHR ui \
         useConversaciones webUrl AuthFlowRolFijo AppContextModoFijo; do
  cp "apps/mobile-renter/__tests__/${f}.test.js" "apps/mobile-owner/__tests__/${f}.test.js"
done
```

- [ ] **Step 4: Corregir el import de OwnerApp en el nuevo App.js (todavía no existe — se hace en la Task 7, pero confirmar que nada en `src/owner` movido quedó con una ruta relativa rota)**

```bash
cd "RentACar-mobile/apps/mobile-owner" && grep -rn "\.\./\.\./\.\./" src/owner | grep -v node_modules
```

Si aparece algo, son imports relativos que subían más allá de `apps/mobile-renter/src/owner` (por ejemplo hacia `apps/mobile-renter/src/renter` — no debería haber ninguno, `owner` y `renter` son hermanos independientes, pero confirmar).

- [ ] **Step 5: Correr la suite de mobile-owner**

```bash
cd "RentACar-mobile/apps/mobile-owner" && npm test
```

Expected: FALLA todavía — `App.js` de mobile-owner no existe (eso es la Task 7) y los tests que montan `OwnerApp` vía imports relativos (`../src/owner/OwnerApp`) deberían encontrarlo bien ya que `src/owner` sí se movió; si algo falla por import roto, es la señal para el Step 4 de arriba.

- [ ] **Step 6: Correr la suite de mobile-renter para confirmar que ya NO tiene rastro de owner**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
```

Expected: 79 suites / 363 tests (las 15 OWNER ya no están acá), todo en verde.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(mobile): mueve src/owner y sus tests a apps/mobile-owner"
```

---

### Task 7: App.js de mobile-owner con el gate de Mandato

**Files:**
- Create: `apps/mobile-owner/App.js`
- Test: `apps/mobile-owner/__tests__/AppOwnerMandato.test.js` (NUEVO)

**Interfaces:**
- Consumes: `AppProvider({ initialMode: "owner" })` (Task 2), `AuthFlow({ fixedRole: "owner" })` (Task 3), `MandatoDuenoModal`/`verificarMandatoAceptado` (ya existen en `mobile-shared`, sin cambios).
- Produces: al loguearse en mobile-owner, si la cuenta nunca aceptó el mandato de dueño, se muestra `MandatoDuenoModal` ANTES del home de `OwnerApp`; una vez aceptado (o si ya estaba aceptado de antes, por ejemplo porque venía del binario único), se monta `OwnerApp` normal.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/mobile-owner/__tests__/AppOwnerMandato.test.js`:

```javascript
import React from "react";
import { act } from "react-test-renderer";
import App from "../App";
import { renderTree, textOf } from "../test-utils";

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockUseApp = {
  isLoggedIn: true,
  authLoading: false,
  transition: null,
  currentUser: { id: "u1", nombre: "Marcela" },
  onboardingVisto: true,
};
jest.mock("@rentacar/mobile-shared", () => {
  const real = jest.requireActual("@rentacar/mobile-shared");
  return {
    ...real,
    useApp: () => mockUseApp,
    useVersionCheck: () => ({ bloqueado: false, urlStore: null }),
    useNetworkStatus: () => ({ isConnected: true }),
  };
});

jest.mock("@rentacar/mobile-shared/components/MandatoDuenoModal", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/components/MandatoDuenoModal");
  return { ...real, verificarMandatoAceptado: jest.fn() };
});

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("App (mobile-owner) · gate de mandato", () => {
  it("si nunca aceptó el mandato, lo muestra antes de OwnerApp", async () => {
    const { verificarMandatoAceptado } = require("@rentacar/mobile-shared/components/MandatoDuenoModal");
    verificarMandatoAceptado.mockResolvedValue(false);

    const tr = renderTree(<App />);
    await asentar();

    expect(textOf(tr)).toContain("Autorización para arrendar tu vehículo");
  });

  it("si ya aceptó el mandato, entra directo a OwnerApp", async () => {
    const { verificarMandatoAceptado } = require("@rentacar/mobile-shared/components/MandatoDuenoModal");
    verificarMandatoAceptado.mockResolvedValue(true);

    const tr = renderTree(<App />);
    await asentar();

    expect(textOf(tr)).not.toContain("Autorización para arrendar tu vehículo");
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

```bash
cd "RentACar-mobile/apps/mobile-owner" && npx jest AppOwnerMandato --no-coverage
```

Expected: FAIL — `App.js` no existe todavía en `mobile-owner`.

- [ ] **Step 3: Crear `apps/mobile-owner/App.js`**

```javascript
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  AppProvider,
  useApp,
  colors,
  AuthFlow,
  SwitchingScreen,
  NetworkBanner,
  useNetworkStatus,
  ForceUpdateScreen,
  useVersionCheck,
  MandatoDuenoModal,
  verificarMandatoAceptado,
} from "@rentacar/mobile-shared";
import { OwnerApp } from "./src/owner/OwnerApp";

// App del Dueño, separada de la de Arrendatario (mobile-renter). Antes de
// entrar al home de dueño se exige el mandato de intermediación (mismo
// modal que en el binario único se disparaba al "cambiar a modo dueño";
// acá se dispara una vez, al loguearse, porque este binario SOLO es dueño).
function Root() {
  const { isLoggedIn, authLoading, currentUser, transition } = useApp();
  const { bloqueado, urlStore } = useVersionCheck();

  // null = todavía no se sabe si aceptó el mandato (se está consultando).
  const [mandatoAceptado, setMandatoAceptado] = useState(null);

  useEffect(() => {
    if (!isLoggedIn || !currentUser?.id) {
      setMandatoAceptado(null);
      return;
    }
    let vivo = true;
    verificarMandatoAceptado(currentUser.id).then((aceptado) => {
      if (vivo) setMandatoAceptado(aceptado);
    });
    return () => {
      vivo = false;
    };
  }, [isLoggedIn, currentUser?.id]);

  if (bloqueado) {
    return <ForceUpdateScreen urlStore={urlStore} />;
  }

  if (authLoading) {
    return <SwitchingScreen mode="owner" title="Cargando tu sesión" subtitle="Un segundo, estamos abriendo la app." />;
  }

  return (
    <>
      {isLoggedIn ? (
        mandatoAceptado === false ? (
          <MandatoDuenoModal
            visible
            userId={currentUser?.id}
            onClose={() => {}}
            onAccepted={() => setMandatoAceptado(true)}
          />
        ) : mandatoAceptado === null ? (
          <SwitchingScreen mode="owner" title="Cargando tu cuenta" subtitle="Un segundo más." />
        ) : (
          <OwnerApp />
        )
      ) : (
        <AuthFlow fixedRole="owner" />
      )}
      {transition ? (
        <SwitchingScreen
          overlay
          mode={transition.mode}
          title={transition.title}
          subtitle={transition.subtitle}
        />
      ) : null}
    </>
  );
}

function ThemedFrame() {
  const { isConnected } = useNetworkStatus();
  return (
    <>
      <StatusBar style="dark" translucent />
      <View style={[styles.outerFrame, { backgroundColor: colors.appOuter }]}>
        <SafeAreaView
          style={[styles.appContainer, { backgroundColor: colors.background }]}
          edges={["top", "left", "right"]}
        >
          <View style={styles.bodyContainer}>
            <Root />
            <NetworkBanner visible={!isConnected} />
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider initialMode="owner">
          <ThemedFrame />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  appContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    boxShadow: "0px 10px 28px rgba(15, 61, 62, 0.14)",
    elevation: 8,
  },
  bodyContainer: { flex: 1 },
});
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

```bash
cd "RentACar-mobile/apps/mobile-owner" && npx jest AppOwnerMandato --no-coverage
```

Expected: PASS, ambos casos.

- [ ] **Step 5: Correr toda la suite de mobile-owner**

```bash
cd "RentACar-mobile/apps/mobile-owner" && npm test
```

Expected: todos los tests movidos/copiados (15 OWNER + 44 SHARED copiados + `AppOwnerMandato.test.js`) en verde. Si algún test SHARED copiado falla acá y no en mobile-renter, es porque asumía implícitamente el contexto de un solo binario (por ejemplo un mock que hardcodea `mode: "renter"`) — ajustar el mock en la copia de `mobile-owner`, no en la de `mobile-renter`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile-owner/App.js apps/mobile-owner/__tests__/AppOwnerMandato.test.js
git commit -m "feat(mobile-owner): monta OwnerApp con gate de mandato de dueño al loguearse"
```

---

### Task 8: Quitar el selector de rol de OwnerProfileScreen.js

**Files:**
- Modify: `apps/mobile-owner/src/owner/screens/OwnerProfileScreen.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: el perfil de dueño ya no ofrece "Cambiar a modo arrendatario".

- [ ] **Step 1: Leer el archivo completo y quitar el selector**

En `apps/mobile-owner/src/owner/screens/OwnerProfileScreen.js`: quitar el import de `ModeSwitchRow` (dejando el resto de esa línea de import intacto), quitar `setMode` de la desestructuración de `useApp()`, y quitar el bloque JSX:

```javascript
        <ModeSwitchRow
          tone="light"
          target="renter"
          title="Cambiar a modo arrendatario"
          desc="Busca y reserva autos para arrendar."
          onPress={() => setMode("renter")}
        />
```

- [ ] **Step 2: Correr la suite de mobile-owner**

```bash
cd "RentACar-mobile/apps/mobile-owner" && npm test
```

Expected: todo en verde (ningún test cubre ese botón puntual con una aserción de texto; si alguno lo hiciera, es la señal de quitar esa aserción a propósito).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-owner/src/owner/screens/OwnerProfileScreen.js
git commit -m "feat(mobile-owner): quita el selector de modo del perfil"
```

---

### Task 9: Verificación final y checklist manual

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Correr las dos suites completas una vez más, desde limpio**

```bash
cd "RentACar-mobile/apps/mobile-renter" && npm test
cd "RentACar-mobile/apps/mobile-owner" && npm test
```

Expected: ambas en verde, sin ningún archivo owner en mobile-renter ni renter en mobile-owner.

- [ ] **Step 2: Confirmar que ninguna de las dos apps importa código de la otra**

```bash
cd "RentACar-mobile"
grep -rn "mobile-renter/src/owner\|mobile-owner/src/renter" apps/ 2>/dev/null
grep -rln "src/owner" apps/mobile-renter/src apps/mobile-renter/App.js 2>/dev/null
grep -rln "src/renter" apps/mobile-owner/src apps/mobile-owner/App.js 2>/dev/null
```

Expected: sin resultados en los tres comandos.

- [ ] **Step 3: Smoke test manual (no automatizable en este entorno) — a cargo de quien tenga un dispositivo/emulador**

- [ ] Levantar `mobile-renter` (`npm run start` desde esa carpeta) y confirmar: la bienvenida solo ofrece "Quiero arrendar" (sin la tarjeta de dueño), el registro funciona, el login funciona, el perfil YA NO tiene "Cambiar a modo dueño".
- [ ] Levantar `mobile-owner` (`npm run start` desde esa carpeta) y confirmar: la bienvenida solo ofrece "Quiero publicar mi auto", una cuenta que nunca fue dueña ve el modal de Mandato al loguearse, aceptarlo lleva al home de dueño, una cuenta que YA era dueña (por ejemplo porque antes usaba el binario único y ya había aceptado el mandato) entra directo sin ver el modal de nuevo, el perfil de dueño YA NO tiene "Cambiar a modo arrendatario".
- [ ] Confirmar que las dos apps pueden estar instaladas a la vez en el mismo dispositivo sin chocar (schemes distintos).

- [ ] **Step 4: Pendientes que quedan fuera de este plan, a decidir con el cliente**

- Identidad visual real de `mobile-owner` (ícono, splash, nombre de marca definitivo) — hoy usa una copia de los assets de `mobile-renter` con nombre "ArriendoMiAutoYa Dueños" como placeholder funcional.
- Creación real del proyecto EAS de `mobile-owner` (Task 5, Step 6) si no se pudo correr por falta de login interactivo.
- Publicación real en las tiendas (listados nuevos, capturas de pantalla, textos de tienda) — no es parte de este plan de código.
- Limpieza de `ModeSwitchRow` en `mobile-shared` (queda sin uso tras este plan, se deja así a propósito, ver "Decisión de diseño").
