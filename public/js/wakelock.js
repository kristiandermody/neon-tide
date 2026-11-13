// Screen Wake Lock during play. The browser drops the lock whenever the page is hidden,
// so it is requested again each time the page becomes visible while still wanted.
let wanted = false;
let sentinel = null;
let pending = false; // a request is in flight; sentinel is still null until it resolves

async function acquire() {
  if (!wanted || sentinel || pending || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
  pending = true;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (!wanted) {
      // keepAwake(false) ran while the request was pending; nobody wants this lock any more.
      lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    lock.addEventListener("release", () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
    // Not allowed right now (battery saver, no user activation); try again on the next visibility change.
  } finally {
    pending = false;
  }
}

document.addEventListener("visibilitychange", acquire);

export function keepAwake(on) {
  wanted = on;
  if (on) acquire();
  else if (sentinel) {
    sentinel.release().catch(() => {});
    sentinel = null;
  }
}
