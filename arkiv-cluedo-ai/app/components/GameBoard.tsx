"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ROOMS, getCellType } from "../lib/game-engine";
import { useGameStore } from "../lib/game-store";
import { Position } from "../lib/game-types";
import {
  Laptop,
  Database,
  Leaf,
  Tv,
  Cpu,
  Flame,
  ShieldAlert,
  Binary,
  BookOpen,
  HelpCircle
} from "lucide-react";

const getRoomStyle = (id: string) => {
  switch (id) {
    case "QUANTUM_LABS":
      return { backgroundColor: "#1a2c30", borderColor: "#14b8a6", textColor: "text-cyan-400" }; // Teal Slate
    case "ARCHIVE_ROOM":
      return { backgroundColor: "#172237", borderColor: "#2563eb", textColor: "text-blue-400" }; // Classic Navy
    case "AETHER_GARDEN":
      return { backgroundColor: "#142d22", borderColor: "#10b981", textColor: "text-emerald-400" }; // Forest Sage
    case "HOLOGRAM_LOUNGE":
      return { backgroundColor: "#201c38", borderColor: "#6366f1", textColor: "text-indigo-400" }; // Royal Indigo
    case "MAINFRAME":
      return { backgroundColor: "#281630", borderColor: "#a855f7", textColor: "text-purple-400" }; // Majestic Plum
    case "REACTOR_CORE":
      return { backgroundColor: "#38161f", borderColor: "#f43f5e", textColor: "text-rose-400" }; // Deep Crimson
    case "CYPHER_VAULT":
      return { backgroundColor: "#1c1d22", borderColor: "#b89255", textColor: "text-zinc-300" }; // Carbon Charcoal
    case "CONTROL_DECK":
      return { backgroundColor: "#142d2a", borderColor: "#0d9488", textColor: "text-teal-400" }; // Sea Green
    case "NEURAL_LIBRARY":
      return { backgroundColor: "#382b16", borderColor: "#d97706", textColor: "text-amber-400" }; // Vintage Amber Gold
    default:
      return { backgroundColor: "#121318", borderColor: "#b89255", textColor: "text-[#b89255]" };
  }
};

const getRoomIcon = (id: string, className: string, color: string) => {
  switch (id) {
    case "QUANTUM_LABS": return <Laptop className={className} style={{ color }} />;
    case "ARCHIVE_ROOM": return <Database className={className} style={{ color }} />;
    case "AETHER_GARDEN": return <Leaf className={className} style={{ color }} />;
    case "HOLOGRAM_LOUNGE": return <Tv className={className} style={{ color }} />;
    case "MAINFRAME": return <Cpu className={className} style={{ color }} />;
    case "REACTOR_CORE": return <Flame className={className} style={{ color }} />;
    case "CYPHER_VAULT": return <ShieldAlert className={className} style={{ color }} />;
    case "CONTROL_DECK": return <Binary className={className} style={{ color }} />;
    case "NEURAL_LIBRARY": return <BookOpen className={className} style={{ color }} />;
    default: return <HelpCircle className={className} style={{ color }} />;
  }
};

