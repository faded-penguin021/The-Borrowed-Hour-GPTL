import React, { useRef, useEffect } from "react";
import type { Entry } from "../types";
import { realmGlyph } from "../data/premises";
import { realmText, realmBorder } from "../data/realmStyles";
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
import { IconButton } from "./ui/IconButton";
import {
  Undo2, BookOpen, Bookmark, Copy, CopyPlus, Clock, Settings,
  Volume2, VolumeX, Mic, MicOff, Sparkles, Play, Pause, Loader,
  BookMarked, RotateCcw, Download, HeartHandshake,
} from "lucide-react";

// The quiet inline "STOP" beside a loading phrase. Repeated for each loading
// state below, so its utility recipe lives here once.
const STOP_BTN =
  "ml-[14px] px-[10px] py-[2px] bg-transparent border border-cream/[0.18] text-cream-faint " +
  "font-display text-[9px] not-italic tracking-[0.3em] cursor-pointer align-middle " +
  "transition-all duration-[250ms] hover:border-rose-ember/50 hover:text-rose-ember";

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
      <header className="game-header relative flex items-center justify-between px-6 py-4 border-b border-cream/10">
        <div className="header-title font-display font-medium text-xs flex items-center gap-3 text-cream-dim tracking-[0.3em]">
          <span className={realmText[premise.realm]}>{realmGlyph(premise.realm)}</span>
          {premise.title.toUpperCase()}
        </div>
        <div className="header-actions flex items-center gap-2">
          <IconButton
            onClick={undoLastTurn}
            disabled={!canUndo}
            title="Undo the last turn"
            aria-label="Undo the last turn"
          >
            <Undo2 size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> UNDO</span>
          </IconButton>
          <IconButton
            onClick={onOpenLedger}
            disabled={entries.length === 0}
            title="Open the ledger — see what's tracked"
            aria-label="Open the ledger"
          >
            <BookOpen size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> LEDGER</span>
          </IconButton>
          <IconButton
            onClick={saveCurrent}
            disabled={loading || entries.length === 0}
            title="Set aside this hour"
            aria-label="Set aside this hour"
          >
            <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> SET ASIDE</span>
          </IconButton>
          <IconButton
            onClick={() => exportChronicle(false)}
            disabled={entries.length === 0}
            title={hasMeta ? "Copy the chronicle as text — narration only, no commentary" : "Copy the chronicle as text — to keep, or to share"}
            aria-label="Copy the chronicle"
          >
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> COPY</span>
          </IconButton>
          {hasMeta && (
            <IconButton
              onClick={() => exportChronicle(true)}
              title="Copy the chronicle and the director's commentary together"
              aria-label="Copy the chronicle with commentary"
            >
              <CopyPlus size={14} strokeWidth={1.5} aria-hidden="true" />
              <span className="btn-label"> COPY ALL</span>
            </IconButton>
          )}
          <IconButton
            onClick={openSavesModal}
            title="Open hours"
            aria-label="Open saved hours"
          >
            <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> HOURS</span>
          </IconButton>
          <IconButton
            onClick={onOpenSettings}
            title="Reader preferences — contrast, motion, typewriter"
            aria-label="Reader preferences"
          >
            <Settings size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> READING</span>
          </IconButton>
          {ambienceEnabled && (
            <IconButton
              onClick={onToggleAmbienceMute}
              title={ambienceMuted ? "Unmute the ambience bed" : "Mute the ambience bed"}
              aria-label={ambienceMuted ? "Unmute ambience" : "Mute ambience"}
              aria-pressed={ambienceMuted ? "true" : "false"}
            >
              {ambienceMuted ? <VolumeX size={14} strokeWidth={1.5} aria-hidden="true" /> : <Volume2 size={14} strokeWidth={1.5} aria-hidden="true" />}
              <span className="btn-label">{ambienceMuted ? " MUTED" : " AMBIENT"}</span>
            </IconButton>
          )}
          {ttsEnabled && (
            <IconButton
              onClick={onToggleTtsMute}
              title={ttsMuted ? "Resume narration aloud" : "Silence narration aloud"}
              aria-label={ttsMuted ? "Resume narration aloud" : "Silence narration aloud"}
              aria-pressed={ttsMuted ? "true" : "false"}
            >
              {ttsMuted ? <MicOff size={14} strokeWidth={1.5} aria-hidden="true" /> : <Mic size={14} strokeWidth={1.5} aria-hidden="true" />}
              <span className="btn-label">{ttsMuted ? " SILENT" : " VOICE"}</span>
            </IconButton>
          )}
          <IconButton
            onClick={restart}
            danger
            title="Begin a new hour"
            aria-label="Begin a new hour"
          >
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="btn-label"> ANEW</span>
          </IconButton>
        </div>
      </header>
      {(sessionTokens?.input > 0 || sessionTokens?.output > 0) && (
        <div className="font-display font-medium flex justify-end gap-4 px-5 py-1 text-[9px] tracking-[0.2em] text-cream-faint border-b border-cream/[0.07] select-none">
          <span>{formatTokens(sessionTokens.input)} IN</span>
          <span className="opacity-[0.35]">·</span>
          <span>{formatTokens(sessionTokens.output)} OUT</span>
        </div>
      )}
      {saveBanner && (
        <div
          className={`mx-auto mt-3 px-4 py-2 font-body italic text-sm fade-in border bg-twilight/65 ${
            saveBanner.kind === "ok"
              ? "text-rose-gold border-rose-gold/30"
              : "text-rose-ember border-rose-ember/30"
          }`}
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
            <div className="divider-mark font-body italic text-base slow-fade-in text-cream-faint">
              <span>{loadingPhrase || "the hour begins to write itself"}</span>
              <span className="typing-dots ml-1.5">
                <span>.</span><span>.</span><span>.</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); cancelRequest?.(); }}
                className={STOP_BTN}
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
                  <div className="narration-text font-body text-lg text-cream-bright leading-[1.7]">
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
                      className="mt-2 flex flex-col items-start gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        onClick={(e) => { e.stopPropagation(); onPlayEntry?.(i); }}
                        size="sm"
                        disabled={isLoading}
                        title={isLoading ? "Preparing narration…" : (isSpeaking ? "Pause narration" : (isPaused ? "Resume narration" : "Play this passage aloud"))}
                        aria-label={btnLabel}
                        aria-busy={isLoading ? "true" : "false"}
                        className={isLoading ? "opacity-75" : ""}
                      >
                        <span aria-hidden="true" className={isLoading ? "tts-spin" : ""}>{isLoading ? <Loader size={12} strokeWidth={1.5} /> : (isSpeaking ? <Pause size={12} strokeWidth={1.5} /> : <Play size={12} strokeWidth={1.5} />)}</span>
                        <span className="btn-label"> {btnLabel}</span>
                        {isLoading && (
                          <span className="typing-dots ml-1">
                            <span>.</span><span>.</span><span>.</span>
                          </span>
                        )}
                      </IconButton>
                      {ttsPlayback?.lastError && ttsPlayback?.lastErrorTurnId === i && (
                        <div className="font-body italic text-[11px] text-rose-ember opacity-[0.85] leading-[1.4] max-w-full break-words">
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
                className="action-text font-body text-base fade-in leading-[1.6]"
              >
                {entry.text}
              </div>
            );
          })}
          {entries.length === 1 && entries[0].type === "narration" && entries[0].fullyRevealed && !ended && !metaMode && (
            <div className="text-center font-body italic slow-fade-in text-cream-faint text-[13px] pt-1 tracking-[0.02em]">
              <span className={`${realmText[premise.realm]} opacity-70`}><HeartHandshake size={12} strokeWidth={1.5} /></span>{" "}
              when this hour is spent, you may speak with its author about it
            </div>
          )}
          {showResolution && (
            <div className="fade-in pt-4">
              <div className={`divider-mark font-display font-medium ${realmText[premise.realm]} tracking-[0.4em] text-[12px]`}>
                <span className="divider-ornament">THE HOUR IS SPENT</span>
              </div>
              <div className="text-center mt-6 font-body italic text-base text-cream-faint">
                The chronicle is closed. You may now speak with its author — ask what you missed, point out what felt amiss.
              </div>
              <div className="text-center mt-6 flex justify-center gap-3 flex-wrap">
                {!revealText && !revealLoading && (
                  <IconButton onClick={startReveal} size="lg" accent={premise.realm}>
                    <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />UNVEIL THE HIDDEN HOUR
                  </IconButton>
                )}
                <IconButton onClick={enterMetaMode} size="lg" accent={premise.realm}>
                  <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />SPEAK WITH THE AUTHOR
                </IconButton>
                <IconButton onClick={saveCurrent} size="lg">
                  <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />KEEP THIS HOUR
                </IconButton>
                <IconButton onClick={restart} size="lg">
                  <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />BEGIN A NEW HOUR
                </IconButton>
                {!keepsakeBlob && !keepsakeLoading && (
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); startKeepsake(); }}
                    size="lg"
                    title="Generate a self-contained HTML keepsake of this chronicle"
                  >
                    <BookMarked size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />GENERATE BOOK
                  </IconButton>
                )}
                {keepsakeLoading && (
                  <IconButton disabled size="lg" className="opacity-60">
                    binding the hour
                    <span className="typing-dots ml-1.5">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </IconButton>
                )}
                {keepsakeBlob && !keepsakeLoading && (
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); downloadKeepsake(keepsakeFilename); }}
                    size="lg"
                    accent={premise.realm}
                    title="Download the HTML keepsake file"
                  >
                    <Download size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />TAP TO SAVE FILE
                  </IconButton>
                )}
                {keepsakeError && (
                  <div className="font-body italic text-[12px] text-rose-ember w-full text-center mt-1">
                    {keepsakeError}
                  </div>
                )}
              </div>
              {revealLoading && !revealText && (
                <div className="mt-8 italic font-body slow-fade-in text-cream-dim">
                  the hidden hour surfaces
                  <span className="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelReveal?.(); }}
                    className={STOP_BTN}
                    aria-label="Stop this request"
                    title="Stop this request"
                  >
                    STOP
                  </button>
                </div>
              )}
              {revealText && (
                <div className="mt-8 fade-in">
                  <div className={`divider-mark font-display font-medium ${realmText[premise.realm]} tracking-[0.35em] text-[10px]`}>
                    <span className="divider-ornament">THE HIDDEN HOUR</span>
                  </div>
                  <div className="narration-text font-body text-base mt-6 leading-[1.75] italic text-cream-dim">
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
                <div className="mt-4 italic font-body text-rose-ember text-[13px]">
                  {revealError.message}
                </div>
              )}
            </div>
          )}
          {metaMode && (
            <div className="pt-4 fade-in">
              <div className={`divider-mark font-display font-medium ${realmText[premise.realm]} tracking-[0.4em] text-[11px]`}>
                <span className="divider-ornament">AUTHOR'S TABLE</span>
              </div>
              <div className="text-center mt-3 mb-6 font-body italic text-sm text-cream-faint">
                Out of character. Ask about plot threads you missed, things that felt inconsistent, or anything else about the story.
              </div>
              {metaMessages.length === 0 && (
                <div className="font-body text-base text-cream-dim leading-[1.7]">
                  <span className="italic">A few things you might ask:</span>
                  <ul className="mt-2 space-y-1 text-cream-dim">
                    <li>— What plot threads or characters did I miss?</li>
                    <li>— Were there other endings I could have reached?</li>
                    <li>— That part where X happened — did it contradict Y?</li>
                    <li>— What were you really trying to do with this story?</li>
                  </ul>
                </div>
              )}
              <div className="text-center mt-3 mb-2 flex justify-center gap-3 flex-wrap">
                <IconButton onClick={saveCurrent} size="lg">
                  <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />KEEP THIS HOUR
                </IconButton>
                {!keepsakeBlob && !keepsakeLoading && (
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); startKeepsake(); }}
                    size="lg"
                    title="Generate a self-contained HTML keepsake of this chronicle"
                  >
                    <BookMarked size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />GENERATE BOOK
                  </IconButton>
                )}
                {keepsakeLoading && (
                  <IconButton disabled size="lg" className="opacity-60">
                    binding the hour
                    <span className="typing-dots ml-1.5">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </IconButton>
                )}
                {keepsakeBlob && !keepsakeLoading && (
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); downloadKeepsake(keepsakeFilename); }}
                    size="lg"
                    accent={premise.realm}
                    title="Download the HTML keepsake file"
                  >
                    <Download size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />TAP TO SAVE FILE
                  </IconButton>
                )}
                <IconButton onClick={restart} size="lg">
                  <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />BEGIN A NEW HOUR
                </IconButton>
                {keepsakeError && (
                  <div className="font-body italic text-[12px] text-rose-ember w-full text-center mt-1">
                    {keepsakeError}
                  </div>
                )}
              </div>
              <div className="space-y-6 mt-6">
                {metaMessages.map((m, i: number) => {
                  if (m.role === "user") {
                    return (
                      <div
                        key={i}
                        className={`font-body fade-in text-cream-bright px-4 py-[10px] border-l-2 ${realmBorder[premise.realm]} bg-[#1c162c]/35`}
                      >
                        {m.text}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="font-body text-base fade-in text-cream leading-[1.7] whitespace-pre-wrap"
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
            <div className="italic font-body slow-fade-in text-cream-dim">
              {loadingPhrase || (metaMode ? "the author considers" : "the hour considers")}
              <span className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); cancelRequest?.(); }}
                className={STOP_BTN}
                aria-label="Stop this request"
                title="Stop this request"
              >
                STOP
              </button>
            </div>
          )}
          {error && (
            <div className="italic font-body text-rose-ember">
              <div>{error.message}</div>
              {error.detail && (
                <div className="mt-1 text-[12px] opacity-60 italic">
                  {error.detail}
                </div>
              )}
              <ErrorRawDetail raw={error.raw} />
            </div>
          )}
          {recovery && !loading && (
            <div className="mt-3 fade-in">
              <IconButton
                onClick={(e) => { e.stopPropagation(); continueNarration?.(); }}
                accent={premise.realm}
                pad="px-5 py-[9px]"
                title="Have the narrator finish the interrupted passage"
              >
                <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />CONTINUE THE NARRATION
              </IconButton>
            </div>
          )}
        </div>
      </div>
      <GameComposer />
    </div>
  );
}
