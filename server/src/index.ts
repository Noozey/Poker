import type { Env } from "./types";
import { handleAuth } from "./routes/auth";
import { handleLobbies } from "./routes/lobbies";
import { handleGame } from "./routes/gameHandler";

export { LobbyRoom } from "./durable-objects/LobbyRoom";

// Replaces the old `app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }))`
// Express middleware. Set CLIENT_ORIGIN as a var in wrangler.jsonc (or a
// secret) if you want to lock this down instead of allowing "*".
const ALLOWED_ORIGIN = "*";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Browser CORS preflight for any route (POST/PUT with JSON bodies
    // trigger this automatically).
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // Realtime connection — replaces socket.io's io.on("connection").
    // Each lobby gets its own Durable Object instance, addressed by name,
    // holding that lobby's WebSocket connections.
    // (No CORS wrapping here: the WebSocket upgrade response can't carry
    // custom headers the same way, and browsers don't preflight it.)
    if (url.pathname.startsWith("/ws/")) {
      const lobbyName = url.pathname.slice("/ws/".length);
      if (!lobbyName) return new Response("Missing lobby name", { status: 400 });
      const id = env.LOBBY_ROOM.idFromName(lobbyName);
      const stub = env.LOBBY_ROOM.get(id);
      return stub.fetch(request);
    }

    let response: Response;

    if (url.pathname.startsWith("/auth")) {
      response = await handleAuth(request, env, url);
    } else if (url.pathname.startsWith("/lobbies")) {
      response = await handleLobbies(request, env, url);
    } else if (url.pathname.startsWith("/game")) {
      response = await handleGame(request, env, url);
    } else {
      response = new Response("Not found", { status: 404 });
    }

    return withCors(response);
  },
};
