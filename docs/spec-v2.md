# Neon Tide: v2 spec proposal (draft, not approved)

Status: **proposal only.** Nothing here is approved scope and nothing in it has been built. `docs/spec.md` stays
frozen for Phase 1, and `CLAUDE.md` forbids building beyond Phase 1 until the owner approves a v2 spec and updates
`CLAUDE.md`. This file exists so that decision can be made on paper.

Source: the 2026-11-13 review (findings G1 to G4, L2, B7, S6), `docs/backlog.md`, and the Phase 2 list in
`docs/spec.md` section 12. The Phase 2 items (barrage, hidden sinking, easy and medium AI) are not repeated here
except where they interact.

## Summary

| ID | Item | Size | Recommendation | Changes the Phase 1 spec at |
|---|---|---|---|---|
| G1 | End-of-game reveal and board review | small | **Do first** | section 7 ("never send the opponent's board") |
| G2a | Resign | small | **Do first** | section 6 (lifecycle), new message |
| G2b | Claim a win after the opponent has been gone a long time | small-medium | Do second | section 6, decision 2026-10-10 on expiry |
| G2c | Turn timer | medium | **Do not build yet** | section 3 (rules) |
| G4 | In-app rules sheet | small, client only | Do with G1 | none |
| B7 | Keep the unfinished fleet layout across reloads | small, client only | Do with G1 | none |
| L2 | Sunk reveal draws ship boundaries when ships touch | medium | Keep as is; decide with hidden sinking | section 3 |
| G3 | Rematch | medium | Defer | sections 3 and 8 ("one link is one game") |
| S6 | Clean up finished games and limiter objects | small | Defer until storage or privacy matters | section 6 |

Size is relative to the work already done in Phase 1, not an estimate in hours.

---

## G1. End-of-game reveal and board review

**Problem.** The loser never learns where the surviving ships were, which is the tabletop convention and the usual
proof that nobody cheated. The game-over dialog cannot be dismissed (it blocks `cancel` and offers only "New game"),
so neither player can look back at the final boards.

**Proposal.**
- When a game is decided by a win, the final `state` for both seats includes the opponent's fleet placements
  (`opponentFleet`). Before the game is over the server still never sends it. Games that expire unfinished, or end
  by resignation or abandonment (G2), reveal nothing: nobody earned it, and it avoids teaching a player the layout of
  a game they could still be in.
- The game-over dialog gets a "View boards" action that closes it and shows both final boards (own and enemy, with
  every ship drawn and the shot history). "New game" stays one tap away.
- Computer games reveal the computer's fleet the same way.

**Why it is safe.** The reveal happens only after `phase` is `over` with a winner, so it cannot help the player in
the game it belongs to. The risk is a bug that sends it early, so the existing leak tests are extended: every message
before the end must contain no key `opponentFleet`, and after the end it must equal the opponent's stored fleet.

**Spec change.** Section 7: "Never send the opponent's board" becomes "never send the opponent's board until the
game has been won".

**Alternative considered.** Reveal only the surviving ships. Rejected: it is more code (a filter) for less value; the
full board is what players expect.

**Done when.** Unit tests for both directions of the rule; an E2E that finishes a game and finds the opponent's ships
on the review screen; the dialog can be closed and reopened.

## G2. Abandoned games

**Problem.** If the opponent leaves, the player gets a toast and waits. There is no resign, no claim-win, no timer.
The game expires after 24 hours idle, but decision 2026-10-10 counts joins and resumes as activity, so a waiting
player who keeps reopening the link keeps the game alive indefinitely.

**G2a. Resign (recommended first).** A "Resign" action in a menu or on the battle screen, with a confirmation
dialog. New client message `resign`; the server ends the game with the other seat as winner and a `reason` of
`resigned` in the final `state`. No reveal (see G1). Works in friend and computer games.

**G2b. Claim a win (recommended second).** The server already tracks when a seat went away (`goneAt`). Proposal: when
the opponent has been disconnected for more than a set time (suggest 10 minutes; configurable constant), a "Claim
win" action appears for the waiting player. Claiming ends the game with `reason: "abandoned"`. The server checks the
condition itself; the client only shows the button. Open question for the owner: the delay. Too short punishes a
phone that is simply locked; 10 minutes is a starting point and cheap to change.
Related: change the expiry clock so that a player reopening the link does not extend a game whose opponent has not
moved. That reverses part of decision 2026-10-10 ("joins, resumes and moves all count as activity") and needs the
owner's explicit yes.

**G2c. Turn timer (not recommended now).** Auto-forfeit or auto-skip when a turn runs long. It is the most
contentious option: it changes the rules (section 3), forces a choice between forfeit and skip, and punishes casual
play on phones, where people put the device down. Leave it out until stalling is actually seen in real games. If it
is added later, prefer a visible "your opponent has been away for N minutes" nudge plus G2b over an automatic loss.

