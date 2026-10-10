// Room logic: everything the GameRoom Durable Object decides, as pure functions over a JSON record.
// No Cloudflare imports, so it is unit-tested in plain Node like the engine.
import {
  CLASSIC_RULES,
  chooseShot,
  fire,
  markReady,
  newGame,
  other,
  placeFleet,
  randomFleet,
  shotsAt,
  sunkShips,
  type GameState,
  type Rng,
  type RulesConfig,
  type Seat,
  type ShotOutcome,
} from "../engine/index.ts";
import type { ClientMessage, ErrorMessage, Mode, ResultMessage, ServerMessage, Side, StateMessage } from "./protocol.ts";

export const RULES: RulesConfig = CLASSIC_RULES;
/** Seat token used for the computer. Real tokens are 32 hex characters, so this can never collide. */
export const COMPUTER = "computer";

export interface RoomRecord {
  v: 1;
  id: string;
  mode: Mode;
  createdAt: number;
  updatedAt: number;
  seats: [string | null, string | null];
  game: GameState;
  expired: boolean;
}

export interface Outgoing {
  to: Seat;
  msg: ServerMessage;
}

export interface Handled {
  out: Outgoing[];
  /** True when every connected seat should get a fresh `state`. */
  changed: boolean;
}

export function createRoom(id: string, mode: Mode, creatorToken: string, now: number, rng: Rng): RoomRecord {
  const room: RoomRecord = {
    v: 1,
    id,
    mode,
    createdAt: now,
    updatedAt: now,
    seats: [creatorToken, null],
    game: newGame(),
    expired: false,
  };
  if (mode === "computer") {
    room.seats[1] = COMPUTER;
    placeFleet(RULES, room.game, 1, randomFleet(RULES, rng));
  }
  return room;
}

export function seatOf(room: RoomRecord, token: string): Seat | null {
  if (room.seats[0] === token) return 0;
  if (room.seats[1] === token) return 1;
  return null;
}

function error(code: string, message: string): ErrorMessage {
  return { type: "error", code, message };
}

const ERROR_TEXT: Record<string, string> = {
  wrong_fleet: "Place all five ships.",
  out_of_bounds: "That ship would leave the grid.",
  overlap: "Ships cannot overlap.",
  touching: "Ships cannot touch.",
  wrong_phase: "That move is not allowed right now.",
  already_ready: "Your fleet is already locked in.",
  no_fleet: "Place your fleet first.",
  not_your_turn: "Wait for your turn.",
  bad_cell: "That cell is not on the grid.",
  already_shot: "You already fired there.",
};

/**
 * Seats a token. A token that already holds a seat resumes it. `join` may take the open seat;
 * `resume` never takes a new seat.
 */
export function claimSeat(room: RoomRecord, msg: { type: "join" | "resume"; token: string }): { seat: Seat; joined: boolean } | ErrorMessage {
  const existing = seatOf(room, msg.token);
  if (existing !== null) return { seat: existing, joined: false };
  if (room.expired) return error("expired", "This game expired.");
  if (room.game.phase === "over") return error("game_over", "This game has ended.");
  if (msg.type === "resume") return error("not_a_player", "You are not in this game.");
  if (room.seats[1] === null) {
    room.seats[1] = msg.token;
    return { seat: 1, joined: true };
  }
  return error("game_full", "This game already has two players.");
}

function side(viewer: Seat, seat: Seat | null): Side | null {
  if (seat === null) return null;
  return seat === viewer ? "you" : "opponent";
}

function resultFor(viewer: Seat, shot: ShotOutcome): ResultMessage {
  const msg: ResultMessage = {
    type: "result",
    by: side(viewer, shot.by)!,
    cell: shot.cell,
    result: shot.result,
    winner: side(viewer, shot.winner),
  };
  if (shot.ship) msg.ship = shot.ship;
  if (shot.sunkCells) msg.sunkCells = shot.sunkCells;
  return msg;
}

/** Sends a shot result to both seats (the computer seat receives nothing). */
function announce(room: RoomRecord, shot: ShotOutcome): Outgoing[] {
  const out: Outgoing[] = [];
  for (const seat of [0, 1] as Seat[]) {
    if (room.seats[seat] !== COMPUTER) out.push({ to: seat, msg: resultFor(seat, shot) });
  }
  return out;
}

/** Lets the computer move for as long as it holds the turn (it only ever fires once per turn). */
function computerTurn(room: RoomRecord, rng: Rng): Outgoing[] {
  if (room.mode !== "computer" || room.game.phase !== "playing" || room.game.turn !== 1) return [];
  const cell = chooseShot(RULES, shotsAt(RULES, room.game.players[0]), rng);
  const shot = fire(RULES, room.game, 1, cell);
  if (!shot.ok) throw new Error(`computer fired illegally: ${shot.error}`);
  return announce(room, shot.value);
}

/** Applies one game message from a seated player. */
export function handle(room: RoomRecord, seat: Seat, msg: ClientMessage, now: number, rng: Rng): Handled {
  if (room.expired) return { out: [{ to: seat, msg: error("expired", "This game expired.") }], changed: false };
  let out: Outgoing[] = [];
  let failure: string | null = null;

  switch (msg.type) {
    case "place": {
      const r = placeFleet(RULES, room.game, seat, msg.fleet);
      if (!r.ok) failure = r.error;
      break;
    }
    case "ready": {
      const r = markReady(room.game, seat, rng);
      if (!r.ok) failure = r.error;
      else if (room.mode === "computer" && !room.game.players[1].ready) markReady(room.game, 1, rng);
      if (r.ok) out = computerTurn(room, rng);
      break;
    }
    case "fire": {
      const r = fire(RULES, room.game, seat, msg.cell);
      if (!r.ok) failure = r.error;
      else out = [...announce(room, r.value), ...computerTurn(room, rng)];
      break;
    }
    default:
      return { out: [], changed: false };
  }

  if (failure) return { out: [{ to: seat, msg: error(failure, ERROR_TEXT[failure] ?? "Not allowed.") }], changed: false };
  room.updatedAt = now;
  return { out, changed: true };
}

/** The personalized snapshot for one seat. Never includes the opponent's fleet. */
export function stateFor(room: RoomRecord, seat: Seat, opponentConnected: boolean): StateMessage {
  const me = room.game.players[seat];
  const opp = room.game.players[other(seat)];
  return {
    type: "state",
    id: room.id,
    mode: room.mode,
    phase: room.expired ? "expired" : room.game.phase,
    turn: side(seat, room.game.turn),
    winner: side(seat, room.game.winner),
    yourFleet: me.fleet ? me.fleet.map((p) => ({ ...p })) : null,
    yourReady: me.ready,
    opponentReady: opp.ready,
    opponentJoined: room.seats[other(seat)] !== null,
    opponentConnected: room.seats[other(seat)] === COMPUTER || opponentConnected,
    yourShots: shotsAt(RULES, opp),
    opponentShots: shotsAt(RULES, me),
    yourSunk: sunkShips(RULES, me),
    opponentSunk: sunkShips(RULES, opp),
  };
}
