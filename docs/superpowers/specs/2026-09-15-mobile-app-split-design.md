# Separar RentACar-mobile en dos apps: mobile-renter y mobile-owner

## Contexto y motivación

Hoy `RentACar-mobile` es un solo binario Expo (`apps/mobile`) que muestra
`RenterApp` o `OwnerApp` según un `mode` guardado en `AppContext`, con un
selector para "cambiar de modo" y una pantalla de transición
(`SwitchingScreen`) entre ambos.

El cliente pidió separarlo en dos apps de verdad (dos íconos, dos listados
en las tiendas) por comodidad del usuario final: quien solo arrienda autos
no debería convivir con el flujo de dueño dentro de la misma app, y
viceversa.

## Alcance de este documento

Este spec cubre **solo la separación estructural** (dos apps, código
compartido, cuentas, onboarding de dueño). Las otras 6 mejoras pedidas por
el cliente (sesión/KYC, cuenta bancaria de dueños, categorización de
autos, licencias por categoría, zoom de cámara, navegación del
marketplace) quedan fuera de este documento — se abordan una por una
después de esta separación, cada una con su propio análisis.

## Decisiones ya validadas con el cliente

1. **Motivo**: pedido del cliente, por comodidad del usuario final (cada
   persona ve solo la experiencia de su rol, sin selector).
2. **Cuentas**: se comparte el mismo backend/login de Supabase entre las
   dos apps. Una misma persona puede tener cuenta de arrendatario y de
   dueño a la vez, y usa el mismo usuario/clave en ambas apps.
3. **Onboarding de dueño**: al entrar por primera vez a la app de dueño
   con una cuenta que nunca aceptó ese rol, se muestra un aviso/consentimiento
   propio (autorización para lucrar con su vehículo, etc.) antes de dejarlo
   entrar al home de dueño.
4. **Nombres de los proyectos**: `apps/mobile-renter` y `apps/mobile-owner`
   (no `apps/mobile` + `apps/owner`).

## Arquitectura

```
RentACar-mobile/
  apps/
    mobile-renter/     <- hoy "apps/mobile"; se renombra, conserva
                           bundleIdentifier, scheme y proyecto EAS actuales
    mobile-owner/       <- app nueva e independiente
  packages/
    mobile-shared/      <- sin cambios de ubicación; se sigue compartiendo
```

- **mobile-renter**: continúa siendo el proyecto Expo que ya existe hoy
  (`cl.arriendatuauto.app`, scheme `arriendatuauto`, proyecto EAS
  `2b05af04-600a-4544-bc16-85fe714c68fb`). Se renombra la carpeta de
  `apps/mobile` a `apps/mobile-renter` pero **no cambia su identidad de
  publicación** — los usuarios ya instalados no deben verse afectados.
- **mobile-owner**: proyecto Expo nuevo, con su propio `app.json`
  (bundleIdentifier nuevo, p. ej. `cl.arriendatuauto.duenos`; scheme nuevo,
  p. ej. `arriendatuautodueno`, para que ambas apps convivan en el mismo
  dispositivo sin chocar; proyecto EAS nuevo).
- `packages/mobile-shared` no se mueve ni se duplica: sigue exportando
  tema, componentes UI, cliente API, autenticación, `PhotoViewer`, etc.
  Ambas apps lo consumen igual que hoy.

## Migración de código

- `src/owner/**` (pantallas, `OwnerApp.js`) se mueve de
  `apps/mobile` a `apps/mobile-owner/src/owner/**`.
- `src/renter/**` se queda donde está, ahora bajo
  `apps/mobile-renter/src/renter/**`.
- `App.js` de cada proyecto monta directamente su app (`RenterApp` en
  mobile-renter, `OwnerApp` en mobile-owner) — sin `mode` ni
  `SwitchingScreen`.
- Se elimina de `AppContext` (en `mobile-shared`) todo lo que sea
  exclusivo del selector de modo: `mode`, `transition` y las funciones que
  lo manejan. Lo que sí se conserva ahí: sesión, usuario actual, y la
  nueva bandera de "aceptó ser dueño" (o el campo que ya use el backend
  para esto, a confirmar en el plan).
- Notificaciones push, deep linking (`expo-linking`) y la tarea de
  telemetría en segundo plano (`expo-task-manager`) se registran por
  separado en cada proyecto — cada uno con su propio `scheme` y su propia
  configuración de notificaciones en `app.json`.

## Onboarding de dueño

Al iniciar sesión en mobile-owner, si la cuenta no tiene el consentimiento
de dueño registrado, se muestra una pantalla de aviso/aceptación antes del
home de dueño. El detalle exacto de dónde vive esa bandera (nuevo campo en
el perfil vía API, o uno ya existente) se define en el plan de
implementación, revisando primero qué expone hoy `AppContext`/`ApiClient`
sobre el usuario.

## Tests

- Los tests de pantallas de dueño (`enrolarAuto.test.js`,
  `subidaFotos.test.js`, `catalogosFinancieros.test.js`, etc.) se mueven
  junto con su código a `apps/mobile-owner/__tests__`.
- Los tests de pantallas de arrendatario (`CarDetailScreen*.test.js`,
  etc.) se quedan en `apps/mobile-renter/__tests__`.
- `packages/mobile-shared` conserva su propia suite si la tiene, sin
  cambios.
- Cada app mantiene su propio `package.json` con su config de Jest
  (`jest-expo`, `setupFilesAfterEnv`, `transformIgnorePatterns`), copiando
  la configuración actual de `apps/mobile/package.json`.

## Fuera de alcance / riesgos a marcar en el plan

- No se decide en este documento el nombre final de marca/ícono de la app
  de dueño (a confirmar con el cliente antes de crear el proyecto EAS
  nuevo).
- No se decide el mecanismo exacto de la bandera de consentimiento de
  dueño (columna nueva en backend vs. campo ya existente) — se investiga
  al planificar.
- El repo `RentACar-mobile` es un solo repositorio git con workspaces npm
  (`apps/*`, `packages/*>`); la separación es de carpetas/proyectos Expo
  dentro del mismo repo, no de repositorios separados.
