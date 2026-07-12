import type { ProviderId } from "../types";
import React from "react";
import { ApiKeyRow } from "./ApiKeyRow";
import { LocalLLMRow } from "./LocalLLMRow";
import { PROVIDER_ORDER } from "../llm/providers";

export function ApiKeysSection({ proxyUrl }: { proxyUrl?: string }) {
  return (
    <div className="block px-4 py-3 border border-cream/10 bg-[#1c162c]/40 cursor-default text-left w-full">
      <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
        API keys
      </div>
      <div className="font-body italic text-cream-dim text-xs mt-1 leading-[1.6]">
        Keys are stored only in this browser's localStorage and are never sent anywhere except the provider's own API. A passphrase encrypts them at rest — that protects against a casual peek at storage, not against code running on the page.
      </div>
      {PROVIDER_ORDER.filter((id) => id !== "local").map((id) => (
        <ApiKeyRow key={id} providerId={id as ProviderId} proxyUrl={proxyUrl} />
      ))}
      <LocalLLMRow />
    </div>
  );
}
