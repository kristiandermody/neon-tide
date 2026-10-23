// Neon Tide client: routing, screens, and the game view. Server-authoritative: the client renders
// what the GameRoom sends and only keeps a local draft of the fleet before Ready.
import { Board } from "./board.js";
import { h, icon, reducedMotion, sleep, tokenMs } from "./dom.js";
import { isMuted, onMuteChange, play, setMuted, unlockAudio } from "./feedback.js";
import { FLEET, SIZE, cellLabel, fits, occupancy, randomLayout, shipCells, shipLength, shipName } from "./fleet.js";
import { Connection } from "./net.js";
import { playerToken } from "./store.js";
import { keepAwake } from "./wakelock.js";

const app = document.getElementById("app");
const toastRegion = document.getElementById("toasts");
let current = null; // active screen controller with an optional destroy()

document.addEventListener("pointerdown", unlockAudio);

// ---------- Shared pieces ----------

function muteButton() {
  const btn = h(
    "button.nt-iconbtn.nt-iconbtn--ghost.nt-mute",
    { type: "button", "aria-label": "Mute sound", "aria-pressed": String(isMuted()), onclick: () => setMuted(!isMuted()) },
    icon("sound", "nt-mute__on"),
    icon("muted", "nt-mute__off"),
  );
  const off = onMuteChange((m) => btn.setAttribute("aria-pressed", String(m)));
  btn.addEventListener("nt:destroy", off);
  return btn;
}

export function toast(title, body, state) {
  const el = h(
    "div.nt-toast.is-entering",
    { role: "status" },
    state ? h(`span.nt-cell.nt-cell--${state}`, { "aria-hidden": "true" }) : null,
    h("div", {}, h("strong.nt-toast__title", {}, title), body ? h("span", {}, body) : null),
  );
  toastRegion.replaceChildren(el);
  setTimeout(() => el.remove(), 2400);
}

function wordmark() {
  return document.getElementById("wordmark").content.firstElementChild.cloneNode(true);
}

function navigate(path) {
  history.pushState({}, "", path);
  route();
}

function mount(screen) {
  current?.destroy?.();
  for (const el of app.querySelectorAll(".nt-mute")) el.dispatchEvent(new Event("nt:destroy"));
  current = screen;
  app.replaceChildren(screen.el);
}

// ---------- Home ----------

function homeScreen() {
  const status = h("p.nt-small.nt-text-secondary", { "aria-live": "polite" });
  const start = async (mode, btn) => {
    unlockAudio();
    btn.disabled = true;
    status.textContent = "";
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, token: playerToken() }),
      });
      if (res.status === 429) throw new Error("Too many new games from this network. Try again in a few minutes.");
      if (!res.ok) throw new Error("Could not start a game. Try again.");
      const { id } = await res.json();
      navigate(`/g/${id}`);
    } catch (err) {
      status.textContent = err instanceof Error && err.message ? err.message : "Could not start a game. Try again.";
      btn.disabled = false;
    }
  };
  const vsFriend = h("button.nt-btn.nt-btn--primary.nt-btn--block", { type: "button", onclick: () => start("friend", vsFriend) }, "Play a friend");
  const vsComputer = h("button.nt-btn.nt-btn--block", { type: "button", onclick: () => start("computer", vsComputer) }, "Play the computer");

  const el = h(
    "main.nt-screen",
    {},
    h("div.nt-screen__top", {}, h("div.nt-topbar", {}, h("span"), muteButton())),
    h(
      "div.nt-screen__main.nt-screen__main--center.home",
      {},
      h("h1.home__mark", {}, wordmark()),
      h("p.nt-arcade.nt-arcade--label.home__tag", {}, "Sink Cube"),
      h("p.nt-small.nt-text-secondary.home__line", {}, "A naval grid game. Hide five ships, then take turns firing until one fleet is gone."),
    ),
    h("div.nt-screen__dock", {}, vsFriend, vsComputer, status),
  );
  return { el };
}

