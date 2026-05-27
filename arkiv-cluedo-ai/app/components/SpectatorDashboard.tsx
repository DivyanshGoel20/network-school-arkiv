"use client";

import React, { useState, useEffect } from "react";
import { useGameStore } from "../lib/game-store";
import { SUSPECTS, WEAPONS, ROOMS } from "../lib/game-engine";
import { SuspectId, WeaponId, RoomId, NotebookStatus } from "../lib/game-types";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ScrollText, Activity, FolderOpen, Tag } from "lucide-react";
import { BRAGA_CONFIG } from "../lib/arkiv";

export default function SpectatorDashboard() {
  const { players, notebooks, logs, activePlayerIndex, disproveResult, selectedSuggestion, activeMonologue } = useGameStore();
  const [activeTab, setActiveTab] = useState<"notebooks" | "timeline">("notebooks");
  const [selectedAgentTab, setSelectedAgentTab] = useState<SuspectId>("CIPHER");
  const [mounted, setMounted] = useState(false);

  const activePlayer = players[activePlayerIndex];

  // Auto-sync active agent selection when their turn arrives
  useEffect(() => {
    setMounted(true);
    if (activePlayer?.id) {
      setSelectedAgentTab(activePlayer.id);
    }
  }, [activePlayer?.id]);

  if (!mounted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border border-zinc-850 bg-zinc-950/20 rounded-3xl min-h-[550px]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest leading-none">
          Loading Spectator Dossier...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      
      {/* Dossier Folders tab system */}
      <div className="flex flex-col flex-1 bg-[#121318] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl min-h-[550px] relative">
        <div className="flex bg-[#0d0e12] border-b border-zinc-800 p-1.5 gap-1.5 z-10 relative">
          <button
            onClick={() => setActiveTab("notebooks")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-[10px] font-bold font-mono uppercase tracking-widest rounded-lg transition-all duration-300 folder-tab ${
              activeTab === "notebooks" 
                ? "bg-[#ebdcb9] border border-[#b89255] text-zinc-950 shadow-inner folder-tab-active" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
            }`}
          >
            <Brain className={`w-4 h-4 ${activeTab === "notebooks" ? "text-amber-800" : "text-zinc-500"}`} />
            Dossier Notebooks
          </button>
          
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-[10px] font-bold font-mono uppercase tracking-widest rounded-lg transition-all duration-300 folder-tab ${
              activeTab === "timeline" 
                ? "bg-[#ebdcb9] border border-[#b89255] text-zinc-950 shadow-inner folder-tab-active" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
            }`}
          >
            <ScrollText className={`w-4 h-4 ${activeTab === "timeline" ? "text-amber-800" : "text-zinc-500"}`} />
            Dossier Activity Logs
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className={`flex-1 p-5 overflow-y-auto transition-colors duration-500 ${activeTab === "notebooks" ? "bg-[#ebdcb9]/5" : "bg-[#121318]"}`}>
          
          {/* TAB 1: AI NOTEBOOKS (Real Manila Case File Folder) */}
          {activeTab === "notebooks" && (
            <div className="flex flex-col gap-6">
              
              {/* AI Reasoning thoughts overlay banner */}
              <AnimatePresence mode="wait">
                {activeMonologue ? (
                  <motion.div 
                    key="ai-monologue"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-start gap-3.5 p-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-md"
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" 
                      style={{ backgroundColor: activePlayer?.color }}
                    />
                    <div className="flex-1 text-[11px] font-mono leading-relaxed text-zinc-300">
                      <span className="font-bold text-[#b89255] block uppercase tracking-widest text-[9px] mb-1">
                        💭 {activePlayer?.name}'s Internal Monologue (0G Qwen AI)
                      </span>
                      <p className="text-zinc-400 italic font-sans text-xs">"{activeMonologue}"</p>
                    </div>
                  </motion.div>
                ) : selectedSuggestion && disproveResult ? (
                  <motion.div 
                    key="suggest-disprove"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-start gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
                  >
                    <Activity className="w-4.5 h-4.5 text-[#b89255] mt-0.5 shrink-0" />
                    <div className="flex-1 text-[11px] font-mono leading-relaxed text-zinc-300">
                      <span className="font-bold text-zinc-200 block uppercase tracking-wider mb-0.5">
                        Active Reasoner: {activePlayer?.name}
                      </span>
                      <span>
                        Suggested <b className="text-[#b89255]">{selectedSuggestion.suspect}</b> inside <b className="text-[#b89255]">{selectedSuggestion.room.replace("_", " ")}</b> using <b className="text-[#b89255]">{selectedSuggestion.weapon.replace("_", " ")}</b>. {disproveResult.text}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <div key="waiting" className="flex items-start gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                    <Activity className="w-4.5 h-4.5 text-zinc-600 mt-0.5 shrink-0" />
                    <div className="flex-1 text-[11px] font-mono leading-relaxed text-zinc-500 uppercase tracking-widest">
                      Waiting for active detective thoughts...
                    </div>
                  </div>
                )}
              </AnimatePresence>

              {/* Accordion Manila Tab Selectors */}
              <div className="flex flex-wrap gap-1 border-b border-[#b89255] pb-[1px] mt-2">
                {players.map((p) => {
                  const isSelected = selectedAgentTab === p.id;
                  const isActive = activePlayer?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedAgentTab(p.id)}
                      style={{
                        borderBottomColor: isSelected ? "#f4ebd0" : "#b89255",
                      }}
                      className={`px-4 py-2 text-[10px] font-bold font-typewriter uppercase tracking-widest border transition-all duration-200 rounded-t-lg -mb-[1px] relative flex items-center gap-2 ${
                        isSelected 
                          ? "bg-[#f4ebd0] border-[#b89255] text-zinc-950 z-10 font-black" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-350 z-0"
                      }`}
                    >
                      <div 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: p.color }}
                      />
                      <span>{p.name}</span>
                      {isActive && (
                        <span className="text-[7px] px-1 bg-cyan-100 text-cyan-800 font-bold rounded border border-cyan-800/40 leading-none">
                          Active
                        </span>
                      )}
                      {p.eliminated && (
                        <span className="text-[7px] px-1 bg-red-150 text-red-800 font-bold rounded border border-red-800/40 leading-none line-through">
                          Out
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Agent secret ledger notebook details - Real Manila Case File Dossier Sheet */}
              {(() => {
                const p = players.find(player => player.id === selectedAgentTab);
                if (!p) return null;
                const notebook = notebooks[p.id];
                if (!notebook) return null;
                const isActive = activePlayer?.id === p.id;

                return (
                  <div className="manila-dossier p-6 shadow-2xl relative border-2 border-[#b89255] rounded-b-xl rounded-tr-none animate-in fade-in duration-300">
                    
                    {/* Manila Folder Sheet Header */}
                    <div className="flex items-center justify-between border-b-2 border-[#1c1d22]/30 pb-3 mb-5">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: p.color }}
                        />
                        <h4 className="text-xs font-black font-typewriter tracking-widest text-[#1c1d22] uppercase">
                          CASE FILE LEDGER: {p.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="px-2.5 py-0.5 text-[8px] bg-cyan-100 text-cyan-850 border-2 border-cyan-850 font-bold rounded uppercase tracking-wider">
                            ACTIVE DETECTIVE
                          </span>
                        )}
                        {p.eliminated && (
                          <span className="px-2.5 py-0.5 text-[8px] bg-red-100 text-red-850 border-2 border-red-850 font-bold rounded uppercase tracking-wider">
                            ELIMINATED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Manila spreadsheet - Retro typewriter print */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1c1d22] font-typewriter">
                      
                      {/* Column 1: Suspects */}
                      <div className="flex flex-col gap-3 min-w-0">
                        <h5 className="text-[9px] text-[#1c1d22]/65 font-black uppercase tracking-widest border-b border-[#1c1d22]/20 pb-1.5 mb-1 flex items-center justify-between">
                          <span>Suspects</span>
                          <span className="text-[8px] font-normal">Ink Record</span>
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          {SUSPECTS.map((s) => {
                            const status = notebook.suspects[s.id];
                            return (
                              <div 
                                key={s.id} 
                                className="flex items-center justify-between px-3 py-2 bg-[#1c1d22]/5 border border-[#1c1d22]/15 rounded-xl hover:bg-[#1c1d22]/10 transition-all duration-200 min-w-0"
                              >
                                <span className={`text-[10.5px] font-bold min-w-0 truncate pr-1 ${status === "ELIMINATED" ? "line-through text-[#1c1d22]/40 font-normal" : "text-[#1c1d22]"}`}>
                                  {s.name}
                                </span>
                                <NotebookBadge status={status} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Column 2: Weapons */}
                      <div className="flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1c1d22]/20 md:pl-4 min-w-0">
                        <h5 className="text-[9px] text-[#1c1d22]/65 font-black uppercase tracking-widest border-b border-[#1c1d22]/20 pb-1.5 mb-1 flex items-center justify-between">
                          <span>Weapons</span>
                          <span className="text-[8px] font-normal">Ink Record</span>
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          {WEAPONS.map((w) => {
                            const status = notebook.weapons[w.id];
                            return (
                              <div 
                                key={w.id} 
                                className="flex items-center justify-between px-3 py-2 bg-[#1c1d22]/5 border border-[#1c1d22]/15 rounded-xl hover:bg-[#1c1d22]/10 transition-all duration-200 min-w-0"
                              >
                                <span className={`text-[10.5px] font-bold min-w-0 truncate pr-1 ${status === "ELIMINATED" ? "line-through text-[#1c1d22]/40 font-normal" : "text-[#1c1d22]"}`}>
                                  {w.name.replace("_", " ")}
                                </span>
                                <NotebookBadge status={status} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Column 3: Rooms */}
                      <div className="flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#1c1d22]/20 md:pl-4 min-w-0">
                        <h5 className="text-[9px] text-[#1c1d22]/65 font-black uppercase tracking-widest border-b border-[#1c1d22]/20 pb-1.5 mb-1 flex items-center justify-between">
                          <span>Locations</span>
                          <span className="text-[8px] font-normal">Ink Record</span>
                        </h5>
                        <div className="flex flex-col gap-1.5">
                          {ROOMS.filter(r => r.id !== "MAINFRAME").map((r) => {
                            const status = notebook.rooms[r.id];
                            return (
                              <div 
                                key={r.id} 
                                className="flex items-center justify-between px-3 py-2 bg-[#1c1d22]/5 border border-[#1c1d22]/15 rounded-xl hover:bg-[#1c1d22]/10 transition-all duration-200 min-w-0"
                              >
                                <span className={`text-[10.5px] font-bold min-w-0 truncate pr-1 ${status === "ELIMINATED" ? "line-through text-[#1c1d22]/40 font-normal" : "text-[#1c1d22]"}`}>
                                  {r.name}
                                </span>
                                <NotebookBadge status={status} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: SPECTATOR TIMELINE LOGS (Retro Stamped Docket List) */}
          {activeTab === "timeline" && (
            <div className="flex flex-col gap-3.5">
              {logs.map((log) => {
                const playerState = players.find((p) => p.id === log.player);
                const color = playerState?.color || "#ffffff";

                return (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all duration-300 shadow-md relative overflow-hidden font-mono text-zinc-300"
                  >
                    {/* Color side indicator bead */}
                    <div 
                      className="absolute top-0 bottom-0 left-0 w-1" 
                      style={{ backgroundColor: color }}
                    />

                    <div className="mt-0.5 shrink-0 p-1.5 bg-zinc-950 border border-zinc-800 rounded-lg">
                      {log.type === "dice" && <span className="text-sm select-none">🎲</span>}
                      {log.type === "move" && <span className="text-sm select-none">🏃</span>}
                      {log.type === "suggest" && <span className="text-sm select-none">💡</span>}
                      {log.type === "disprove" && <span className="text-sm select-none">👁️</span>}
                      {log.type === "fail_disprove" && <span className="text-sm select-none">🔎</span>}
                      {log.type === "accuse_success" && <span className="text-sm select-none">🏆</span>}
                      {log.type === "accuse_fail" && <span className="text-sm select-none">❌</span>}
                      {log.type === "setup" && <span className="text-sm select-none">⚙️</span>}
                    </div>

                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ color }} className="font-bold font-mono tracking-wider text-[11px]">
                          {playerState?.name || "Aether Manor"}
                        </span>
                        <span className="text-[8px] text-zinc-500 font-mono">
                          Turn {log.turn} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed font-sans text-xs">{log.text}</p>
                      {log.txHash && (
                        <div className="mt-2 flex items-center">
                          <a
                            href={`${BRAGA_CONFIG.explorerUrl}tx/${log.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 hover:border-[#b89255] hover:text-[#b89255] text-zinc-400 text-[8px] font-bold font-mono rounded uppercase tracking-wider transition-all duration-200"
                          >
                            <span>🔗 VIEW TRANSACTION ON BRAGA</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Retro Stamped high-contrast ledger ink status badge for the dossier
function NotebookBadge({ status }: { status: NotebookStatus }) {
  if (status === "HELD_BY_ME") {
    return (
      <span className="px-2.5 py-0.5 rounded border-2 font-bold text-[8.5px] tracking-wider uppercase leading-none shrink-0 bg-emerald-50 border-emerald-800 text-emerald-850 font-typewriter">
        MY HAND
      </span>
    );
  }
  if (status === "ELIMINATED") {
    return (
      <span className="px-2.5 py-0.5 rounded border-2 font-bold text-[8.5px] tracking-wider uppercase leading-none shrink-0 bg-zinc-100 border-zinc-400 text-zinc-550 font-typewriter line-through decoration-[#b91c1c] decoration-2">
        RULED OUT
      </span>
    );
  }
  if (status === "HELD_BY_OTHER") {
    return (
      <span className="px-2.5 py-0.5 rounded border-2 font-bold text-[8.5px] tracking-wider uppercase leading-none shrink-0 bg-amber-50 border-amber-800 text-amber-850 font-typewriter">
        DISPROVED
      </span>
    );
  }
  // Possible
  return (
    <span className="px-2.5 py-0.5 rounded border-2 font-bold text-[8.5px] tracking-wider uppercase leading-none shrink-0 bg-zinc-50 border-zinc-300 text-zinc-500 font-typewriter">
      POSSIBLE
    </span>
  );
}
