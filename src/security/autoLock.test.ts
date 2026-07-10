// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAutoLock } from "./autoLock";

const GRACE = 1_000;
const CAP = 5_000;

let hidden = false;

function setHidden(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});

afterEach(() => {
  vi.useRealTimers();
});

function make(unlocked = true) {
  const lock = vi.fn();
  const controller = createAutoLock({
    lock,
    isUnlocked: () => unlocked,
    hideGraceMs: GRACE,
    sessionCapMs: CAP,
  });
  controller.start();
  return { lock, controller };
}

describe("createAutoLock", () => {
  it("arms the absolute cap at unlock, not at start", () => {
    const { lock, controller } = make();
    vi.advanceTimersByTime(CAP * 3);
    expect(lock).not.toHaveBeenCalled();
    controller.noteUnlocked();
    vi.advanceTimersByTime(CAP - 1);
    expect(lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(lock).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it("re-arms the cap on each unlock", () => {
    const { lock, controller } = make();
    controller.noteUnlocked();
    vi.advanceTimersByTime(CAP / 2);
    controller.noteUnlocked(); // fresh session → fresh window
    vi.advanceTimersByTime(CAP / 2);
    expect(lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CAP / 2);
    expect(lock).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it("locks after the hide grace when backgrounded", () => {
    const { lock, controller } = make();
    setHidden(true);
    vi.advanceTimersByTime(GRACE);
    expect(lock).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it("returning to the foreground before the grace cancels the lock", () => {
    const { lock, controller } = make();
    setHidden(true);
    vi.advanceTimersByTime(GRACE - 1);
    setHidden(false);
    vi.advanceTimersByTime(GRACE * 5);
    expect(lock).not.toHaveBeenCalled();
    controller.stop();
  });

  it("does not schedule a hide lock while already locked", () => {
    const { lock, controller } = make(false);
    setHidden(true);
    vi.advanceTimersByTime(GRACE * 2);
    expect(lock).not.toHaveBeenCalled();
    controller.stop();
  });

  it("stop clears pending timers", () => {
    const { lock, controller } = make();
    controller.noteUnlocked();
    setHidden(true);
    controller.stop();
    vi.advanceTimersByTime(CAP * 2);
    expect(lock).not.toHaveBeenCalled();
  });
});