function messageScreen(title, body) {
  const el = h(
    "main.nt-screen",
    {},
    h("div.nt-screen__top", {}, h("div.nt-topbar", {}, h("span"), muteButton())),
    h("div.nt-screen__main.nt-screen__main--center", {}, h("h1.nt-arcade", {}, title), h("p.nt-text-secondary", {}, body)),
    h("div.nt-screen__dock", {}, h("button.nt-btn.nt-btn--primary.nt-btn--block", { type: "button", onclick: () => navigate("/") }, "New game")),
  );
  return { el };
}

// ---------- Share link ----------

function sharePanel(url) {
  const input = h("input.nt-share__input", { id: "share-link", type: "text", readOnly: true, value: url, onfocus: (e) => e.target.select() });
  const status = h("p.nt-share__status", { role: "status" });
  const canShare = typeof navigator.share === "function";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      input.focus();
      input.select();
      if (!document.execCommand?.("copy")) {
        status.textContent = "Select the link and copy it.";
        return;
      }
    }
    status.textContent = "Link copied.";
  };
  const share = async () => {
    status.textContent = "";
    if (!canShare) return copy();
    try {
      await navigator.share({ title: "Neon Tide", text: "Play Neon Tide with me. Sink Cube!", url });
    } catch (err) {
      if (err?.name !== "AbortError") await copy();
    }
  };
  return h(
    "div.nt-share",
    {},
    h("label.nt-share__label", { for: "share-link" }, "Invite link"),
    h(
      "div.nt-share__row",
      {},
      input,
      h("button.nt-btn", { type: "button", onclick: share, "aria-label": canShare ? "Share invite link" : "Copy invite link" }, canShare ? icon("share") : null, canShare ? "Share" : "Copy"),
    ),
    status,
  );
}

// ---------- Fleet tracker ----------

function hitsByShip(shots) {
  const hits = new Map();
  for (const s of shots) if (s.result !== "miss") hits.set(s.ship, (hits.get(s.ship) ?? 0) + 1);
  return hits;
}

// Hits on the enemy fleet do not say which ship was hit, so only your own fleet shows per-ship damage.
function fleetTracker(title, shots, sunk, compact = false) {
  const hits = shots ? hitsByShip(shots) : new Map();
  return h(
    `div.nt-fleet${compact ? ".nt-fleet--compact" : ""}`,
    {},
    h("div.nt-fleet__head", {}, h("span", {}, title), h("span.nt-fleet__count", {}, `${FLEET.length - sunk.length}/${FLEET.length} afloat`)),
    h(
      "ul.nt-fleet__list",
      {},
      FLEET.map((s) => {
        const isSunk = sunk.includes(s.id);
        const hitCount = isSunk ? s.length : hits.get(s.id) ?? 0;
        return h(
          `li.nt-fleet__ship${isSunk ? ".is-sunk" : ""}`,
          { "aria-label": `${s.name}: ${isSunk ? "sunk" : shots ? `${hitCount} of ${s.length} hit` : "afloat"}` },
          h("span.nt-fleet__name", {}, s.name),
          h("span.nt-fleet__pips", { "aria-hidden": "true" }, Array.from({ length: s.length }, (_, i) => h(`span.nt-pip${i < hitCount ? ".nt-pip--hit" : ""}`))),
        );
      }),
    ),
  );
}

// ---------- Game ----------

class GameScreen {
  constructor(id) {
    this.id = id;
    this.vm = null; // last state, updated locally by results while they animate
    this.queue = [];
    this.busy = false;
    this.kind = null; // which sub-screen is built
    this.draft = { placements: [], selected: FLEET[0].id, orientation: Object.fromEntries(FLEET.map((s) => [s.id, "h"])) };
    this.invalid = [];
    this.target = null;
    this.firing = false;
    this.el = h("div.game", {}, h("main.nt-screen", {}, h("div.nt-screen__main.nt-screen__main--center", {}, h("p.nt-waiting__label", {}, "Connecting"))));
    this.conn = new Connection(id, playerToken(), {
      onMessage: (msg) => this.receive(msg),
      onStatus: (status) => this.connectionStatus(status),
    });
    // Lock screen, app switch, back-forward cache and network changes all come back through here.
    this.onReturn = () => document.visibilityState === "visible" && this.conn.wake();
    document.addEventListener("visibilitychange", this.onReturn);
    addEventListener("pageshow", this.onReturn);
    addEventListener("online", this.onReturn);
    keepAwake(true);
  }

