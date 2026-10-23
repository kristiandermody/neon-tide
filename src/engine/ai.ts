import { shipCells, type Cell, type Orientation, type Rng } from "./board.ts";
import type { Shot } from "./game.ts";

/** A shot as the computer saw it: hits do not name their ship, sunk shots list the whole wreck. */
export type SeenShot = Shot & { sunkCells?: Cell[] };
import type { RulesConfig } from "./rules.ts";

/**
 * Hard computer opponent (spec section 4). It sees only its own shot results, never the player's board.
 * A plain hit does not say which ship it belongs to; only a sunk shot does, and it lists the wreck.
 *
 * For every unshot cell, count the legal placements of each unsunk ship that cover it, then fire at the
 * highest count, breaking ties at random. A placement is legal when it stays on the board and avoids misses
 * and wrecks. While there are hits not yet part of a wreck, a placement counts once per such hit it covers
 * and placements covering none are ignored, so the AI finishes what it started.
 */
export function chooseShot(rules: RulesConfig, shots: readonly SeenShot[], rng: Rng): Cell {
  const heat = heatmap(rules, shots);
  let best = -1;
  let candidates: Cell[] = [];
  for (let cell = 0; cell < heat.length; cell++) {
    if (heat[cell] < 0) continue;
    if (heat[cell] > best) {
      best = heat[cell];
      candidates = [cell];
    } else if (heat[cell] === best) {
      candidates.push(cell);
    }
  }
  if (candidates.length === 0) throw new Error("no cells left to shoot");
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Placement counts per cell; -1 marks a cell already shot. Exported for tests. */
export function heatmap(rules: RulesConfig, shots: readonly SeenShot[]): number[] {
  const total = rules.size * rules.size;
  const heat = new Array<number>(total).fill(0);
  const blocked = new Set<Cell>();
  const sunk = new Set<string>();
  const open = new Set<Cell>();

  for (const shot of shots) {
    heat[shot.cell] = -1;
    if (shot.result === "miss") blocked.add(shot.cell);
    else if (shot.result === "hit") open.add(shot.cell);
    else {
      sunk.add(shot.ship!);
      for (const c of shot.sunkCells ?? [shot.cell]) blocked.add(c);
    }
  }
  for (const c of blocked) open.delete(c);

  for (const spec of rules.fleet) {
    if (sunk.has(spec.id)) continue;
    for (let start = 0; start < total; start++) {
      for (const orientation of ["h", "v"] as Orientation[]) {
        const cells = shipCells(rules, start, orientation, spec.length);
        if (!cells || cells.some((c) => blocked.has(c))) continue;
        const covered = cells.filter((c) => open.has(c)).length;
        if (open.size > 0 && covered === 0) continue;
        const weight = open.size > 0 ? covered : 1;
        for (const c of cells) if (heat[c] >= 0) heat[c] += weight;
      }
    }
  }
  return heat;
}
