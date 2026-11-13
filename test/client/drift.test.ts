import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSIC_RULES, shipCells } from "../../src/engine/index.ts";
import { GAME_ID_PATTERN as SERVER_ID_PATTERN } from "../../src/room/ids.ts";

// B8: the client keeps its own copies of rules the server enforces, to avoid a build step. If they drift,
// placement previews and Randomize produce fleets the server rejects, or the UI shows wrong names. Fail loudly.

type ClientFleet = {
  SIZE: number;
  FLEET: Array<{ id: string; name: string; length: number }>;
  shipCells: (cell: number, orientation: "h" | "v", length: number) => number[] | null;
};
const load = async <T>(file: string): Promise<T> => (await import(new URL(`../../public/js/${file}`, import.meta.url).href)) as T;

test("client fleet copy matches the engine rules", async () => {
  const client = await load<ClientFleet>("fleet.js");
  assert.equal(client.SIZE, CLASSIC_RULES.size);
  assert.deepEqual(
    client.FLEET.map((s) => ({ ...s })),
    CLASSIC_RULES.fleet.map((s) => ({ ...s })),
  );
});

test("client ship geometry matches the engine for every cell, orientation and length", async () => {
  const client = await load<ClientFleet>("fleet.js");
  for (const length of new Set(CLASSIC_RULES.fleet.map((s) => s.length))) {
    for (const orientation of ["h", "v"] as const) {
      for (let cell = 0; cell < CLASSIC_RULES.size ** 2; cell++) {
        assert.deepEqual(client.shipCells(cell, orientation, length), shipCells(CLASSIC_RULES, cell, orientation, length), `${orientation} ${length} at ${cell}`);
      }
    }
  }
});

test("client game id pattern matches the server's", async () => {
  const { GAME_ID_PATTERN } = await load<{ GAME_ID_PATTERN: RegExp }>("ids.js");
  assert.equal(GAME_ID_PATTERN.source, SERVER_ID_PATTERN.source);
  assert.equal(GAME_ID_PATTERN.flags, SERVER_ID_PATTERN.flags);
});