  destroy() {
    this.conn.stop();
    keepAwake(false);
    document.removeEventListener("visibilitychange", this.onReturn);
    removeEventListener("pageshow", this.onReturn);
    removeEventListener("online", this.onReturn);
    this.dialog?.close();
  }

  /** The game is decided: nothing more will arrive, so free the socket and the screen. */
  finish() {
    this.conn.stop();
    keepAwake(false);
  }

  get opponentName() {
    return this.vm?.mode === "computer" ? "Computer" : "Opponent";
  }

  connectionStatus(status) {
    this.online = status === "open";
    if (this.kind === "battle") this.renderBattle();
  }

  receive(msg) {
    if (msg.type === "error") return this.error(msg);
    this.queue.push(msg);
    if (!this.busy) this.drain();
  }

  error(msg) {
    this.firing = false;
    const fatal = { not_found: "No game here", game_full: "Game is full", game_over: "Game over", expired: "Game expired", not_a_player: "Not your game" };
    if (fatal[msg.code]) {
      this.finish();
      this.kind = "message";
      this.el.replaceChildren(messageScreen(fatal[msg.code], msg.message).el);
      return;
    }
    toast("Not allowed", msg.message);
    this.render();
  }

  async drain() {
    this.busy = true;
    while (this.queue.length) {
      const msg = this.queue.shift();
      if (msg.type === "state") {
        this.vm = msg;
        this.render();
      } else if (msg.type === "opponent_status") {
        this.opponentStatus(msg.status);
      } else if (msg.type === "result" && this.vm) {
        this.applyResult(msg);
        this.render();
        await this.animate(msg);
      }
    }
    this.busy = false;
    if (this.vm?.phase === "over" && this.kind === "battle") this.showGameOver();
  }

  opponentStatus(status) {
    if (status === "joined") {
      play("tap");
      toast("Friend joined", "They are placing their fleet.");
    } else if (status === "disconnected") {
      toast(`${this.opponentName} left`, "The game is saved. It continues when they open the link again.");
    } else if (status === "connected") {
      play("tap");
      toast(`${this.opponentName} is back`, "");
    }
  }

  applyResult(r) {
    const vm = this.vm;
    const shot = { cell: r.cell, result: r.result, ship: r.ship, sunkCells: r.sunkCells };
    if (r.by === "you") {
      vm.yourShots.push(shot);
      if (r.result === "sunk" && !vm.opponentSunk.includes(r.ship)) vm.opponentSunk.push(r.ship);
      this.firing = false;
      this.target = null;
    } else {
      vm.opponentShots.push(shot);
      if (r.result === "sunk" && !vm.yourSunk.includes(r.ship)) vm.yourSunk.push(r.ship);
    }
    vm.turn = r.winner ? null : r.by === "you" ? "opponent" : "you";
    if (r.winner) {
      vm.phase = "over";
      vm.winner = r.winner;
    }
  }

  async animate(r) {
    const mine = r.by === "you";
    const board = mine ? this.enemyBoard : this.ownBoard;
    const name = shipName(r.ship);
    const from = !mine && r.result !== "miss" ? "ship" : "unknown";
    board?.flip([r.cell], from);
    if (r.result === "miss") {
      play("miss");
      toast(mine ? "Miss" : `${this.opponentName} missed`, cellLabel(r.cell), "miss");
    } else if (r.result === "hit") {
      play("hit");
      board?.shake();
      toast(mine ? "Hit" : `${this.opponentName} hit`, mine ? cellLabel(r.cell) : `Your ${name}`, "hit");
    } else {
      play("sunk");
      board?.shake();
      board?.flip(r.sunkCells ?? [r.cell], "hit", true);
      toast(mine ? "Sunk" : `${this.opponentName} sank`, mine ? `${name} destroyed` : `Your ${name}`, "sunk");
    }
    // Hold so the result can be read before the turn flips; without motion there is nothing to wait out.
    await sleep(reducedMotion() ? tokenMs("--dur-turn") : tokenMs("--dur-hold") + (r.result === "sunk" ? tokenMs("--dur-bounce") : tokenMs("--dur-flip")));
    if (r.winner) this.showGameOver(true);
  }

