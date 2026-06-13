import express from "express";
import { io } from "../index.js";
import supabase from "../database/supabaseConfig.js";

const router = express.Router();

const SUITS = [
  { name: "Hearts", symbol: "♥️" },
  { name: "Diamonds", symbol: "♦️" },
  { name: "Clubs", symbol: "♣️" },
  { name: "Spades", symbol: "♠️" },
];
const RANKS = [
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

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

function drawCard(deck) {
  const index = Math.floor(Math.random() * deck.length);
  return deck.splice(index, 1)[0];
}

router.post("/", async (req, res) => {
  const { lobbyName, playerNum } = req.body;
  const numPlayers = Math.max(2, Number(playerNum) || 2);

  const check = {
    players: Array(numPlayers).fill(false),
    community: Array(6).fill(false),
  };

  const deck = buildDeck();
  const cardsToDraw = 2 * numPlayers + 5; // always exact
  const drawedDeck = [];
  for (let i = 0; i < cardsToDraw; i++) {
    drawedDeck.push(drawCard(deck));
  }

  const { data: lobbyRows, error: fetchError } = await supabase
    .from("lobby-data")
    .select("dealer")
    .eq("name", lobbyName)
    .maybeSingle();

  if (fetchError) {
    console.error("game POST – fetch dealer:", fetchError.message);
    return res.status(500).json({ error: fetchError.message });
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
    return res.status(500).json({ error: upsertError.message });
  }

  io.to(lobbyName).emit("game-data", upserted);

  return res.json(upserted);
});

router.post("/check/:player", async (req, res) => {
  const playerIndex = parseInt(req.params.player, 10) - 1;
  const { lobbyName, state } = req.body;

  if (isNaN(playerIndex) || playerIndex < 0) {
    return res.status(400).json({ error: "Invalid player index" });
  }

  const { data, error } = await supabase
    .from("lobby-data")
    .select("check, folduser")
    .eq("name", lobbyName)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const check = data.check;
  const folduser = Array.isArray(data.folduser) ? data.folduser : [];
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

  if (updateError) return res.status(500).json({ error: updateError.message });

  io.to(lobbyName).emit("check-update", updated);

  return res.json(updated);
});

router.put("/raise", async (req, res) => {
  const { lobbyName, id, buy_in_amount, pot, raise } = req.body;

  // Update player balance and pot/call in parallel
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
    return res.status(500).json({ error: "Unable to fetch lobby" });
  }

  const { id: lobbyId, players } = lobbyResult.data;

  const updatedPlayers = players.map((player) =>
    player.id === id ? { ...player, buy_in_amount } : player,
  );

  const { error: updateError } = await supabase
    .from("lobbies")
    .update({ players: updatedPlayers })
    .eq("id", lobbyId);

  if (updateError) {
    return res.status(500).json({ error: "Unable to update player" });
  }

  if (!potResult.error) {
    io.to(lobbyName).emit("raise-update", potResult.data);
  }

  return res.json({ success: true });
});

router.get("/data/:lobbyName", async (req, res) => {
  const { lobbyName } = req.params;

  const { data, error } = await supabase
    .from("lobby-data")
    .select("*")
    .eq("name", lobbyName)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

export default router;
