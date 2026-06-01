// Ambient global augmentation for The Borrowed Hour.
//
// Domain types now live as explicit ES-module exports in `src/types.ts` — import
// them where needed. The only thing that genuinely belongs in an ambient `.d.ts`
// is the global `Window` augmentation below: it can't be expressed as a plain
// module export, and it must stay visible to every file without an import.

import type { StorageShim } from "./types";

declare global {
  interface Window {
    storage: StorageShim;
    // External script-loaded SDK (js.puter.com) with no published types — `any` is
    // the honest type for this untyped boundary; app code confines its use.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    puter?: any;
  }
}

export {};
