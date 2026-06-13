import { api } from "./lib/axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { GamePlay } from "./components/gamelogic.jsx";
import { useLobbyData } from "./context/lobbyData.jsx";

export default function GameRoom() {
  const [lobbyData, setLobbyData] = useState(null);
  const [socket, setSocket] = useState(null);
  const { lobbyName } = useLobbyData();

  useEffect(() => {
    const newSocket = io("http://localhost:3000/", {
      transports: ["polling", "websocket"],
    });

    newSocket.on("connect", () => {
      newSocket.emit("join-lobby", { lobbyName });
    });

    newSocket.on("lobby-data", (data) => {
      setLobbyData(data);
    });

    newSocket.on("gamedetails", (msg) => {
      toast(`${msg.name} ${msg.state}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("leave-lobby", { lobbyName });
      newSocket.disconnect();
    };
  }, [lobbyName]);

  useEffect(() => {
    const fetchLobbyData = async () => {
      try {
        const response = await api.get(`/lobbies/all/${lobbyName}`);
        setLobbyData(response.data);
      } catch (error) {
        console.error("Error fetching lobby data:", error);
      }
    };

    fetchLobbyData();

    toast(
      <div className="flex gap-4">
        {/* Fixed: JSX requires camelCase SVG props */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#51ff2e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        Connected to the room...
      </div>,
    );
  }, [lobbyName]);

  if (!lobbyData) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-900 text-gray-100">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-gray-800 absolute w-full h-full flex">
      <GamePlay lobbyData={lobbyData} socket={socket} />
    </div>
  );
}
