import { DurableObject } from "cloudflare:workers";
import type {
  CallPayload,
  Env,
  FoldPayload,
  GameDetailsPayload,
  WinnerPayload,
} from "../types";
import { getSupabase } from "../database/supabaseConfig";

// One LobbyRoom instance exists per lobbyName (env.LOBBY_ROOM.idFromName),
// so every WebSocket this object holds already belongs to the same lobby —
// no need for the room-tracking maps a single global DO would need.
//
// Uses the hibernation API (ctx.acceptWebSocket / webSocketMessage /
// webSocketClose) so the object can be evicted from memory between messages
// without losing its connections — ctx.getWebSockets() still returns them
// after a restart, unlike a plain in-memory Set.
export class LobbyRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  broadcast(message: unknown, exclude?: WebSocket): void {
    const json = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(json);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal trigger from a REST route handler (via broadcastToLobby),
    // e.g. after a lobby/game row is updated in Supabase.
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const body = await request.json();
      this.broadcast(body);
      return new Response("ok");
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    let msg: { type: string; payload: unknown };
    try {
      msg = JSON.parse(data as string);
    } catch {
      return; // ignore malformed messages
    }
    await this.handleEvent(ws, msg);
  }

  async webSocketClose(): Promise<void> {
    // Nothing to clean up manually — ctx.getWebSockets() reflects the
    // current connection set automatically.
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error("LobbyRoom websocket error:", error);
  }

  async handleEvent(
    ws: WebSocket,
    msg: { type: string; payload: unknown },
  ): Promise<void> {
    switch (msg.type) {
      case "gamedetails": {
        const payload = msg.payload as GameDetailsPayload;
        this.broadcast({ type: "gamedetails", payload }, ws);
        const next = await this.changeTurn(payload);
        this.broadcast({ type: "turn-change", payload: { currentTurn: next } });
        break;
      }
      case "call": {
        const payload = msg.payload as CallPayload;
        this.broadcast({ type: "call", payload }, ws);
        await getSupabase(this.env)
          .from("lobby-data")
          .update({ call: 0 })
          .eq("name", payload.lobbyName);
        break;
      }
      case "fold": {
        const payload = msg.payload as FoldPayload;
        this.broadcast({ type: "fold", payload }, ws);
        await this.updateFold(payload);
        break;
      }
      case "winner": {
        const payload = msg.payload as WinnerPayload;
        await this.updatePot(payload);
        this.broadcast({ type: "winner", payload });
        break;
      }
      case "msg": {
        this.broadcast({ type: "msg", payload: msg.payload }, ws);
        break;
      }
      default:
        break;
    }
  }

  async changeTurn({
    lobbyName,
    currentTurn,
    numPlayer,
    foldedIds = [],
  }: GameDetailsPayload): Promise<number> {
    let next = currentTurn >= numPlayer ? 1 : currentTurn + 1;

    for (let i = 0; i < numPlayer; i++) {
      if (!foldedIds.includes(next)) break;
      next = next >= numPlayer ? 1 : next + 1;
    }

    const { error } = await getSupabase(this.env)
      .from("lobby-data")
      .update({ currentTurn: next })
      .eq("name", lobbyName);

    if (error) console.error("changeTurn error:", error.message);
    return next;
  }

  async updateFold({ lobbyName, id }: FoldPayload): Promise<void> {
    const supabase = getSupabase(this.env);
    const { data, error } = await supabase
      .from("lobby-data")
      .select("folduser")
      .eq("name", lobbyName)
      .single<{ folduser: number[] }>();

    if (error) {
      console.error("updateFold – fetch error:", error.message);
      return;
    }

    const current = Array.isArray(data.folduser) ? data.folduser : [];
    if (current.includes(id)) return;

    const { error: updateError } = await supabase
      .from("lobby-data")
      .update({ folduser: [...current, id] })
      .eq("name", lobbyName);

    if (updateError)
      console.error("updateFold – update error:", updateError.message);
  }

  async updatePot({ name: lobbyName, winner, pot }: WinnerPayload): Promise<void> {
    if (!pot || pot === 0) return;

    const supabase = getSupabase(this.env);
    const { data: lobby, error } = await supabase
      .from("lobbies")
      .select("players")
      .eq("name", lobbyName)
      .single<{ players: { id: string; buy_in_amount?: number }[] }>();

    if (error) {
      console.error("updatePot – fetch error:", error.message);
      return;
    }

    let winnerFound = false;
    const updatedPlayers = lobby.players.map((player) => {
      if (player.id === winner) {
        winnerFound = true;
        return { ...player, buy_in_amount: (player.buy_in_amount ?? 0) + pot };
      }
      return player;
    });

    if (!winnerFound) {
      console.error("updatePot – winner id not found in players:", winner);
      return;
    }

    const { error: updateError } = await supabase
      .from("lobbies")
      .update({ players: updatedPlayers })
      .eq("name", lobbyName);

    if (updateError) {
      console.error("updatePot – update error:", updateError.message);
      return;
    }

    const { error: potError } = await supabase
      .from("lobby-data")
      .update({ pot: 0 })
      .eq("name", lobbyName);

    if (potError) console.error("updatePot – zero pot error:", potError.message);
  }
}
