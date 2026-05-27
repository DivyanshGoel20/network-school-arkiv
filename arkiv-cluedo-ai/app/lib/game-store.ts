import { create } from "zustand";
import {
  Position,
  RoomId,
  SuspectId,
  WeaponId,
  Card,
  Envelope,
  LogEntry,
  PlayerState,
  GameSession,
  ArkivTx,
  DeductionNotebook,
  NotebookStatus,
} from "./game-types";
import {
  ROOMS,
  WEAPONS,
  SUSPECTS,
  getCellType,
  getRoomAt,
  findPath,
  shuffle,
  createEmptyNotebook,
  runNotebookDeduction,
} from "./game-engine";
import {
  generateAgentKeyPair,
  encryptData,
  decryptData,
} from "./crypto-helper";
import {
  PROJECT_ATTRIBUTE,
  DEFAULT_DEMO_PRIVATE_KEY,
  getOrGeneratePrivateKey,
  getWalletClient,
  publicClient,
  safeArkivWrite,
} from "./arkiv";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";

const queryAgentInference = async (
  agentId: string,
  context: string,
  action: string
): Promise<string | null> => {
  try {
    const res = await fetch("/api/inference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, context, action })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ok) return data.answer;
    return null;
  } catch {
    return null;
  }
};

interface GameState {
  // Game states
  gameId: string | null;
  status: "setup" | "playing" | "finished";
  players: PlayerState[];
  activePlayerIndex: number;
  currentTurn: number;
  diceResult: number | null;
  logs: LogEntry[];
  winner: SuspectId | null;
  envelope: Envelope | null;

  // On-Chain Cryptographic proof fields
  encryptedEnvelope: string | null;
  sessionTxHash: string | null;

  // Private cryptographic states (kept locally)
  privateKeys: Record<SuspectId, any>; // Private keys for decrypting clues
  notebooks: Record<SuspectId, DeductionNotebook>; // Local AI notebook grid
  notebookRevealCount: Record<string, number>; // Heuristic: Track how many times card was revealed
  writePrivateKey: string; // The user's or default Braga testnet private key

  // Spectator control states
  isPlaying: boolean;
  gameSpeed: number; // Ticking multiplier in ms
  activeAction: "idle" | "rolling" | "moving" | "suggesting" | "disproving" | "accusing" | "next_turn_pending";
  selectedSuggestion: { suspect: SuspectId; weapon: WeaponId; room: RoomId } | null;
  disproveResult: { revealerId: SuspectId | null; cardShown: Card | null; text: string } | null;

  // Technical Arkiv state
  ledger: ArkivTx[];
  transactionError: string | null; // Pauses loop if on-chain write fails (gas shortage)
  activeMonologue: string | null;

  // Actions
  setWritePrivateKey: (key: string) => void;
  setGameSpeed: (speed: number) => void;
  togglePlay: () => void;
  addLedgerTx: (tx: Omit<ArkivTx, "id" | "timestamp">) => string;
  updateLedgerTxStatus: (id: string, status: "success" | "error", update: Partial<ArkivTx>) => void;
  resetGame: () => void;
  initializeGame: () => Promise<void>;
  executeSingleStep: () => Promise<void>;
  clearTransactionError: () => void;
}

export const useGameStore = create<GameState>((set, get) => {
  
  // Starting positions in hallway coordinates
  const STARTING_POSITIONS: Record<SuspectId, Position> = {
    CIPHER: { x: 3, y: 0 },
    VECTOR: { x: 8, y: 0 },
    SYLPH: { x: 0, y: 8 },
    ORACLE: { x: 11, y: 3 },
  };

  return {
    gameId: null,
    status: "setup",
    players: [],
    activePlayerIndex: 0,
    currentTurn: 1,
    diceResult: null,
    logs: [],
    winner: null,
    envelope: null,
    encryptedEnvelope: null,
    sessionTxHash: null,
    privateKeys: {} as Record<SuspectId, any>,
    notebooks: {} as Record<SuspectId, DeductionNotebook>,
    notebookRevealCount: {},
    writePrivateKey: typeof window !== "undefined" ? getOrGeneratePrivateKey() : DEFAULT_DEMO_PRIVATE_KEY,
    isPlaying: false,
    gameSpeed: 2000, // Standard spectator step delay
    activeAction: "idle",
    selectedSuggestion: null,
    disproveResult: null,
    ledger: [],
    transactionError: null,
    activeMonologue: null,

    setWritePrivateKey: (writePrivateKey) => set({ writePrivateKey }),
    setGameSpeed: (gameSpeed) => set({ gameSpeed }),
    togglePlay: () => set((state) => ({ 
      isPlaying: !state.isPlaying,
      transactionError: null // Clear gas error on play retry
    })),
    clearTransactionError: () => set({ transactionError: null }),

    addLedgerTx: (tx) => {
      const id = Math.random().toString(36).substring(7);
      const newTx: ArkivTx = {
        ...tx,
        id,
        timestamp: Date.now(),
      };
      set((state) => ({ ledger: [newTx, ...state.ledger].slice(0, 50) }));
      return id;
    },

    updateLedgerTxStatus: (id, status, update) => {
      set((state) => ({
        ledger: state.ledger.map((tx) =>
          tx.id === id ? { ...tx, status, ...update } : tx
        ),
      }));
    },

    resetGame: () => {
      set({
        gameId: null,
        status: "setup",
        players: [],
        activePlayerIndex: 0,
        currentTurn: 1,
        diceResult: null,
        logs: [],
        winner: null,
        envelope: null,
        encryptedEnvelope: null,
        sessionTxHash: null,
        privateKeys: {} as Record<SuspectId, any>,
        notebooks: {} as Record<SuspectId, DeductionNotebook>,
        notebookRevealCount: {},
        isPlaying: false,
        activeAction: "idle",
        selectedSuggestion: null,
        disproveResult: null,
        transactionError: null,
        activeMonologue: null,
      });
    },

    initializeGame: async () => {
      const { writePrivateKey, addLedgerTx, updateLedgerTxStatus } = get();
      set({ activeAction: "idle", status: "setup", transactionError: null });

      const generatedGameId = `game-${Math.random().toString(36).substring(2, 10)}`;

      // 1. Generate cryptographic keys for AI agents
      const agentKeys: Record<SuspectId, { publicKey: string; privateKey: any }> = {} as any;
      const ledgerId = addLedgerTx({
        type: "create",
        entityType: "key_generation",
        status: "pending",
        details: "Generating asymmetric RSA keypairs for AI Agents",
      });

      for (const s of SUSPECTS) {
        agentKeys[s.id] = await generateAgentKeyPair();
      }

      updateLedgerTxStatus(ledgerId, "success", {
        details: "Cryptographic keys successfully generated for Cipher, Vector, Sylph, and Oracle",
      });

      // 2. Setup Cluedo Deck
      const suspectCards: Card[] = SUSPECTS.map((s) => ({ type: "suspect", id: s.id, name: s.name }));
      const weaponCards: Card[] = WEAPONS.map((w) => ({ type: "weapon", id: w.id, name: w.name }));
      const roomCards: Card[] = ROOMS.filter((r) => r.id !== "MAINFRAME").map((r) => ({
        type: "room",
        id: r.id,
        name: r.name,
      }));

      // Shuffle decks
      const shuffledSuspects = shuffle(suspectCards);
      const shuffledWeapons = shuffle(weaponCards);
      const shuffledRooms = shuffle(roomCards);

      // Select murder secrets (Envelope)
      const envelope: Envelope = {
        suspect: shuffledSuspects.pop()!.id as SuspectId,
        weapon: shuffledWeapons.pop()!.id as WeaponId,
        room: shuffledRooms.pop()!.id as RoomId,
      };

      // Create an entropy-enriched, non-deterministic envelope ciphertext
      const randomEnvelopeNonce = Math.random().toString(36).substring(2, 15);
      const envelopePayload = JSON.stringify({
        card: `${envelope.suspect}:${envelope.weapon}:${envelope.room}`,
        turn: 0,
        timestamp: Date.now(),
        nonce: randomEnvelopeNonce,
      });

      // Encrypt envelope with Host Public Key
      const encryptedEnvelope = await encryptData(envelopePayload, agentKeys.CIPHER.publicKey);

      // Combine remaining cards and distribute
      const remainingDeck = shuffle([...shuffledSuspects, ...shuffledWeapons, ...shuffledRooms]);
      const playerHands: Record<SuspectId, Card[]> = {
        CIPHER: [],
        VECTOR: [],
        SYLPH: [],
        ORACLE: [],
      };

      let cardIndex = 0;
      while (remainingDeck.length > 0) {
        const card = remainingDeck.pop()!;
        const suspectKey = SUSPECTS[cardIndex % SUSPECTS.length].id;
        playerHands[suspectKey].push(card);
        cardIndex++;
      }

      // 3. Initialize players state
      const players: PlayerState[] = SUSPECTS.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        position: STARTING_POSITIONS[s.id],
        currentRoom: null,
        cards: playerHands[s.id],
        publicKey: agentKeys[s.id].publicKey,
        eliminated: false,
        hasAccused: false,
      }));

      // Initialize notebooks
      const notebooks: Record<SuspectId, DeductionNotebook> = {} as any;
      const privateKeys: Record<SuspectId, any> = {} as any;

      for (const s of SUSPECTS) {
        notebooks[s.id] = createEmptyNotebook(playerHands[s.id]);
        privateKeys[s.id] = agentKeys[s.id].privateKey;
      }

      const setupLog: LogEntry = {
        id: "setup-log",
        turn: 0,
        player: "CIPHER",
        type: "setup",
        text: `Game initialized at Aether Manor. Envelope committed on Braga. Remaining cards distributed to AI detectives.`,
        timestamp: Date.now(),
      };

      // Set initial state
      set({
        gameId: generatedGameId,
        status: "playing",
        players,
        notebooks,
        privateKeys,
        envelope,
        encryptedEnvelope,
        logs: [setupLog],
        activePlayerIndex: 0,
        currentTurn: 1,
        diceResult: null,
        disproveResult: null,
        selectedSuggestion: null,
        activeAction: "next_turn_pending",
        activeMonologue: null,
      });

      // 4. Arkiv Braga Session Creation
      const gsTxLedgerId = addLedgerTx({
        type: "create",
        entityType: "game_session",
        status: "pending",
        details: `Deploying Game Session ${generatedGameId} to Arkiv Braga`,
      });

      try {
        const walletClient = getWalletClient(writePrivateKey);
        const sessionPayload = {
          gameId: generatedGameId,
          status: "playing",
          currentTurn: 1,
          activePlayerIndex: 0,
          players: players.map((p) => ({
            id: p.id,
            publicKey: p.publicKey,
            position: p.position,
          })),
          encryptedEnvelope: encryptedEnvelope,
        };

        // Await strict on-chain write
        await safeArkivWrite(
          async () => {
            return await walletClient.createEntity({
              payload: jsonToPayload(sessionPayload),
              contentType: "application/json",
              attributes: [
                PROJECT_ATTRIBUTE,
                { key: "entityType", value: "game_session" },
                { key: "gameId", value: generatedGameId },
                { key: "status", value: "playing" },
                { key: "created", value: Date.now() },
              ],
              expiresIn: ExpirationTime.fromHours(4),
            });
          },
          (tx) => {
            updateLedgerTxStatus(gsTxLedgerId, tx.status, { txHash: tx.txHash, error: tx.error });
            if (tx.txHash) {
              set({ sessionTxHash: tx.txHash });
            }
          }
        );
      } catch (err: any) {
        // Halt match execution on gas write failures!
        set({ 
          isPlaying: false, 
          activeAction: "idle", 
          transactionError: err?.message || String(err) 
        });
        return;
      }

      // Save Encrypted Private Cards for each agent on Arkiv
      for (const p of players) {
        const cardsTxId = addLedgerTx({
          type: "create",
          entityType: "clue_entity",
          status: "pending",
          details: `Publishing encrypted private hand for player ${p.name}`,
        });

        const randomCardNonce = Math.random().toString(36).substring(2, 15);
        const cardsPayload = JSON.stringify({
          card: JSON.stringify(p.cards),
          turn: 0,
          timestamp: Date.now(),
          nonce: randomCardNonce,
        });

        try {
          const encryptedHand = await encryptData(cardsPayload, p.publicKey);
          const walletClient = getWalletClient(writePrivateKey);

          // Await strict on-chain write
          await safeArkivWrite(
            async () => {
              return await walletClient.createEntity({
                payload: jsonToPayload({ encryptedCards: encryptedHand }),
                contentType: "application/json",
                attributes: [
                  PROJECT_ATTRIBUTE,
                  { key: "entityType", value: "clue_entity" },
                  { key: "gameId", value: generatedGameId },
                  { key: "ownerAgentId", value: p.id },
                ],
                expiresIn: ExpirationTime.fromHours(4),
              });
            },
            (tx) => updateLedgerTxStatus(cardsTxId, tx.status, { txHash: tx.txHash, error: tx.error })
          );
        } catch (err: any) {
          // Halt match execution on gas write failures!
          set({ 
            isPlaying: false, 
            activeAction: "idle", 
            transactionError: err?.message || String(err) 
          });
          return;
        }
      }
    },

    executeSingleStep: async () => {
      const {
        gameId,
        status,
        players,
        activePlayerIndex,
        currentTurn,
        notebooks,
        privateKeys,
        writePrivateKey,
        addLedgerTx,
        updateLedgerTxStatus,
        activeAction,
        selectedSuggestion,
      } = get();

      if (status !== "playing" || !gameId) return;

      const activePlayer = players[activePlayerIndex];

      // If active player is eliminated, skip their turn cleanly
      if (activePlayer.eliminated) {
        set({
          activePlayerIndex: (activePlayerIndex + 1) % players.length,
          activeAction: "next_turn_pending",
          diceResult: null,
          disproveResult: null,
          selectedSuggestion: null,
        });
        return;
      }

      // STATE MACHINE STEP ENGINE
      if (activeAction === "idle") {
        // Clear any previous transaction errors before attempting next step
        set({ transactionError: null });

        // Generate dynamic AI monologue on turn start
        const agentId = activePlayer.id;
        const currentPos = `x=${activePlayer.position.x}, y=${activePlayer.position.y}`;
        const notebook = notebooks[agentId];
        const ruledOutSus = Object.entries(notebook.suspects).filter(([_, s]) => s === "ELIMINATED").map(([id]) => id).join(", ") || "none";
        const ruledOutWep = Object.entries(notebook.weapons).filter(([_, w]) => w === "ELIMINATED").map(([id]) => id).join(", ") || "none";
        const hand = activePlayer.cards.map(c => c.name).join(", ");
        
        const context = `Your name is ${activePlayer.name}. You hold these private cards in your hand: [${hand}]. You are currently at coordinates ${currentPos}. In your deduction notebook, you have successfully ruled out suspects [${ruledOutSus}] and weapons [${ruledOutWep}]. You are rolling the die now.`;
        
        const monologue = await queryAgentInference(agentId, context, "TURN_START");
        if (!monologue) {
          set({
            isPlaying: false,
            activeAction: "idle",
            transactionError: "ZERO_G Intelligence Router connection failed. The AI agent turn monologue could not be generated. Paused game to wait for connection.",
          });
          return;
        }
        set({ activeMonologue: monologue });

        // --- STEP 1: ROLL DICE ---
        set({ activeAction: "rolling" });
        const diceVal = Math.floor(Math.random() * 6) + 1;

        const newLog: LogEntry = {
          id: `dice-log-${Date.now()}`,
          turn: currentTurn,
          player: activePlayer.id,
          type: "dice",
          text: `${activePlayer.name} rolled a ${diceVal}.`,
          timestamp: Date.now(),
        };

        set({
          diceResult: diceVal,
          logs: [newLog, ...get().logs],
        });

        // Sync turn log metadata to Braga
        const logTxId = addLedgerTx({
          type: "create",
          entityType: "turn_log",
          status: "pending",
          details: `Syncing turn ${currentTurn} dice roll for ${activePlayer.name} to Arkiv Braga`,
        });

        try {
          const walletClient = getWalletClient(writePrivateKey);
          await safeArkivWrite(
            async () => {
              return await walletClient.createEntity({
                payload: jsonToPayload({ turn: currentTurn, player: activePlayer.id, dice: diceVal }),
                contentType: "application/json",
                attributes: [
                  PROJECT_ATTRIBUTE,
                  { key: "entityType", value: "turn_log" },
                  { key: "gameId", value: gameId },
                  { key: "turnNumber", value: currentTurn },
                ],
                expiresIn: ExpirationTime.fromHours(4),
              });
            },
            (tx) => {
              updateLedgerTxStatus(logTxId, tx.status, { txHash: tx.txHash, error: tx.error });
              if (tx.txHash) {
                set((state) => ({
                  logs: state.logs.map((l) =>
                    l.id === newLog.id ? { ...l, txHash: tx.txHash } : l
                  ),
                }));
              }
            }
          );
        } catch (err: any) {
          set({ 
            isPlaying: false, 
            activeAction: "idle", 
            transactionError: err?.message || String(err) 
          });
          return; // abort step execution
        }

        setTimeout(() => set({ activeAction: "moving" }), 400);

      } else if (activeAction === "moving") {
        // --- STEP 2: PATHFIND & WALK TILE-BY-TILE ---
        const diceVal = get().diceResult || 1;
        const notebook = notebooks[activePlayer.id];

        const uneliminatedRooms = ROOMS.filter(
          (r) => r.id !== "MAINFRAME" && notebook.rooms[r.id] === "POSSIBLE"
        );

        let bestTargetDoor: Position | null = null;
        let shortestPath: Position[] | null = null;

        for (const room of uneliminatedRooms) {
          for (const door of room.doors) {
            const path = findPath(activePlayer.position, door);
            if (path) {
              if (!shortestPath || path.length < shortestPath.length) {
                shortestPath = path;
                bestTargetDoor = door;
              }
            }
          }
        }

        if (!shortestPath) {
          const centerMainframe = ROOMS.find((r) => r.id === "MAINFRAME")!;
          for (const door of centerMainframe.doors) {
            const path = findPath(activePlayer.position, door);
            if (path) {
              if (!shortestPath || path.length < shortestPath.length) {
                shortestPath = path;
                bestTargetDoor = door;
              }
            }
          }
        }

        let newPos = activePlayer.position;
        let arrivedRoom: RoomId | null = null;

        if (shortestPath && shortestPath.length > 1) {
          const movesPossible = Math.min(diceVal, shortestPath.length - 1);
          
          // VISUAL STEP ANIMATION: Pawn steps coordinate-by-coordinate with a short hop interval
          for (let i = 1; i <= movesPossible; i++) {
            const stepPos = shortestPath[i];
            set((state) => ({
              players: state.players.map((p) =>
                p.id === activePlayer.id ? { ...p, position: stepPos } : p
              ),
            }));
            await new Promise((resolve) => setTimeout(resolve, 180));
          }

          newPos = shortestPath[movesPossible];

          if (newPos.x === bestTargetDoor?.x && newPos.y === bestTargetDoor?.y) {
            const targetRoom = getRoomAt(bestTargetDoor);
            if (targetRoom) {
              const config = ROOMS.find((r) => r.id === targetRoom)!;
              newPos = config.center;
              arrivedRoom = targetRoom;
            }
          }
        } else {
          // hallway wiggle
          const adjDirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
          ];
          for (const dir of adjDirs) {
            const next = { x: activePlayer.position.x + dir.x, y: activePlayer.position.y + dir.y };
            if (getCellType(next.x, next.y) === "hallway") {
              newPos = next;
              break;
            }
          }
        }

        // Apply final stepping coordinate
        const updatedPlayers = players.map((p) =>
          p.id === activePlayer.id
            ? { ...p, position: newPos, currentRoom: arrivedRoom }
            : p
        );

        const moveText = arrivedRoom
          ? `${activePlayer.name} navigated to ${ROOMS.find((r) => r.id === arrivedRoom)!.name}.`
          : `${activePlayer.name} moved towards the next wing.`;

        const newLog: LogEntry = {
          id: `move-log-${Date.now()}`,
          turn: currentTurn,
          player: activePlayer.id,
          type: "move",
          text: moveText,
          timestamp: Date.now(),
        };

        set({
          players: updatedPlayers,
          logs: [newLog, ...get().logs],
        });

        if (arrivedRoom) {
          set({ activeAction: "suggesting" });
        } else {
          set({ activeAction: "next_turn_pending" });
          get().executeDeductionNotebooks();
        }

      } else if (activeAction === "suggesting") {
        // --- STEP 3: SUGGESTION DECLARATION ---
        const notebook = notebooks[activePlayer.id];
        const currentRoom = activePlayer.currentRoom!;

        const possibleSuspect = SUSPECTS.filter((s) => notebook.suspects[s.id] === "POSSIBLE");
        const possibleWeapon = WEAPONS.filter((w) => notebook.weapons[w.id] === "POSSIBLE");

        const suggestedSuspect = possibleSuspect.length > 0 
          ? possibleSuspect[Math.floor(Math.random() * possibleSuspect.length)].id 
          : SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)].id;

        const suggestedWeapon = possibleWeapon.length > 0 
          ? possibleWeapon[Math.floor(Math.random() * possibleWeapon.length)].id 
          : WEAPONS[Math.floor(Math.random() * WEAPONS.length)].id;

        const roomConfig = ROOMS.find((r) => r.id === currentRoom)!;

        // Animate the suggested suspect "jumping" into the room center
        const updatedPlayers = players.map((p) =>
          p.id === suggestedSuspect
            ? { ...p, position: roomConfig.center, currentRoom: currentRoom }
            : p
        );

        const suspectName = SUSPECTS.find((s) => s.id === suggestedSuspect)!.name;
        const weaponName = WEAPONS.find((w) => w.id === suggestedWeapon)!.name.replace("_", " ");
        const roomName = roomConfig.name;

        const suggestContext = `Your name is ${activePlayer.name}. You are inside the ${roomName}. You are raising an active suggestion: you suspect that ${suspectName} committed the murder inside the ${roomName} using the ${weaponName}.`;

        const speech = await queryAgentInference(activePlayer.id, suggestContext, "SUGGESTION");
        if (!speech) {
          set({
            isPlaying: false,
            activeAction: "suggesting",
            transactionError: "ZERO_G Intelligence Router connection failed. The active detective's Suggestion statement could not be generated. Paused game to wait for connection.",
          });
          return;
        }

        const finalSpeech = `"${speech}" (${activePlayer.name} suspects ${suspectName} in ${roomName} with ${weaponName})`;
        const newLogId = Date.now();

        const newLog: LogEntry = {
          id: `suggest-log-${newLogId}`,
          turn: currentTurn,
          player: activePlayer.id,
          type: "suggest",
          text: finalSpeech,
          timestamp: newLogId,
        };

        set({
          players: updatedPlayers,
          logs: [newLog, ...get().logs],
          selectedSuggestion: { suspect: suggestedSuspect, weapon: suggestedWeapon, room: currentRoom },
          activeAction: "disproving",
        });

        // Sync suggestion metadata to Braga
        const suggestTxId = addLedgerTx({
          type: "create",
          entityType: "suggestion",
          status: "pending",
          details: `Syncing turn ${currentTurn} suggestion for ${activePlayer.name} to Arkiv Braga`,
        });

        try {
          const walletClient = getWalletClient(writePrivateKey);
          await safeArkivWrite(
            async () => {
              return await walletClient.createEntity({
                payload: jsonToPayload({
                  turn: currentTurn,
                  player: activePlayer.id,
                  suspect: suggestedSuspect,
                  weapon: suggestedWeapon,
                  room: currentRoom,
                  speech: finalSpeech,
                }),
                contentType: "application/json",
                attributes: [
                  PROJECT_ATTRIBUTE,
                  { key: "entityType", value: "suggestion" },
                  { key: "gameId", value: gameId },
                  { key: "turnNumber", value: currentTurn },
                ],
                expiresIn: ExpirationTime.fromHours(4),
              });
            },
            (tx) => {
              updateLedgerTxStatus(suggestTxId, tx.status, { txHash: tx.txHash, error: tx.error });
              if (tx.txHash) {
                set((state) => ({
                  logs: state.logs.map((l) =>
                    l.id === newLog.id ? { ...l, txHash: tx.txHash } : l
                  ),
                }));
              }
            }
          );
        } catch (err: any) {
          set({ 
            isPlaying: false, 
            activeAction: "idle", 
            transactionError: err?.message || String(err) 
          });
          return; // abort step execution
        }

      } else if (activeAction === "disproving") {
        // --- STEP 4: CLOCKWISE REVEAL INQUIRY ---
        const suggestion = selectedSuggestion!;
        let disproved = false;
        let disprovingPlayerId: SuspectId | null = null;
        let cardShown: Card | null = null;

        const activeIdx = players.findIndex((p) => p.id === activePlayer.id);
        
        for (let i = 1; i < players.length; i++) {
          const nextIdx = (activeIdx + i) % players.length;
          const responder = players[nextIdx];

          const matchingCards = responder.cards.filter(
            (c) =>
              (c.type === "suspect" && c.id === suggestion.suspect) ||
              (c.type === "weapon" && c.id === suggestion.weapon) ||
              (c.type === "room" && c.id === suggestion.room)
          );

          if (matchingCards.length > 0) {
            disproved = true;
            disprovingPlayerId = responder.id;

            const { notebookRevealCount } = get();
            matchingCards.sort((a, b) => {
              const countA = notebookRevealCount[`${responder.id}-${a.id}`] || 0;
              const countB = notebookRevealCount[`${responder.id}-${b.id}`] || 0;
              return countA - countB;
            });
            cardShown = matchingCards[0];

            set((state) => ({
              notebookRevealCount: {
                ...state.notebookRevealCount,
                [`${responder.id}-${cardShown!.id}`]: (state.notebookRevealCount[`${responder.id}-${cardShown!.id}`] || 0) + 1,
              },
            }));
            break;
          }
        }

        if (disproved && disprovingPlayerId && cardShown) {
          const revealer = players.find((p) => p.id === disprovingPlayerId)!;
          const disprovedText = `${revealer.name} privately disproved ${activePlayer.name}'s suggestion.`;

          const disproveContext = `Your name is ${revealer.name}. ${activePlayer.name} made a suggestion of suspect ${suggestion.suspect}, room ${suggestion.room}, and weapon ${suggestion.weapon}. You have successfully disproved this by privately sharing the ${cardShown.name} card with them.`;

          const speech = await queryAgentInference(revealer.id, disproveContext, "DISPROVAL");
          if (!speech) {
            set({
              isPlaying: false,
              activeAction: "disproving",
              transactionError: "ZERO_G Intelligence Router connection failed. The responding detective's Disproval statement could not be generated. Paused game to wait for connection.",
            });
            return;
          }

          const finalSpeech = `"${speech}" (${revealer.name} privately disproved ${activePlayer.name}'s suggestion)`;
          const newLogId = Date.now();

          const newLog: LogEntry = {
            id: `disprove-log-${newLogId}`,
            turn: currentTurn,
            player: activePlayer.id,
            type: "disprove",
            text: finalSpeech,
            timestamp: newLogId,
          };

          // Immediately push newLog to state and update notebooks to prevent race conditions
          set((state) => {
            const updatedNotebooks = { ...state.notebooks };
            const activeNotebook = updatedNotebooks[activePlayer.id];

            if (cardShown!.type === "suspect") {
              activeNotebook.suspects[cardShown!.id as SuspectId] = "ELIMINATED";
            } else if (cardShown!.type === "weapon") {
              activeNotebook.weapons[cardShown!.id as WeaponId] = "ELIMINATED";
            } else if (cardShown!.type === "room") {
              activeNotebook.rooms[cardShown!.id as RoomId] = "ELIMINATED";
            }

            return {
              notebooks: updatedNotebooks,
              disproveResult: {
                revealerId: disprovingPlayerId,
                cardShown,
                text: `${revealer.name} showed: ${cardShown!.name}`,
              },
              logs: [newLog, ...state.logs],
            };
          });

          // Cryptographic Reveal via Braga
          const revealTxId = addLedgerTx({
            type: "create",
            entityType: "clue_share",
            status: "pending",
            details: `Encrypting & publishing clue reveal from ${revealer.name} to ${activePlayer.name} on Arkiv Braga`,
          });

          const randomRevealNonce = Math.random().toString(36).substring(2, 15);
          const revealPayload = JSON.stringify({
            card: cardShown.id,
            turn: currentTurn,
            timestamp: Date.now(),
            nonce: randomRevealNonce,
          });

          try {
            const encryptedPayload = await encryptData(revealPayload, activePlayer.publicKey);
            const walletClient = getWalletClient(writePrivateKey);

            // Await strict on-chain write
            await safeArkivWrite(
              async () => {
                return await walletClient.createEntity({
                  payload: jsonToPayload({ encryptedReveal: encryptedPayload }),
                  contentType: "application/json",
                  attributes: [
                    PROJECT_ATTRIBUTE,
                    { key: "entityType", value: "clue_share" },
                    { key: "gameId", value: gameId },
                    { key: "fromAgentId", value: revealer.id },
                    { key: "toAgentId", value: activePlayer.id },
                  ],
                  expiresIn: ExpirationTime.fromHours(4),
                });
              },
              (tx) => {
                updateLedgerTxStatus(revealTxId, tx.status, { txHash: tx.txHash, error: tx.error });
                if (tx.txHash) {
                  set((state) => ({
                    logs: state.logs.map((l) =>
                      l.id === newLog.id ? { ...l, txHash: tx.txHash } : l
                    ),
                  }));
                }
              }
            );
          } catch (err: any) {
            set({ 
              isPlaying: false, 
              activeAction: "idle", 
              transactionError: err?.message || String(err) 
            });
            return;
          }

          set({
            activeAction: "accusing",
          });

        } else {
          const failText = `None of the other agents could disprove ${activePlayer.name}'s suggestion!`;
          const newLog: LogEntry = {
            id: `disprove-fail-${Date.now()}`,
            turn: currentTurn,
            player: activePlayer.id,
            type: "fail_disprove",
            text: failText,
            timestamp: Date.now(),
          };

          // Since no one could disprove, the cards suggested that are not held by the active player must be the solution!
          // Eliminate all other possibilities in these categories in active detective's notebook.
          set((state) => {
            const updatedNotebooks = { ...state.notebooks };
            const activeNotebook = updatedNotebooks[activePlayer.id];
            const suggestion = state.selectedSuggestion!;

            const checkAndSolve = (cardId: string, type: "suspects" | "weapons" | "rooms", list: any[]) => {
              if (activeNotebook[type][cardId as any] !== "HELD_BY_ME") {
                for (const item of list) {
                  if (item.id !== cardId) {
                    activeNotebook[type][item.id as any] = "ELIMINATED";
                  }
                }
              }
            };

            checkAndSolve(suggestion.suspect, "suspects", SUSPECTS);
            checkAndSolve(suggestion.weapon, "weapons", WEAPONS);
            checkAndSolve(suggestion.room, "rooms", ROOMS);

            return {
              notebooks: updatedNotebooks,
              logs: [newLog, ...state.logs],
              disproveResult: {
                revealerId: null,
                cardShown: null,
                text: `No one has these cards. Either in envelope or active hand.`,
              },
              activeAction: "accusing",
            };
          });
        }

      } else if (activeAction === "accusing") {
        // --- STEP 5: ACCUSATION HEURISTIC ---
        const notebook = notebooks[activePlayer.id];
        const solution = runNotebookDeduction(notebook);
        const { envelope } = get();

        if (solution.solvedSuspect && solution.solvedWeapon && solution.solvedRoom && envelope) {
          const finalSuspect = SUSPECTS.find((s) => s.id === solution.solvedSuspect)!;
          const finalWeapon = WEAPONS.find((w) => w.id === solution.solvedWeapon)!;
          const finalRoom = ROOMS.find((r) => r.id === solution.solvedRoom)!;

          const isCorrect =
            solution.solvedSuspect === envelope.suspect &&
            solution.solvedWeapon === envelope.weapon &&
            solution.solvedRoom === envelope.room;

          const accuseTxId = addLedgerTx({
            type: "create",
            entityType: "accusation",
            status: "pending",
            details: `Publishing final Accusation by ${activePlayer.name} to Arkiv Braga`,
          });

          let accusationTxHash: string | undefined;

          try {
            const walletClient = getWalletClient(writePrivateKey);
            const randomAccNonce = Math.random().toString(36).substring(2, 15);
            const accusationPayload = JSON.stringify({
              card: `${solution.solvedSuspect}:${solution.solvedWeapon}:${solution.solvedRoom}`,
              accuser: activePlayer.id,
              correct: isCorrect,
              nonce: randomAccNonce,
              timestamp: Date.now(),
            });

            const encryptedAcc = await encryptData(accusationPayload, activePlayer.publicKey);

            // Await strict on-chain write
            await safeArkivWrite(
              async () => {
                return await walletClient.createEntity({
                  payload: jsonToPayload({ encryptedAcc, correct: isCorrect }),
                  contentType: "application/json",
                  attributes: [
                    PROJECT_ATTRIBUTE,
                    { key: "entityType", value: "accusation" },
                    { key: "gameId", value: gameId },
                    { key: "accuser", value: activePlayer.id },
                    { key: "correct", value: isCorrect ? "true" : "false" },
                  ],
                  expiresIn: ExpirationTime.fromHours(4),
                });
              },
              (tx) => {
                updateLedgerTxStatus(accuseTxId, tx.status, { txHash: tx.txHash, error: tx.error });
                if (tx.txHash) {
                  accusationTxHash = tx.txHash;
                }
              }
            );
          } catch (err: any) {
            set({ 
              isPlaying: false, 
              activeAction: "idle", 
              transactionError: err?.message || String(err) 
            });
            return;
          }

          if (isCorrect) {
            // WINNER
            const winContext = `Your name is ${activePlayer.name}. You have solved the murder! You are declaring a correct final accusation that ${finalSuspect.name} is the murderer, inside the ${finalRoom.name} using the ${finalWeapon.name}. You are announcing your victory.`;

            const speech = await queryAgentInference(activePlayer.id, winContext, "ACCUSATION");
            if (!speech) {
              set({
                isPlaying: false,
                activeAction: "accusing",
                transactionError: "ZERO_G Intelligence Router connection failed. The winning detective's Victory statement could not be generated. Paused game to wait for connection.",
              });
              return;
            }

            const finalSpeech = `🚨 CORRECT ACCUSATION! "${speech}" (${activePlayer.name} accused ${finalSuspect.name} in ${finalRoom.name} with ${finalWeapon.name})`;
            const newLogId = Date.now();
            const winLog: LogEntry = {
              id: `win-log-${newLogId}`,
              turn: currentTurn,
              player: activePlayer.id,
              type: "accuse_success",
              text: finalSpeech,
              timestamp: newLogId,
              txHash: accusationTxHash,
            };

            set({
              status: "finished",
              winner: activePlayer.id,
              isPlaying: false,
              logs: [winLog, ...get().logs],
              activeAction: "idle",
            });

            const finishSessionTxId = addLedgerTx({
              type: "update",
              entityType: "game_session",
              status: "pending",
              details: `Marking Game Session ${gameId} as finished on Arkiv`,
            });

            try {
              const walletClient = getWalletClient(writePrivateKey);
              await safeArkivWrite(
                async () => {
                  return await walletClient.createEntity({
                    payload: jsonToPayload({
                      gameId,
                      status: "finished",
                      winner: activePlayer.id,
                      envelope,
                    }),
                    contentType: "application/json",
                    attributes: [
                      PROJECT_ATTRIBUTE,
                      { key: "entityType", value: "game_session" },
                      { key: "gameId", value: gameId },
                      { key: "status", value: "finished" },
                    ],
                    expiresIn: ExpirationTime.fromHours(24),
                  });
                },
                (tx) => updateLedgerTxStatus(finishSessionTxId, tx.status, { txHash: tx.txHash, error: tx.error })
              );
            } catch (err: any) {
              set({ 
                isPlaying: false, 
                activeAction: "idle", 
                transactionError: err?.message || String(err) 
              });
              return;
            }

          } else {
            // WRONG ACCUSATION
            const failText = `❌ INCORRECT ACCUSATION! ${activePlayer.name} accused ${finalSuspect.name} in the ${finalRoom.name} with ${finalWeapon.name}... but the files do not match. ${activePlayer.name} is ELIMINATED!`;
            const failLog: LogEntry = {
              id: `fail-log-${Date.now()}`,
              turn: currentTurn,
              player: activePlayer.id,
              type: "accuse_fail",
              text: failText,
              timestamp: Date.now(),
              txHash: accusationTxHash,
            };

            const updatedPlayers = players.map((p) =>
              p.id === activePlayer.id ? { ...p, eliminated: true } : p
            );

            set({
              players: updatedPlayers,
              logs: [failLog, ...get().logs],
              activeAction: "next_turn_pending",
            });
          }
        } else {
          set({ activeAction: "next_turn_pending" });
        }

        // Sync updated AI memory notebook to on-chain persistence
        const memoryTxId = addLedgerTx({
          type: "create",
          entityType: "ai_memory",
          status: "pending",
          details: `Syncing encrypted detective notebook for ${activePlayer.name} to Arkiv Braga`,
        });

        const randomMemNonce = Math.random().toString(36).substring(2, 15);
        const notebookPayload = JSON.stringify({
          card: JSON.stringify(notebook),
          turn: currentTurn,
          timestamp: Date.now(),
          nonce: randomMemNonce,
        });

        try {
          const encryptedNotebook = await encryptData(notebookPayload, activePlayer.publicKey);
          const walletClient = getWalletClient(writePrivateKey);

          // Await strict on-chain write
          await safeArkivWrite(
            async () => {
              return await walletClient.createEntity({
                payload: jsonToPayload({ encryptedNotebook }),
                contentType: "application/json",
                attributes: [
                  PROJECT_ATTRIBUTE,
                  { key: "entityType", value: "ai_memory" },
                  { key: "gameId", value: gameId },
                  { key: "agentId", value: activePlayer.id },
                ],
                expiresIn: ExpirationTime.fromHours(4),
              });
            },
            (tx) => updateLedgerTxStatus(memoryTxId, tx.status, { txHash: tx.txHash, error: tx.error })
          );
        } catch (err: any) {
          set({ 
            isPlaying: false, 
            activeAction: "idle", 
            transactionError: err?.message || String(err) 
          });
          return;
        }

        get().executeDeductionNotebooks();

      } else if (activeAction === "next_turn_pending") {
        // --- STEP 6: ADVANCE SEQUENTIALLY TO NEXT ACTIVE PLAYER ---
        const nextIdx = (activePlayerIndex + 1) % players.length;
        const nextTurn = activeIdxToTurn(nextIdx, currentTurn, players.length);

        set({
          activePlayerIndex: nextIdx,
          currentTurn: nextTurn,
          diceResult: null,
          disproveResult: null,
          selectedSuggestion: null,
          activeAction: "idle",
        });
      }
    },

    executeDeductionNotebooks: () => {
      const { players, notebooks } = get();
      
      for (const p of players) {
        if (p.eliminated) continue;
        const notebook = notebooks[p.id];
        
        const checkCategory = (items: any[], type: "suspects" | "weapons" | "rooms") => {
          const possibleItems = items.filter((item) => notebook[type][item.id] === "POSSIBLE");
          if (possibleItems.length === 1) {
            notebook[type][possibleItems[0].id] = "POSSIBLE";
          }
        };

        checkCategory(SUSPECTS, "suspects");
        checkCategory(WEAPONS, "weapons");
        checkCategory(ROOMS, "rooms");
      }
    },
  };
});

function activeIdxToTurn(nextIdx: number, currentTurn: number, totalPlayers: number): number {
  if (nextIdx === 0) {
    return currentTurn + 1;
  }
  return currentTurn;
}
