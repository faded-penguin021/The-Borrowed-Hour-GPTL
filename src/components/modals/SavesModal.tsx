import React, { useState, useEffect } from "react";
import { SAVE_CAP, APPROX_CHARS_PER_TOKEN, formatKB, formatTokens } from "../../data/constants";
import { realmGlyph } from "../../data/premises";
import { realmPill } from "../../data/realmStyles";
import type { SaveListEntry, SaveRecord } from "../../types";
import { Modal } from "../ui/Modal";
import { X, Bookmark } from "lucide-react";

interface SavesModalProps {
  saves: SaveListEntry[];
  totalBytes?: number;
  cap?: number;
  loading: boolean;
  onClose: () => void;
  onLoad: (save: SaveRecord) => void;
  onDelete: (key: string, e: React.SyntheticEvent) => void;
  inGame: boolean;
}

export function SavesModal({ saves, totalBytes = 0, cap = SAVE_CAP, loading, onClose, onLoad, onDelete, inGame }: SavesModalProps) {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!armedKey)
      return;
    const t = setTimeout(() => setArmedKey(null), 4000);
    return () => clearTimeout(t);
  }, [armedKey]);
  const handleReleaseTap = (key: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (armedKey === key) {
      setArmedKey(null);
      onDelete(key, e);
    } else {
      setArmedKey(key);
    }
  };
  const ratio = saves.length / cap;
  const countTone = saves.length >= cap ? "full" : ratio >= 0.8 ? "warn" : "ok";
  const countColor = countTone === "full" ? "var(--rose-ember)" : countTone === "warn" ? "var(--rose-gold)" : "var(--cream-dim)";
  const totalKB = totalBytes / 1024;
  return (
    <Modal
      onClose={() => {
        setArmedKey(null);
        onClose();
      }}
    >
        <div className="px-6 py-5 border-b border-cream/10 flex items-center justify-between">
          <div>
            <div className="font-display font-medium text-[10px] mb-1 text-cream-faint tracking-[0.4em]">
              HOURS SET ASIDE
            </div>
            <h2 className="font-display font-medium text-xl text-cream-bright tracking-[0.04em]">
              Take an hour up again
            </h2>
            {!loading && saves.length > 0 && (
              <div className="font-body italic mt-1 flex flex-wrap gap-x-3 text-[12px] text-cream-dim">
                <span className={countColor}>
                  {saves.length} of {cap} kept
                  {countTone === "full" && " — full"}
                  {countTone === "warn" && " — nearing the cap"}
                </span>
                <span>·</span>
                <span>{formatKB(totalKB)} in total</span>
                <span>·</span>
                <span>{formatTokens(Math.round(totalBytes / APPROX_CHARS_PER_TOKEN), true)}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="font-display font-medium text-sm text-cream-dim tracking-[0.2em]"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-3 min-h-[200px]">
          {loading ? (
            <div className="text-center font-body italic py-12 text-cream-dim">
              Counting the hours
              <span className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          ) : saves.length === 0 ? (
            <div className="text-center font-body italic py-12 text-cream-faint">
              No hours set aside yet.
              {inGame && (
                <div className="mt-2 text-sm flex items-center justify-center gap-1">Use <Bookmark size={12} strokeWidth={1.5}  /> SET ASIDE to keep your current hour.</div>
              )}
            </div>
          ) : (
            saves.map((save) => (
              <button
                key={save.key}
                data-testid="save-row"
                className="flex items-center justify-between gap-3 px-[18px] py-[14px] border border-cream/[0.08] bg-[#1c162c]/40 transition-all duration-300 cursor-pointer text-left w-full hover:border-rose-gold/30 hover:bg-[#1c162c]/70"
                onClick={() => onLoad(save)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-block font-display text-[8px] tracking-[0.4em] px-[7px] py-[2px] border ${realmPill[save.realm]}`}>
                      {realmGlyph(save.realm)} {save.realmLabel || save.realm?.toUpperCase()}
                    </span>
                    <span className="font-display font-medium text-base text-cream-bright tracking-[0.02em]">
                      {save.title}
                    </span>
                  </div>
                  <div className="font-body italic text-sm flex flex-wrap gap-x-3 items-center text-cream-dim">
                    <span>{save.turns || 0} turns taken</span>
                    <span>·</span>
                    <span>{formatRelative(save.savedAt)}</span>
                    {save.size && (
                      <>
                        <span>·</span>
                        <span
                          title={`${formatKB(save.size.kb)} on disk · ${formatTokens(save.size.tokens)} if reloaded`}
                          className="text-cream-faint"
                        >
                          {formatKB(save.size.kb)} · {formatTokens(save.size.tokens)}
                        </span>
                      </>
                    )}
                    {save.ended && (
                      <>
                        <span>·</span>
                        <span className="font-display font-medium text-rose-gold text-[9px] tracking-[0.3em]">
                          COMPLETE
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  onClick={(e) => handleReleaseTap(save.key, e)}
                  className={`bg-transparent border font-display text-[9px] tracking-[0.25em] cursor-pointer transition-all duration-300 px-2.5 py-[5px] ${
                    armedKey === save.key
                      ? "bg-[rgba(180,70,70,0.25)] border-[rgba(220,100,100,0.7)] text-[rgba(255,200,200,1)]"
                      : "border-cream/20 text-cream-dim hover:border-rose-ember/50 hover:text-rose-ember"
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      handleReleaseTap(save.key, e);
                  }}
                  title={armedKey === save.key ? "Tap again to release this hour permanently" : "Release this hour (tap, then confirm)"}
                  aria-label={armedKey === save.key ? `Confirm releasing ${save.title}` : `Release ${save.title}`}
                >
                  {armedKey === save.key ? <><X size={11} strokeWidth={1.5} className="mr-0.5" />CONFIRM</> : "RELEASE"}
                </span>
              </button>
            ))
          )}
        </div>
    </Modal>
  );
}

function formatRelative(ts: number | undefined) {
  if (!ts)
    return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)
    return "moments ago";
  if (m < 60)
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24)
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30)
    return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}
