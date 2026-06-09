import { afterEach, describe, expect, it, vi } from "vitest";

// The module caches its policy at module scope, so each test re-imports it
// after resetting modules. Vitest runs in Node (no DOM), so we stand in a
// minimal TrustedTypes factory that captures the rules the module registers —
// letting us drive its real createScriptURL guard.

interface ScriptUrlRules {
  createScriptURL: (input: string) => string;
}

const PUTER_SDK_URL = "https://js.puter.com/v2/";

let lastRules: ScriptUrlRules | null = null;
let createPolicy: ReturnType<typeof vi.fn> | null = null;

function installTrustedTypes(): void {
  lastRules = null;
  createPolicy = vi.fn((_name: string, rules: ScriptUrlRules) => {
    lastRules = rules;
    return { name: _name, createScriptURL: (u: string) => rules.createScriptURL(u) };
  });
  vi.stubGlobal("window", { trustedTypes: { createPolicy } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  lastRules = null;
  createPolicy = null;
});

describe("puterSdkScriptUrl", () => {
  it("passes the Puter SDK URL through the Trusted Types policy when available", async () => {
    installTrustedTypes();
    const { puterSdkScriptUrl } = await import("./trustedTypes");

    expect(puterSdkScriptUrl()).toBe(PUTER_SDK_URL);
    expect(createPolicy).toHaveBeenCalledWith("puter-loader", expect.anything());
  });

  it("creates the policy at most once across calls", async () => {
    installTrustedTypes();
    const { puterSdkScriptUrl } = await import("./trustedTypes");

    puterSdkScriptUrl();
    puterSdkScriptUrl();

    expect(createPolicy).toHaveBeenCalledTimes(1);
  });

  it("refuses any script URL other than the Puter SDK", async () => {
    installTrustedTypes();
    const { puterSdkScriptUrl } = await import("./trustedTypes");
    puterSdkScriptUrl(); // register the policy so lastRules is captured

    expect(lastRules).not.toBeNull();
    expect(() => lastRules!.createScriptURL(PUTER_SDK_URL)).not.toThrow();
    expect(() => lastRules!.createScriptURL("https://evil.example/x.js")).toThrow(TypeError);
  });

  it("falls back to the plain string when Trusted Types is unavailable", async () => {
    vi.stubGlobal("window", {});
    const { puterSdkScriptUrl } = await import("./trustedTypes");

    expect(puterSdkScriptUrl()).toBe(PUTER_SDK_URL);
  });

  it("falls back to the plain string when there is no window at all", async () => {
    const { puterSdkScriptUrl } = await import("./trustedTypes");

    expect(puterSdkScriptUrl()).toBe(PUTER_SDK_URL);
  });
});

describe("serviceWorkerScriptUrl", () => {
  // Vitest leaves import.meta.env.BASE_URL at its default "/", so the worker
  // URL the module builds is "/sw.js".
  const SW_URL = "/sw.js";

  it("passes the worker URL through the Trusted Types policy when available", async () => {
    installTrustedTypes();
    const { serviceWorkerScriptUrl } = await import("./trustedTypes");

    expect(serviceWorkerScriptUrl()).toBe(SW_URL);
    expect(createPolicy).toHaveBeenCalledWith("sw-loader", expect.anything());
  });

  it("creates the policy at most once across calls", async () => {
    installTrustedTypes();
    const { serviceWorkerScriptUrl } = await import("./trustedTypes");

    serviceWorkerScriptUrl();
    serviceWorkerScriptUrl();

    expect(createPolicy).toHaveBeenCalledTimes(1);
  });

  it("refuses any script URL other than the worker", async () => {
    installTrustedTypes();
    const { serviceWorkerScriptUrl } = await import("./trustedTypes");
    serviceWorkerScriptUrl(); // register the policy so lastRules is captured

    expect(lastRules).not.toBeNull();
    expect(() => lastRules!.createScriptURL(SW_URL)).not.toThrow();
    expect(() => lastRules!.createScriptURL("https://evil.example/sw.js")).toThrow(TypeError);
  });

  it("falls back to the plain string when Trusted Types is unavailable", async () => {
    vi.stubGlobal("window", {});
    const { serviceWorkerScriptUrl } = await import("./trustedTypes");

    expect(serviceWorkerScriptUrl()).toBe(SW_URL);
  });
});
