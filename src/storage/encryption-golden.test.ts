// @vitest-environment jsdom
//
// Golden fixtures freezing the at-rest encryption formats. These blobs were
// generated once with the shipped parameters (PBKDF2-SHA-256 310k, AES-GCM-256,
// 12-byte IV, the enc:v1:/enc:v2: base64 framings) and are committed as
// constants. If ANY of those parameters or layouts changes, these tests fail —
// which is the point: such a change silently strands every user's stored keys.
// A failure here means "add a migration", never "regenerate the fixtures".
import { describe, it, expect, beforeEach } from "vitest";
import {
  deriveSessionKey,
  decryptWithKey,
  decryptSecretV1,
  migrateV1Blobs,
  isV2,
} from "./encryption";

const PASSPHRASE = "golden-passphrase";
const INSTALL_SALT_B64 = "AQIDBAUGBwgJCgsMDQ4PEA==";
const GOLDEN_V2 = "enc:v2:FRYXGBkaGxwdHh8g.zF1M+w5XF1b6DQGH2IOGt2bgy7vOYmImdhLOQlxw+4EROmA=";
const GOLDEN_V1 = "enc:v1:ZWZnaGlqa2xtbm9wcXJzdA==.eXp7fH1+f4CBgoOE.UoabnuajNEwdrBdowzaikfRlDvsV/NqgyXlFYxM5Adg6Kg4=";

beforeEach(() => {
  localStorage.clear();
  // The fixture's per-install KDF salt, exactly as unlock would find it.
  localStorage.setItem("borrowed:kdf-salt:v1", INSTALL_SALT_B64);
});

describe("golden storage-format fixtures", () => {
  it("decrypts the committed enc:v2: blob with the derived session key", async () => {
    const key = await deriveSessionKey(PASSPHRASE);
    expect(await decryptWithKey(key, GOLDEN_V2)).toBe("sk-golden-v2-secret");
  });

  it("decrypts the committed enc:v1: blob from the raw passphrase", async () => {
    expect(await decryptSecretV1(GOLDEN_V1, PASSPHRASE)).toBe("sk-golden-v1-secret");
  });

  it("migrates the committed v1 blob to a decryptable v2 blob at unlock", async () => {
    localStorage.setItem("borrowed:legacy_key:v1", GOLDEN_V1);
    const key = await deriveSessionKey(PASSPHRASE);
    await migrateV1Blobs(PASSPHRASE, key);
    const migrated = localStorage.getItem("borrowed:legacy_key:v1")!;
    expect(isV2(migrated)).toBe(true);
    expect(await decryptWithKey(key, migrated)).toBe("sk-golden-v1-secret");
  });

  it("a wrong passphrase cannot open either fixture", async () => {
    const wrong = await deriveSessionKey("not-the-passphrase");
    await expect(decryptWithKey(wrong, GOLDEN_V2)).rejects.toBeTruthy();
    await expect(decryptSecretV1(GOLDEN_V1, "not-the-passphrase")).rejects.toBeTruthy();
  });
});
