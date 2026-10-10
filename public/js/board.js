// A 10x10 nt-board. Cells are buttons; state is set per render, animations are layered on top.
import { h } from "./dom.js";
import { SIZE, cellLabel } from "./fleet.js";

const STATES = ["unknown", "miss", "hit", "sunk", "ship"];
const STATE_WORD = { unknown: "", miss: "miss", hit: "hit", sunk: "sunk", ship: "your ship" };

export class Board {
  /**
   * @param {{ label: string, mini?: boolean, onTap?: (cell: number) => void }} options
   */
  constructor({ label, mini = false, onTap }) {
    this.mini = mini;
    this.cells = [];
    this.el = h(`div.nt-board${mini ? ".nt-board--mini" : ""}`, mini ? { role: "img", "aria-label": label } : { role: "grid", "aria-label": label });
    if (!mini) {
      const head = h("div.nt-board__row", { role: "row" }, h("span.nt-board__label", { "aria-hidden": "true" }));
      for (let c = 0; c < SIZE; c++) head.append(h("span.nt-board__label", { "aria-hidden": "true" }, String.fromCharCode(65 + c)));
      this.el.append(head);
    }
    for (let r = 0; r < SIZE; r++) {
      const row = h("div.nt-board__row", { role: mini ? null : "row" });
      if (!mini) row.append(h("span.nt-board__label", { "aria-hidden": "true" }, String(r + 1)));
      for (let c = 0; c < SIZE; c++) {
        const cell = r * SIZE + c;
        const el = mini
          ? h("span.nt-cell")
          : h("button.nt-cell", { type: "button", role: "gridcell", "aria-label": cellLabel(cell), onclick: () => onTap?.(cell) });
        this.cells.push(el);
        row.append(el);
      }
      this.el.append(row);
    }
  }

  /**
   * @param {(cell: number) => { state?: string, valid?: boolean, invalid?: boolean, targeted?: boolean, last?: boolean, disabled?: boolean }} describe
   */
  render(describe) {
    for (let i = 0; i < this.cells.length; i++) {
      const d = describe(i);
      const state = d.state ?? "unknown";
      const el = this.cells[i];
      for (const s of STATES) el.classList.toggle(`nt-cell--${s}`, s === state && s !== "unknown");
      el.classList.toggle("nt-cell--valid", !!d.valid);
      el.classList.toggle("nt-cell--invalid", !!d.invalid);
      el.classList.toggle("is-last", !!d.last);
      if (!this.mini) {
        el.setAttribute("aria-selected", d.targeted ? "true" : "false");
        if (d.disabled) el.setAttribute("aria-disabled", "true");
        else el.removeAttribute("aria-disabled");
        el.setAttribute("aria-label", [cellLabel(i), STATE_WORD[state]].filter(Boolean).join(", "));
      }
    }
  }

  /** Flip animation on cells (staggered via --i). `from` names the face shown before the flip. */
  flip(cells, from = "unknown", sinking = false) {
    cells.forEach((cell, i) => {
      const el = this.cells[cell];
      el.style.setProperty("--i", String(i));
      el.classList.remove("is-flipping", "is-sinking", "nt-cell--from-ship", "nt-cell--from-hit");
      void el.offsetWidth; // restart the animation
      if (from !== "unknown") el.classList.add(`nt-cell--from-${from}`);
      el.classList.add("is-flipping");
      if (sinking) el.classList.add("is-sinking");
      setTimeout(() => el.classList.remove("is-flipping", "is-sinking", "nt-cell--from-ship", "nt-cell--from-hit"), 1200 + i * 60);
    });
  }

  shake() {
    this.el.classList.remove("is-shaking");
    void this.el.offsetWidth;
    this.el.classList.add("is-shaking");
    setTimeout(() => this.el.classList.remove("is-shaking"), 400);
  }
}
