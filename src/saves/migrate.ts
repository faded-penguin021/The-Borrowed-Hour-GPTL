import type { SaveRecord } from "../types";

export const CURRENT_SAVE_VERSION = 1;

export function migrateSave(raw: unknown): SaveRecord {
  if (raw == null || typeof raw !== "object") return raw as SaveRecord;
  const rec = raw as Record<string, unknown>;
  const version = typeof rec.schemaVersion === "number" ? rec.schemaVersion : 0;

  if (version < 1) {
    rec.schemaVersion = 1;
  }

  return rec as unknown as SaveRecord;
}
