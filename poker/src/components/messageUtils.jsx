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
    <div className="fixed top-2 left-2 z-50 w-[85vw] max-w-[240px] sm:w-[200px]">
      <ScrollArea className="h-[120px] p-2 bg-white dark:bg-gray-800 rounded-md shadow-md">
        {message.map((item, index) => (
          <div
            key={index}
            className="text-xs text-gray-900 dark:text-gray-100 leading-snug"
          >
            {item.msg ? (
              <div>
                <strong className="text-[11px]">{item.name}:</strong> {item.msg}
              </div>
            ) : (
              <span className="text-yellow-400 font-bold text-[11px]">
                ({item.name}: {item.state})
              </span>
            )}
          </div>
        ))}
      </ScrollArea>
      <div className="flex gap-1 pt-2">
        <Input
          className="flex-1 h-7 text-xs px-2"
          placeholder="Message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={handleMessage}
          className="p-1 h-7 w-7 min-w-7"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-send-horizontal-icon"
          >
            <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
            <path d="M6 12h16" />
          </svg>
        </Button>
      </div>
    </div>
  );
};
