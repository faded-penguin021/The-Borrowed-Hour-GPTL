// @vitest-environment jsdom
//
// Failure-path coverage for the saves hook: the quota/rollback branch of
// saveCurrent, the save-cap guard, silent autosave failure, and save-version
// handling on the load/readAutosave paths. The storage shim and the IndexedDB
// image/doc store are the only boundaries stubbed — migrate and compression run
// for real, so a version-stamp or decode regression trips these tests.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { SAVE_PREFIX, AUTOSAVE_KEY, SAVE_CAP, EMPTY_LEDGER } from "../data/constants";
import type { SaveCurrentArgs } from "../hooks/useSaves";
import { CURRENT_SAVE_VERSION } from "../saves/migrate";
import type { Premise } from "../types";

// ── Boundary doubles ─────────────────────────────────────────────────────────
const img = vi.hoisted(() => ({
  putImage: vi.fn(),
  deleteImagesForSave: vi.fn(),
  putDoc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock("../storage/imageStore", () => img);

import { useSaves } from "../hooks/useSaves";

type StorageMock = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
};

let storage: StorageMock;

const premise: Premise = {
  id: "p1", realm: "echo", realmLabel: "ECHO", title: "The Hour",
  teaser: "t", seed: "s", gmNote: "n",
};

function args(overrides: Partial<SaveCurrentArgs> = {}): SaveCurrentArgs {
  return {
    premise,
    entries: [{ type: "narration", text: "A door opens.", fullyRevealed: true }],
    ended: false,
    gameState: null,
    ledger: EMPTY_LEDGER,
    history: [],
    metaMessages: [],
    metaMode: false,
    language: "en",
    codex: null,
    ...overrides,
  };
}

/** Render the hook and flush the on-mount readAutosave effect. */
async function mountHook() {
  const rendered = renderHook(() => useSaves());
  await act(async () => { await Promise.resolve(); });
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  storage = {
    get: vi.fn(async () => null),
    set: vi.fn(async (key: string, value: string) => ({ key, value })),
    delete: vi.fn(async (key: string) => ({ key })),
    list: vi.fn(async () => ({ keys: [] as string[] })),
  };
  (window as unknown as { storage: StorageMock }).storage = storage;
  img.putImage.mockResolvedValue("ok");
  img.deleteImagesForSave.mockResolvedValue(undefined);
  img.putDoc.mockResolvedValue(undefined);
  img.getDoc.mockResolvedValue(null);
  // saveCurrent offloads illustration bytes via fetch(url).blob().
  (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(
    async () => ({ blob: async () => new Blob(["img-bytes"]) }) as unknown as Response,
  );
});

afterEach(() => {
  delete (window as unknown as { storage?: unknown }).storage;
});

const illustratedArgs = () =>
  args({
    entries: [
      {
        type: "narration",
        text: "A door opens.",
        fullyRevealed: true,
        illustration: { status: "ready", url: "data:image/png;base64,AAAA" },
      },
    ],
  });

describe("saveCurrent — quota / rollback", () => {
  it("rolls back offloaded blobs and shows a quota error when the record write fails on quota", async () => {
    storage.set.mockRejectedValueOnce(new Error("The quota has been exceeded."));
    const { result } = await mountHook();

    await act(async () => { await result.current.saveCurrent(illustratedArgs()); });

    // The illustration bytes were offloaded first, then released on failure.
    expect(img.putImage).toHaveBeenCalledTimes(1);
    expect(img.deleteImagesForSave).toHaveBeenCalledTimes(1);
    expect(result.current.saveBanner?.kind).toBe("err");
    expect(result.current.saveBanner?.text).toMatch(/storage limit/i);
  });

  it("shows a generic error (not the quota copy) on a non-quota write failure", async () => {
    storage.set.mockRejectedValueOnce(new Error("disk on fire"));
    const { result } = await mountHook();

    await act(async () => { await result.current.saveCurrent(illustratedArgs()); });

    expect(img.deleteImagesForSave).toHaveBeenCalledTimes(1);
    expect(result.current.saveBanner?.kind).toBe("err");
    expect(result.current.saveBanner?.text).toBe("Could not set the hour aside.");
  });

  it("refuses to save past the cap and never writes the record", async () => {
    const full = Array.from({ length: SAVE_CAP }, (_, i) => SAVE_PREFIX + i);
    storage.list.mockResolvedValue({ keys: full });
    const { result } = await mountHook();

    await act(async () => { await result.current.saveCurrent(args()); });

    expect(storage.set).not.toHaveBeenCalled();
    expect(result.current.saveBanner?.kind).toBe("err");
    expect(result.current.saveBanner?.text).toMatch(/already kept/i);
  });

  it("writes the record and reports success under the cap", async () => {
    const { result } = await mountHook();

    await act(async () => { await result.current.saveCurrent(args()); });

    expect(storage.set).toHaveBeenCalledTimes(1);
    const [key] = storage.set.mock.calls[0];
    expect(key.startsWith(SAVE_PREFIX)).toBe(true);
    expect(result.current.saveBanner?.kind).toBe("ok");
  });
});

describe("writeAutosave — silent failure", () => {
  it("never throws or surfaces a banner when the slot write fails", async () => {
    img.putDoc.mockRejectedValueOnce(new Error("idb blocked"));
    storage.set.mockRejectedValueOnce(new Error("quota"));
    const { result } = await mountHook();

    await act(async () => {
      await expect(result.current.writeAutosave(args())).resolves.toBeUndefined();
    });

    expect(result.current.hasAutosave).toBe(false);
    expect(result.current.saveBanner).toBeNull();
  });
});

describe("readAutosave — version handling and corruption tolerance", () => {
  it("stamps schemaVersion on a pre-versioning slot read from localStorage", async () => {
    img.getDoc.mockResolvedValue(null);
    const unversioned = JSON.stringify({ id: "autosave", premiseId: "p1", savedAt: 5, premise });
    storage.get.mockImplementation(async (key: string) =>
      key === AUTOSAVE_KEY ? { key, value: unversioned } : null,
    );
    const { result } = await mountHook();

    let rec: Awaited<ReturnType<typeof result.current.readAutosave>> = null;
    await act(async () => { rec = await result.current.readAutosave(); });

    expect(rec).not.toBeNull();
    expect(rec!.schemaVersion).toBe(CURRENT_SAVE_VERSION);
    expect(rec!.premise?.title).toBe("The Hour");
  });

  it("returns null (no crash) when the slot JSON is corrupt", async () => {
    img.getDoc.mockResolvedValue(null);
    storage.get.mockImplementation(async (key: string) =>
      key === AUTOSAVE_KEY ? { key, value: "not-json{{" } : null,
    );
    const { result } = await mountHook();

    let rec: Awaited<ReturnType<typeof result.current.readAutosave>> = "unset" as never;
    await act(async () => { rec = await result.current.readAutosave(); });

    expect(rec).toBeNull();
  });
});

describe("loadSaveList — version stamping and damaged-record tolerance", () => {
  it("migrates each entry and skips ones that fail to parse", async () => {
    storage.list.mockResolvedValue({ keys: [SAVE_PREFIX + "a", SAVE_PREFIX + "b"] });
    const good = JSON.stringify({ id: "a", premiseId: "p1", savedAt: 10, premise });
    storage.get.mockImplementation(async (key: string) => {
      if (key === SAVE_PREFIX + "a") return { key, value: good };
      if (key === SAVE_PREFIX + "b") return { key, value: "corrupt{{" };
      return null;
    });
    const { result } = await mountHook();

    await act(async () => { await result.current.loadSaveList(); });

    expect(result.current.saveList).toHaveLength(1);
    expect(result.current.saveList[0].schemaVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.current.savesTotalBytes).toBeGreaterThan(0);
  });
});
