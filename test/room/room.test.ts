import { test } from "node:test";
import assert from "node:assert/strict";
import { randomFleet, seededRng, shipCells, type Placement, type Seat } from "../../src/engine/index.ts";
import { GAME_ID_PATTERN, newGameId } from "../../src/room/ids.ts";
import { parseClientMessage, type ServerMessage } from "../../src/room/protocol.ts";
import { COMPUTER, RULES, claimSeat, createRoom, handle, stateFor, type RoomRecord } from "../../src/room/room.ts";

const ALICE = "a".repeat(32);
const BOB = "b".repeat(32);
const stacked = (): Placement[] => RULES.fleet.map((s, i) => ({ ship: s.id, cell: i * RULES.size, orientation: "h" }));

function cellsOf(fleet: Placement[]): Set<number> {
  return new Set(fleet.flatMap((p) => shipCells(RULES, p.cell, p.orientation, RULES.fleet.find((s) => s.id === p.ship)!.length)!));
}

/** Plays a whole computer game; returns every message sent to the human seat, states included. */
function playComputerGame(seed: number): { room: RoomRecord; seen: ServerMessage[] } {
  const rng = seededRng(seed);
  const room = createRoom("x", "computer", ALICE, 0, rng);
  const seen: ServerMessage[] = [];
  const run = (msg: Parameters<typeof handle>[2]) => {
    const r = handle(room, 0, msg, 1, rng);
    for (const o of r.out) {
      assert.equal(o.to, 0, "computer seat never receives messages");
      seen.push(o.msg);
    }
    seen.push(stateFor(room, 0, false));
    return r;
  };
  run({ type: "place", fleet: randomFleet(RULES, rng) });
  run({ type: "ready" });
  let next = 0;
  while (room.game.phase === "playing") {
    assert.equal(room.game.turn, 0, "after any human action the computer has already moved");
    const shot = new Set(room.game.players[1].shotsReceived);
    while (shot.has(next)) next++;
    run({ type: "fire", cell: next });
  }
  return { room, seen };
}

test("game ids are 16 base32 characters (80 bits) and unique", () => {
  const ids = new Set(Array.from({ length: 1000 }, newGameId));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.match(id, GAME_ID_PATTERN);
});

test("client messages are shape-checked", () => {
  assert.deepEqual(parseClientMessage('{"type":"fire","cell":12}'), { type: "fire", cell: 12 });
  assert.equal(parseClientMessage('{"type":"fire","cell":"12"}'), null);
  assert.equal(parseClientMessage('{"type":"join","token":"short"}'), null);
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: "join", token: ALICE })), { type: "join", token: ALICE });
  assert.equal(parseClientMessage("not json"), null);
  assert.equal(parseClientMessage('{"type":"place","fleet":[{"ship":"carrier","cell":0,"orientation":"x"}]}'), null);
  assert.equal(parseClientMessage("x".repeat(5000)), null);
  const place = parseClientMessage(JSON.stringify({ type: "place", fleet: [{ ship: "carrier", cell: 0, orientation: "h", extra: 1 }] }));
  assert.deepEqual(place, { type: "place", fleet: [{ ship: "carrier", cell: 0, orientation: "h" }] });
});

test("computer room: the computer holds seat 1 with a placed fleet; strangers cannot join", () => {
  const room = createRoom("x", "computer", ALICE, 0, seededRng(1));
  assert.equal(room.seats[1], COMPUTER);
  assert.ok(room.game.players[1].fleet);
  assert.deepEqual(claimSeat(room, { type: "resume", token: ALICE }), { seat: 0, joined: false });
  assert.equal((claimSeat(room, { type: "join", token: BOB }) as { code: string }).code, "game_full");
  assert.equal((claimSeat(room, { type: "resume", token: BOB }) as { code: string }).code, "not_a_player");
});

test("ready starts play against the computer, and a computer first turn is taken immediately", () => {
  for (let seed = 0; seed < 10; seed++) {
    const room = createRoom("x", "computer", ALICE, 0, seededRng(seed));
    handle(room, 0, { type: "place", fleet: stacked() }, 1, seededRng(seed));
    const r = handle(room, 0, { type: "ready" }, 1, seededRng(seed));
    assert.equal(room.game.phase, "playing");
    assert.equal(room.game.turn, 0);
    const opened = room.game.players[0].shotsReceived.length === 1;
    assert.equal(r.out.length, opened ? 1 : 0);
  }
});

test("errors go only to the sender and change nothing", () => {
  const room = createRoom("x", "computer", ALICE, 0, seededRng(2));
  const before = JSON.stringify(room);
  const r = handle(room, 0, { type: "fire", cell: 0 }, 5, seededRng(2));
  assert.equal(r.changed, false);
  assert.deepEqual(r.out.map((o) => [o.to, o.msg.type, (o.msg as { code: string }).code]), [[0, "error", "wrong_phase"]]);
  assert.equal(JSON.stringify(room), before);
});

