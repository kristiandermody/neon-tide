// Rules are data so later phases can add modes without touching the engine's call sites.

export interface ShipSpec {
  /** Stable id used in messages and storage. */
  id: string;
  /** Name shown to players. */
  name: string;
  length: number;
}

export interface RulesConfig {
  /** Board is size x size. Columns are lettered from A, rows numbered from 1. */
  size: number;
  fleet: readonly ShipSpec[];
  /** Ships may sit in adjacent cells (they may never overlap). */
  shipsMayTouch: boolean;
}

export const CLASSIC_RULES: RulesConfig = Object.freeze({
  size: 10,
  fleet: Object.freeze([
    { id: "carrier", name: "Carrier", length: 5 },
    { id: "dreadnought", name: "Dreadnought", length: 4 },
    { id: "cruiser", name: "Cruiser", length: 3 },
    { id: "submarine", name: "Submarine", length: 3 },
    { id: "destroyer", name: "Destroyer", length: 2 },
  ]),
  shipsMayTouch: true,
});
