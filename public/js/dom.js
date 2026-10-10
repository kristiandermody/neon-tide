// Tiny DOM helpers. No framework.

/** h("button.nt-btn.nt-btn--primary", { onclick, type: "button" }, "Ready") */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key in el && !key.includes("-") && key !== "role") el[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const SVG = "http://www.w3.org/2000/svg";

/** Pixel icons on a 16-unit grid, drawn as rects so they stay crisp. */
const ICONS = {
  sound: [[1, 6, 3, 4], [4, 5, 2, 6], [6, 3, 2, 10], [10, 5, 1, 6], [12, 3, 1, 10]],
  muted: [[1, 6, 3, 4], [4, 5, 2, 6], [6, 3, 2, 10], [10, 5, 1, 1], [11, 6, 1, 1], [12, 7, 1, 1], [13, 8, 1, 1], [14, 9, 1, 1], [14, 5, 1, 1], [13, 6, 1, 1], [11, 8, 1, 1], [10, 9, 1, 1]],
  back: [[3, 7, 11, 2], [5, 5, 2, 2], [7, 3, 2, 2], [5, 9, 2, 2], [7, 11, 2, 2]],
  share: [[7, 1, 2, 9], [5, 3, 2, 2], [9, 3, 2, 2], [3, 7, 2, 7], [11, 7, 2, 7], [3, 12, 10, 2]],
};

export function icon(name, extra = "") {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", `nt-icon ${extra}`.trim());
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [x, y, w, hgt] of ICONS[name]) {
    const r = document.createElementNS(SVG, "rect");
    r.setAttribute("x", x);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", hgt);
    svg.append(r);
  }
  return svg;
}

export const reducedMotion = () =>
  document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds classes, removes them after `ms`. */
export function flash(el, classes, ms) {
  el.classList.add(...classes);
  setTimeout(() => el.classList.remove(...classes), ms);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reads a duration token such as --dur-hold in milliseconds. */
export function tokenMs(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return raw.endsWith("ms") ? n : n * 1000;
}
