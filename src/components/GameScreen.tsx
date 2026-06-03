import React, { useRef, useEffect } from "react";
import type { Entry } from "../types";
import { realmGlyph } from "../data/premises";
import { formatTokens } from "../data/constants";
import { useGame, useGameRun } from "../context/GameContext";
import { useSettingsContext } from "../context/SettingsContext";
import { useAmbienceContext } from "../context/AmbienceContext";
import { useTTSContext } from "../context/TTSContext";
import { TypewriterText } from "./TypewriterText";
import { StreamingNarration } from "./StreamingNarration";
import { ErrorRawDetail } from "./ErrorRawDetail";
import { IllustrationPlate } from "./IllustrationPlate";
import { GameComposer } from "./GameComposer";
import {
  Undo2, BookOpen, Bookmark, Copy, CopyPlus, Clock, Settings,
  Volume2, VolumeX, Mic, MicOff, Sparkles, Play, Pause, Loader,
  BookMarked, RotateCcw, Download, HeartHandshake,
} from "lucide-react";

/**
 * Story state comes from `useGame()`, runtime state from `useGameRun()`, and
 * the cross-cutting systems (reading prefs, ambience, TTS) are read straight
 * from their own contexts. The input lives inside `GameComposer`.
 */
interface GameScreenProps {
  onOpenLedger: () => void;
  onOpenSettings: () => void;
}

