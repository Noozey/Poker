import { useState } from "react";
import { useAuth } from "./context/authProvider";
import { Button } from "@/components/ui/button";
import logo from "./image/Logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { api } from "./lib/axios";
import GameRoom from "./gameroom";
import { toast } from "sonner";
import { useLobbyData } from "./context/lobbyData";

export default function Lobby() {
  const { session, signOut } = useAuth();
  const [inRoom, setInRoom] = useState(false);

  return inRoom ? (
    <GameRoom />
  ) : (
    <div className="flex flex-col gap-10 items-center justify-center min-h-screen w-screen bg-gray-900 text-gray-100">
      {/* Logo Section */}
      <img src={logo} alt="Logo" className="h-48 w-48" />

      {/* User Info Section */}
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-4xl font-semibold">Welcome to BluffZone</h1>
        <p className="text-gray-400">You are logged in as:</p>
        <img
          src={session.user.user_metadata.avatar_url}
          alt="User avatar"
          className="rounded-full border-4 border-blue-500 shadow-md w-32 h-32 transform hover:scale-105 transition-transform duration-300 ease-in-out"
        />
        <h2 className="text-2xl font-semibold mt-2">
          {session.user.user_metadata.full_name}
        </h2>
      </div>

      {/* Action Buttons Section */}
      <div className="flex gap-4">
        <CreateLobby setInRoom={setInRoom} />
        <JoinLobby setInRoom={setInRoom} />
      </div>

      {/* Sign Out Button */}
      <Button
        variant="destructive"
        onClick={() => signOut()}
        className="shadow-md"
      >
        Sign Out
      </Button>
    </div>
  );
}

const CreateLobby = ({ setInRoom }) => {
  const { session } = useAuth();
  const [lobbyCode, setLobbyCode] = useState("");
  const [gameType, setGameType] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [password, setPassword] = useState("");
  const { setLobbyName } = useLobbyData();

  const handleCreate = async () => {
    if (!lobbyCode || !gameType || !maxPlayers || !buyInAmount) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      await api.post("/lobbies/create", {
        name: lobbyCode,
        game_type: gameType,
        max_players: maxPlayers,
        buy_in_amount: buyInAmount || 1000,
        password: password || null,
        creator_id: session.user.id,
        players: [
          {
            id: session.user.id,
            avatar_url: session.user.user_metadata.avatar_url,
            name: session.user.user_metadata.full_name,
            buy_in_amount: buyInAmount || 1000,
          },
        ],
      });
      setInRoom(true);
      setLobbyName(lobbyCode);
    } catch (error) {
      toast(
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ff0000"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-octagon-x-icon lucide-octagon-x"
          >
            <path d="m15 9-6 6" />
            <path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" />
            <path d="m9 9 6 6" />
          </svg>
          Name already in use
        </div>
      );

      console.log(error);
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Create Lobby</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-gray-700">
        <DialogHeader>
          <DialogTitle>
            Welcome, {session.user.user_metadata.full_name}
          </DialogTitle>
          <DialogDescription>
            Create the lobby by filling out the details below.
          </DialogDescription>
        </DialogHeader>

        {/* Basic Info */}
        <div className="grid gap-4 py-10">
          <div className="grid gap-2">
            <Label>Lobby Name</Label>
            <Input
              onChange={(e) => setLobbyCode(e.target.value)}
              placeholder="Enter lobby name"
            />
          </div>

          <div className="grid gap-2">
            <Label>Game Type</Label>
            <Select onValueChange={(value) => setGameType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select game type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texas">Texas Hold'em</SelectItem>
                <SelectItem value="omaha">Omaha</SelectItem>
                <SelectItem value="7stud">7-Card Stud</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Max Players</Label>
              <Input
                type="number"
                min={2}
                max={4}
                placeholder="Max 4"
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Buy-In Amount</Label>
              <Input
                type="number"
                placeholder="e.g. 1000"
                onChange={(e) => setBuyInAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Password</Label>
            <Input
              onChange={(e) => setPassword(e.target.value)}
              type="text"
              placeholder="Private lobby password"
            />
          </div>
        </div>
        {/* Advanced Options */}
        <div className="border-t pt-4 mt-4 grid gap-4">
          <div className="flex items-center justify-between">
            <Label>Show Last Hand</Label>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <Label>Allow Spectators</Label>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <Label>Enable Chat</Label>
            <Switch />
          </div>
        </div>

        {/* Action */}
        <div className="text-right">
          <Button onClick={handleCreate}>Create Lobby</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
const JoinLobby = ({ setInRoom }) => {
  const { session } = useAuth();
  const [lobbyCode, setLobbyCode] = useState("");
  const [password, setPassword] = useState("");
  const [points, setPoints] = useState(null);
  const { setLobbyName } = useLobbyData();

  const handleJoin = async () => {
    try {
      const response = await api.put("/lobbies/join", {
        lobby_code: lobbyCode,
        password: password,
        nickname: session.user.user_metadata.full_name,
        user_id: {
          id: session.user.id,
          avatar_url: session.user.user_metadata.avatar_url,
          name: session.user.user_metadata.full_name,
          buy_in_amount: points || 1000,
        },
      });
      if (response.data.success) {
        setInRoom(true);
        setLobbyName(lobbyCode);
      } else {
        toast(response.data.error || "Failed to join lobby.");
      }
    } catch (error) {
      console.error("Error joining lobby:", error);
      toast("Please check the code and password or lobby is full");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Join Lobby</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-gray-700">
        <DialogHeader>
          <DialogTitle>
            Welcome, {session.user.user_metadata.full_name}
          </DialogTitle>
          <DialogDescription>fill correct details</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Lobby Code</Label>
            <Input
              placeholder="Enter Lobby Code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Points (optional)</Label>
            <Input
              placeholder="set points"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleJoin}>Join Lobby</Button>
      </DialogContent>
    </Dialog>
  );
};
