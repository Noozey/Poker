import type { Card, CheckState, Env, LobbyDataRow, Suit } from "../types";
import { getSupabase } from "../database/supabaseConfig";
import { broadcastToLobby } from "../utils";

const SUITS: Suit[] = [
  { name: "Hearts", symbol: "♥️" },
  { name: "Diamonds", symbol: "♦️" },
  { name: "Clubs", symbol: "♣️" },
  { name: "Spades", symbol: "♠️" },
];

const RANKS: string[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

function drawCard(deck: Card[]): Card {
  const index = Math.floor(Math.random() * deck.length);
  return deck.splice(index, 1)[0];
}

interface CreateGameBody {
  lobbyName: string;
  playerNum: number | string;
}

interface CheckBody {
  lobbyName: string;
  state?: string;
}

interface RaiseBody {
  lobbyName: string;
  id: string;
  buy_in_amount: number;
  pot: number;
  raise: number;
}

export async function handleGame(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const supabase = getSupabase(env);

  // POST /game  — deal a new hand
  if (
    request.method === "POST" &&
    (url.pathname === "/game" || url.pathname === "/game/")
  ) {
    const { lobbyName, playerNum } = (await request.json()) as CreateGameBody;
    const numPlayers = Math.max(2, Number(playerNum) || 2);

    const check: CheckState = {
      players: Array(numPlayers).fill(false),
      community: Array(6).fill(false),
    };

    const deck = buildDeck();
    const cardsToDraw = 2 * numPlayers + 5; // always exact
    const drawedDeck: Card[] = [];
    for (let i = 0; i < cardsToDraw; i++) {
      drawedDeck.push(drawCard(deck));
    }

    const { data: lobbyRows, error: fetchError } = await supabase
      .from("lobby-data")
      .select("dealer")
      .eq("name", lobbyName)
      .maybeSingle<Pick<LobbyDataRow, "dealer">>();

    if (fetchError) {
      console.error("game POST – fetch dealer:", fetchError.message);
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    const prevDealer = lobbyRows?.dealer ?? 0;
    const dealer = prevDealer >= numPlayers ? 1 : prevDealer + 1;
    const currentTurn = dealer >= numPlayers ? 1 : dealer + 1;

    const { data: upserted, error: upsertError } = await supabase
      .from("lobby-data")
      .upsert(
        [
          {
            name: lobbyName,
            draweddeck: drawedDeck,
            check,
            dealer,
            show: false,
            currentTurn,
            folduser: [],
            pot: 0,
            call: 0,
          },
        ],
        { onConflict: "name" },
      )
      .select()
      .single();

    if (upsertError) {
      console.error("game POST – upsert:", upsertError.message);
      return Response.json({ error: upsertError.message }, { status: 500 });
    }

    await broadcastToLobby(env, lobbyName, {
      type: "game-data",
      payload: upserted,
    });

    return Response.json(upserted);
  }

  // POST /game/check/:player
  const checkMatch = url.pathname.match(/^\/game\/check\/([^/]+)$/);
  if (request.method === "POST" && checkMatch) {
    const playerIndex = parseInt(checkMatch[1], 10) - 1;
    const { lobbyName, state } = (await request.json()) as CheckBody;

    if (isNaN(playerIndex) || playerIndex < 0) {
      return Response.json({ error: "Invalid player index" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("lobby-data")
      .select("check, folduser")
      .eq("name", lobbyName)
      .single<Pick<LobbyDataRow, "check" | "folduser">>();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const check = data.check;
    const folduser: number[] = Array.isArray(data.folduser)
      ? data.folduser
      : [];
    const numPlayers = check.players.length;

    if (state === "raised") {
      check.players = Array(numPlayers).fill(false);
    }
    check.players[playerIndex] = true;

    const activePlayers = check.players.filter(
      (_, i) => !folduser.includes(i + 1),
    );
    const allActed = activePlayers.length > 0 && activePlayers.every(Boolean);

    if (allActed) {
      check.players = Array(numPlayers).fill(false);

      if (!check.community[0]) {
        check.community[0] = true;
        check.community[1] = true;
        check.community[2] = true;
      } else if (!check.community[3]) {
        check.community[3] = true; // Turn
      } else if (!check.community[4]) {
        check.community[4] = true; // River
      } else if (!check.community[5]) {
        check.community[5] = true; // Showdown flag
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("lobby-data")
      .update({ check })
      .eq("name", lobbyName)
      .select()
      .single();

    if (updateError)
      return Response.json({ error: updateError.message }, { status: 500 });

    await broadcastToLobby(env, lobbyName, {
      type: "check-update",
      payload: updated,
    });

    return Response.json(updated);
  }

  // PUT /game/raise
  if (request.method === "PUT" && url.pathname === "/game/raise") {
    const { lobbyName, id, buy_in_amount, pot, raise } =
      (await request.json()) as RaiseBody;

    const [lobbyResult, potResult] = await Promise.all([
      supabase
        .from("lobbies")
        .select("id, players")
        .eq("name", lobbyName)
        .single(),
      supabase
        .from("lobby-data")
        .update({ pot, call: raise })
        .eq("name", lobbyName)
        .select("pot, call")
        .single(),
    ]);

    if (lobbyResult.error) {
      return Response.json({ error: "Unable to fetch lobby" }, { status: 500 });
    }

    const { id: lobbyId, players } = lobbyResult.data;

    const updatedPlayers = players.map((player: { id: string }) =>
      player.id === id ? { ...player, buy_in_amount } : player,
    );

    const { error: updateError } = await supabase
      .from("lobbies")
      .update({ players: updatedPlayers })
      .eq("id", lobbyId);

    if (updateError) {
      return Response.json(
        { error: "Unable to update player" },
        { status: 500 },
      );
    }

    if (!potResult.error) {
      await broadcastToLobby(env, lobbyName, {
        type: "raise-update",
        payload: potResult.data,
      });
    }

    return Response.json({ success: true });
  }

  // GET /game/data/:lobbyName
  const dataMatch = url.pathname.match(/^\/game\/data\/([^/]+)$/);
  if (request.method === "GET" && dataMatch) {
    const lobbyName = decodeURIComponent(dataMatch[1]);

    const { data, error } = await supabase
      .from("lobby-data")
      .select("*")
      .eq("name", lobbyName)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }

  return new Response("Not found", { status: 404 });
}