  // ----- render dispatch -----

  render() {
    const vm = this.vm;
    if (!vm) return;
    if (vm.phase === "over" || vm.phase === "expired") this.finish();
    if (vm.phase === "expired") {
      this.kind = "message";
      this.el.replaceChildren(messageScreen("Game expired", "This game sat idle for 24 hours and has ended.").el);
      return;
    }
    const inviting = vm.mode === "friend" && !vm.opponentJoined;
    if (vm.phase === "placing" && !vm.yourReady && inviting && !this.lobbyDone) return this.ensure("lobby", () => this.buildLobby(), () => {});
    if (vm.phase === "placing" && !vm.yourReady) return this.ensure("placing", () => this.buildPlacing(), () => this.renderPlacing());
    if (vm.phase === "placing") return this.ensure(`waiting-${inviting}`, () => this.buildWaiting(inviting), () => {});
    this.ensure("battle", () => this.buildBattle(), () => this.renderBattle());
  }

  ensure(kind, build, update) {
    if (this.kind !== kind) {
      this.kind = kind;
      this.el.replaceChildren(build());
    }
    update();
  }

  // ----- placing -----

  buildPlacing() {
    if (this.vm.yourFleet) this.draft.placements = this.vm.yourFleet.map((p) => ({ ...p }));
    this.placeBoard = new Board({ label: "Your grid", onTap: (cell) => this.tapPlacement(cell) });
    this.hint = h("p.nt-topbar__hint", { "aria-live": "polite" });
    this.tray = h("div.nt-tray", { "aria-label": "Ships to place" });
    this.rotateBtn = h("button.nt-btn.nt-btn--grow", { type: "button", onclick: () => this.rotate() }, "Rotate");
    this.readyBtn = h("button.nt-btn.nt-btn--primary.nt-btn--block", { type: "button", onclick: () => this.ready() }, "Ready");
    return h(
      "main.nt-screen",
      {},
      h("div.nt-screen__top", {}, h("div.nt-topbar", {}, h("div.nt-stack", {}, h("h1.nt-topbar__title", {}, "Place fleet"), this.hint), muteButton())),
      h("div.nt-screen__main", {}, h("div.nt-screen__board", {}, this.placeBoard.el), this.tray),
      h(
        "div.nt-screen__dock",
        {},
        h("div.nt-row", {}, this.rotateBtn, h("button.nt-btn.nt-btn--grow", { type: "button", onclick: () => this.randomize() }, "Randomize")),
        this.readyBtn,
      ),
    );
  }

  renderPlacing() {
    const { placements, selected, orientation } = this.draft;
    const occ = occupancy(placements);
    const selectedCells = new Set(
      placements.filter((p) => p.ship === selected).flatMap((p) => shipCells(p.cell, p.orientation, shipLength(p.ship)) ?? []),
    );
    const invalid = new Set(this.invalid);
    this.placeBoard.render((cell) => ({
      state: occ.has(cell) ? "ship" : "unknown",
      valid: selectedCells.has(cell),
      invalid: invalid.has(cell),
    }));

    const placedIds = new Set(placements.map((p) => p.ship));
    const unplaced = FLEET.filter((s) => !placedIds.has(s.id));
    this.tray.replaceChildren(
      ...(unplaced.length
        ? unplaced.map((s) => {
            const btn = h(
              `button.nt-ship${s.id === selected ? ".is-selected" : ""}`,
              { type: "button", "aria-label": `${s.name}, ${s.length} cells`, "aria-pressed": String(s.id === selected), onclick: () => this.select(s.id) },
              Array.from({ length: s.length }, () => h("span.nt-cell.nt-cell--ship", { "aria-hidden": "true" })),
            );
            btn.style.setProperty("--ship-cell", "20px");
            btn.style.setProperty("--cell-min", "0px");
            btn.style.setProperty("--cube-depth", "3px");
            btn.style.setProperty("--cube-notch", "1px");
            return btn;
          })
        : [h("p.nt-small.nt-text-secondary", {}, "All ships placed. Tap a ship to move it, or press Ready.")]),
    );

    this.hint.textContent = selected
      ? `${shipName(selected)} (${shipLength(selected)}), ${orientation[selected] === "h" ? "across" : "down"}. Tap a cell.`
      : "Tap a ship, then a cell.";
    this.rotateBtn.disabled = !selected;
    this.readyBtn.disabled = placements.length !== FLEET.length;
  }

