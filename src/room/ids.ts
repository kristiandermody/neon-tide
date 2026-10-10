// Unguessable game ids: 80 bits from crypto.getRandomValues, as 16 lowercase base32 characters.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32: no i, l, o, u

export const GAME_ID_PATTERN = /^[0-9a-hjkmnp-tv-z]{16}$/;

export function newGameId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}
