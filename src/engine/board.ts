import type { RulesConfig, ShipSpec } from "./rules.ts";

/** Cells are indexed row-major: index = row * size + col, both zero-based. */
export type Cell = number;
export type Orientation = "h" | "v";

export interface Placement {
  ship: string;
  /** Top-left cell of the ship. */
  cell: Cell;
  orientation: Orientation;
}

export type Rng = () => number;

export type PlacementError =
  | "wrong_fleet"
  | "out_of_bounds"
  | "overlap"
  | "touching";

export type PlacementCheck = { ok: true } | { ok: false; error: PlacementError; ship?: string };

export function cellLabel(rules: RulesConfig, cell: Cell): string {
  const row = Math.floor(cell / rules.size);
  const col = cell % rules.size;
  return String.fromCharCode(65 + col) + String(row + 1);
}

export function isCell(rules: RulesConfig, cell: unknown): cell is Cell {
  return Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < rules.size * rules.size;
}

/** Cells covered by a ship of `length`, or null if it leaves the board. */
export function shipCells(rules: RulesConfig, cell: Cell, orientation: Orientation, length: number): Cell[] | null {
  if (!isCell(rules, cell) || length < 1) return null;
  const row = Math.floor(cell / rules.size);
  const col = cell % rules.size;
  if (orientation === "h" ? col + length > rules.size : row + length > rules.size) return null;
  const step = orientation === "h" ? 1 : rules.size;
  return Array.from({ length }, (_, i) => cell + i * step);
}

function neighbours(rules: RulesConfig, cell: Cell): Cell[] {
  const row = Math.floor(cell / rules.size);
  const col = cell % rules.size;
  const out: Cell[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < rules.size && c >= 0 && c < rules.size) out.push(r * rules.size + c);
  }
  return out;
}

function specFor(rules: RulesConfig, id: string): ShipSpec | undefined {
  return rules.fleet.find((s) => s.id === id);
}

/** Checks a complete fleet: every ship exactly once, on the board, no overlaps. */
export function validateFleet(rules: RulesConfig, placements: readonly Placement[]): PlacementCheck {
  if (!Array.isArray(placements) || placements.length !== rules.fleet.length) return { ok: false, error: "wrong_fleet" };
  const seen = new Set<string>();
  const owner = new Map<Cell, string>();
  for (const p of placements) {
    const spec = p && typeof p.ship === "string" ? specFor(rules, p.ship) : undefined;
    if (!spec || seen.has(spec.id) || (p.orientation !== "h" && p.orientation !== "v")) {
      return { ok: false, error: "wrong_fleet" };
    }
    seen.add(spec.id);
    const cells = shipCells(rules, p.cell, p.orientation, spec.length);
    if (!cells) return { ok: false, error: "out_of_bounds", ship: spec.id };
    for (const c of cells) {
      if (owner.has(c)) return { ok: false, error: "overlap", ship: spec.id };
      owner.set(c, spec.id);
    }
  }
  if (!rules.shipsMayTouch) {
    for (const [c, id] of owner) {
      for (const n of neighbours(rules, c)) {
        const other = owner.get(n);
        if (other !== undefined && other !== id) return { ok: false, error: "touching", ship: id };
      }
    }
  }
  return { ok: true };
}

/** A legal random fleet. Retries per ship; restarts from scratch if a ship cannot fit. */
export function randomFleet(rules: RulesConfig, rng: Rng): Placement[] {
  for (;;) {
    const placements: Placement[] = [];
    let failed = false;
    for (const spec of rules.fleet) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const candidate: Placement = {
          ship: spec.id,
          cell: Math.floor(rng() * rules.size * rules.size),
          orientation: rng() < 0.5 ? "h" : "v",
        };
        const trial = [...placements, candidate];
        if (validatePartial(rules, trial)) {
          placements.push(candidate);
          placed = true;
        }
      }
      if (!placed) {
        failed = true;
        break;
      }
    }
    if (!failed) return placements;
  }
}

/** validateFleet without the "every ship present" requirement. */
function validatePartial(rules: RulesConfig, placements: readonly Placement[]): boolean {
  const padded = { ...rules, fleet: rules.fleet.filter((s) => placements.some((p) => p.ship === s.id)) };
  return validateFleet(padded, placements).ok;
}
