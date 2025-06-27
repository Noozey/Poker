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
  const [playerCard, setPlayerCard] = useState([
    { player: 1, id: session.user.id, cards: [] },
    { player: 2, id: lobbyData.players[1]?.id || null, cards: [] },
  ]);
  const [tableCard, setTableCard] = useState([]);
  const [check, setCheck] = useState([
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [pot, setPot] = useState(0);
  const [dealer, setDealer] = useState(null);
  const [show, setShow] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [raise, setRaise] = useState(0);
  const [call, setCall] = useState(0);
  const [playerAfterFold, setPlayerAfterFold] = useState([]);

  useEffect(() => {
    const data = async () => {
      await api.get(`/game/data/${lobbyName}`).then((response) => {
        console.log(response.data[0]);
        setCardData(response.data[0].draweddeck);
        setPot(response.data[0].pot);
        setCheck(response.data[0].check.community);
        setDealer(response.data[0].dealer);
        setShow(response.data[0].show);
        setCurrentTurn(response.data[0].currentTurn);
      });
    };

    data();
  }, [lobbyName]);

  const createCardData = async () => {
    await api.post(`/game/`, {
      playerNum: lobbyData.players.length,
      lobbyName,
    });
  };

  const newGame = async () => {
    setShow(false);
    await createCardData();
  };

  useEffect(() => {
    const allRevealed = check.every((c) => c);

    if (allRevealed) {
      pot
        ? checkWinner(
            playerAfterFold || playerCard,
            tableCard,
            check,
            socket,
            pot,
            lobbyName,
          )
        : null;
      setShow(true);
    }
  }, [check]);

  useEffect(() => {
    if (!socket) return;

    const handleGameData = (data) => {
      setCardData(data.draweddeck);
      setPot(data.pot);
      setCheck(data.check.community);
      setDealer(data.dealer);
      setShow(data.show);
      setCurrentTurn(data.currentTurn);
      setCall(data.call);
    };

    const onGameData = (data) => {
      if (data.name === lobbyName) {
        handleGameData(data);
      }
    };

    socket.on("game-data", onGameData);

    return () => {
      socket.off("game-data", onGameData);
    };
  }, [lobbyName, socket]);

  useEffect(() => {
    const getCardDetails = () => {
      const numberOfPlayers = lobbyData.players.length;
      // first 2 cards for each player
      const cards = cardData.slice(0, numberOfPlayers * 2);
      // rest for the table
      const table = cardData.slice(numberOfPlayers * 2);

      // deal cards to players
      const tempPlayerCards = lobbyData.players.map((player, idx) => {
        return {
          player: idx + 1,
          id: player.id,
          cards: cards.slice(idx * 2, idx * 2 + 2),
          buy_in_amount: player.buy_in_amount,
          name: player.name,
          dealer,
        };
      });

      setPlayerCard(tempPlayerCards);
      setTableCard(table);
    };

    getCardDetails();
  }, [cardData, lobbyData, dealer]);

  if (!cardData) {
    return <div>Loading</div>;
  }

  const updateCheck = async (data) => {
    let player = playerCard.find((p) => p.id === session.user.id);
    if (!player) return;

    try {
      await api.post(`/game/check/${player.player}`, {
        lobbyName,
        state: data,
      });
    } catch (error) {
      console.error("Check failed.", error);
    }
    socket.emit("gamedetails", {
      name: session.user.user_metadata.name,
      state: data,
      currentTurn,
      numPlayer: lobbyData.players.length,
      lobbyName,
    });
  };

  const handleFold = async () => {
    socket.emit("gamedetails", {
      name: session.user.user_metadata.name,
      state: "Fold",
      currentTurn,
      numPlayer: lobbyData.players.length,
      lobbyName,
    });
    socket.emit("fold", { lobbyName: lobbyName, id: session.user.id });

    const index = playerCard.findIndex((data) => data.id === session.user.id);
    if (index !== -1) {
      const newPlayerList = playerCard.filter((_, i) => i !== index);
      setPlayerAfterFold(newPlayerList);
    }
  };

  const handleCheck = async () => {
    if (call !== 0) {
      toast("You can't check as opponent has rasied");
      return;
    }
    updateCheck("check");
  };

  const handleCall = async () => {
    if (call === 0) {
      toast("You can raise or check");
      return;
    }

    const updatedPlayerCard = playerCard.map((player) =>
      player.id === session.user.id
        ? { ...player, buy_in_amount: player.buy_in_amount - call }
        : player,
    );

    const updatedPlayer = updatedPlayerCard.find(
      (p) => p.id === session.user.id,
    );

    socket.emit("call", { lobbyName });
    updateCheck("call");

    if (updatedPlayer) {
      await api.put("game/raise", {
        lobbyName,
        id: updatedPlayer.id,
        buy_in_amount: updatedPlayer.buy_in_amount,
        pot: pot + call,
      });
    }
  };

  const handleRaise = async () => {
    if (raise === 0) {
      toast("You can't raise with 0 vlaue in the pot");
      return;
    }
    updateCheck("raised");
    const updatedPlayerCard = playerCard.map((player) =>
      player.id === session.user.id
        ? { ...player, buy_in_amount: player.buy_in_amount - raise }
        : player,
    );

    const updatedPlayer = updatedPlayerCard.find(
      (p) => p.id === session.user.id,
    );

    if (updatedPlayer) {
      console.log();
      await api.put("game/raise", {
        lobbyName,
        id: updatedPlayer.id,
        buy_in_amount: updatedPlayer.buy_in_amount,
        pot: pot + raise,
        raise,
      });
    }
  };

  return (
    <div className="bg-gray-800 w-full h-full mb-auto z-0 grid grid-cols-12 grid-rows-5 justify-center p-5 gap-5">
      <Message socket={socket} />
      {/* Table Cards */}
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
                <div className="h-full w-full flex items-center justify-center text-6xl max-md:text-2xl ">
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

      {playerCard[currentTurn - 1].id === session.user.id ? (
        <div className="row-start-5 max-md:col-start-10 col-start-6 col-span-2 justify-self-center relative z-50 grid grid-rows-2 max-2xl:grid-cols-2 gap-6 place-items-center max-2xl:col-start-11 max-2xl:row-start-4">
          {/* Button row */}
          {check.every((value) => value === true) ? null : (
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
                onClick={() => handleCheck("Checked")}
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
      ) : null}

      <div
        className="p-2 rounded-lg h-fit w-fit bg-gray-700
        shadow-2xl flex flex-col max-[767px]:flex-row gap-4 max-[767px]:gap-2 col-start-11 2xl:col-start-12 col-span-2 justify-self-center
max-w-[300px] sm:max-w-[200px] text-sm sm:p-2 max-md:col-start-10 max-sm:col-start-9"
      >
        <div>
          <h3 className="text-gray-100 font-semibold mb-4 max-[767px]:mb-2">
            Players
          </h3>
          <ScrollArea className="h-[125px] max-[767px]:h-[100px]">
            <ul className="flex flex-col gap-2">
              {playerCard.map((player, index) => (
                <li
                  key={index}
                  className="bg-gray-600 p-2 rounded-md max-[767px]:p-1"
                >
                  {session.user.id === player.id ? (
                    <div className="font-semibold text-green-400">
                      Me: {player.buy_in_amount}
                    </div>
                  ) : (
                    <div>
                      {player.name}: {player.buy_in_amount}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
        <div className="flex flex-col gap-5 h-full justify-center items-center">
          <div className="max-[767px]:text-xs">Pot Size: {pot}</div>

          {lobbyData.creator_id === session.user.id ? (
            <div className="flex justify-center mt-4 max-[767px]:mt-0 max-[767px]:ml-2">
              <Button
                className="bg-blue-800 hover:bg-blue-900 text-gray-50 font-semibold py-2 px-4 rounded-md shadow-md transform hover:translate-y-[-2px] transition-transform duration-300 ease-in-out
        max-[767px]:py-1 max-[767px]:px-2 max-[767px]:text-xs"
                onClick={newGame}
              >
                New Game
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
