import type { Env, Lobby, Player } from "../types";
import { getSupabase } from "../database/supabaseConfig";
import { broadcastToLobby } from "../utils";

interface CreateLobbyBody {
  name: string;
  game_type: string;
  max_players: number;
  buy_in_amount: number;
  password?: string | null;
  creator_id: string;
  players: Player[];
}

interface JoinLobbyBody {
  lobby_code: string;
  password?: string;
  user_id: Player;
}

export async function handleLobbies(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const supabase = getSupabase(env);

  // POST /lobbies/create
  if (request.method === "POST" && url.pathname === "/lobbies/create") {
    const {
      name,
      game_type,
      max_players,
      buy_in_amount,
      password,
      creator_id,
      players,
    } = (await request.json()) as CreateLobbyBody;

    const { data, error } = await supabase
      .from("lobbies")
      .insert([
        {
          name,
          game_type,
          max_players,
          buy_in_amount,
          password: password || null,
          creator_id,
          players,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("create lobby:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ message: "Lobby created", lobby: data }, { status: 201 });
  }

  // PUT /lobbies/join
  if (request.method === "PUT" && url.pathname === "/lobbies/join") {
    const { lobby_code, password, user_id } = (await request.json()) as JoinLobbyBody;

    const { data: lobby, error: fetchError } = await supabase
      .from("lobbies")
      .select("id, players, max_players")
      .eq("name", lobby_code)
      .eq("password", password || "")
      .maybeSingle<Pick<Lobby, "id" | "players" | "max_players">>();

    if (fetchError || !lobby) {
      return Response.json(
        { error: "Lobby not found or password incorrect" },
        { status: 404 },
      );
    }

    const existing: Player[] = lobby.players || [];
    const alreadyIn = existing.some((p) => p.id === user_id.id);

    let newPlayers: Player[];
    if (alreadyIn) {
      newPlayers = existing.map((p) => (p.id === user_id.id ? user_id : p));
    } else if (existing.length >= lobby.max_players) {
      return Response.json({ error: "Lobby is full" }, { status: 400 });
    } else {
      newPlayers = [...existing, user_id];
    }

    const { data, error: updateError } = await supabase
      .from("lobbies")
      .update({ players: newPlayers })
      .eq("id", lobby.id)
      .select()
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    await broadcastToLobby(env, lobby_code, { type: "lobby-data", payload: data });

    return Response.json(
      { message: "Joined lobby", lobby: data, success: true },
      { status: 200 },
    );
  }

  // GET /lobbies/all/:lobbyName
  const allMatch = url.pathname.match(/^\/lobbies\/all\/([^/]+)$/);
  if (request.method === "GET" && allMatch) {
    const lobbyName = decodeURIComponent(allMatch[1]);

    const { data, error } = await supabase
      .from("lobbies")
      .select("*")
      .eq("name", lobbyName)
      .single();

    if (error || !data) {
      return Response.json({ error: "Lobby not found" }, { status: 404 });
    }

    return Response.json(data, { status: 200 });
  }

  return new Response("Not found", { status: 404 });
}
