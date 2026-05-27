import {
  Position,
  CellType,
  RoomConfig,
  RoomId,
  SuspectId,
  WeaponId,
  Card,
  Envelope,
  LogEntry,
  PlayerState,
  DeductionNotebook,
  NotebookStatus,
} from "./game-types";

// Setup Rooms configuration
export const ROOMS: RoomConfig[] = [
  {
    id: "QUANTUM_LABS",
    name: "Quantum Labs",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    glowColor: "shadow-[0_0_20px_rgba(6,182,212,0.3)]",
    minX: 0, minY: 0, maxX: 2, maxY: 2,
    doors: [{ x: 2, y: 1 }, { x: 1, y: 2 }],
    center: { x: 1, y: 1 },
  },
  {
    id: "ARCHIVE_ROOM",
    name: "Archive Room",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    glowColor: "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    minX: 4, minY: 0, maxX: 7, maxY: 2,
    doors: [{ x: 5, y: 2 }, { x: 6, y: 2 }],
    center: { x: 5, y: 1 },
  },
  {
    id: "AETHER_GARDEN",
    name: "Aether Garden",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
    glowColor: "shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    minX: 9, minY: 0, maxX: 11, maxY: 2,
    doors: [{ x: 9, y: 1 }, { x: 10, y: 2 }],
    center: { x: 10, y: 1 },
  },
  {
    id: "HOLOGRAM_LOUNGE",
    name: "Hologram Lounge",
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
    glowColor: "shadow-[0_0_20px_rgba(99,102,241,0.3)]",
    minX: 0, minY: 4, maxX: 2, maxY: 6,
    doors: [{ x: 2, y: 5 }, { x: 1, y: 4 }, { x: 1, y: 6 }],
    center: { x: 1, y: 5 },
  },
  {
    id: "MAINFRAME",
    name: "The Mainframe",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/50",
    glowColor: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
    minX: 4, minY: 4, maxX: 7, maxY: 7,
    doors: [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
    center: { x: 5, y: 5 },
  },
  {
    id: "REACTOR_CORE",
    name: "Reactor Core",
    color: "bg-rose-500/20 text-rose-400 border-rose-500/50",
    glowColor: "shadow-[0_0_20px_rgba(244,63,94,0.3)]",
    minX: 9, minY: 4, maxX: 11, maxY: 6,
    doors: [{ x: 9, y: 5 }, { x: 10, y: 4 }, { x: 10, y: 6 }],
    center: { x: 10, y: 5 },
  },
  {
    id: "CYPHER_VAULT",
    name: "Cypher Vault",
    color: "bg-violet-500/20 text-violet-400 border-violet-500/50",
    glowColor: "shadow-[0_0_20px_rgba(139,92,246,0.3)]",
    minX: 0, minY: 9, maxX: 2, maxY: 11,
    doors: [{ x: 2, y: 10 }, { x: 1, y: 9 }],
    center: { x: 1, y: 10 },
  },
  {
    id: "CONTROL_DECK",
    name: "Control Deck",
    color: "bg-teal-500/20 text-teal-400 border-teal-500/50",
    glowColor: "shadow-[0_0_20px_rgba(20,184,166,0.3)]",
    minX: 4, minY: 9, maxX: 7, maxY: 11,
    doors: [{ x: 5, y: 9 }, { x: 6, y: 9 }],
    center: { x: 5, y: 10 },
  },
  {
    id: "NEURAL_LIBRARY",
    name: "Neural Library",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    minX: 9, minY: 9, maxX: 11, maxY: 11,
    doors: [{ x: 9, y: 10 }, { x: 10, y: 9 }],
    center: { x: 10, y: 10 },
  },
];

export const WEAPONS: { id: WeaponId; name: string }[] = [
  { id: "NEURAL_SPIKE", name: "Neural Spike" },
  { id: "DATA_LEAK", name: "Data Leak" },
  { id: "EMP_GRENADE", name: "EMP Grenade" },
  { id: "GLITCH_VIRUS", name: "Glitch Virus" },
  { id: "QUANTUM_BLADE", name: "Quantum Blade" },
  { id: "OVERLOAD_CORD", name: "Overload Cord" },
];

export const SUSPECTS: { id: SuspectId; name: string; color: string }[] = [
  { id: "APEX", name: "Apex", color: "#a855f7" },     // Purple (A)
  { id: "ROGUE", name: "Rogue", color: "#f43f5e" },   // Rose (R)
  { id: "KESTREL", name: "Kestrel", color: "#10b981" }, // Emerald (K)
  { id: "IRIS", name: "Iris", color: "#3b82f6" },     // Blue (I)
  { id: "VECTOR", name: "Vector", color: "#f59e0b" }, // Amber (V)
];

/**
 * Returns type of cell at coordinates.
 */
export function getCellType(x: number, y: number): CellType {
  // Check within grid boundaries
  if (x < 0 || x > 11 || y < 0 || y > 11) return "wall";

  for (const r of ROOMS) {
    if (x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY) {
      if (x === r.center.x && y === r.center.y) return "room_center";
      if (r.doors.some((d) => d.x === x && d.y === y)) return "door";
      return "wall";
    }
  }
  return "hallway";
}

/**
 * Get the room ID at a specific position, if any.
 */
export function getRoomAt(pos: Position): RoomId | null {
  for (const r of ROOMS) {
    if (pos.x >= r.minX && pos.x <= r.maxX && pos.y >= r.minY && pos.y <= r.maxY) {
      return r.id;
    }
  }
  return null;
}

/**
 * Find the shortest path from start to target coordinates using BFS.
 */
export function findPath(start: Position, target: Position): Position[] | null {
  const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [start] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  const startRoom = getRoomAt(start);
  const targetRoom = getRoomAt(target);

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;

    if (pos.x === target.x && pos.y === target.y) {
      return path;
    }

    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    for (const dir of dirs) {
      const nextPos = { x: pos.x + dir.x, y: pos.y + dir.y };
      const key = `${nextPos.x},${nextPos.y}`;

      if (visited.has(key)) continue;

      const cellType = getCellType(nextPos.x, nextPos.y);
      const nextRoom = getRoomAt(nextPos);

      // Pathfinding constraints:
      // 1. Can walk on hallway cells and doors
      // 2. Can walk into room center ONLY if it is the target destination
      // 3. Cannot walk through walls
      // 4. Cannot pass through other rooms' interiors
      let walkOk = false;

      if (cellType === "hallway" || cellType === "door") {
        walkOk = true;
      } else if (cellType === "room_center") {
        // Can only step on target room center or stay in current room center
        if (targetRoom && nextRoom === targetRoom) {
          walkOk = true;
        } else if (startRoom && nextRoom === startRoom) {
          walkOk = true;
        }
      }

      if (walkOk) {
        visited.add(key);
        queue.push({ pos: nextPos, path: [...path, nextPos] });
      }
    }
  }

  return null;
}

