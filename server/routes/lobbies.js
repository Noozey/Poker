import express from "express";
import supabase from "../database/supabaseConfig.js";
import { io } from "../index.js";

const router = express.Router();

router.post("/create", async (req, res) => {
  const {
    name,
    game_type,
    max_players,
    buy_in_amount,
    password,
    creator_id,
    players,
  } = req.body;

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
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ message: "Lobby created", lobby: data });
});

router.put("/join", async (req, res) => {
  const { lobby_code, password, user_id } = req.body;

  const { data: lobby, error: fetchError } = await supabase
    .from("lobbies")
    .select("id, players, max_players")
    .eq("name", lobby_code)
    .eq("password", password || "")
    .maybeSingle();

  if (fetchError || !lobby) {
    return res
      .status(404)
      .json({ error: "Lobby not found or password incorrect" });
  }

  const existing = lobby.players || [];
  const alreadyIn = existing.some((p) => p.id === user_id.id);

  let newPlayers;
  if (alreadyIn) {
    newPlayers = existing.map((p) => (p.id === user_id.id ? user_id : p));
  } else if (existing.length >= lobby.max_players) {
    return res.status(400).json({ error: "Lobby is full" });
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
    return res.status(500).json({ error: updateError.message });
  }

  io.to(lobby_code).emit("lobby-data", data);

  return res
    .status(200)
    .json({ message: "Joined lobby", lobby: data, success: true });
});

router.get("/all/:lobbyName", async (req, res) => {
  const { lobbyName } = req.params;

  const { data, error } = await supabase
    .from("lobbies")
    .select("*")
    .eq("name", lobbyName)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  return res.status(200).json(data);
});

export default router;
