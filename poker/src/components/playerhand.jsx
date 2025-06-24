import card from "../image/cardback.png";
import { playerPositions } from "./cardposition.jsx";
import { cn } from "../lib/utils.js";
import { useAuth } from "../context/authProvider.jsx";

const renderCard = (card, index, offset = 0) => (
  <div
    key={index}
    className={`absolute top-0 ${
      offset ? `left-[40px] z-20` : "left-0"
    } w-full h-full z-10 ${
      offset ? "rotate-10" : ""
    } bg-white text-black flex flex-col items-start p-2 rounded-lg`}
  >
    {card.rank}
    {card.suit.symbol}
    <div className="h-full w-full flex items-center justify-center text-6xl">
      {card.suit.symbol}
    </div>
  </div>
);

export const RenderPlayerHand = (playerIndex, playerCard, show) => {
  const { session } = useAuth();
  const player = playerCard[playerIndex];
  if (!player) return null;

  const pos = playerPositions[playerIndex];

  return session.user.id === player.id || show ? (
    <div
      key={playerIndex}
      className={`w-[100px] h-full ${pos.rowStart} ${pos.colStart} col-span-2 justify-self-center relative max-2xl:h-[80%] max-2xl:w-[75px]`}
    >
      {player.player === player.dealer ? (
        <>
          <div className="w-10 h-10 bg-yellow-400 rounded-full absolute bottom-1 left-1 z-50 shadow-md border-2 font-semibold border-yellow-600 flex items-center justify-center text-black">
            D
          </div>
        </>
      ) : null}

      {/* cards here */}
      {player.cards.map((card, idx) =>
        renderCard(card, idx, idx % 2 === 0 ? 9 : 0),
      )}
    </div>
  ) : (
    <div
      key={playerIndex}
      className={cn(
        "w-[120px] h-auto col-span-2 justify-self-center relative rounded-4xl  max-2xl:h-[80%] max-2xl:w-[90px]",
        pos.rowStart,
        pos.colStart,
      )}
    >
      {player.player === player.dealer ? (
        <>
          <div className="w-10 h-10 bg-yellow-400 rounded-full absolute bottom-1 left-1 z-50 shadow-md border-2 font-semibold border-yellow-600 flex items-center justify-center text-black">
            D
          </div>
        </>
      ) : null}

      <div className="absolute">
        <img src={card} className="w-full h-full" />
      </div>
      <div className="absolute rotate-[20deg]">
        <img src={card} className="w-full h-full" />
      </div>
    </div>
  );
};
