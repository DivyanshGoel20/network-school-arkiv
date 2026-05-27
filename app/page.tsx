"use client";

import React, { useEffect, useState } from "react";
import { useGameStore } from "./lib/game-store";
import { SUSPECTS, WEAPONS, ROOMS } from "./lib/game-engine";
import GameBoard from "./components/GameBoard";
import SpectatorDashboard from "./components/SpectatorDashboard";
import { getAddressFromPrivateKey, BRAGA_CONFIG } from "./lib/arkiv";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ServerCrash,
  Lock,
  Unlock,
  AlertTriangle,
  Copy,
  Check,
  FolderOpen,
  Fingerprint,
  Search
} from "lucide-react";

export default function Home() {
  const {
    gameId,
    status,
    isPlaying,
    winner,
    envelope,
    encryptedEnvelope,
    sessionTxHash,
    transactionError,
    writePrivateKey,
    togglePlay,
    resetGame,
    initializeGame,
    executeSingleStep,
  } = useGameStore();

  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Sync mounting to prevent Next.js hydration mismatches on client-derived keys
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-running simulation step loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isPlaying && status === "playing" && gameId) {
      const tick = async () => {
        await executeSingleStep();
        timer = setTimeout(tick, 2000); // 2-second constant velocity ticks
      };
      timer = setTimeout(tick, 2000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isPlaying, status, gameId, executeSingleStep]);

  // Automated first-boot initialization
  useEffect(() => {
    const autoInit = async () => {
      setLoading(true);
      try {
        await initializeGame();
      } catch (err: any) {
        setInitError(err?.message || "Failed to initialize game environment");
      } finally {
        setLoading(false);
      }
    };
    autoInit();
  }, [initializeGame]);

  const handleInit = async () => {
    setLoading(true);
    setInitError(null);
    try {
      resetGame();
      await initializeGame();
    } catch (err: any) {
      setInitError(err?.message || "Failed to initialize game environment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden pb-12">

      {/* 1. Header Navigation Bar */}
      <header className="relative border-b border-zinc-800 bg-[#121318] px-6 py-4 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] overflow-hidden group">
            {/* Glowing decorative background pattern */}
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-orange-500/10 opacity-50 group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
            {/* The Icon inside */}
            <Fingerprint className="w-7 h-7 text-amber-400 group-hover:text-amber-300 relative z-10 transition-all duration-300 group-hover:scale-105" />
            <Search className="w-3.5 h-3.5 text-zinc-100 absolute bottom-1.5 right-1.5 z-20 stroke-[3px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-widest text-zinc-100 uppercase font-mono drop-shadow-[0_2px_10px_rgba(245,158,11,0.1)]">
              CASEBOOK
            </h1>
          </div>
        </div>

        {/* Global Match Controls & Live System indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">

          {/* Match Action Controllers in Header */}
          <div className="flex items-center gap-2 border-r border-zinc-800 pr-4 mr-2">
            <button
              onClick={togglePlay}
              disabled={status !== "playing" || loading}
              className={`py-1.5 px-3 rounded-lg font-bold font-mono text-[18px] uppercase tracking-widest flex items-center justify-center gap-1.5 border transition-all duration-200 ${isPlaying
                  ? "bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-amber-500"
                  : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-950 font-extrabold shadow-inner disabled:opacity-50"
                }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 shrink-0" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 shrink-0 fill-zinc-950" /> Play
                </>
              )}
            </button>

            <button
              onClick={handleInit}
              disabled={loading}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-red-400 rounded-lg transition-all"
              title="Reset & Initialize New Match"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-[16px] text-zinc-500 uppercase tracking-widest mb-0.5">Session ID</span>
            <span className="text-zinc-300 font-bold">{gameId || "PREPARING..."}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full shadow-inner">
            <div className={`w-1.5 h-1.5 rounded-full ${status === "playing" ? "bg-cyan-500 animate-pulse" : status === "finished" ? "bg-emerald-500" : "bg-zinc-600"}`} />
            <span className="text-[18px] font-bold text-zinc-300 uppercase tracking-tight">
              {status}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Transaction Blocked Banner (Gas required) */}
      {mounted && transactionError && (
        <div className="w-full max-w-5xl mx-auto px-6 mt-4">
          <div className="relative overflow-hidden p-5 bg-[#171410] border border-amber-500/20 rounded-2xl shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-zinc-900 border border-amber-500/30 rounded-xl text-amber-500 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black font-mono tracking-widest uppercase text-amber-400">
                    TRANSACTION BLOCKED — BRAGA GAS REQUIRED
                  </h3>
                  <p className="text-[22px] text-zinc-400 max-w-2xl leading-relaxed mt-1 font-sans">
                    The active AI agent attempted to submit a transaction to the Arkiv Braga testnet ledger, but the write failed due to a gas shortage. Please fund the host account below using the official Braga faucet to resume the match:
                  </p>

                   {/* Host account address */}
                   <div className="flex items-center gap-3 mt-3 flex-wrap">
                     <div className="flex items-center justify-between gap-3 px-3.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[18px] font-mono font-bold text-zinc-300 shadow-inner">
                       <span className="text-zinc-500 mr-1 select-none">HOST ADDRESS:</span>
                       <span className="select-all break-all">
                         {mounted ? getAddressFromPrivateKey(writePrivateKey) : "..."}
                       </span>
                       <button
                         onClick={() => {
                           if (mounted) {
                             navigator.clipboard.writeText(getAddressFromPrivateKey(writePrivateKey));
                             setCopiedHost(true);
                             setTimeout(() => setCopiedHost(false), 2000);
                           }
                         }}
                         className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded transition-all"
                         title="Copy host address"
                       >
                         {copiedHost ? (
                           <Check className="w-3 h-3 text-emerald-400" />
                         ) : (
                           <Copy className="w-3 h-3" />
                         )}
                       </button>
                     </div>

                    <a
                      href={BRAGA_CONFIG.faucetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-[#b89255] hover:bg-[#c9a366] text-zinc-950 font-bold font-mono text-[9px] tracking-widest uppercase rounded-lg transition-all duration-200"
                    >
                      Open Braga Faucet
                    </a>
                  </div>
                </div>
              </div>

              {/* Action error snippet detail */}
              <div className="flex flex-col items-end shrink-0 justify-center">
                <span className="text-[16px] font-mono font-bold text-zinc-500 uppercase tracking-widest">RPC Error Message</span>
                <div className="max-w-[280px] bg-zinc-950 border border-zinc-900 px-3 py-2.5 rounded-xl text-[18px] font-mono text-red-400 max-h-16 overflow-y-auto mt-1 break-words shadow-inner leading-normal">
                  {transactionError}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Dashboard Layout Stack */}
      <main className="flex-1 w-full max-w-[1750px] mx-auto px-6 mt-6 flex flex-col gap-6 relative z-10">

        {/* TAMPER-PROOF CASE FILE HORIZONTAL BANNER (FULL WIDTH) AT THE TOP */}
        {encryptedEnvelope && (
          <section className="w-full">
            <div className="manila-dossier p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-2 shadow-lg w-full">
              {/* Left block: Header & Status */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                {status === "finished" ? (
                  <div className="p-1 bg-[#1c1d22]/10 border border-[#1c1d22]/20 rounded-xl">
                    <Unlock className="w-4 h-4 text-emerald-800" />
                  </div>
                ) : (
                  <div className="wax-seal shrink-0" />
                )}
                <div className="flex flex-col leading-tight font-typewriter">
                  <span className="text-[20px] font-black text-[#1c1d22] uppercase tracking-widest">
                    TAMPER-PROOF CASE FILE
                  </span>
                  <span className="text-[16px] text-[#1c1d22]/60 uppercase tracking-tight">
                    On-Chain Cryptographic Proof (RSA-OAEP)
                  </span>
                </div>
              </div>

              {/* Middle block: Ciphertext or Decrypted Content */}
              <div className="flex-1 w-full md:w-auto font-typewriter">
                {status === "finished" && envelope ? (
                  <div className="p-2 bg-emerald-100/50 border border-dashed border-emerald-800/40 rounded-lg text-center flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[16px] text-emerald-800 uppercase tracking-widest font-black">
                      CASE SUCCESSFULLY SOLVED!
                    </span>
                    <div className="flex flex-wrap justify-center gap-3 text-[20px] font-black text-zinc-900 uppercase mt-1">
                      <span>Suspect: <span className="text-rose-800 bg-[#1c1d22]/5 px-1.5 py-0.5 rounded">{envelope.suspect}</span></span>
                      <span>Weapon: <span className="text-cyan-800 bg-[#1c1d22]/5 px-1.5 py-0.5 rounded">{envelope.weapon.replace("_", " ")}</span></span>
                      <span>Room: <span className="text-amber-800 bg-[#1c1d22]/5 px-1.5 py-0.5 rounded">{envelope.room.replace("_", " ")}</span></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-[#1c1d22]/5 border border-[#1c1d22]/15 px-3 py-1.5 rounded-lg justify-between shadow-inner">
                    <span className="text-[16px] text-[#1c1d22]/60 uppercase tracking-wider font-black whitespace-nowrap">
                      ON-CHAIN COMMITMENT:
                    </span>
                    <div className="text-[17px] text-[#1c1d22] break-all select-all font-typewriter leading-normal max-w-none">
                      {encryptedEnvelope}
                    </div>
                    <span className="text-[15px] text-[#1c1d22]/40 italic shrink-0 hidden lg:inline">
                      (Committed on Braga)
                    </span>
                  </div>
                )}
              </div>

              {/* Right block: Action Proof Link & Status Badge */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
                <span className={`px-2 py-0.5 text-[16px] font-bold font-typewriter rounded-md border-2 uppercase ${status === "finished"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-800"
                    : "bg-red-50 text-red-800 border-red-800/80 stamp-classified"
                  }`}>
                  {status === "finished" ? "Decrypted" : "Secured"}
                </span>

                {sessionTxHash && (
                  <a
                    href={`${BRAGA_CONFIG.explorerUrl}tx/${sessionTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1c1d22]/10 border border-[#1c1d22]/20 hover:border-amber-900/65 hover:bg-amber-900/10 text-amber-900 text-[16px] font-bold font-mono rounded-md uppercase tracking-wider transition-all duration-200"
                  >
                    <span>🔗 View on Braga</span>
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SIDE-BY-SIDE SPLIT GRID: Left (GameBoard) & Right (SpectatorDashboard) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full">

          {/* Left Column: GameBoard centerpiece */}
          <section className="lg:col-span-5 w-full flex flex-col h-full">
            {initError ? (
              <div className="p-8 border border-red-950/40 bg-red-950/15 rounded-2xl flex flex-col items-center justify-center text-center text-xs text-red-400">
                <ServerCrash className="w-8 h-8 mb-2 animate-bounce" />
                <span className="font-bold mb-1 uppercase tracking-wider">Failed to Sync to Arkiv Braga</span>
                <p className="opacity-70 leading-relaxed max-w-xs">{initError}</p>
                <button
                  onClick={handleInit}
                  className="mt-4 px-3.5 py-2 bg-red-900 hover:bg-red-800 text-zinc-100 rounded-lg font-bold transition-all uppercase text-[20px]"
                >
                  Retry Setup
                </button>
              </div>
            ) : (
              <GameBoard />
            )}
          </section>

          {/* Right Column: Spacious Dossier Notebooks & Activity Logs */}
          <section className="lg:col-span-7 w-full flex flex-col h-full">
            <SpectatorDashboard />
          </section>

        </div>

      </main>
    </div>
  );
}
