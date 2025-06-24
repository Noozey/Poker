import { useState, useEffect } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input.jsx";
import { Button } from "./ui/button";
import { useAuth } from "../context/authProvider.jsx";
import { useLobbyData } from "../context/lobbyData.jsx";

export const Message = ({ socket }) => {
  const { lobbyName } = useLobbyData();
  const [message, setMessage] = useState([]);
  const [input, setInput] = useState("");
  const { session } = useAuth();
  useEffect(() => {
    if (!socket) return;

    const msg = (data) => {
      setMessage((prevMessages) => [...prevMessages, data]);
    };

    socket.on("msg", (data) => {
      if (data.lobbyName === lobbyName) {
        msg(data);
        console.log(data);
        return;
      }
    });

    // Cleanup by removing the event
    return () => {
      socket.off("msg", msg);
    };
  }, [socket]);

  const handleMessage = () => {
    if (input.trim()) {
      socket.emit("msg", {
        name: session.user.user_metadata.name,
        msg: input,
        lobbyName,
      });
      setMessage((prev) => [
        ...prev,
        { name: session.user.user_metadata.name, msg: input, lobbyName },
      ]);
      setInput("");
    }
  };
  return (
    <div className="w-[200px]">
      <ScrollArea className="h-[100px]">
        {message.map((item, index) => (
          <div key={index}>
            {item.msg ? (
              <div>
                <strong>{item.name}:</strong> item.msg
              </div>
            ) : (
              <span className="text-yellow-400 font-bold">
                ({item.name}: {item.state})
              </span>
            )}
          </div>
        ))}
      </ScrollArea>
      <div className="flex gap-2 pt-4 w-full">
        <Input
          placeholder="Type Message ....."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button variant="outline" onClick={handleMessage}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-send-horizontal-icon lucide-send-horizontal"
          >
            <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
            <path d="M6 12h16" />
          </svg>
        </Button>
      </div>
    </div>
  );
};
