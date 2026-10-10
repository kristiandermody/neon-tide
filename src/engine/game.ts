import { isCell, shipCells, validateFleet, type Cell, type Placement, type PlacementError, type Rng } from "./board.ts";
import type { RulesConfig } from "./rules.ts";

export type Seat = 0 | 1;
export type Phase = "placing" | "playing" | "over";
export type ShotResult = "miss" | "hit" | "sunk";

export interface PlayerState {
  fleet: Placement[] | null;
  ready: boolean;
  /** Cells the opponent has fired at on this player's board, in order. */
  shotsReceived: Cell[];
}

/** Plain JSON so it can be stored as-is. Rules are passed to every function, never stored here. */
export interface GameState {
  phase: Phase;
  players: [PlayerState, PlayerState];
  turn: Seat | null;
  winner: Seat | null;
}

export interface Shot {
  cell: Cell;
  result: ShotResult;
  /** Ship id for hit and sunk; absent for a miss. */
  ship?: string;
}

export interface ShotOutcome extends Shot {
  by: Seat;
  /** Every cell of the ship, only when result is "sunk". */
  sunkCells?: Cell[];
  winner: Seat | null;
}

export type GameError =
  | PlacementError
  | "wrong_phase"
  | "already_ready"
  | "no_fleet"
  | "not_your_turn"
  | "bad_cell"
  | "already_shot";

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: GameError };

export function newGame(): GameState {
  const player = (): PlayerState => ({ fleet: null, ready: false, shotsReceived: [] });
  return { phase: "placing", players: [player(), player()], turn: null, winner: null };
}

export function other(seat: Seat): Seat {
  return seat === 0 ? 1 : 0;
}

/** Sets or replaces a seat's fleet. Allowed until that seat is ready. */
export function placeFleet(rules: RulesConfig, game: GameState, seat: Seat, fleet: Placement[]): Outcome<null> {
  if (game.phase !== "placing") return { ok: false, error: "wrong_phase" };
  const player = game.players[seat];
  if (player.ready) return { ok: false, error: "already_ready" };
  const check = validateFleet(rules, fleet);
  if (!check.ok) return { ok: false, error: check.error };
  player.fleet = fleet.map((p) => ({ ship: p.ship, cell: p.cell, orientation: p.orientation }));
  return { ok: true, value: null };
}

/** Locks a seat's fleet. When both seats are ready, a coin flip picks who fires first. */
export function markReady(game: GameState, seat: Seat, rng: Rng): Outcome<null> {
  if (game.phase !== "placing") return { ok: false, error: "wrong_phase" };
  const player = game.players[seat];
  if (player.ready) return { ok: false, error: "already_ready" };
  if (!player.fleet) return { ok: false, error: "no_fleet" };
  player.ready = true;
  if (game.players[0].ready && game.players[1].ready) {
    game.phase = "playing";
    game.turn = rng() < 0.5 ? 0 : 1;
  }
  return { ok: true, value: null };
}

function shipAt(rules: RulesConfig, fleet: Placement[], cell: Cell): { placement: Placement; cells: Cell[] } | null {
  for (const placement of fleet) {
    const spec = rules.fleet.find((s) => s.id === placement.ship)!;
    const cells = shipCells(rules, placement.cell, placement.orientation, spec.length)!;
    if (cells.includes(cell)) return { placement, cells };
  }
  return null;
}

function resolve(rules: RulesConfig, defender: PlayerState, cell: Cell, upTo: number): Shot & { sunkCells?: Cell[] } {
  const hit = shipAt(rules, defender.fleet!, cell);
  if (!hit) return { cell, result: "miss" };
  const earlier = new Set(defender.shotsReceived.slice(0, upTo + 1));
  const sunk = hit.cells.every((c) => earlier.has(c));
  return sunk
    ? { cell, result: "sunk", ship: hit.placement.ship, sunkCells: hit.cells }
    : { cell, result: "hit", ship: hit.placement.ship };
}

/** One shot by `seat` at the opponent. Strict alternation: a hit does not grant another turn. */
export function fire(rules: RulesConfig, game: GameState, seat: Seat, cell: Cell): Outcome<ShotOutcome> {
  if (game.phase !== "playing") return { ok: false, error: "wrong_phase" };
  if (game.turn !== seat) return { ok: false, error: "not_your_turn" };
  if (!isCell(rules, cell)) return { ok: false, error: "bad_cell" };
  const defender = game.players[other(seat)];
  if (defender.shotsReceived.includes(cell)) return { ok: false, error: "already_shot" };
  defender.shotsReceived.push(cell);
  const shot = resolve(rules, defender, cell, defender.shotsReceived.length - 1);
  if (isFleetSunk(rules, defender)) {
    game.phase = "over";
    game.winner = seat;
    game.turn = null;
  } else {
    game.turn = other(seat);
  }
  return { ok: true, value: { ...shot, by: seat, winner: game.winner } };
}

/** Ship ids of a player's fleet that are fully hit. */
export function sunkShips(rules: RulesConfig, player: PlayerState): string[] {
  if (!player.fleet) return [];
  const shot = new Set(player.shotsReceived);
  return player.fleet
    .filter((p) => {
      const spec = rules.fleet.find((s) => s.id === p.ship)!;
      return shipCells(rules, p.cell, p.orientation, spec.length)!.every((c) => shot.has(c));
    })
    .map((p) => p.ship);
}

function isFleetSunk(rules: RulesConfig, player: PlayerState): boolean {
  return sunkShips(rules, player).length === rules.fleet.length;
}

/**
 * Shots fired at `defender`, each as the shooter saw it at the time.
 * A sunk shot lists the ship's cells so the shooter can mark the whole wreck.
 * This is all a shooter may know about the defender's board.
 */
export function shotsAt(rules: RulesConfig, defender: PlayerState): Array<Shot & { sunkCells?: Cell[] }> {
  if (!defender.fleet) return [];
  return defender.shotsReceived.map((cell, i) => resolve(rules, defender, cell, i));
}