  select(ship) {
    play("tap");
    this.draft.selected = this.draft.selected === ship ? null : ship;
    this.renderPlacing();
  }

  tapPlacement(cell) {
    const { placements, selected, orientation } = this.draft;
    const owner = occupancy(placements).get(cell);
    if (owner && owner !== selected) return this.select(owner);
    if (owner && owner === selected) return this.select(owner);
    if (!selected) return;
    const candidate = { ship: selected, cell, orientation: orientation[selected] };
    this.tryPlace(candidate);
  }

  tryPlace(candidate) {
    const { placements } = this.draft;
    if (!fits(candidate, placements)) {
      const len = shipLength(candidate.ship);
      const step = candidate.orientation === "h" ? 1 : SIZE;
      const row = Math.floor(candidate.cell / SIZE);
      this.invalid = Array.from({ length: len }, (_, i) => candidate.cell + i * step).filter(
        (c) => c < SIZE * SIZE && (candidate.orientation === "v" || Math.floor(c / SIZE) === row),
      );
      play("miss");
      this.renderPlacing();
      setTimeout(() => {
        this.invalid = [];
        if (this.kind === "placing") this.renderPlacing();
      }, 700);
      return false;
    }
    this.draft.placements = [...placements.filter((p) => p.ship !== candidate.ship), candidate];
    const placed = new Set(this.draft.placements.map((p) => p.ship));
    this.draft.selected = FLEET.find((s) => !placed.has(s.id))?.id ?? null;
    play("tap");
    this.renderPlacing();
    return true;
  }

  rotate() {
    const { selected, orientation, placements } = this.draft;
    if (!selected) return;
    const next = orientation[selected] === "h" ? "v" : "h";
    const placed = placements.find((p) => p.ship === selected);
    if (placed) {
      const keep = this.draft.selected;
      if (this.tryPlace({ ...placed, orientation: next })) {
        orientation[selected] = next;
        this.draft.selected = keep;
        this.renderPlacing();
      }
      return;
    }
    orientation[selected] = next;
    play("tap");
    this.renderPlacing();
  }

  randomize() {
    this.draft.placements = randomLayout();
    for (const p of this.draft.placements) this.draft.orientation[p.ship] = p.orientation;
    this.draft.selected = null;
    play("tap");
    this.renderPlacing();
  }

  ready() {
    if (this.draft.placements.length !== FLEET.length) return;
    unlockAudio();
    const sent = this.conn.send({ type: "place", fleet: this.draft.placements }) && this.conn.send({ type: "ready" });
    if (!sent) toast("Offline", "Reconnecting. Try again in a moment.");
    else this.readyBtn.disabled = true;
  }

  // ----- lobby and waiting (friend games) -----

  get link() {
    return `${location.origin}/g/${this.id}`;
  }

  waiting(label, hint) {
    return h(
      "div.nt-waiting",
      {},
      h("div.nt-waiting__cubes", { "aria-hidden": "true" }, h("span.nt-waiting__cube"), h("span.nt-waiting__cube"), h("span.nt-waiting__cube")),
      h("p.nt-waiting__label", {}, label),
      h("p.nt-waiting__hint", {}, hint),
    );
  }

