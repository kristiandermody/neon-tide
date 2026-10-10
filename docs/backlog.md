# Backlog: v2 candidates, known issues, and bugs

The working list for after Phase 1. Nothing here is approved scope until it lands in a spec
(`docs/spec.md` is frozen for Phase 1; v2 gets its own spec). Log decisions in `docs/decisions.md`.

## Bugs and changes (things that don't work as expected)

Add one line each: date, what happened, device and browser, link or game id if any.

| Date | Report | Device | Status |
|---|---|---|---|
| — | (none reported yet; owner's real-iPhone test pending) | — | — |

## Known issues and gaps in Phase 1

| Issue | Impact | Suggested fix |
|---|---|---|
| Press Start 2P font not bundled | Arcade titles use system monospace | Owner supplies `public/fonts/press-start-2p.woff2`, then the `@font-face` rule in `tokens.css` is enabled by regenerating it from the design system |
| Phones narrower than 360px (iPhone SE 1st gen) scroll sideways | Small | Design-system decision: allow cells under 32px, or accept |
| Expiry (24h) verified by unit test only | Low | Optional: a staging test with a shortened `EXPIRY_MS` |
| Dead-socket probe after lock screen tested in desktop WebKit only | Real iOS behaviour unverified | Owner's real-iPhone lock/return test |
| OG image URL is absolute to production, including on staging | Staging previews show production's image (same file) | Fine unless the images diverge |
| Finished and expired game records are never deleted | Negligible storage (under 2 KB per game) | Optional cleanup alarm after N days |
| Wide (tablet/desktop) battle layout has empty space under the boards | Cosmetic | Design pass for 768px and wider |
| Placement screen: tapping your selected ship deselects it; no drag | By spec (no drag-and-drop) | Revisit after real-phone feedback |

## v2 candidates

From spec section 12 (Phase 2 backlog). The engine is open for these via `RulesConfig`:

- **Barrage:** a limited-use multi-shot where each surviving ship fires one missile in the same turn.
  Open question: a shared pool of 2 per player, or per ship.
- **Hidden sinking:** the defender does not announce a sunk ship. Open question: always on, or a one-time ability.
  Note: the sunk wreck reveal (`sunkCells`) and the AI's use of ship names would change.
- **Easy and medium AI** plus a difficulty selector. Hard AI lives in `src/engine/ai.ts`.

Other ideas surfaced during the build (not requested; for the owner to accept or drop):

- Rematch or "play again with the same friend". This was deliberately out of Phase 1 ("one link is one game").
- In-game rules or help sheet (the design system already has `nt-legend`).
- Opponent-left handling beyond the toast (for example, claim a win after a long absence).
- Offline shell via a service worker (not needed for install).
