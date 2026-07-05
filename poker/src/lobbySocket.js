// Drop-in replacement for the subset of the socket.io-client API this app
// uses (`on`, `off`, `emit`, `disconnect`), built on a plain WebSocket.
// The Cloudflare Worker backend speaks JSON messages shaped like
// { type: "eventName", payload: {...} } over a native WebSocket at
// /ws/:lobbyName — this wrapper translates that into the familiar
// socket.emit(event, payload) / socket.on(event, handler) calls so the
// rest of the app (e.g. GamePlay / gamelogic.jsx) doesn't need to change.
export function createLobbySocket(url) {
  const ws = new WebSocket(url);
  const listeners = new Map(); // eventName -> Set<handler>

  ws.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return; // ignore malformed messages
    }
    const handlers = listeners.get(msg.type);
    if (handlers) {
      handlers.forEach((fn) => fn(msg.payload));
    }
  });

  return {
    on(event, handler) {
      if (event === "connect") {
        ws.addEventListener("open", handler);
        return;
      }
      if (event === "disconnect") {
        ws.addEventListener("close", handler);
        return;
      }
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    emit(event, payload) {
      const send = () => ws.send(JSON.stringify({ type: event, payload }));
      if (ws.readyState === WebSocket.OPEN) {
        send();
      } else {
        ws.addEventListener("open", send, { once: true });
      }
    },
    disconnect() {
      ws.close();
    },
    raw: ws,
  };
}
