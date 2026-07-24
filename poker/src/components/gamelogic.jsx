import { api } from "../lib/axios";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useAuth } from "../context/authProvider.jsx";
import { checkWinner } from "./winnerUtils.jsx";
import { RenderPlayerHand } from "./playerhand.jsx";
import { Message } from "./messageUtils.jsx";
import Chips from "./pokerChips.jsx";
import { useLobbyData } from "../context/lobbyData.jsx";
import { toast } from "sonner";
import { ScrollArea } from "./ui/scroll-area.jsx";

export function GamePlay({ lobbyData, socket }) {
  const { session } = useAuth();
  const { lobbyName } = useLobbyData();
  const [cardData, setCardData] = useState([]);
  const [playerCard, setPlayerCard] = useState([]);
  const [tableCard, setTableCard] = useState([]);
  const [check, setCheck] = useState(Array(6).fill(false));
  const [pot, setPot] = useState(0);
  const [dealer, setDealer] = useState(null);
  const [show, setShow] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [raise, setRaise] = useState(0);
  const [call, setCall] = useState(0);
  const [playerAfterFold, setPlayerAfterFold] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState([]);

  const applyGameState = (data) => {
    setCardData(data.draweddeck ?? []);
    setPot(data.pot ?? 0);
    setCheck(data.check?.community ?? Array(6).fill(false));
    setDealer(data.dealer ?? null);
    setShow(data.show ?? false);
    setCurrentTurn(data.currentTurn ?? 1);
    setCall(data.call ?? 0);
    setPlayerAfterFold(data.folduser ?? []);
    setGameStarted(true);
  };

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const response = await api.get(`/game/data/${lobbyName}`);
        applyGameState(response.data);
      } catch (error) {
        if (error.response?.status === 404) {
          setGameStarted(false);
        } else {
          console.error("Failed to fetch game data:", error);
        }
      }
    };

    fetchGameData();
  }, [lobbyName]);

  useEffect(() => {
    if (!socket) return;

    const onGameData = (data) => applyGameState(data);

    const onCheckUpdate = (data) => {
      setCheck(data.check?.community ?? Array(6).fill(false));
    };

    const onTurnChange = ({ currentTurn: next }) => {
      setCurrentTurn(next);
    };

    const onRaiseUpdate = ({ pot: newPot, call: newCall }) => {
      if (newPot !== undefined) setPot(newPot);
      if (newCall !== undefined) setCall(newCall);
    };

    const onCall = () => setCall(0);

    const onFold = ({ id }) => {
      setPlayerAfterFold((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const onWinner = ({ winner, pot: wonPot }) => {
      toast(`Player ${winner} won the pot of ${wonPot}!`);
    };

    const onPlayerDisconnected = ({ playerId }) => {
      setDisconnectedPlayers((prev) =>
        prev.includes(playerId) ? prev : [...prev, playerId],
      );
    };

    const onPlayerConnected = ({ playerId }) => {
      setDisconnectedPlayers((prev) => {
        if (prev.includes(playerId)) {
          toast(`Player reconnected`);
        }
        return prev.filter((id) => id !== playerId);
      });
    };

    socket.on("game-data", onGameData);
    socket.on("check-update", onCheckUpdate);
    socket.on("turn-change", onTurnChange);
    socket.on("raise-update", onRaiseUpdate);
    socket.on("call", onCall);
    socket.on("fold", onFold);
    socket.on("winner", onWinner);
    socket.on("player-disconnected", onPlayerDisconnected);
    socket.on("player-connected", onPlayerConnected);

    return () => {
      socket.off("game-data", onGameData);
      socket.off("check-update", onCheckUpdate);
      socket.off("turn-change", onTurnChange);
      socket.off("raise-update", onRaiseUpdate);
      socket.off("call", onCall);
      socket.off("fold", onFold);
      socket.off("winner", onWinner);
      socket.off("player-disconnected", onPlayerDisconnected);
      socket.off("player-connected", onPlayerConnected);
    };
  }, [socket]);

  useEffect(() => {
    if (!cardData.length || !lobbyData?.players?.length) return;

    const numberOfPlayers = lobbyData.players.length;
    const holeCards = cardData.slice(0, numberOfPlayers * 2);
    const communityCards = cardData.slice(numberOfPlayers * 2);

    const dealt = lobbyData.players.map((player, idx) => ({
      player: idx + 1,
      id: player.id,
      cards: holeCards.slice(idx * 2, idx * 2 + 2),
      buy_in_amount: player.buy_in_amount,
      name: player.name,
      dealer,
    }));

    setPlayerCard(dealt);
    setTableCard(communityCards);
  }, [cardData, lobbyData, dealer]);

  useEffect(() => {
    if (!check.every(Boolean)) return;
    if (!pot) return;

    const activeIds =
      playerAfterFold.length > 0
        ? playerCard.filter((p) => !playerAfterFold.includes(p.id))
        : playerCard;

    if (activeIds.length > 0) {
      checkWinner(playerCard, tableCard, check, socket, pot, lobbyName);
    }

    setShow(true);
  }, [check]);

  const createCardData = async () => {
    await api.post(`/game/`, {
      playerNum: lobbyData.players.length,
      lobbyName,
    });
  };

  const newGame = async () => {
    setShow(false);
    setPlayerAfterFold([]);
    await createCardData();
  };

  const updateCheck = async (state) => {
    const player = playerCard.find((p) => p.id === session.user.id);
    if (!player) return;

    try {
      await api.post(`/game/check/${player.player}`, { lobbyName, state });
    } catch (error) {
      console.error("Check failed:", error);
      toast("Action failed — please try again.");
      return;
    }

    socket.emit("gamedetails", {
      name: session.user.user_metadata.name,
      state,
      currentTurn,
      numPlayer: lobbyData.players.length,
      lobbyName,
      foldedIds: playerAfterFold,
    });
  };

  const handleFold = () => {
    socket.emit("gamedetails", {
      name: session.user.user_metadata.name,
      state: "Fold",
      currentTurn,
      numPlayer: lobbyData.players.length,
      lobbyName,
      foldedIds: playerAfterFold,
    });
    socket.emit("fold", { lobbyName, id: session.user.id });

    setPlayerAfterFold((prev) =>
      prev.includes(session.user.id) ? prev : [...prev, session.user.id],
    );
  };

  const handleCheck = () => {
    if (call !== 0) {
      toast("You can't check — opponent has raised.");
      return;
    }
    updateCheck("check");
  };

  const handleCall = async () => {
    if (call === 0) {
      toast("Nothing to call — you can raise or check.");
      return;
    }

    const myCard = playerCard.find((p) => p.id === session.user.id);
    if (!myCard) return;

    const newAmount = myCard.buy_in_amount - call;

    try {
      await api.put("/game/raise", {
        lobbyName,
        id: session.user.id,
        buy_in_amount: newAmount,
        pot: pot + call,
        raise: 0, // clears the outstanding call amount once it's matched
      });
    } catch (error) {
      console.error("Call failed:", error);
      toast("Call failed — please try again.");
      return;
    }

    socket.emit("call", { lobbyName });
    await updateCheck("call");
  };

  const handleRaise = async () => {
    if (raise === 0) {
      toast("Set a raise amount first.");
      return;
    }

    const myCard = playerCard.find((p) => p.id === session.user.id);
    if (!myCard) return;

    const newAmount = myCard.buy_in_amount - raise;

    try {
      await api.put("/game/raise", {
        lobbyName,
        id: session.user.id,
        buy_in_amount: newAmount,
        pot: pot + raise,
        raise,
      });
    } catch (error) {
      console.error("Raise failed:", error);
      toast("Raise failed — please try again.");
      return;
    }

    await updateCheck("raised");
  };

  const myPlayer = playerCard.find((p) => p.id === session.user.id);
  const isMyTurn = playerCard[currentTurn - 1]?.id === session.user.id;
  const isFolded = playerAfterFold.includes(session.user.id);
  const allRevealed = check.every(Boolean);

  if (!gameStarted || !cardData.length) {
    return (
      <div className="bg-gray-800 w-full h-full flex flex-col items-center justify-center gap-6 text-gray-100">
        <p className="text-xl text-gray-400">
          Waiting for host to start the game...
        </p>
        {lobbyData.creator_id === session.user.id && (
          <Button
            className="bg-blue-800 hover:bg-blue-900 text-gray-50 font-semibold py-2 px-4 rounded-md"
            onClick={newGame}
          >
            Start Game
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 w-full h-full mb-auto z-0 grid grid-cols-12 grid-rows-5 justify-center p-5 gap-5">
      <Message socket={socket} />

      {/* Community Cards */}
      <div className="h-full row-start-2 row-end-5 col-start-4 col-end-10 max-md:col-start-3 max-md:col-end-8 max-2xl:row-start-3 max-2xl:col-start-5 max-xl:col-end-9 flex flex-col gap-6 justify-center items-center bg-green-900 max-xl:rounded-4xl rounded-full border-[20px] border-amber-950 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-4px_-4px_10px_rgba(0,0,0,0.5),0_0_20px_rgba(0,0,0,0.8)]">
        <div className="w-[80%] h-[150px] grid grid-cols-5 gap-7">
          {tableCard.map((card, index) =>
            check[index] ? (
              <div
                key={index}
                className="w-[100px] h-full bg-white text-black flex flex-col items-start p-2 rounded-lg justify-self-center max-2xl:h-[80%] max-2xl:w-[75px] max-md:h-[50%] max-md:w-[50px]"
              >
                {card.rank}
                {card.suit.symbol}
                <div className="h-full w-full flex items-center justify-center text-6xl max-md:text-2xl">
                  {card.suit.symbol}
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* Player Hands */}
      {playerCard.map((player, index) =>
        RenderPlayerHand(index, playerCard, show),
      )}

      {/* Action buttons — only shown on your turn and if not folded */}
      {isMyTurn && !isFolded && (
        <div className="row-start-5 max-md:col-start-10 col-start-6 col-span-2 justify-self-center relative z-50 grid grid-rows-2 max-2xl:grid-cols-2 gap-6 place-items-center max-2xl:col-start-11 max-2xl:row-start-4">
          {!allRevealed && (
            <div className="flex justify-center max-md:w-[50px] gap-3 max-2xl:flex-col max-2xl:col-start-1">
              <Button
                onClick={handleCall}
                className="bg-green-900 text-gray-50 font-semibold py-2 px-6 rounded-md shadow-md transition-transform hover:scale-105 hover:bg-green-800 hover:shadow-lg border border-gray-700"
              >
                Call
              </Button>
              <Button
                onClick={handleRaise}
                className="bg-yellow-900 text-gray-50 font-semibold py-2 px-6 rounded-md shadow-md transition-transform hover:scale-105 hover:bg-yellow-800 hover:shadow-lg border border-gray-700"
              >
                Raise
              </Button>
              <Button
                onClick={handleFold}
                className="bg-red-900 text-gray-50 font-semibold py-2 px-6 rounded-md shadow-md transition-transform hover:scale-105 hover:bg-red-800 hover:shadow-lg border border-gray-700"
              >
                Fold
              </Button>
              <Button
                onClick={handleCheck}
                className="bg-blue-900 text-gray-50 font-semibold py-2 px-6 rounded-md shadow-md transition-transform hover:scale-105 hover:bg-blue-800 hover:shadow-lg border border-gray-700"
              >
                Check
              </Button>
            </div>
          )}
          <div className="max-2xl:col-start-2">
            <Chips setRaise={setRaise} />
          </div>
        </div>
      )}

      {/* Sidebar: player list, pot, new game */}
      <div className="p-2 rounded-lg h-fit w-fit bg-gray-700 shadow-2xl flex flex-col max-[767px]:flex-row gap-4 max-[767px]:gap-2 col-start-11 2xl:col-start-12 col-span-2 justify-self-center max-w-[300px] sm:max-w-[200px] text-sm sm:p-2 max-md:col-start-10 max-sm:col-start-9">
        <div>
          <h3 className="text-gray-100 font-semibold mb-4 max-[767px]:mb-2">
            Players
          </h3>
          <ScrollArea className="h-[125px] max-[767px]:h-[100px]">
            <ul className="flex flex-col gap-2">
              {playerCard.map((player, index) => (
                <li
                  key={index}
                  className={`bg-gray-600 p-2 rounded-md max-[767px]:p-1 ${
                    currentTurn === player.player
                      ? "ring-2 ring-yellow-400"
                      : ""
                  } ${playerAfterFold.includes(player.id) ? "opacity-40 line-through" : ""}`}
                >
                  {session.user.id === player.id ? (
                    <div className="font-semibold text-green-400">
                      You: {player.buy_in_amount}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>
                        {player.name}: {player.buy_in_amount}
                      </span>
                      {disconnectedPlayers.includes(player.id) && (
                        <span className="text-xs text-red-400 font-medium">
                          (disconnected)
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <div className="flex flex-col gap-5 h-full justify-center items-center">
          <div className="max-[767px]:text-xs text-gray-100">Pot: {pot}</div>

          {lobbyData.creator_id === session.user.id && (
            <div className="flex justify-center mt-4 max-[767px]:mt-0 max-[767px]:ml-2">
              <Button
                className="bg-blue-800 hover:bg-blue-900 text-gray-50 font-semibold py-2 px-4 rounded-md shadow-md transform hover:translate-y-[-2px] transition-transform duration-300 ease-in-out max-[767px]:py-1 max-[767px]:px-2 max-[767px]:text-xs"
                onClick={newGame}
              >
                New Game
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