export function GameScreen({
  onOpenLedger,
  onOpenSettings,
}: GameScreenProps) {
  const {
    premise, entries, skipNonce, ended,
    metaMode, metaMessages, recovery, saveBanner, canUndo,
    streamingStore,
    revealText, revealLoading, revealError,
    keepsakeBlob, keepsakeLoading, keepsakeError, keepsakeFilename,
    markEntryRevealed, markMetaRevealed, enterMetaMode,
    undoLastTurn, skipReveal, cancelRequest, continueNarration, restart,
    saveCurrent, openSavesModal, exportChronicle,
    startReveal, cancelReveal, startKeepsake, downloadKeepsake,
  } = useGame();
  // High-frequency runtime state lives in its own context so it does not
  // re-render story-only consumers.
  const { loading, loadingPhrase, error, sessionTokens } = useGameRun();

  // Cross-cutting systems are read straight from their contexts; the locals
  // below keep the existing JSX (header controls, per-entry play) unchanged.
  const { instantReveal } = useSettingsContext();
  const { ambienceLevel, ambienceUnavailable, ambienceMuted, setAmbienceMuted } = useAmbienceContext();
  const tts = useTTSContext();
  const { ttsEnabled, ttsMuted, ttsPlayback } = tts;
  const ambienceEnabled = ambienceLevel !== "off" && !ambienceUnavailable;
  const onToggleAmbienceMute = () => setAmbienceMuted((m) => !m);
  const onToggleTtsMute = () => tts.setTtsMuted((m) => !m);
  const onPlayEntry = (idx: number) => tts.playEntry(entries, idx);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the scroll pinned near the bottom as new prose and turns arrive.
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [entries, loading, metaMessages]);

  const lastEntry = entries[entries.length - 1];
  const showResolution = ended && lastEntry && lastEntry.type === "narration" && lastEntry.fullyRevealed && !metaMode;
  const hasMeta = metaMessages.length > 0;
  // This screen only mounts during play, where a premise is always set. Guard
  // anyway so `premise` narrows to non-null for the JSX below.
  if (!premise) return null;
  return (
    <div
      className="relative flex flex-col"
      style={{ height: "var(--app-vh, 100dvh)", minHeight: "var(--app-vh, 100dvh)" }}
    >
      <header
        className="game-header relative flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
      >
        <div
          className="header-title display-font text-xs flex items-center gap-3"
          style={{ color: "var(--cream-dim)", letterSpacing: "0.3em" }}
        >
          <span style={{ color: `var(--${premise.realm})` }}>{realmGlyph(premise.realm)}</span>
          {premise.title.toUpperCase()}
        </div>
        <div className="header-actions flex items-center gap-2">
          <button
            onClick={undoLastTurn}
            disabled={!canUndo}
            className="icon-btn"
            title="Undo the last turn"
            aria-label="Undo the last turn"
          >
            <Undo2 size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> UNDO</span>
          </button>
          <button
            onClick={onOpenLedger}
            disabled={entries.length === 0}
            className="icon-btn"
            title="Open the ledger — see what's tracked"
            aria-label="Open the ledger"
          >
            <BookOpen size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> LEDGER</span>
          </button>
          <button
            onClick={saveCurrent}
            disabled={loading || entries.length === 0}
            className="icon-btn"
            title="Set aside this hour"
            aria-label="Set aside this hour"
          >
            <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> SET ASIDE</span>
          </button>
          <button
            onClick={() => exportChronicle(false)}
            disabled={entries.length === 0}
            className="icon-btn"
            title={hasMeta ? "Copy the chronicle as text — narration only, no commentary" : "Copy the chronicle as text — to keep, or to share"}
            aria-label="Copy the chronicle"
          >
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> COPY</span>
          </button>
          {hasMeta && (
            <button
              onClick={() => exportChronicle(true)}
              className="icon-btn"
              title="Copy the chronicle and the director's commentary together"
              aria-label="Copy the chronicle with commentary"
            >
              <CopyPlus size={14} strokeWidth={1.5} aria-hidden="true" />
              <span className="btn-label"> COPY ALL</span>
            </button>
          )}
          <button
            onClick={openSavesModal}
            className="icon-btn"
            title="Open hours"
            aria-label="Open saved hours"
          >
            <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> HOURS</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="icon-btn"
            title="Reader preferences — contrast, motion, typewriter"
            aria-label="Reader preferences"
          >
            <Settings size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> READING</span>
          </button>
          {ambienceEnabled && (
            <button
              onClick={onToggleAmbienceMute}
              className="icon-btn"
              title={ambienceMuted ? "Unmute the ambience bed" : "Mute the ambience bed"}
              aria-label={ambienceMuted ? "Unmute ambience" : "Mute ambience"}
              aria-pressed={ambienceMuted ? "true" : "false"}
            >
              {ambienceMuted ? <VolumeX size={14} strokeWidth={1.5} aria-hidden="true" /> : <Volume2 size={14} strokeWidth={1.5} aria-hidden="true" />}
              <span className="btn-label">{ambienceMuted ? " MUTED" : " AMBIENT"}</span>
            </button>
          )}
          {ttsEnabled && (
            <button
              onClick={onToggleTtsMute}
              className="icon-btn"
              title={ttsMuted ? "Resume narration aloud" : "Silence narration aloud"}
              aria-label={ttsMuted ? "Resume narration aloud" : "Silence narration aloud"}
              aria-pressed={ttsMuted ? "true" : "false"}
            >
              {ttsMuted ? <MicOff size={14} strokeWidth={1.5} aria-hidden="true" /> : <Mic size={14} strokeWidth={1.5} aria-hidden="true" />}
              <span className="btn-label">{ttsMuted ? " SILENT" : " VOICE"}</span>
            </button>
          )}
          <button
            onClick={restart}
            className="icon-btn icon-btn-danger"
            title="Begin a new hour"
            aria-label="Begin a new hour"
          >
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> ANEW</span>
          </button>
        </div>
      </header>
      {(sessionTokens?.input > 0 || sessionTokens?.output > 0) && (
        <div
          className="display-font"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 16,
            padding: "4px 20px",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--cream-faint)",
            borderBottom: "1px solid rgba(232,222,197,0.07)",
            userSelect: "none"
          }}
        >
          <span>{formatTokens(sessionTokens.input)} IN</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{formatTokens(sessionTokens.output)} OUT</span>
        </div>
      )}
      {saveBanner && (
        <div
          className="mx-auto mt-3 px-4 py-2 body-font italic text-sm fade-in"
          style={{
            color: saveBanner.kind === "ok" ? "var(--rose-gold)" : "var(--rose-ember)",
            border: "1px solid",
            borderColor: saveBanner.kind === "ok" ? "rgba(212, 165, 116, 0.3)" : "rgba(217, 122, 122, 0.3)",
            background: "rgba(10, 8, 20, 0.65)"
          }}
        >
          {saveBanner.text}
        </div>
      )}
      <div
        ref={scrollRef}
        className="game-scroll flex-1 overflow-y-auto px-6 py-12"
        onClick={skipReveal}
      >
        <div className="max-w-3xl mx-auto space-y-8">
          {entries.length === 0 && loading && (
            <div className="divider-mark body-font italic text-base slow-fade-in">
              <span>{loadingPhrase || "the hour begins to write itself"}</span>
              <span className="typing-dots" style={{ marginLeft: "6px" }}>
                <span>.</span><span>.</span><span>.</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); cancelRequest?.(); }}
                className="loading-stop-btn"
                aria-label="Stop this request"
                title="Stop this request"
              >
                STOP
              </button>
            </div>
          )}
          {entries.map((entry: Entry, i: number) => {
            if (entry.type === "narration") {
              const showPlay = ttsEnabled && entry.fullyRevealed && !entry.streaming && typeof entry.text === "string" && entry.text.trim();
              const isLoading = ttsPlayback?.loading && ttsPlayback?.loadingTurnId === i;
              const isActive = ttsPlayback?.activeTurnId === i;
              const isSpeaking = isActive && ttsPlayback?.speaking;
              const isPaused = isActive && ttsPlayback?.paused;
              const btnLabel = isLoading ? "LOADING" : (isSpeaking ? "PAUSE" : (isPaused ? "RESUME" : "PLAY"));
              return (
                <div key={i} className="fade-in" data-testid="narration-entry">
                  <div className="narration-text body-font text-lg" style={{ lineHeight: 1.7 }}>
                    {entry.streaming ? (
                      <StreamingNarration store={streamingStore} scrollRef={scrollRef} />
                    ) : (
                      <TypewriterText
                        text={entry.text}
                        instant={entry.fullyRevealed || instantReveal}
                        skipSignal={skipNonce}
                        onDone={() => markEntryRevealed(i)}
                        scrollRef={scrollRef}
                      />
                    )}
                  </div>
                  {entry.illustration && (
                    <IllustrationPlate plate={entry.illustration} realm={premise.realm} />
                  )}
                  {showPlay && (
                    <div
                      className="mt-2"
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); onPlayEntry?.(i); }}
                        className="icon-btn"
                        disabled={isLoading}
                        title={isLoading ? "Preparing narration…" : (isSpeaking ? "Pause narration" : (isPaused ? "Resume narration" : "Play this passage aloud"))}
                        aria-label={btnLabel}
                        aria-busy={isLoading ? "true" : "false"}
                        style={{ padding: "4px 10px", fontSize: "10px", opacity: isLoading ? 0.75 : 1 }}
                      >
                        <span aria-hidden="true" className={isLoading ? "tts-spin" : ""}>{isLoading ? <Loader size={12} strokeWidth={1.5} /> : (isSpeaking ? <Pause size={12} strokeWidth={1.5} /> : <Play size={12} strokeWidth={1.5} />)}</span>
                        <span className="btn-label"> {btnLabel}</span>
                        {isLoading && (
                          <span className="typing-dots" style={{ marginLeft: "4px" }}>
                            <span>.</span><span>.</span><span>.</span>
                          </span>
                        )}
                      </button>
                      {ttsPlayback?.lastError && ttsPlayback?.lastErrorTurnId === i && (
                        <div
                          className="body-font italic"
                          style={{ fontSize: "11px", color: "var(--rose-ember)", opacity: 0.85, lineHeight: 1.4, maxWidth: "100%", wordBreak: "break-word" }}
                        >
                          tts: {ttsPlayback.lastError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={i}
                className="action-text body-font text-base fade-in"
                style={{ lineHeight: 1.6 }}
              >
                {entry.text}
              </div>
            );
          })}
          {entries.length === 1 && entries[0].type === "narration" && entries[0].fullyRevealed && !ended && !metaMode && (
            <div
              className="text-center body-font italic slow-fade-in"
              style={{
                color: "var(--cream-faint)",
                fontSize: "13px",
                paddingTop: "4px",
                letterSpacing: "0.02em"
              }}
            >
              <span style={{ color: `var(--${premise.realm})`, opacity: 0.7 }}><HeartHandshake size={12} strokeWidth={1.5}  /></span>{" "}
              when this hour is spent, you may speak with its author about it
            </div>
          )}
          {showResolution && (
            <div className="fade-in pt-4">
              <div
                className="divider-mark display-font"
                style={{
                  color: `var(--${premise.realm})`,
                  letterSpacing: "0.4em",
                  fontSize: "12px"
                }}
              >
                <span className="divider-ornament">THE HOUR IS SPENT</span>
              </div>
              <div
                className="text-center mt-6 body-font italic text-base"
                style={{ color: "var(--cream-faint)" }}
              >
                The chronicle is closed. You may now speak with its author — ask what you missed, point out what felt amiss.
              </div>
              <div className="text-center mt-6 flex justify-center gap-3 flex-wrap">
                {!revealText && !revealLoading && (
                  <button
                    onClick={startReveal}
                    className="icon-btn"
                    style={{
                      padding: "10px 22px",
                      borderColor: `var(--${premise.realm}-border)`,
                      color: `var(--${premise.realm})`
                    }}
                  >
                    <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />UNVEIL THE HIDDEN HOUR
                  </button>
                )}
                <button
                  onClick={enterMetaMode}
                  className="icon-btn"
                  style={{
                    padding: "10px 22px",
                    borderColor: `var(--${premise.realm}-border)`,
                    color: `var(--${premise.realm})`
                  }}
                >
                  <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />SPEAK WITH THE AUTHOR
                </button>
                <button onClick={saveCurrent} className="icon-btn" style={{ padding: "10px 22px" }}>
                  <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />KEEP THIS HOUR
                </button>
                <button onClick={restart} className="icon-btn" style={{ padding: "10px 22px" }}>
                  <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />BEGIN A NEW HOUR
                </button>
                {!keepsakeBlob && !keepsakeLoading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startKeepsake(); }}
                    className="icon-btn"
                    style={{ padding: "10px 22px" }}
                    title="Generate a self-contained HTML keepsake of this chronicle"
                  >
                    <BookMarked size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />GENERATE BOOK
                  </button>
                )}
                {keepsakeLoading && (
                  <button disabled className="icon-btn" style={{ padding: "10px 22px", opacity: 0.6 }}>
                    binding the hour
                    <span className="typing-dots" style={{ marginLeft: "6px" }}>
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </button>
                )}
                {keepsakeBlob && !keepsakeLoading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadKeepsake(keepsakeFilename); }}
                    className="icon-btn"
                    style={{
                      padding: "10px 22px",
                      borderColor: `var(--${premise.realm}-border)`,
                      color: `var(--${premise.realm})`
                    }}
                    title="Download the HTML keepsake file"
                  >
                    <Download size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />TAP TO SAVE FILE
                  </button>
                )}
                {keepsakeError && (
                  <div
                    className="body-font italic"
                    style={{ fontSize: "12px", color: "var(--rose-ember)", width: "100%", textAlign: "center", marginTop: "4px" }}
                  >
                    {keepsakeError}
                  </div>
                )}
              </div>
              {revealLoading && !revealText && (
                <div
                  className="mt-8 italic body-font slow-fade-in"
                  style={{ color: "var(--cream-dim)" }}
                >
                  the hidden hour surfaces
                  <span className="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelReveal?.(); }}
                    className="loading-stop-btn"
                    aria-label="Stop this request"
                    title="Stop this request"
                  >
                    STOP
                  </button>
                </div>
              )}
              {revealText && (
                <div className="mt-8 fade-in">
                  <div
                    className="divider-mark display-font"
                    style={{
                      color: `var(--${premise.realm})`,
                      letterSpacing: "0.35em",
                      fontSize: "10px"
                    }}
                  >
                    <span className="divider-ornament">THE HIDDEN HOUR</span>
                  </div>
                  <div
                    className="narration-text body-font text-base mt-6"
                    style={{ lineHeight: 1.75, fontStyle: "italic", color: "var(--cream-dim)" }}
                  >
                    <TypewriterText
                      text={revealText}
                      instant={true}
                      scrollRef={scrollRef}
                    />
                    {revealLoading && (
                      <span className="cursor-blink" aria-hidden="true" />
                    )}
                  </div>
                </div>
              )}
              {revealError && (
                <div
                  className="mt-4 italic body-font"
                  style={{ color: "var(--rose-ember)", fontSize: "13px" }}
                >
                  {revealError.message}
                </div>
              )}
            </div>
          )}
          {metaMode && (
            <div className="pt-4 fade-in">
              <div
                className="divider-mark display-font"
                style={{
                  color: `var(--${premise.realm})`,
                  letterSpacing: "0.4em",
                  fontSize: "11px"
                }}
              >
                <span className="divider-ornament">AUTHOR'S TABLE</span>
              </div>
              <div
                className="text-center mt-3 mb-6 body-font italic text-sm"
                style={{ color: "var(--cream-faint)" }}
              >
                Out of character. Ask about plot threads you missed, things that felt inconsistent, or anything else about the story.
              </div>
              {metaMessages.length === 0 && (
                <div
                  className="body-font text-base"
                  style={{ color: "var(--cream-dim)", lineHeight: 1.7 }}
                >
                  <span style={{ fontStyle: "italic" }}>A few things you might ask:</span>
                  <ul className="mt-2 space-y-1" style={{ color: "var(--cream-dim)" }}>
                    <li>— What plot threads or characters did I miss?</li>
                    <li>— Were there other endings I could have reached?</li>
                    <li>— That part where X happened — did it contradict Y?</li>
                    <li>— What were you really trying to do with this story?</li>
                  </ul>
                </div>
              )}
              <div className="space-y-6 mt-6">
                {metaMessages.map((m, i: number) => {
                  if (m.role === "user") {
                    return (
                      <div
                        key={i}
                        className="body-font fade-in"
                        style={{
                          color: "var(--cream-bright)",
                          padding: "10px 16px",
                          borderLeft: `2px solid var(--${premise.realm}-border)`,
                          background: "rgba(28, 22, 44, 0.35)"
                        }}
                      >
                        {m.text}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="body-font text-base fade-in"
                      style={{
                        color: "var(--cream)",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      <TypewriterText
                        text={m.text}
                        instant={m.fullyRevealed || instantReveal}
                        skipSignal={skipNonce}
                        onDone={() => markMetaRevealed(i)}
                        scrollRef={scrollRef}
                        fastMode
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {loading && entries.length > 0 && !lastEntry?.streaming && (
            <div className="italic body-font slow-fade-in" style={{ color: "var(--cream-dim)" }}>
              {loadingPhrase || (metaMode ? "the author considers" : "the hour considers")}
              <span className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); cancelRequest?.(); }}
                className="loading-stop-btn"
                aria-label="Stop this request"
                title="Stop this request"
              >
                STOP
              </button>
            </div>
          )}
          {error && (
            <div className="italic body-font" style={{ color: "var(--rose-ember)" }}>
              <div>{error.message}</div>
              {error.detail && (
                <div
                  className="mt-1"
                  style={{ fontSize: "12px", opacity: 0.6, fontStyle: "italic" }}
                >
                  {error.detail}
                </div>
              )}
              <ErrorRawDetail raw={error.raw} />
            </div>
          )}
          {recovery && !loading && (
            <div className="mt-3 fade-in">
              <button
                onClick={(e) => { e.stopPropagation(); continueNarration?.(); }}
                className="icon-btn"
                style={{
                  padding: "9px 20px",
                  borderColor: `var(--${premise.realm}-border)`,
                  color: `var(--${premise.realm})`
                }}
                title="Have the narrator finish the interrupted passage"
              >
                <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6 }} />CONTINUE THE NARRATION
              </button>
            </div>
          )}
        </div>
      </div>
      <GameComposer />
    </div>
  );
}
