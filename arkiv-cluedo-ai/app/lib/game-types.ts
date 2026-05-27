export type SuspectId = "CIPHER" | "VECTOR" | "SYLPH" | "ORACLE";

export type WeaponId = 
  | "NEURAL_SPIKE" 
  | "DATA_LEAK" 
  | "EMP_GRENADE" 
  | "GLITCH_VIRUS" 
  | "QUANTUM_BLADE" 
  | "OVERLOAD_CORD";

export type RoomId = 
  | "QUANTUM_LABS" 
  | "AETHER_GARDEN" 
  | "CYPHER_VAULT" 
  | "NEURAL_LIBRARY" 
  | "HOLOGRAM_LOUNGE" 
  | "REACTOR_CORE" 
  | "ARCHIVE_ROOM" 
  | "CONTROL_DECK" 
  | "MAINFRAME";

export type CardType = "suspect" | "weapon" | "room";

export interface Card {
  type: CardType;
  id: string; // matches SuspectId | WeaponId | RoomId
  name: string;
}

export interface Envelope {
  suspect: SuspectId;
  weapon: WeaponId;
  room: RoomId;
}

export type CellType = "wall" | "hallway" | "door" | "room_center";

export interface Position {
  x: number;
  y: number;
}

export interface RoomConfig {
  id: RoomId;
  name: string;
  color: string;
  glowColor: string;
  // Box boundary
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  // Entry doors
  doors: Position[];
  center: Position;
}

export type NotebookStatus = "POSSIBLE" | "ELIMINATED" | "HELD_BY_ME" | "HELD_BY_OTHER";

export interface PlayerState {
  id: SuspectId;
  name: string;
  color: string;
  position: Position;
  currentRoom: RoomId | null;
  // Encrypted locally or stored in memory
  cards: Card[];
  publicKey: string; // Stringified base64 or JWK
  eliminated: boolean;
  hasAccused: boolean;
}

export interface LogEntry {
  id: string;
  turn: number;
  player: SuspectId;
  type: "move" | "suggest" | "disprove" | "fail_disprove" | "accuse_success" | "accuse_fail" | "dice" | "info" | "setup";
  text: string;
  timestamp: number;
  txHash?: string;
}

export interface GameSession {
  id: string;
  status: "setup" | "playing" | "finished";
  players: PlayerState[];
  activePlayerIndex: number;
  currentTurn: number;
  diceResult: number | null;
  logs: LogEntry[];
  winner: SuspectId | null;
  // Revealed at the end of the game
  envelope: Envelope | null;
  encryptedEnvelope?: string; // Stored encrypted on-chain
}

export interface ArkivTx {
  id: string;
  type: "create" | "update" | "query" | "extend";
  entityType: string;
  txHash?: string;
  status: "pending" | "success" | "error";
  error?: string;
  timestamp: number;
  details: string;
}

export interface DeductionNotebook {
  suspects: Record<SuspectId, NotebookStatus>;
  weapons: Record<WeaponId, NotebookStatus>;
  rooms: Record<RoomId, NotebookStatus>;
}