export default function GameBoard() {
  const { players, activePlayerIndex, diceResult, activeAction } = useGameStore();
  const activePlayer = players[activePlayerIndex];

  // Helper to generate coordinates on a 12x12 grid
  const cells: Position[] = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      cells.push({ x, y });
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-between p-6 boardgame-wood-frame w-full shadow-2xl h-full">
      {/* Decorative brass corner angles */}
      <div className="absolute top-2 left-2 w-10 h-10 border-t-4 border-l-4 border-amber-600/30 rounded-tl-xl pointer-events-none select-none z-20" />
      <div className="absolute top-2 right-2 w-10 h-10 border-t-4 border-r-4 border-amber-600/30 rounded-tr-xl pointer-events-none select-none z-20" />
      <div className="absolute bottom-2 left-2 w-10 h-10 border-b-4 border-l-4 border-amber-600/30 rounded-bl-xl pointer-events-none select-none z-20" />
      <div className="absolute bottom-2 right-2 w-10 h-10 border-b-4 border-r-4 border-amber-600/30 rounded-br-xl pointer-events-none select-none z-20" />

      {/* Vintage boardgame title */}
      <div className="text-[10px] font-black tracking-[0.35em] text-[#b89255] uppercase font-mono pb-4 select-none drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.95)]">
        🕵️‍♂️ CASEBOOK: THE AETHER MANOR 🕵️‍♂️
      </div>

      {/* Outer physical shadows and inner velvet game field felt */}
      <div className="relative w-full aspect-square grid grid-cols-12 grid-rows-12 gap-1 p-2 boardgame-felt overflow-hidden">

        {/* Render grid floor cells */}
        {cells.map((cell) => {
          const cellType = getCellType(cell.x, cell.y);
          const isDoor = cellType === "door";
          const isWall = cellType === "wall";
          const isCenter = cellType === "room_center";

          let tileStyle = "";

          if (isDoor) {
            // Elegant brass door archways
            tileStyle = "bg-[#b89255]/20 border-2 border-[#b89255] rounded-md shadow-inner z-10";
          } else if (isWall) {
            tileStyle = "border-none pointer-events-none";
          } else if (isCenter) {
            tileStyle = "border-none pointer-events-none";
          } else {
            // Hallway cells: Mahogany wood parquet floor board
            tileStyle = "bg-[#23150f] hover:bg-[#2c1a12] border border-[#301d14] rounded shadow-inner transition-colors duration-200";
          }

          return (
            <div
              key={`${cell.x}-${cell.y}`}
              style={{
                gridColumn: cell.x + 1,
                gridRow: cell.y + 1,
              }}
              className={`relative flex items-center justify-center ${tileStyle}`}
            />
          );
        })}

        {/* Render large Room Overlays (Tactile Elevated Cardboard Tiles) */}
        {ROOMS.map((room) => {
          const gridColStart = room.minX + 1;
          const gridColEnd = room.maxX + 2;
          const gridRowStart = room.minY + 1;
          const gridRowEnd = room.maxY + 2;
          const roomStyle = getRoomStyle(room.id);

          return (
            <div
              key={room.id}
              style={{
                gridColumnStart: gridColStart,
                gridColumnEnd: gridColEnd,
                gridRowStart: gridRowStart,
                gridRowEnd: gridRowEnd,
                backgroundColor: roomStyle.backgroundColor,
                borderColor: roomStyle.borderColor,
              }}
              className="relative p-3 flex flex-col items-center justify-center border-2 rounded-2xl pointer-events-none select-none z-10 shadow-lg transition-all duration-500 hover:scale-[1.02]"
            >
              {/* Elegant inner gold/bronze trim line */}
              <div
                className="absolute inset-1.5 border rounded-xl pointer-events-none opacity-20"
                style={{ borderColor: roomStyle.borderColor }}
              />

              {/* Central Room Label and Icon */}
              <div className="flex flex-col items-center gap-1.5 text-center z-10">
                <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 shadow-md">
                  {getRoomIcon(room.id, "w-4.5 h-4.5 opacity-95", roomStyle.borderColor)}
                </div>
                <span className="text-[10px] font-black font-sans tracking-tight uppercase opacity-95 leading-tight mt-1 text-zinc-100">
                  {room.name}
                </span>
              </div>
            </div>
          );
        })}


        {/* Render Suspect Pawns as 3D Cylindrical Board Game Tokens */}
        <AnimatePresence>
          {players.map((p) => {
            const isActive = activePlayer?.id === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0 }}
                // Spring mechanical transitions for highly realistic bouncy hops
                transition={{ type: "spring", stiffness: 220, damping: 13 }}
                style={{
                  gridColumn: p.position.x + 1,
                  gridRow: p.position.y + 1,
                  zIndex: isActive ? 30 : 20,
                }}
                className="relative flex items-center justify-center p-0.5"
              >
                {/* Active Player halo aura - clean and subtle */}
                {isActive && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    style={{ backgroundColor: p.color }}
                    className="absolute w-10 h-10 rounded-full blur-[4px] pointer-events-none"
                  />
                )}

                {/* 3D cylindrical token body with brass/gold pedestal */}
                <div
                  style={{
                    borderColor: "#b89255", // Gold border
                    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.6)",
                    backgroundColor: p.color, // Solid player background color
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center select-none border-2 cursor-pointer transition-all duration-300 relative ${p.eliminated ? "opacity-35 border-zinc-800 scale-75 shadow-none" : "hover:scale-110 active:scale-95"
                    }`}
                >
                  {/* Clean solid circle inside showing initials with Courier Prime style */}
                  <div
                    className="absolute inset-0.5 rounded-full flex items-center justify-center font-black text-zinc-900 font-mono text-[11px] bg-zinc-100 border border-zinc-950/10 shadow-inner"
                  >
                    <span>{p.name[0]}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Board Status footer: Stamped paper card look */}
      <div className="w-full mt-5 flex items-center justify-between px-4 py-3 bg-[#121318] border border-zinc-800 rounded-2xl z-10 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping shrink-0" />
          <span className="text-[9px] text-zinc-400 font-mono tracking-widest uppercase">
            {activeAction === "idle" ? "WAITING FOR MOVE..." : `STATUS: ${activeAction.toUpperCase()}`}
          </span>
        </div>
        {diceResult !== null && (
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[9px] text-zinc-550 uppercase tracking-widest">DICE RESULT:</span>
            <div className="px-2.5 py-0.5 bg-zinc-900 border border-zinc-850 text-cyan-400 rounded-lg text-[9px] font-black shadow-[0_0_8px_rgba(6,182,212,0.15)]">
              🎲 {diceResult} UNITS
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