  buildLobby() {
    return h(
      "main.nt-screen",
      {},
      h("div.nt-screen__top", {}, h("div.nt-topbar", {}, h("h1.nt-topbar__title", {}, "Invite a friend"), muteButton())),
      h(
        "div.nt-screen__main.nt-screen__main--center",
        {},
        this.waiting("Waiting for a friend", "Send this link to one friend. You can place your fleet while you wait."),
      ),
      h(
        "div.nt-screen__dock",
        {},
        sharePanel(this.link),
        h("button.nt-btn.nt-btn--primary.nt-btn--block", { type: "button", onclick: () => ((this.lobbyDone = true), this.render()) }, "Place your fleet"),
      ),
    );
  }

  buildWaiting(inviting) {
    return h(
      "main.nt-screen",
      {},
      h("div.nt-screen__top", {}, h("div.nt-topbar", {}, h("h1.nt-topbar__title", {}, "Fleet ready"), muteButton())),
      h(
        "div.nt-screen__main.nt-screen__main--center",
        {},
        inviting
          ? this.waiting("Waiting for a friend", "Your fleet is locked in. Send the link; the game starts when your friend is ready.")
          : this.waiting(`Waiting for ${this.opponentName.toLowerCase()}`, "Your fleet is locked in. The game starts when both fleets are ready."),
      ),
      inviting ? h("div.nt-screen__dock", {}, sharePanel(this.link)) : h("div"),
    );
  }

  // ----- battle -----

  buildBattle() {
    this.enemyBoard = new Board({ label: "Enemy grid", onTap: (cell) => this.aim(cell) });
    this.ownBoard = new Board({ label: "Your grid", mini: true });
    this.banner = h("div.nt-banner.is-entering");
    this.bannerTitle = h("p.nt-banner__title", { "aria-live": "polite" });
    this.bannerHint = h("p.nt-banner__hint");
    this.banner.append(h("div.nt-banner__text", {}, this.bannerTitle, this.bannerHint), h("div.nt-banner__aside", {}, muteButton()));
    this.enemyFleet = h("div");
    this.ownFleet = h("div");
    this.fireMeta = h("span.nt-btn__meta");
    this.fireBtn = h("button.nt-btn.nt-btn--primary.nt-btn--fire", { type: "button", onclick: () => this.fire() }, "Fire", this.fireMeta);
    return h(
      "main.nt-screen.nt-screen--wide.battle",
      {},
      h("div.nt-screen__top", {}, this.banner),
      h(
        "div.nt-battle",
        {},
        h("section.nt-battle__side", { "aria-label": "Enemy waters" }, h("div.nt-screen__board", {}, this.enemyBoard.el)),
        h(
          "section.nt-battle__side",
          { "aria-label": "Fleets" },
          h("div.nt-panel", {}, h("div.nt-row", {}, this.ownBoard.el, h("div.nt-stack.nt-stack--lg", {}, this.enemyFleet, this.ownFleet))),
        ),
      ),
      h("div.nt-screen__dock", {}, this.fireBtn),
    );
  }

