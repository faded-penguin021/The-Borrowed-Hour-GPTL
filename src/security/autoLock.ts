// Auto-lock controller for the session key.
//
// This is a *text adventure*: a reader can sit on a long narration, or weigh
// their next move, for several minutes without touching mouse or keyboard. A
// strict in-tab idle timer would therefore lock them out mid-game and force a
// re-prompt — unacceptable. So auto-lock is driven by the tab going to the
// background (visibilitychange / pagehide), not by foreground inactivity.
//
// When the tab is hidden we wait a short grace period before locking, so a quick
// tab switch (to copy something, check a message) doesn't force a re-prompt on
// return. As an absolute backstop there is a long, generous session cap that
// never fires while the user is actively reading a foreground tab.

export interface AutoLockOptions {
  /** Drop the cached session key. */
  lock: () => void;
  /** Whether a session key is currently cached. */
  isUnlocked: () => boolean;
  /** Grace delay after the tab is hidden before locking. */
  hideGraceMs?: number;
  /** Absolute upper bound on a single unlocked session. */
  sessionCapMs?: number;
}

export interface AutoLockController {
  start(): void;
  stop(): void;
  /**
   * Arm (or re-arm) the absolute session cap. Call at each successful unlock:
   * the cap bounds an *unlocked session*, so it must run from the unlock, not
   * from controller start — a page-lifetime timer would fire once (possibly
   * while still locked) and leave later unlocks uncapped.
   */
  noteUnlocked(): void;
}

const DEFAULT_HIDE_GRACE_MS = 2 * 60 * 1000; // 2 minutes backgrounded → lock
const DEFAULT_SESSION_CAP_MS = 8 * 60 * 60 * 1000; // 8 hours absolute backstop

export function createAutoLock(opts: AutoLockOptions): AutoLockController {
  const hideGraceMs = opts.hideGraceMs ?? DEFAULT_HIDE_GRACE_MS;
  const sessionCapMs = opts.sessionCapMs ?? DEFAULT_SESSION_CAP_MS;

  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;
  let started = false;

  const clearHideTimer = () => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const scheduleHideLock = () => {
    if (!opts.isUnlocked()) return;
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      opts.lock();
    }, hideGraceMs);
  };

  const onVisibilityChange = () => {
    if (typeof document !== "undefined" && document.hidden)
      scheduleHideLock();
    else
      clearHideTimer(); // back in the foreground before the grace elapsed
  };

  // pagehide covers bfcache/navigation-away cases visibilitychange can miss.
  const onPageHide = () => scheduleHideLock();

  const clearCapTimer = () => {
    if (capTimer !== null) {
      clearTimeout(capTimer);
      capTimer = null;
    }
  };

  return {
    start() {
      if (started || typeof document === "undefined") return;
      started = true;
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("pagehide", onPageHide);
    },
    noteUnlocked() {
      if (!started) return;
      clearCapTimer();
      capTimer = setTimeout(() => {
        capTimer = null;
        opts.lock();
      }, sessionCapMs);
    },
    stop() {
      if (!started) return;
      started = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      clearHideTimer();
      clearCapTimer();
    },
  };
}
