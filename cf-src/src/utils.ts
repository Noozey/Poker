import type { Env } from "./types";

// Used by REST route handlers (which aren't inside the Durable Object) to
// push a realtime update out to everyone connected to a given lobby's socket.
// Replaces the old `io.to(lobbyName).emit(...)` calls.
export async function broadcastToLobby(
  env: Env,
  lobbyName: string,
  message: unknown,
): Promise<void> {
  const id = env.LOBBY_ROOM.idFromName(lobbyName);
  const stub = env.LOBBY_ROOM.get(id);
  await stub.fetch("https://internal/broadcast", {
    method: "POST",
    body: JSON.stringify(message),
  });
}
