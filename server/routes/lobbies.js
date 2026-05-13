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
    .select();

  if (error) {
    console.error("Error creating lobby:", error.message);
    return res.status(500).json({ error: error.message });
  }

  // 5. Respond
  res.status(201).json({
    message: "Lobby and state table created successfully",
    lobby: data,
  });
});

router.put("/join", async (req, res) => {
  const { lobby_code, password, user_id } = req.body;

  let { data: lobbies, error: fetchError } = await supabase
    .from("lobbies")
    .select("id, players,max_players")
    .eq("name", lobby_code)
    .eq("password", password || "")
    .maybeSingle();

  if (fetchError || !lobbies) {
    console.error("Error fetching lobby:", fetchError?.message);
    return res
      .status(404)
      .json({ error: "Lobby not found or password incorrect" });
  }

  const updatedPlayers = lobbies.players || [];

  const newPlayers = updatedPlayers.some((player) => player.id === user_id.id)
    ? updatedPlayers.map((player) =>
        player.id === user_id.id ? user_id : player,
      )
    : lobbies.players.length >= lobbies.max_players
      ? null
      : [...updatedPlayers, user_id];

  const { data, error: updateError } = await supabase
    .from("lobbies")
    .update({ players: newPlayers })
    .eq("id", lobbies.id)
    .select();

  if (updateError) {
    console.error("Error updating lobby:", updateError.message);
    return res.status(500).json({ error: updateError.message });
  }

  res
    .status(200)
    .json({ message: "Joined lobby successfully", lobby: data, success: true });
});

router.get("/all/:lobbyName", async (req, res) => {
  const { lobbyName } = req.params;

  const { data, error } = await supabase
    .from("lobbies")
    .select("*")
    .eq("name", lobbyName);

  if (error || !data || data.length === 0) {
    console.error("Error fetching lobby:", error?.message || "Not found");
    return res.status(404).json({ error: "Lobby not found" });
  }
  res.status(200).json(data[0]);
});

supabase
  .channel("lobbies")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "lobbies" },
    (payload) => {
      io.emit("lobby-data", payload.new);
    },
  )
  .subscribe();

export default router;
