// Client copy of the placement rules, used only to preview and lay out a fleet before Ready.
// The server validates every fleet with the engine (src/engine), which stays the source of truth.

export const SIZE = 10;

export const FLEET = [
  { id: "carrier", name: "Carrier", length: 5 },
  { id: "dreadnought", name: "Dreadnought", length: 4 },
  { id: "cruiser", name: "Cruiser", length: 3 },
  { id: "submarine", name: "Submarine", length: 3 },
  { id: "destroyer", name: "Destroyer", length: 2 },
];

export const shipName = (id) => FLEET.find((s) => s.id === id)?.name ?? id;
export const shipLength = (id) => FLEET.find((s) => s.id === id)?.length ?? 0;

export function cellLabel(cell) {
  return String.fromCharCode(65 + (cell % SIZE)) + String(Math.floor(cell / SIZE) + 1);
}

/** Cells for a ship, or null if it would leave the grid. */
export function shipCells(cell, orientation, length) {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  if (orientation === "h" ? col + length > SIZE : row + length > SIZE) return null;
  const step = orientation === "h" ? 1 : SIZE;
  return Array.from({ length }, (_, i) => cell + i * step);
}

/** Map of cell -> ship id for a list of placements. */
export function occupancy(placements) {
  const map = new Map();
  for (const p of placements) {
    for (const c of shipCells(p.cell, p.orientation, shipLength(p.ship)) ?? []) map.set(c, p.ship);
  }
  return map;
}

/** Whether `placement` fits among `others` (ships may touch, never overlap). */
export function fits(placement, others) {
  const cells = shipCells(placement.cell, placement.orientation, shipLength(placement.ship));
  if (!cells) return false;
  const taken = occupancy(others.filter((p) => p.ship !== placement.ship));
  return cells.every((c) => !taken.has(c));
}

export function randomLayout() {
  for (;;) {
    const placed = [];
    for (const ship of FLEET) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const p = { ship: ship.id, cell: Math.floor(Math.random() * SIZE * SIZE), orientation: Math.random() < 0.5 ? "h" : "v" };
        if (fits(p, placed)) {
          placed.push(p);
          break;
        }
      }
    }
    if (placed.length === FLEET.length) return placed;
  }
}
