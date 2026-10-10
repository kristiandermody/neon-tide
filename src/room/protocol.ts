// WebSocket message protocol (spec section 7). JSON text frames.
// Game creation is an HTTP POST (/api/games) so the Worker can rate-limit it per IP.
import type { Cell, Placement, ShotResult } from "../engine/index.ts";

export type Mode = "computer" | "friend";

export type ClientMessage =
  | { type: "join"; token: string }
  | { type: "resume"; token: string }
  | { type: "place"; fleet: Placement[] }
  | { type: "ready" }
  | { type: "fire"; cell: Cell }
  | { type: "ping" };

/** A shot as the receiving player may see it. */
export interface ViewShot {
  cell: Cell;
  result: ShotResult;
  ship?: string;
  sunkCells?: Cell[];
}

export type Side = "you" | "opponent";

export interface StateMessage {
  type: "state";
  id: string;
  mode: Mode;
  phase: "placing" | "playing" | "over" | "expired";
  turn: Side | null;
  winner: Side | null;
  yourFleet: Placement[] | null;
  yourReady: boolean;
  opponentReady: boolean;
  opponentJoined: boolean;
  opponentConnected: boolean;
  /** Your shots at the opponent's board. */
  yourShots: ViewShot[];
  /** The opponent's shots at your board. */
  opponentShots: ViewShot[];
  yourSunk: string[];
  opponentSunk: string[];
}

export interface ResultMessage {
  type: "result";
  by: Side;
  cell: Cell;
  result: ShotResult;
  ship?: string;
  sunkCells?: Cell[];
  winner: Side | null;
}

export interface OpponentStatusMessage {
  type: "opponent_status";
  status: "joined" | "connected" | "disconnected";
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export type ServerMessage = StateMessage | ResultMessage | OpponentStatusMessage | ErrorMessage;

/** The exact ping frame. The Durable Object answers it without waking (auto-response). */
export const PING = '{"type":"ping"}';
export const PONG = '{"type":"pong"}';

export const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/** Parses and shape-checks a client frame. Returns null for anything malformed. */
export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  switch (m.type) {
    case "join":
    case "resume":
      return typeof m.token === "string" && TOKEN_PATTERN.test(m.token) ? { type: m.type, token: m.token } : null;
    case "place":
      if (!Array.isArray(m.fleet) || m.fleet.length > 20) return null;
      if (!m.fleet.every((p) => p && typeof p === "object" && typeof p.ship === "string" && Number.isInteger(p.cell) && (p.orientation === "h" || p.orientation === "v"))) return null;
      return { type: "place", fleet: m.fleet.map((p) => ({ ship: p.ship, cell: p.cell, orientation: p.orientation })) };
    case "ready":
      return { type: "ready" };
    case "fire":
      return Number.isInteger(m.cell) ? { type: "fire", cell: m.cell as number } : null;
    case "ping":
      return { type: "ping" };
    default:
      return null;
  }
}
