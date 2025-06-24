import express from "express";
import { io } from "../index.js";
import supabase from "../database/supabaseConfig.js";
const router = express.Router();

const suits = [
  { name: "Hearts", symbol: "♥️" },
  { name: "Diamonds", symbol: "♦️" },
  { name: "Clubs", symbol: "♣️" },
  { name: "Spades", symbol: "♠️" },
];

const ranks = [
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

router.post("/", async (req, res) => {
  const { lobbyName, playerNum } = req.body;

  const numPlayers = Number(playerNum) || 2;
  const players = Array(numPlayers).fill(false);
  const fullDeck = [];
  const drawedDeck = [];

  let check = {
    players,
    community: Array(5).fill(false),
  };

  for (const suit of suits) {
    for (const rank of ranks) {
      fullDeck.push({ rank, suit });
    }
  }

  function drawCard(deck) {
    const index = Math.floor(Math.random() * deck.length);
    return deck.splice(index, 1)[0];
  }

  // Fix here: use players.length instead of players array
  const numberOfCardsToDraw = 9 + (players.length - 2) * 2;

  for (let i = 0; i < numberOfCardsToDraw; i++) {
    drawedDeck.push(drawCard(fullDeck));
  }

  const { data, error } = await supabase
    .from("lobby-data")
    .select("dealer")
    .eq("name", lobbyName);

  if (error) {
    console.error("Error fetching dealer:", error);
    return; // or handle error accordingly
  }

  const dealer = data?.[0]?.dealer ?? 0;

  const changeDealer = dealer >= playerNum ? 1 : dealer + 1;
  const currentTurn = changeDealer >= playerNum ? 1 : changeDealer + 1;

  const { data: upsertData, error: upsertError } = await supabase
    .from("lobby-data")
    .upsert(
      [
        {
          name: lobbyName,
          draweddeck: drawedDeck,
          check: check,
          dealer: changeDealer,
          show: false,
          currentTurn,
        },
      ],
      { onConflict: "name" }
    )
    .select();

  if (upsertError) {
    console.error("Error updating lobby-data:", upsertError);
  }

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.json(data);
  }
});

router.post("/check/:player", async (req, res) => {
  const { player } = req.params;
  const { lobbyName, state } = req.body;

  let index = parseInt(player) - 1;

  const { data, error } = await supabase
    .from("lobby-data")
    .select("name, check")
    .eq("name", lobbyName)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  let check = data.check;

  check.players[index] = true;
  if (state === "raised") {
    check.players = check.players.map(() => false);
    check.players[index] = true;
  }

  if (check.players.every(Boolean)) {
    if (!check.community[0] && !check.community[1] && !check.community[2]) {
      check.community[0] = true;
      check.community[1] = true;
      check.community[2] = true;

      check.players = Array(check.players.length).fill(false);
    } else if (!check.community[3]) {
      check.community[3] = true;
      check.players = Array(check.players.length).fill(false);
    } else if (!check.community[4]) {
      check.community[4] = true;
      check.players = Array(check.players.length).fill(false);
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("lobby-data")
    .update({ check })
    .eq("name", lobbyName);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  res.json(updated);
});

router.put("/raise", async (req, res) => {
  const { lobbyName, id, buy_in_amount, pot, raise } = req.body;

  const { data, error } = await supabase
    .from("lobbies")
    .select("id, players")
    .eq("name", lobbyName)
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to fetch lobby" });
  }

  if (!data) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  const lobbyId = data.id;
  const players = data.players;

  const updatedPlayers = players.map((player) =>
    player.id === id ? { ...player, buy_in_amount } : player
  );

  const { error: updateError } = await supabase
    .from("lobbies")
    .update({ players: updatedPlayers })
    .eq("id", lobbyId);

  if (updateError) {
    console.error(updateError);
    return res.status(500).json({ error: "Unable to update player" });
  }

  const { data: setPot, err } = await supabase
    .from("lobby-data")
    .update({ pot, call: raise })
    .eq("name", lobbyName)
    .select("*");
});

router.get("/data/:lobbyName", async (req, res) => {
  const { lobbyName } = req.params;

  try {
    const { data, error } = await supabase
      .from("lobby-data")
      .select("*")
      .eq("name", lobbyName);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

supabase
  .channel("lobby-data")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "lobby-data" },
    (payload) => {
      io.emit("game-data", payload.new);
    }
  )
  .subscribe();

export default router;