  renderBattle() {
    const vm = this.vm;
    if (!vm || !this.enemyBoard) return;
    const yourTurn = vm.turn === "you" && vm.phase === "playing";

    const enemy = new Map(vm.yourShots.map((s) => [s.cell, s.result === "sunk" ? "hit" : s.result]));
    for (const s of vm.yourShots) for (const c of s.sunkCells ?? []) enemy.set(c, "sunk");
    const lastMine = vm.yourShots.at(-1)?.cell;
    this.enemyBoard.render((cell) => ({
      state: enemy.get(cell),
      targeted: cell === this.target,
      last: cell === lastMine,
      disabled: !yourTurn || enemy.has(cell),
    }));
    this.enemyBoard.el.classList.toggle("nt-board--active", yourTurn);

    const own = new Map();
    for (const c of occupancy(vm.yourFleet ?? []).keys()) own.set(c, "ship");
    for (const s of vm.opponentShots) own.set(s.cell, s.result === "sunk" ? "hit" : s.result);
    for (const s of vm.opponentShots) for (const c of s.sunkCells ?? []) own.set(c, "sunk");
    const lastTheirs = vm.opponentShots.at(-1)?.cell;
    this.ownBoard.render((cell) => ({ state: own.get(cell), last: cell === lastTheirs }));

    this.banner.classList.toggle("nt-banner--you", yourTurn);
    this.banner.classList.toggle("nt-banner--opp", !yourTurn);
    if (vm.phase === "over") {
      this.bannerTitle.textContent = vm.winner === "you" ? "You win" : "You lose";
      this.bannerHint.textContent = "Game over.";
    } else if (yourTurn) {
      this.bannerTitle.textContent = "Your turn";
      this.bannerHint.textContent = this.target === null ? "Tap a cell to aim." : `Aiming at ${cellLabel(this.target)}. Press Fire.`;
    } else {
      this.bannerTitle.textContent = `${this.opponentName}'s turn`;
      this.bannerHint.textContent = !vm.opponentConnected ? `${this.opponentName} is away. The game will resume when they return.` : "Incoming fire.";
    }
    if (this.online === false) this.bannerHint.textContent = "Reconnecting...";

    this.enemyFleet.replaceChildren(fleetTracker("Enemy fleet", null, vm.opponentSunk, true));
    this.ownFleet.replaceChildren(fleetTracker("Your fleet", vm.opponentShots, vm.yourSunk, true));

    this.fireMeta.textContent = this.target === null ? "" : cellLabel(this.target);
    this.fireBtn.disabled = !yourTurn || this.target === null || this.firing;
  }

  aim(cell) {
    const vm = this.vm;
    if (!vm || vm.turn !== "you" || vm.phase !== "playing" || this.firing) return;
    if (vm.yourShots.some((s) => s.cell === cell || s.sunkCells?.includes(cell))) return;
    this.target = cell;
    play("tap");
    this.renderBattle();
  }

  fire() {
    if (this.target === null || this.firing) return;
    if (!this.conn.send({ type: "fire", cell: this.target })) return toast("Offline", "Reconnecting. Try again in a moment.");
    this.firing = true;
    play("fire");
    this.enemyBoard.cells[this.target].classList.add("is-firing");
    this.renderBattle();
  }

  showGameOver(withSound = false) {
    if (this.dialog?.open) return;
    const vm = this.vm;
    const won = vm.winner === "you";
    const shots = vm.yourShots.length;
    const hits = vm.yourShots.filter((s) => s.result !== "miss").length;
    const accuracy = shots ? Math.round((hits / shots) * 100) : 0;
    if (withSound) play(won ? "win" : "lose");
    this.dialog = h(
      "dialog.nt-modal",
      { "aria-labelledby": "over-title" },
      h(
        "div.nt-modal__panel",
        {},
        h("h2.nt-modal__title", { id: "over-title" }, won ? "You win" : "You lose"),
        h("p.nt-modal__body", {}, won ? `You sank the ${this.opponentName.toLowerCase()}'s whole fleet.` : `The ${this.opponentName.toLowerCase()} sank your whole fleet.`),
        h(
          "div.nt-stats",
          {},
          stat(String(shots), "Shots"),
          stat(String(hits), "Hits"),
          stat(`${accuracy}%`, "Accuracy"),
        ),
        h("div.nt-modal__actions", {}, h("button.nt-btn.nt-btn--primary.nt-btn--block", { type: "button", onclick: () => navigate("/") }, "New game")),
      ),
    );
    this.dialog.addEventListener("cancel", (e) => e.preventDefault());
    this.el.append(this.dialog);
    this.dialog.showModal();
  }
}

function stat(value, label) {
  return h("div.nt-stats__item", {}, h("p.nt-stats__value", {}, value), h("p.nt-stats__label", {}, label));
}

// ---------- Router ----------

function route() {
  const match = location.pathname.match(/^\/g\/([0-9a-z]{16})$/);
  if (match) mount(new GameScreen(match[1]));
  else if (location.pathname === "/") mount(homeScreen());
  else mount(messageScreen("Not found", "There is nothing at this address."));
}

addEventListener("popstate", route);
route();
