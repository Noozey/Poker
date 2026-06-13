import express from "express";
import dotenv from "dotenv";
import room from "./routes/lobbies.js";
import auth from "./routes/auth.js";
import gamehandle from "./routes/gameHandler.js";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import supabase from "./database/supabaseConfig.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

export const io = new Server(server, {
  path: "/socket.io", // explicit path avoids CF routing ambiguity
  transports: ["polling", "websocket"],
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

app.use("/lobbies", room);
app.use("/auth", auth);
app.use("/game", gamehandle);

const updatePot = async (data) => {
  const { name: lobbyName, winner, pot } = data;

  if (!pot || pot === 0) return;

  const { data: lobby, error } = await supabase
    .from("lobbies")
    .select("players")
    .eq("name", lobbyName)
    .single();

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
};

const changeTurn = async ({
  lobbyName,
  currentTurn,
  numPlayer,
  foldedIds = [],
}) => {
  let next = currentTurn >= numPlayer ? 1 : currentTurn + 1;

  for (let i = 0; i < numPlayer; i++) {
    if (!foldedIds.includes(next)) break;
    next = next >= numPlayer ? 1 : next + 1;
  }

  const { error } = await supabase
    .from("lobby-data")
    .update({ currentTurn: next })
    .eq("name", lobbyName);

  if (error) console.error("changeTurn error:", error.message);
  return next;
};

const updateCall = async (lobbyName) => {
  const { error } = await supabase
    .from("lobby-data")
    .update({ call: 0 })
    .eq("name", lobbyName);

  if (error) console.error("updateCall error:", error.message);
};

const updateFold = async ({ lobbyName, id }) => {
  const { data, error } = await supabase
    .from("lobby-data")
    .select("folduser")
    .eq("name", lobbyName)
    .single();

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
};

io.on("connection", (socket) => {
  socket.on("join-lobby", ({ lobbyName }) => {
    if (!lobbyName) return;
    socket.join(lobbyName);
    socket.emit("joined-lobby", { lobbyName });
  });

  socket.on("leave-lobby", ({ lobbyName }) => {
    socket.leave(lobbyName);
  });

  socket.on("gamedetails", async (msg) => {
    const { lobbyName, currentTurn, numPlayer, foldedIds } = msg;

    socket.to(lobbyName).emit("gamedetails", msg);

    const next = await changeTurn({
      lobbyName,
      currentTurn,
      numPlayer,
      foldedIds,
    });

    io.to(lobbyName).emit("turn-change", { currentTurn: next });
  });

  socket.on("call", async (data) => {
    const { lobbyName } = data;
    socket.to(lobbyName).emit("call", data);
    await updateCall(lobbyName);
  });

  socket.on("fold", async (data) => {
    const { lobbyName } = data;
    socket.to(lobbyName).emit("fold", data);
    await updateFold(data);
  });

  socket.on("winner", async (data) => {
    const { lobbyName } = data;
    await updatePot(data);
    io.to(lobbyName).emit("winner", data);
  });

  socket.on("msg", (msg) => {
    const { lobbyName } = msg;
    if (lobbyName) {
      socket.to(lobbyName).emit("msg", msg);
    } else {
      socket.broadcast.emit("msg", msg);
    }
  });

  socket.on("disconnect", () => {});
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