/**
 * Shuffles an array in place.
 */
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Initialize a brand new Detective Notebook for a player.
 */
export function createEmptyNotebook(ownerCards: Card[]): DeductionNotebook {
  const notebook: DeductionNotebook = {
    suspects: {} as Record<SuspectId, NotebookStatus>,
    weapons: {} as Record<WeaponId, NotebookStatus>,
    rooms: {} as Record<RoomId, NotebookStatus>,
  };

  // Pre-fill suspects
  for (const s of SUSPECTS) {
    notebook.suspects[s.id] = ownerCards.some((c) => c.type === "suspect" && c.id === s.id)
      ? "HELD_BY_ME"
      : "POSSIBLE";
  }

  // Pre-fill weapons
  for (const w of WEAPONS) {
    notebook.weapons[w.id] = ownerCards.some((c) => c.type === "weapon" && c.id === w.id)
      ? "HELD_BY_ME"
      : "POSSIBLE";
  }

  // Pre-fill rooms
  for (const r of ROOMS) {
    // Mainframe is never a card in the deck, but pre-filled as eliminated
    if (r.id === "MAINFRAME") {
      notebook.rooms[r.id] = "ELIMINATED";
      continue;
    }
    notebook.rooms[r.id] = ownerCards.some((c) => c.type === "room" && c.id === r.id)
      ? "HELD_BY_ME"
      : "POSSIBLE";
  }

  return notebook;
}

/**
 * Perform logical deduction step on an AI's notebook.
 * Evaluates rules:
 * 1. If we hold it, it's eliminated from the envelope.
 * 2. If we know someone else holds it, it's eliminated from the envelope.
 * 3. If there is only ONE remaining possibility in a category, that must be the murder fact!
 */
export function runNotebookDeduction(notebook: DeductionNotebook): {
  solvedSuspect: SuspectId | null;
  solvedWeapon: WeaponId | null;
  solvedRoom: RoomId | null;
} {
  const results = {
    solvedSuspect: null as SuspectId | null,
    solvedWeapon: null as WeaponId | null,
    solvedRoom: null as RoomId | null,
  };

  // 1. Suspects
  const suspectsPossible = SUSPECTS.filter((s) => notebook.suspects[s.id] === "POSSIBLE");
  if (suspectsPossible.length === 1) {
    results.solvedSuspect = suspectsPossible[0].id;
  }

  // 2. Weapons
  const weaponsPossible = WEAPONS.filter((w) => notebook.weapons[w.id] === "POSSIBLE");
  if (weaponsPossible.length === 1) {
    results.solvedWeapon = weaponsPossible[0].id;
  }

  // 3. Rooms
  const roomsPossible = ROOMS.filter((r) => r.id !== "MAINFRAME" && notebook.rooms[r.id] === "POSSIBLE");
  if (roomsPossible.length === 1) {
    results.solvedRoom = roomsPossible[0].id;
  }

  return results;
}
