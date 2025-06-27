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
    // Connect socket only once
    const socket = io("wss://poker-production-71d8.up.railway.app");

    socket.on("lobby-data", (data) => {
      if (data.name === lobbyName) {
        setLobbyData(data);
      }
    });
    socket.on("gamedetails", (msg) => {
      if (msg.lobbyName === lobbyName) {
        toast(`player ${msg.name} ${msg.state}`);
      }
    });

    setSocket(socket);

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [lobbyName]);

  useEffect(() => {
    const fetchLobbyData = async () => {
      try {
        const response = await api.get(`/lobbies/all/${lobbyName}`);
        if (response.status !== 200) {
          throw new Error("Failed to fetch lobby data.");
        }
        setLobbyData(response.data);
      } catch (error) {
        console.error("Error fetching lobby data.", error);
      }
    };
    fetchLobbyData();
    toast(
      <div className="flex gap-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#51ff2e"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-circle-check-icon lucide-circle-check"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        Connected to the room...
      </div>
    );
  }, [lobbyName]);

  if (!lobbyData) {
    return <div>loading....</div>;
  }

  return (
    <div className="bg-gray-800 absolute w-full h-full flex">
      <GamePlay lobbyName={lobbyName} lobbyData={lobbyData} socket={socket} />
    </div>
  );
}
