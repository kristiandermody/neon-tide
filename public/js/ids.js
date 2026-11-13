// Client copy of the game id pattern in src/room/ids.ts: Crockford base32 (no i, l, o, u), 16 characters.
// A unit test (test/client/drift.test.ts) fails if the two diverge.
export const GAME_ID_PATTERN = /^[0-9a-hjkmnp-tv-z]{16}$/;
