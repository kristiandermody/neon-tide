// Limiter keys for client IPs (S2). One IPv6 subscriber normally controls a whole /64, so keying on the
// full address would give a client that rotates source addresses a fresh allowance each time.

const HEXTET = /^[0-9a-f]{1,4}$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Expands an IPv6 literal to 8 hextets, or returns null if it is not one. */
function expand(addr: string): string[] | null {
  let text = addr;
  const dotted = text.lastIndexOf(":") + 1;
  const v4 = text.slice(dotted).match(IPV4);
  if (v4) {
    const bytes = v4.slice(1).map(Number);
    if (bytes.some((b) => b > 255)) return null;
    text = `${text.slice(0, dotted)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  return groups.length === 8 && groups.every((g) => HEXTET.test(g)) ? groups : null;
}

/**
 * The key a per-IP limiter uses. IPv4 (and anything unparseable, such as "unknown") is kept as is;
 * IPv6 is reduced to its /64 prefix; an IPv4-mapped IPv6 address is keyed as the IPv4 address.
 */
export function limitKey(ip: string): string {
  const addr = ip.trim().toLowerCase().split("%")[0];
  if (!addr.includes(":")) return addr;
  const groups = expand(addr);
  if (!groups) return addr;
  const value = groups.map((g) => parseInt(g, 16));
  if (value.slice(0, 5).every((g) => g === 0) && value[5] === 0xffff) {
    return `${value[6] >> 8}.${value[6] & 255}.${value[7] >> 8}.${value[7] & 255}`;
  }
  return `${value.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}
