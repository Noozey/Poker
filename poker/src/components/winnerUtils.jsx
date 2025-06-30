// utils/winnerUtils.js
import { Hand } from "pokersolver";
import { toast } from "sonner";

export const cardToString = (card) => {
  const rankMap = {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "T",
    J: "J",
    Q: "Q",
    K: "K",
    A: "A",
  };

  const suitMap = {
    "♥️": "h",
    "♦️": "d",
    "♣️": "c",
    "♠️": "s",
  };

  return `${rankMap[card.rank]}${suitMap[card.suit.symbol]}`;
};

export const checkWinner = (
  playerWinnerCheckList,
  tableCard,
  check,
  socket,
  pot,
  lobbyName
) => {
  const communityCards = tableCard.filter((_, idx) => check[idx]);

  const evaluated = playerWinnerCheckList.map((player) => {
    const hand = [...player.cards, ...communityCards];
    const stringHand = hand.map(cardToString);
    return {
      player,
      hand,
      result: Hand.solve(stringHand),
    };
  });

  evaluated.sort((a, b) =>
    Hand.winners([b.result, a.result])[0] === b.result ? 1 : -1
  );

  const winners = Hand.winners(evaluated.map((e) => e.result));
  const winningPlayers = evaluated
    .filter((e) => winners.includes(e.result))
    .map((e) => e.player);

  if (winningPlayers.length === 1) {
    socket.emit("winner", {
      winner: winningPlayers[0].id,
      name: lobbyName,
      pot,
    });
    toast.success(
      `${winningPlayers[0].name || "Player"} wins the pot with ${
        winningPlayers[0].name
      }!!`
    );
    return;
  } else {
    toast(
      `It's a tie between: ${winningPlayers
        .map((p) => p.name || "Player")
        .join(", ")}`
    );
    return;
  }
};
