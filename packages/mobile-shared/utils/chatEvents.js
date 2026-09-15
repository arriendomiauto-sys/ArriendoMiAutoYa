/**
 * Aviso en proceso de actividad en la mensajería, sin necesidad de sockets
 * globales.
 *
 * `ChatListScreen` / `useConversaciones` se enteran de los mensajes nuevos por
 * el poll de notificaciones de `AppContext` (30 s). Cuando el usuario está
 * DENTRO de una conversación (el momento en que de verdad espera sincronía),
 * `RentalChatScreen` avisa aquí al recibir o enviar un mensaje y el globo de
 * la pestaña y las vistas previas se refrescan de inmediato, sin otra cinta
 * corriendo contra la batería.
 */
const escuchadores = new Set();

export function alCambiarChat(escuchador) {
  escuchadores.add(escuchador);
  return () => escuchadores.delete(escuchador);
}

export function avisarCambioChat() {
  escuchadores.forEach((cb) => {
    try {
      cb();
    } catch {
      /* un listener que se cae no tumba al resto */
    }
  });
}