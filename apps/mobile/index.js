import { registerRootComponent } from "expo";
import { inicializarSentry, registrarTareaTelemetria } from "@rentacar/mobile-shared";
import App from "./App";

const Sentry = inicializarSentry();

// Debe correr antes de registerRootComponent: expo-task-manager necesita que
// `defineTask` se resuelva en el top-level del bundle para poder relanzar la
// tarea headless (background location) aunque la app esté cerrada.
registrarTareaTelemetria();

registerRootComponent(Sentry ? Sentry.wrap(App) : App);