test("a full game against the computer finishes with a winner and results for both sides", () => {
  const { room, seen } = playComputerGame(3);
  assert.equal(room.game.phase, "over");
  const final = stateFor(room, 0, false);
  assert.equal(final.phase, "over");
  assert.ok(final.winner === "you" || final.winner === "opponent");
  const results = seen.filter((m) => m.type === "result");
  assert.ok(results.some((m) => m.by === "you") && results.some((m) => m.by === "opponent"));
});

test("the opponent's ship positions never appear in any message to a client", () => {
  for (let seed = 10; seed < 20; seed++) {
    const { room, seen } = playComputerGame(seed);
    const enemy = room.game.players[1];
    const hitByMe = new Set(enemy.shotsReceived);
    const enemyCells = cellsOf(enemy.fleet!);
    const ownFleet = JSON.stringify(room.game.players[0].fleet);
    for (const msg of seen) {
      if (msg.type === "state") {
        assert.equal(JSON.stringify(msg.yourFleet), ownFleet, "only your own fleet is sent");
        for (const shot of msg.yourShots) {
          assert.ok(hitByMe.has(shot.cell));
          for (const c of shot.sunkCells ?? []) assert.ok(hitByMe.has(c), "a wreck only lists cells already hit");
        }
      }
      if (msg.type === "result" && msg.by === "you") {
        for (const c of msg.sunkCells ?? []) assert.ok(hitByMe.has(c));
      }
      // No message carries a placement other than your own.
      const text = JSON.stringify(msg);
      const fleets = [...text.matchAll(/"orientation"/g)].length;
      assert.ok(fleets === 0 || (msg.type === "state" && fleets === msg.yourFleet!.length));
      // Every enemy ship cell mentioned has already been shot.
      for (const cell of enemyCells) {
        if (!hitByMe.has(cell) && msg.type === "result" && msg.by === "you") assert.notEqual(msg.cell, cell);
      }
    }
  }
});

test("seats: a friend room seats the joiner once and resumes known tokens", () => {
  const room = createRoom("x", "friend", ALICE, 0, seededRng(4));
  assert.equal(room.seats[1], null);
  assert.deepEqual(claimSeat(room, { type: "join", token: BOB }), { seat: 1, joined: true });
  assert.deepEqual(claimSeat(room, { type: "join", token: BOB }), { seat: 1, joined: false });
  assert.equal((claimSeat(room, { type: "join", token: "c".repeat(32) }) as { code: string }).code, "game_full");
  const seat: Seat = 1;
  assert.equal(stateFor(room, seat, true).opponentJoined, true);
});

test("friend room: two players finish a game; neither ever sees the other's unhit ships", () => {
  const rng = seededRng(21);
  const room = createRoom("x", "friend", ALICE, 0, rng);
  assert.deepEqual(claimSeat(room, { type: "join", token: BOB }), { seat: 1, joined: true });
  const seen: [ServerMessage[], ServerMessage[]] = [[], []];
  const act = (seat: Seat, msg: Parameters<typeof handle>[2]) => {
    const r = handle(room, seat, msg, 1, rng);
    for (const o of r.out) seen[o.to].push(o.msg);
    if (r.changed) for (const s of [0, 1] as Seat[]) seen[s].push(stateFor(room, s, true));
    return r;
  };
  act(0, { type: "place", fleet: randomFleet(RULES, rng) });
  act(0, { type: "ready" });
  assert.equal(room.game.phase, "placing", "play waits for both fleets");
  assert.equal(stateFor(room, 1, true).opponentReady, true);
  act(1, { type: "place", fleet: randomFleet(RULES, rng) });
  act(1, { type: "ready" });
  assert.equal(room.game.phase, "playing");

  const next: [number, number] = [0, 0];
  while (room.game.phase === "playing") {
    const seat = room.game.turn!;
    const target = room.game.players[seat === 0 ? 1 : 0];
    while (target.shotsReceived.includes(next[seat])) next[seat]++;
    const wrong = handle(room, seat === 0 ? 1 : 0, { type: "fire", cell: 0 }, 1, rng);
    assert.equal((wrong.out[0].msg as { code: string }).code, "not_your_turn");
    act(seat, { type: "fire", cell: next[seat] });
  }
  assert.ok(room.game.winner === 0 || room.game.winner === 1);

  for (const seat of [0, 1] as Seat[]) {
    const enemy = room.game.players[seat === 0 ? 1 : 0];
    const shot = new Set(enemy.shotsReceived);
    const own = JSON.stringify(room.game.players[seat].fleet);
    for (const msg of seen[seat]) {
      if (msg.type === "state") {
        assert.ok(msg.yourFleet === null || JSON.stringify(msg.yourFleet) === own, "only your own fleet, or none yet");
        for (const s of msg.yourShots) for (const c of [s.cell, ...(s.sunkCells ?? [])]) assert.ok(shot.has(c));
      }
      if (msg.type === "result" && msg.by === "you") for (const c of msg.sunkCells ?? []) assert.ok(shot.has(c));
    }
    const final = stateFor(room, seat, true);
    assert.equal(final.winner, room.game.winner === seat ? "you" : "opponent");
  }
});
