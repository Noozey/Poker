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

// create http server first
const server = http.createServer(app);

// then create socket.io server with proper CORS settings
export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Express configuration
app.use(cors({ origin: "*" }));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");

app.use("/lobbies", room);
app.use("/auth", auth);
app.use("/game", gamehandle);

//socket configurations
const updatePot = async (data) => {
  const { data: lobby, error } = await supabase
    .from("lobbies")
    .select("players")
    .eq("name", data.name)
    .single();

  if (error) {
    console.error("Error fetching lobby:", error.message);
    return;
  }

  const updatedPlayers = lobby.players.map((player) => {
    if (player.id === data.winner) {
      return {
        ...player,
        buy_in_amount: player.buy_in_amount + data.pot,
      };
    }
    return player;
  });

  const { error: updateError } = await supabase
    .from("lobbies")
    .update({ players: updatedPlayers })
    .eq("name", data.name);

  if (updateError) {
    console.error("Error updating pot:", updateError.message);
  } else {
  }

  if (data.pot !== 0) {
    const { updated, err } = await supabase
      .from("lobby-data")
      .update({ pot: 0 })
      .eq("name", data.name);
  }
};

const changeTurn = async (data) => {
  let changePlayer;
  data.currentTurn >= data.numPlayer
    ? (changePlayer = 1)
    : (changePlayer = data.currentTurn + 1);

  const { data: change, error } = await supabase
    .from("lobby-data")
    .update({ currentTurn: changePlayer })
    .eq("name", data.lobbyName);
};

const updateCall = async (data) => {
  if (!data) return;

  const { error } = await supabase
    .from("lobby-data")
    .update({ call: 0 })
    .eq("name", data.lobbyName);

  if (error) {
    console.error("Error updating call:", error);
  } else {
    console.log("Call updated to 0 successfully");
  }
};

io.on("connection", (socket) => {
  socket.on("gamedetails", (msg) => {
    socket.broadcast.emit("gamedetails", msg);
    socket.broadcast.emit("msg", msg);
    changeTurn(msg);
  });
  socket.on("msg", (msg) => {
    socket.broadcast.emit("msg", msg);
  });
  socket.on("winner", (data) => {
    updatePot(data);
  });
  socket.on("call", (data) => {
    updateCall(data);
    console.log("hello", data);
  });
  socket.on("disconnect", () => {});
});

server.listen(PORT, () => console.log("Server is alive on port.", PORT));
