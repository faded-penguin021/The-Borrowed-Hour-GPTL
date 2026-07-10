// @vitest-environment jsdom
//
// decryptStored is the seam every key resolver (LLM/TTS/imaging) goes through.
// These tests drive it against the real v2 crypto with a stubbed service
// (setPassphraseService is the documented test-injection point).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decryptStored,
  setPassphraseService,
  WrongPassphraseError,
  type PassphraseService,
} from "./passphrase";
import { deriveSessionKey, encryptWithKey } from "./storage/encryption";
import { ENC_PREFIX_V1 } from "./storage/encryption";

function stubService(overrides: Partial<PassphraseService> = {}): PassphraseService {
  const svc: PassphraseService = {
    requestPassphrase: vi.fn(async () => null),
    resolvePassphrase: vi.fn(),
    getSessionKey: () => null,
    setSessionKeyFromPassphrase: vi.fn(async () => { throw new Error("unexpected"); }),
    clearSessionKey: vi.fn(),
    isUnlocked: () => false,
    ...overrides,
  };
  setPassphraseService(svc);
  return svc;
}

beforeEach(() => localStorage.clear());
afterEach(() => setPassphraseService(null));

describe("decryptStored", () => {
  it("passes plaintext blobs straight through without prompting", async () => {
    const svc = stubService();
    expect(await decryptStored("k", "  sk-plain-key  ")).toBe("sk-plain-key");
    expect(svc.requestPassphrase).not.toHaveBeenCalled();
  });

  it("returns null when the user cancels the prompt", async () => {
    stubService({ requestPassphrase: vi.fn(async () => null) });
    expect(await decryptStored("k", "enc:v2:x.y")).toBeNull();
  });

  it("decrypts a v2 blob with the unlocked session key", async () => {
    const key = await deriveSessionKey("pw");
    const blob = await encryptWithKey(key, "sk-secret");
    stubService({ isUnlocked: () => true, getSessionKey: () => key });
    expect(await decryptStored("k", blob)).toBe("sk-secret");
  });

  it("throws WrongPassphraseError and locks when decryption fails", async () => {
    const right = await deriveSessionKey("right");
    const blob = await encryptWithKey(right, "sk-secret");
    localStorage.clear(); // drop the salt so "wrong" derives a different key
    const wrong = await deriveSessionKey("wrong");
    const svc = stubService({ isUnlocked: () => true, getSessionKey: () => wrong });
    await expect(decryptStored("k", blob)).rejects.toBeInstanceOf(WrongPassphraseError);
    expect(svc.clearSessionKey).toHaveBeenCalled();
  });

  it("treats a lingering v1 blob while unlocked as a wrong passphrase", async () => {
    const key = await deriveSessionKey("pw");
    const svc = stubService({ isUnlocked: () => true, getSessionKey: () => key });
    await expect(decryptStored("k", `${ENC_PREFIX_V1}a.b.c`)).rejects.toBeInstanceOf(WrongPassphraseError);
    expect(svc.clearSessionKey).toHaveBeenCalled();
  });

  it("re-reads the blob after unlock so a freshly-migrated v2 value is used", async () => {
    const key = await deriveSessionKey("pw");
    const migrated = await encryptWithKey(key, "sk-after-migration");
    const STORE = "borrowed:test_key:v1";
    localStorage.setItem(STORE, migrated);
    stubService({
      requestPassphrase: vi.fn(async () => "pw"),
      // Simulates the provider: unlock caches the key; the v1→v2 sweep has
      // already rewritten localStorage by the time it resolves.
      setSessionKeyFromPassphrase: vi.fn(async () => key),
      getSessionKey: () => key,
      isUnlocked: () => false,
    });
    expect(await decryptStored(STORE, `${ENC_PREFIX_V1}stale.v1.blob`)).toBe("sk-after-migration");
  });
});
