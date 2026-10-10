// Screen Wake Lock during play. The browser drops the lock whenever the page is hidden,
// so it is requested again each time the page becomes visible while still wanted.
let wanted = false;
let sentinel = null;

async function acquire() {
  if (!wanted || sentinel || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    // Not allowed right now (battery saver, no user activation); try again on the next visibility change.
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
