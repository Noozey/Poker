import React, { useState } from "react";
import { motion } from "framer-motion";

function PokerChip({
  color = "red",
  value = "100",
  isButton = false,
  onClick,
}) {
  const colorClass =
    color === "red"
      ? "bg-gradient-to-br from-red-700 to-red-500"
      : color === "blue"
        ? "bg-gradient-to-br from-blue-900 to-blue-500"
        : color === "black"
          ? "bg-gradient-to-br from-gray-900 to-gray-700"
          : color === "green"
            ? "bg-gradient-to-br from-green-700 to-green-500"
            : "bg-gradient-to-br from-gray-700 to-gray-500";

  return (
    <div
      className={`flex items-center justify-center rounded-full border-8 border-gray-50 shadow-xl transform ${
        isButton
          ? "rotate-12 hover:rotate-0 hover:scale-110 cursor-pointer"
          : "rotate-12"
      } p-2 ${colorClass} w-16 h-16 relative transition-all duration-200`}
      style={{ boxShadow: "0 6px 12px rgb(0 0 0 / 0.4)" }}
      onClick={onClick}
    >
      {/* Inner circle for poker chip */}
      <div className="flex items-center justify-center rounded-full w-10 h-10 bg-gray-100 shadow-inner">
        <span className="text-gray-900 font-bold text-xs drop-shadow-sm">
          {value}
        </span>
      </div>

      {/* White segments around the chip border - scaled down */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-2 bg-gray-50 rounded-b-sm shadow-sm" />
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3 h-2 bg-gray-50 rounded-t-sm shadow-sm" />
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-2 h-3 bg-gray-50 rounded-r-sm shadow-sm" />
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-3 bg-gray-50 rounded-l-sm shadow-sm" />
    </div>
  );
}

function DropZone({ onDrop, droppedChips, isActive, setRaise }) {
  const totalValue = droppedChips.reduce(
    (sum, chip) => sum + parseInt(chip.value),
    0,
  );
  setRaise(totalValue);

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 rounded-t-2xl border-4 border-dashed border-b-0 transition-all duration-300 z-30 flex items-center justify-center ${
        isActive
          ? "border-green-400 bg-green-900/20 backdrop-blur-sm"
          : "border-amber-600/50 bg-green-900/10 hover:border-amber-600/70"
      }`}
    >
      {droppedChips.length > 0 ? (
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-200 mb-1">
              {totalValue}
            </div>
            <div className="text-sm text-amber-300">Pot Total</div>
          </div>
          <div className="flex flex-wrap gap-1 justify-center max-w-md">
            {droppedChips.slice(0, 4).map((chip, index) => (
              <div key={index} className="transform scale-60 -m-1">
                <PokerChip color={chip.color} value={chip.value} />
              </div>
            ))}
            {droppedChips.length > 4 && (
              <div className="text-sm text-amber-300 ml-2 self-center">
                +{droppedChips.length - 4} more
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-amber-300 text-lg font-medium mb-1">
            Betting Area
          </div>
          <div className="text-amber-400/70 text-sm">
            Drag chips here to bet
          </div>
        </div>
      )}
    </div>
  );
}

const Chips = ({ setRaise }) => {
  const [spawnedChips, setSpawnedChips] = useState([]);
  const [droppedChips, setDroppedChips] = useState([]);
  const [nextId, setNextId] = useState(1);
  const [dropZoneActive, setDropZoneActive] = useState(false);

  const chipTypes = [
    { color: "red", value: "25" },
    { color: "blue", value: "50" },
    { color: "green", value: "100" },
    { color: "black", value: "500" },
  ];

  const spawnChip = (chipType, event) => {
    const x = event.clientX;
    const y = event.clientY;

    const newChip = {
      id: nextId,
      ...chipType,
      x: Math.max(32, Math.min(x, window.innerWidth - 96)),
      y: Math.max(32, Math.min(y, window.innerHeight - 96)),
    };

    setSpawnedChips((prev) => [...prev, newChip]);
    setNextId((prev) => prev + 1);
  };

  const removeChip = (chipId) => {
    setSpawnedChips((prev) => prev.filter((chip) => chip.id !== chipId));
  };

  const handleDragEnd = (event, info, chip) => {
    const tableElement = document.querySelector(".bg-green-900.rounded-full");
    if (!tableElement) {
      setDropZoneActive(false);
      return;
    }

    const tableRect = tableElement.getBoundingClientRect();
    const dropZoneRect = {
      left: tableRect.left,
      right: tableRect.right,
      top: tableRect.bottom - 96, // 24 * 4 for h-24
      bottom: tableRect.bottom,
    };

    const chipX = info.point.x;
    const chipY = info.point.y;

    // Check if chip is dropped in the drop zone (bottom area of table)
    if (
      chipX >= dropZoneRect.left &&
      chipX <= dropZoneRect.right &&
      chipY >= dropZoneRect.top &&
      chipY <= dropZoneRect.bottom
    ) {
      // Add to dropped chips
      setDroppedChips((prev) => [...prev, chip]);
      // Remove from spawned chips
      setSpawnedChips((prev) => prev.filter((c) => c.id !== chip.id));
    }

    setDropZoneActive(false);
  };

  const clearDropZone = () => {
    setDroppedChips([]);
  };

  return (
    <>
      {/* Chip Selection Buttons - Fits in your grid area */}
      <div className="flex max-2xl:flex-col justify-center gap-2 h-fit">
        {chipTypes.map((chipType, index) => (
          <PokerChip
            key={index}
            color={chipType.color}
            value={chipType.value}
            isButton={true}
            onClick={(e) => spawnChip(chipType, e)}
          />
        ))}
      </div>

      {/* Spawned Chips - Positioned absolutely over the entire game */}
      {spawnedChips.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          {spawnedChips.map((chip) => (
            <motion.div
              key={chip.id}
              drag
              dragMomentum={false}
              dragConstraints={{
                left: 32,
                right: window.innerWidth - 96,
                top: 32,
                bottom: window.innerHeight - 96,
              }}
              initial={{
                x: chip.x,
                y: chip.y,
                scale: 0.3,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
              onDoubleClick={() => removeChip(chip.id)}
              onDragStart={() => setDropZoneActive(true)}
              onDragEnd={(event, info) => handleDragEnd(event, info, chip)}
              whileHover={{ scale: 1.1, rotate: 0 }}
              whileDrag={{ scale: 1.2, zIndex: 1000, rotate: 0 }}
              style={{
                left: 0,
                top: 0,
                touchAction: "none",
              }}
            >
              <PokerChip color={chip.color} value={chip.value} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Drop Zone - Positioned to cover bottom of poker table */}
      {dropZoneActive ? null : null}
      <div className="fixed inset-0 pointer-events-none z-30">
        <div className="relative w-full h-full">
          {/* This targets the poker table area - adjust positioning as needed */}
          <div className="absolute top-1/2 left-1/2 max-md:left-1/3 transform -translate-x-1/2 -translate-y-1/2 w-[25%] h-[500px] max-xl:h-[350px]">
            <DropZone
              droppedChips={droppedChips}
              isActive={dropZoneActive}
              setRaise={setRaise}
              className={dropZoneActive}
            />
          </div>
        </div>
      </div>

      {/* Clear All Button - Only shows when chips exist */}
      {spawnedChips.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-4 left-4 bg-red-700 hover:bg-red-800 text-gray-50 px-3 py-2 rounded-md shadow-lg transition-colors z-50 text-sm font-semibold"
          onClick={() => setSpawnedChips([])}
        >
          Clear Chips
        </motion.button>
      )}

      {/* Clear Drop Zone Button - Only shows when there are dropped chips */}
      {droppedChips.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-4 left-32 bg-amber-700 hover:bg-amber-800 text-gray-50 px-3 py-2 rounded-md shadow-lg transition-colors z-50 text-sm font-semibold"
          onClick={clearDropZone}
        >
          Clear Pot
        </motion.button>
      )}
    </>
  );
};

export default Chips;
