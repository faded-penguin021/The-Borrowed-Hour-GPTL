// @ts-check
import React, { useState, useEffect } from "react";
import { SAVE_CAP, APPROX_CHARS_PER_TOKEN, formatKB, formatTokens } from "../../data/constants";
import { realmGlyph } from "../../data/premises";

/**
 * @param {Object} props
 * @param {any[]} props.saves
 * @param {number} [props.totalBytes]
 * @param {number} [props.cap]
 * @param {boolean} props.loading
 * @param {() => void} props.onClose
 * @param {(save: any) => void} props.onLoad
 * @param {(key: string, e: any) => void} props.onDelete
 * @param {boolean} props.inGame
 */
export function SavesModal({ saves, totalBytes = 0, cap = SAVE_CAP, loading, onClose, onLoad, onDelete, inGame }) {
  const [armedKey, setArmedKey] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    if (!armedKey)
      return;
    const t = setTimeout(() => setArmedKey(null), 4000);
    return () => clearTimeout(t);
  }, [armedKey]);
  const handleReleaseTap = (/** @type {string} */ key, /** @type {React.MouseEvent | React.KeyboardEvent} */ e) => {
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
    <div
      className="modal-backdrop"
      onClick={() => {
        setArmedKey(null);
        onClose();
      }}
    >
      <div
        className="modal-panel"
        onClick={(e) => {
          setArmedKey(null);
          e.stopPropagation();
        }}
      >
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <div>
            <div
              className="display-font text-[10px] mb-1"
              style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
            >
              HOURS SET ASIDE
            </div>
            <h2
              className="display-font text-xl"
              style={{ color: "var(--cream-bright)", letterSpacing: "0.04em" }}
            >
              Take an hour up again
            </h2>
            {!loading && saves.length > 0 && (
              <div
                className="body-font italic mt-1 flex flex-wrap gap-x-3"
                style={{ fontSize: 12, color: "var(--cream-dim)" }}
              >
                <span style={{ color: countColor }}>
                  {saves.length} of {cap} kept
                  {countTone === "full" && " — full"}
                  {countTone === "warn" && " — nearing the cap"}
                </span>
                <span>·</span>
                <span>{formatKB(totalKB)} in total</span>
                <span>·</span>
                <span>{formatTokens(Math.round(totalBytes / APPROX_CHARS_PER_TOKEN))}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="display-font text-sm"
            style={{ color: "var(--cream-dim)", letterSpacing: "0.2em" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-3" style={{ minHeight: 200 }}>
          {loading ? (
            <div
              className="text-center body-font italic py-12"
              style={{ color: "var(--cream-dim)" }}
            >
              Counting the hours
              <span className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          ) : saves.length === 0 ? (
            <div
              className="text-center body-font italic py-12"
              style={{ color: "var(--cream-faint)" }}
            >
              No hours set aside yet.
              {inGame && (
                <div className="mt-2 text-sm">Use ❀ SET ASIDE to keep your current hour.</div>
              )}
            </div>
          ) : (
            saves.map((save) => (
              <button key={save.key} className="save-row" onClick={() => onLoad(save)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`realm-pill realm-${save.realm}`}
                      style={{ fontSize: 8, padding: "2px 7px" }}
                    >
                      {realmGlyph(save.realm)} {save.realmLabel || save.realm?.toUpperCase()}
                    </span>
                    <span
                      className="display-font text-base"
                      style={{ color: "var(--cream-bright)", letterSpacing: "0.02em" }}
                    >
                      {save.title}
                    </span>
                  </div>
                  <div
                    className="body-font italic text-sm flex flex-wrap gap-x-3 items-center"
                    style={{ color: "var(--cream-dim)" }}
                  >
                    <span>{save.turns || 0} turns taken</span>
                    <span>·</span>
                    <span>{formatRelative(save.savedAt)}</span>
                    {save.size && (
                      <>
                        <span>·</span>
                        <span
                          title={`${formatKB(save.size.kb)} on disk · ${formatTokens(save.size.tokens)} if reloaded`}
                          style={{ color: "var(--cream-faint)" }}
                        >
                          {formatKB(save.size.kb)} · {formatTokens(save.size.tokens)}
                        </span>
                      </>
                    )}
                    {save.ended && (
                      <>
                        <span>·</span>
                        <span
                          className="display-font"
                          style={{
                            color: "var(--rose-gold)",
                            fontSize: 9,
                            letterSpacing: "0.3em"
                          }}
                        >
                          ❦ COMPLETE
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  onClick={(e) => handleReleaseTap(save.key, e)}
                  className="icon-btn icon-btn-danger"
                  style={{
                    padding: "5px 10px",
                    fontSize: 9,
                    background: armedKey === save.key ? "rgba(180, 70, 70, 0.25)" : undefined,
                    borderColor: armedKey === save.key ? "rgba(220, 100, 100, 0.7)" : undefined,
                    color: armedKey === save.key ? "rgba(255, 200, 200, 1)" : undefined
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      handleReleaseTap(save.key, e);
                  }}
                  title={armedKey === save.key ? "Tap again to release this hour permanently" : "Release this hour (tap, then confirm)"}
                  aria-label={armedKey === save.key ? `Confirm releasing ${save.title}` : `Release ${save.title}`}
                >
                  {armedKey === save.key ? "✕ CONFIRM" : "RELEASE"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelative(/** @type {number | undefined} */ ts) {
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
