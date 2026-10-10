import { shipCells, type Cell, type Orientation, type Rng } from "./board.ts";
import type { Shot } from "./game.ts";
import type { RulesConfig } from "./rules.ts";

/**
 * Hard computer opponent (spec section 4). It sees only its own shot results, never the player's board.
 *
 * For every unshot cell, count the legal placements of each unsunk ship that cover it, then fire at the
 * highest count, breaking ties at random. A placement is legal when it stays on the board, avoids misses
 * and wrecks, avoids hits known to belong to a different ship, and covers every known hit on its own ship.
 * While any unsunk ship has been hit, only those ships are counted, so the AI finishes what it started.
 */
export function chooseShot(rules: RulesConfig, shots: readonly Shot[], rng: Rng): Cell {
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
export function heatmap(rules: RulesConfig, shots: readonly Shot[]): number[] {
  const total = rules.size * rules.size;
  const heat = new Array<number>(total).fill(0);
  const blocked = new Set<Cell>();
  const hitsByShip = new Map<string, Cell[]>();
  const sunk = new Set<string>();

  for (const shot of shots) {
    heat[shot.cell] = -1;
    if (shot.result === "miss") blocked.add(shot.cell);
    else {
      const list = hitsByShip.get(shot.ship!) ?? [];
      list.push(shot.cell);
      hitsByShip.set(shot.ship!, list);
      if (shot.result === "sunk") sunk.add(shot.ship!);
    }
  }
  const hitOwner = new Map<Cell, string>();
  for (const [ship, cells] of hitsByShip) {
    for (const c of cells) {
      if (sunk.has(ship)) blocked.add(c);
      else hitOwner.set(c, ship);
    }
  }

  const afloat = rules.fleet.filter((s) => !sunk.has(s.id));
  const damaged = afloat.filter((s) => hitsByShip.has(s.id));
  const hunted = damaged.length > 0 ? damaged : afloat;

  for (const spec of hunted) {
    const mustCover = hitsByShip.get(spec.id) ?? [];
    for (let start = 0; start < total; start++) {
      for (const orientation of ["h", "v"] as Orientation[]) {
        const cells = shipCells(rules, start, orientation, spec.length);
        if (!cells) continue;
        if (cells.some((c) => blocked.has(c) || (hitOwner.has(c) && hitOwner.get(c) !== spec.id))) continue;
        if (!mustCover.every((c) => cells.includes(c))) continue;
        for (const c of cells) if (heat[c] >= 0) heat[c]++;
      }
    }
  }
  return heat;
}
