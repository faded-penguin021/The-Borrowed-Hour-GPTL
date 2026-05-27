import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, ENC_PREFIX } from "./encryption.js";

describe("encryption", () => {
  it("roundtrips a secret with the correct passphrase", async () => {
    const bundle = await encryptSecret("sk-test-key-12345", "hunter2");
    expect(bundle.startsWith(ENC_PREFIX)).toBe(true);
    const out = await decryptSecret(bundle, "hunter2");
    expect(out).toBe("sk-test-key-12345");
  });

  it("produces a different ciphertext each time (fresh IV + salt)", async () => {
    const a = await encryptSecret("same-plaintext", "same-passphrase");
    const b = await encryptSecret("same-plaintext", "same-passphrase");
    expect(a).not.toBe(b);
  });

  it("rejects the wrong passphrase", async () => {
    const bundle = await encryptSecret("treasure", "correct");
    await expect(decryptSecret(bundle, "wrong")).rejects.toBeDefined();
  });

  it("rejects a malformed bundle", async () => {
    await expect(decryptSecret(ENC_PREFIX + "not.valid.b64", "x")).rejects.toBeDefined();
  });

  it("handles unicode plaintext", async () => {
    const secret = "日本語 · café · 🔑";
    const bundle = await encryptSecret(secret, "p");
    expect(await decryptSecret(bundle, "p")).toBe(secret);
  });
});
