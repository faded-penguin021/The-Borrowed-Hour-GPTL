import { describe, expect, it } from "vitest";
import { z } from "zod";
import "./zodConfig";

describe("zodConfig", () => {
  it("enables Zod jitless mode so the JIT Function probe never runs under the CSP", () => {
    // Importing the module sets Zod's global config as a side effect; without it
    // Zod's `new Function` eval probe fires a caught securitypolicyviolation
    // against require-trusted-types-for 'script'.
    expect(z.config().jitless).toBe(true);
  });
});
