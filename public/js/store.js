// localStorage that never throws (private mode, blocked storage). Falls back to memory for the session.
const memory = new Map();

export const store = {
  get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    } catch {
      // fall through to memory
    }
    return memory.get(key) ?? null;
  },
  set(key, value) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // memory copy is enough for this session
    }
  },
};

/** This device's player token: random, no account. Clearing site data loses the seat (accepted in the spec). */
export function playerToken() {
  let token = store.get("nt:token");
  if (!token || !/^[0-9a-f]{32}$/.test(token)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    store.set("nt:token", token);
  }
  return token;
}