**Spec change.** Section 6 gains the two end reasons and the claim rule. A `reason` field is added to the final
`state`; the client shows a different headline for each.

**Done when.** Unit tests for resign (both seats, wrong phase, already over), for the claim condition (before and
after the delay, opponent connected, opponent back), and E2E for resign in a two-player game.

## G4. In-app rules sheet

**Problem.** The app never says that ships may touch, that the first turn is a coin flip, or that a hit does not give
another shot.

**Proposal.** A small "How to play" sheet reachable from the home screen and the battle screen, using the design
system's existing `nt-legend`. Static text, no server change. It should state the sunk-reveal rule as it actually is
(see L2), so it must be written after that decision.

## B7. Keep the fleet layout across reloads

**Problem.** The placement draft lives in memory and is sent only at Ready. A reload or an iOS tab eviction loses it.

**Proposal.** Store the draft per game id (`nt:draft:<id>`) after each change while placing; restore it on load if
the server state is still `placing` and the player is not ready; clear it at Ready and at game over. Reuse the
existing guarded storage wrapper, since storage can be unavailable (private mode) and the page must work without it.
Validate what is restored against the fleet rules before using it.

## L2. Sunk reveal and touching ships

**Problem (reproduced in the 2026-11-13 review).** A sunk result sends every cell of the wreck. When ships touch the
shooter learns the exact boundary. Example: Destroyer on A1-B1 beside Cruiser on C1-E1; hit C1, then B1, then A1.
The third result says the wreck is exactly A1-B1, so the C1 hit must be a different ship. The tabletop rule announces
only the ship's name. The reasoning in decision 2026-10-10 ("all its cells were already hit, so no hidden information
leaks") does not hold when ships touch, and the rules allow touching.

**Options.**
- **(a) Keep and document.** Cost: none. The leak is minor, because the shooter learns which of their own hits
  belong together only after the ship sinks.
- **(b) Announce the name only and mark just the final cell.** Cost: the computer opponent must reason about which
  hits a sunk ship explains, the sunk visuals change, and `sunkCells` disappears from the protocol.

**Recommendation: (a) for now, decided together with hidden sinking.** Both change `sunkCells`, the way the AI treats
wrecks, and what the board draws, so doing them separately means doing that work twice. Whichever is chosen,
G4 must describe it accurately.

## G3. Rematch

**Problem.** Spec section 3 says "one link is one game. No series, no rematch." Friends who want another game start a
new one and send a new link.

**Options.** (a) Stay as is. (b) A "Play again" button that creates a new game and offers it to the opponent over
their open connection (new messages for offer, accept and decline; the opponent lands on the new link). (c) Make the
new-game flow faster without any protocol change.

**Recommendation: defer.** (b) touches the lifecycle ("a finished link stays finished"), the protocol, and what
happens when the opponent has left. Revisit after G1 and G2, when the end-of-game screen is being worked on anyway.

## S6. Stored data clean-up

**Problem.** Finished and expired game records (both fleets and both seat tokens) are kept forever by decision
2026-10-10, and each IP that ever created a game leaves a limiter object with stored data. Sizes are tiny (under 2 KB
per game).

**Proposal.** One Durable Object alarm after a retention period (suggest 30 days after the game ends) deletes the
fleets and seat tokens and keeps a small tombstone (outcome, shot counts) so the link still says "Game over". Limiter
objects drop expired hits on each call and could clear themselves after the window. This reuses the existing alarm
machinery and needs no new Durable Object class or migration. **Interaction with G1:** the retention period decides
how long the final boards can be reviewed.

**Recommendation: defer** until storage or privacy requirements appear. The only data of any sensitivity is the seat
tokens, which are random and only useful for the game they belong to.

---

## Suggested order

1. **v2.0:** G1 (reveal and review), G2a (resign), G4 (rules sheet), B7 (draft persistence). Each as its own pull
   request, in that order, so the protocol changes (G1, G2a) land before the client-only ones.
2. **v2.1:** G2b (claim win), with the expiry-clock change if the owner agrees.
3. **With Phase 2:** L2 together with hidden sinking and the AI levels.
4. **Later, only if wanted:** G3 rematch, S6 clean-up, G2c timer.

## Decisions needed from the owner

1. Approve a v2 scope (which of the above), and update `CLAUDE.md` so agents may build it.
2. G1: reveal on a win only, as proposed, or also on resignation and abandonment?
3. G2b: the absence delay before "Claim win" appears (proposed 10 minutes), and whether a returning player should
   stop extending the 24 hour expiry.
4. L2: keep the whole-wreck reveal (recommended) or switch to name-only together with hidden sinking.
5. G2c: confirm that a turn timer stays out until stalling is seen.

## What this proposal does not do

It adds no code, no tests and no protocol messages, and it does not change `docs/spec.md`. Every item above stays
unbuilt until the owner approves it in writing.
