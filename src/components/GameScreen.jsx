import React, { useState, useRef, useEffect } from "react";
import { realmGlyph } from "../data/premises.js";
import { formatTokens } from "../data/constants.js";
import { TypewriterText } from "./TypewriterText.jsx";
import { ErrorRawDetail } from "./ErrorRawDetail.jsx";

export function GameScreen({
  premise,
  entries,
  skipNonce,
  instantReveal,
  onEntryDone,
  onMetaDone,
  loading,
  loadingPhrase,
  error,
  ended,
  metaMode,
  metaMessages,
  onEnterMeta,
  onExitMeta,
  onOpenLedger,
  onOpenSettings,
  canUndo,
  onUndo,
  input,
  onInputChange,
  onKeyDown,
  onSubmit,
  onSkip,
  onCancel,
  recovery,
  onContinueNarration,
  onRestart,
  onSave,
  onOpenSaves,
  onExport,
  saveBanner,
  sessionTokens,
  scrollRef,
  textareaRef,
  ambienceEnabled,
  ambienceMuted,
  onToggleAmbienceMute,
  ttsEnabled,
  ttsMuted,
  ttsPlayback,
  onToggleTtsMute,
  onTogglePlayPause,
  onPlayEntry
}) {
  const lastEntry = entries[entries.length - 1];
  const showResolution = ended && lastEntry && lastEntry.type === "narration" && lastEntry.fullyRevealed && !metaMode;
  const inputLocked = ended && !metaMode || loading;
  const hasMeta = metaMessages.length > 0;
  return /* @__PURE__ */ React.createElement("div", {
    className: "relative flex flex-col",
    style: { height: "var(--app-vh, 100dvh)", minHeight: "var(--app-vh, 100dvh)" }
  }, /* @__PURE__ */ React.createElement("header", {
    className: "game-header relative flex items-center justify-between px-6 py-4 border-b",
    style: { borderColor: "rgba(232, 222, 197, 0.1)" }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "header-title display-font text-xs flex items-center gap-3",
    style: { color: "var(--cream-dim)", letterSpacing: "0.3em" }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: `var(--${premise.realm})` }
  }, realmGlyph(premise.realm)), premise.title.toUpperCase()), /* @__PURE__ */ React.createElement("div", {
    className: "header-actions flex items-center gap-2"
  }, /* @__PURE__ */ React.createElement("button", {
    onClick: onUndo,
    disabled: !canUndo,
    className: "icon-btn",
    title: "Undo the last turn",
    "aria-label": "Undo the last turn"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "⟲"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " UNDO")), /* @__PURE__ */ React.createElement("button", {
    onClick: onOpenLedger,
    disabled: entries.length === 0,
    className: "icon-btn",
    title: "Open the ledger — see what's tracked",
    "aria-label": "Open the ledger"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "❖"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " LEDGER")), /* @__PURE__ */ React.createElement("button", {
    onClick: onSave,
    disabled: loading || entries.length === 0,
    className: "icon-btn",
    title: "Set aside this hour",
    "aria-label": "Set aside this hour"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "❀"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " SET ASIDE")), /* @__PURE__ */ React.createElement("button", {
    onClick: () => onExport(false),
    disabled: entries.length === 0,
    className: "icon-btn",
    title: hasMeta ? "Copy the chronicle as text — narration only, no commentary" : "Copy the chronicle as text — to keep, or to share",
    "aria-label": "Copy the chronicle"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "❧"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " COPY")), hasMeta && /* @__PURE__ */ React.createElement("button", {
    onClick: () => onExport(true),
    className: "icon-btn",
    title: "Copy the chronicle and the director's commentary together",
    "aria-label": "Copy the chronicle with commentary"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "❧+"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " COPY ALL")), /* @__PURE__ */ React.createElement("button", {
    onClick: onOpenSaves,
    className: "icon-btn",
    title: "Open hours",
    "aria-label": "Open saved hours"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "❍"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " HOURS")), /* @__PURE__ */ React.createElement("button", {
    onClick: onOpenSettings,
    className: "icon-btn",
    title: "Reader preferences — contrast, motion, typewriter",
    "aria-label": "Reader preferences"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "⚙"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " READING")), ambienceEnabled && /* @__PURE__ */ React.createElement("button", {
    onClick: onToggleAmbienceMute,
    className: "icon-btn",
    title: ambienceMuted ? "Unmute the ambience bed" : "Mute the ambience bed",
    "aria-label": ambienceMuted ? "Unmute ambience" : "Mute ambience",
    "aria-pressed": ambienceMuted ? "true" : "false"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, ambienceMuted ? "♪̸" : "♪"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, ambienceMuted ? " MUTED" : " AMBIENT")), ttsEnabled && /* @__PURE__ */ React.createElement("button", {
    onClick: onToggleTtsMute,
    className: "icon-btn",
    title: ttsMuted ? "Resume narration aloud" : "Silence narration aloud",
    "aria-label": ttsMuted ? "Resume narration aloud" : "Silence narration aloud",
    "aria-pressed": ttsMuted ? "true" : "false"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, ttsMuted ? "▷̸" : "▷"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, ttsMuted ? " SILENT" : " VOICE")),
  /* @__PURE__ */ React.createElement("button", {
    onClick: onRestart,
    className: "icon-btn icon-btn-danger",
    title: "Begin a new hour",
    "aria-label": "Begin a new hour"
  }, /* @__PURE__ */ React.createElement("span", {
    "aria-hidden": "true"
  }, "✕"), /* @__PURE__ */ React.createElement("span", {
    className: "btn-label"
  }, " ANEW")))), (sessionTokens?.input > 0 || sessionTokens?.output > 0) && /* @__PURE__ */ React.createElement("div", {
    className: "display-font",
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 16,
      padding: "4px 20px",
      fontSize: 9,
      letterSpacing: "0.2em",
      color: "var(--cream-faint)",
      borderBottom: "1px solid rgba(232,222,197,0.07)",
      userSelect: "none"
    }
  }, /* @__PURE__ */ React.createElement("span", null, formatTokens(sessionTokens.input), " IN"), /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.35 } }, "·"), /* @__PURE__ */ React.createElement("span", null, formatTokens(sessionTokens.output), " OUT")), saveBanner && /* @__PURE__ */ React.createElement("div", {
    className: "mx-auto mt-3 px-4 py-2 body-font italic text-sm fade-in",
    style: {
      color: saveBanner.kind === "ok" ? "var(--rose-gold)" : "var(--rose-ember)",
      border: "1px solid",
      borderColor: saveBanner.kind === "ok" ? "rgba(212, 165, 116, 0.3)" : "rgba(217, 122, 122, 0.3)",
      background: "rgba(10, 8, 20, 0.65)"
    }
  }, saveBanner.text), /* @__PURE__ */ React.createElement("div", {
    ref: scrollRef,
    className: "game-scroll flex-1 overflow-y-auto px-6 py-12",
    onClick: onSkip
  }, /* @__PURE__ */ React.createElement("div", {
    className: "max-w-3xl mx-auto space-y-8"
  }, entries.length === 0 && loading && /* @__PURE__ */ React.createElement("div", {
    className: "divider-mark body-font italic text-base slow-fade-in"
  }, /* @__PURE__ */ React.createElement("span", null, loadingPhrase || "the hour begins to write itself"), /* @__PURE__ */ React.createElement("span", {
    className: "typing-dots",
    style: { marginLeft: "6px" }
  }, /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, ".")), /* @__PURE__ */ React.createElement("button", {
    onClick: (e) => {
      e.stopPropagation();
      onCancel?.();
    },
    className: "loading-stop-btn",
    "aria-label": "Stop this request",
    title: "Stop this request"
  }, "STOP")), entries.map((entry, i) => {
    if (entry.type === "narration") {
      const showPlay = ttsEnabled && entry.fullyRevealed && !entry.streaming && typeof entry.text === "string" && entry.text.trim();
      const isLoading = ttsPlayback?.loading && ttsPlayback?.loadingTurnId === i;
      const isActive = ttsPlayback?.activeTurnId === i;
      const isSpeaking = isActive && ttsPlayback?.speaking;
      const isPaused = isActive && ttsPlayback?.paused;
      const btnGlyph = isLoading ? "◐" : (isSpeaking ? "❙❙" : "▶");
      const btnLabel = isLoading ? "LOADING" : (isSpeaking ? "PAUSE" : (isPaused ? "RESUME" : "PLAY"));
      return /* @__PURE__ */ React.createElement("div", {
        key: i,
        className: "fade-in"
      }, /* @__PURE__ */ React.createElement("div", {
        className: "narration-text body-font text-lg",
        style: { lineHeight: 1.7 }
      }, /* @__PURE__ */ React.createElement(TypewriterText, {
        text: entry.text,
        instant: entry.fullyRevealed || entry.streaming || instantReveal,
        skipSignal: skipNonce,
        onDone: () => onEntryDone(i),
        scrollRef
      })), showPlay && /* @__PURE__ */ React.createElement("div", {
        className: "mt-2",
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" },
        onClick: (e) => e.stopPropagation()
      }, /* @__PURE__ */ React.createElement("button", {
        onClick: (e) => { e.stopPropagation(); onPlayEntry?.(i); },
        className: "icon-btn",
        disabled: isLoading,
        title: isLoading ? "Preparing narration…" : (isSpeaking ? "Pause narration" : (isPaused ? "Resume narration" : "Play this passage aloud")),
        "aria-label": btnLabel,
        "aria-busy": isLoading ? "true" : "false",
        style: { padding: "4px 10px", fontSize: "10px", opacity: isLoading ? 0.75 : 1 }
      }, /* @__PURE__ */ React.createElement("span", {
        "aria-hidden": "true",
        className: isLoading ? "tts-spin" : ""
      }, btnGlyph), /* @__PURE__ */ React.createElement("span", {
        className: "btn-label"
      }, " ", btnLabel), isLoading && /* @__PURE__ */ React.createElement("span", {
        className: "typing-dots",
        style: { marginLeft: "4px" }
      }, /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, "."))),
      ttsPlayback?.lastError && ttsPlayback?.lastErrorTurnId === i && /* @__PURE__ */ React.createElement("div", {
        className: "body-font italic",
        style: { fontSize: "11px", color: "var(--rose-ember)", opacity: 0.85, lineHeight: 1.4, maxWidth: "100%", wordBreak: "break-word" }
      }, "tts: ", ttsPlayback.lastError)));
    }
    return /* @__PURE__ */ React.createElement("div", {
      key: i,
      className: "action-text body-font text-base fade-in",
      style: { lineHeight: 1.6 }
    }, entry.text);
  }), entries.length === 1 && entries[0].type === "narration" && entries[0].fullyRevealed && !ended && !metaMode && /* @__PURE__ */ React.createElement("div", {
    className: "text-center body-font italic slow-fade-in",
    style: {
      color: "var(--cream-faint)",
      fontSize: "13px",
      paddingTop: "4px",
      letterSpacing: "0.02em"
    }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: `var(--${premise.realm})`, opacity: 0.7 }
  }, "❧"), " ", "when this hour is spent, you may speak with its author about it"), showResolution && /* @__PURE__ */ React.createElement("div", {
    className: "fade-in pt-4"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "divider-mark display-font",
    style: {
      color: `var(--${premise.realm})`,
      letterSpacing: "0.4em",
      fontSize: "12px"
    }
  }, /* @__PURE__ */ React.createElement("span", null, "❦ THE HOUR IS SPENT ❦")), /* @__PURE__ */ React.createElement("div", {
    className: "text-center mt-6 body-font italic text-base",
    style: { color: "var(--cream-faint)" }
  }, "The chronicle is closed. You may now speak with its author — ask what you missed, point out what felt amiss."), /* @__PURE__ */ React.createElement("div", {
    className: "text-center mt-6 flex justify-center gap-3 flex-wrap"
  }, /* @__PURE__ */ React.createElement("button", {
    onClick: onEnterMeta,
    className: "icon-btn",
    style: {
      padding: "10px 22px",
      borderColor: `var(--${premise.realm}-border)`,
      color: `var(--${premise.realm})`
    }
  }, "✦ SPEAK WITH THE AUTHOR"), /* @__PURE__ */ React.createElement("button", {
    onClick: onSave,
    className: "icon-btn",
    style: { padding: "10px 22px" }
  }, "❀ KEEP THIS HOUR"), /* @__PURE__ */ React.createElement("button", {
    onClick: onRestart,
    className: "icon-btn",
    style: { padding: "10px 22px" }
  }, "❀ BEGIN A NEW HOUR"))), metaMode && /* @__PURE__ */ React.createElement("div", {
    className: "pt-4 fade-in"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "divider-mark display-font",
    style: {
      color: `var(--${premise.realm})`,
      letterSpacing: "0.4em",
      fontSize: "11px"
    }
  }, /* @__PURE__ */ React.createElement("span", null, "✦ AUTHOR'S TABLE ✦")), /* @__PURE__ */ React.createElement("div", {
    className: "text-center mt-3 mb-6 body-font italic text-sm",
    style: { color: "var(--cream-faint)" }
  }, "Out of character. Ask about plot threads you missed, things that felt inconsistent, or anything else about the story."), metaMessages.length === 0 && /* @__PURE__ */ React.createElement("div", {
    className: "body-font text-base",
    style: { color: "var(--cream-dim)", lineHeight: 1.7 }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { fontStyle: "italic" }
  }, "A few things you might ask:"), /* @__PURE__ */ React.createElement("ul", {
    className: "mt-2 space-y-1",
    style: { color: "var(--cream-dim)" }
  }, /* @__PURE__ */ React.createElement("li", null, "— What plot threads or characters did I miss?"), /* @__PURE__ */ React.createElement("li", null, "— Were there other endings I could have reached?"), /* @__PURE__ */ React.createElement("li", null, "— That part where X happened — did it contradict Y?"), /* @__PURE__ */ React.createElement("li", null, "— What were you really trying to do with this story?"))), /* @__PURE__ */ React.createElement("div", {
    className: "space-y-6 mt-6"
  }, metaMessages.map((m, i) => {
    if (m.role === "user") {
      return /* @__PURE__ */ React.createElement("div", {
        key: i,
        className: "body-font fade-in",
        style: {
          color: "var(--cream-bright)",
          padding: "10px 16px",
          borderLeft: `2px solid var(--${premise.realm}-border)`,
          background: "rgba(28, 22, 44, 0.35)"
        }
      }, m.text);
    }
    return /* @__PURE__ */ React.createElement("div", {
      key: i,
      className: "body-font text-base fade-in",
      style: {
        color: "var(--cream)",
        lineHeight: 1.7,
        whiteSpace: "pre-wrap"
      }
    }, /* @__PURE__ */ React.createElement(TypewriterText, {
      text: m.text,
      instant: m.fullyRevealed || instantReveal,
      skipSignal: skipNonce,
      onDone: () => onMetaDone(i),
      scrollRef,
      fastMode: true
    }));
  }))), loading && entries.length > 0 && !lastEntry?.streaming && /* @__PURE__ */ React.createElement("div", {
    className: "italic body-font slow-fade-in",
    style: { color: "var(--cream-dim)" }
  }, loadingPhrase || (metaMode ? "the author considers" : "the hour considers"), /* @__PURE__ */ React.createElement("span", {
    className: "typing-dots"
  }, /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, ".")), /* @__PURE__ */ React.createElement("button", {
    onClick: (e) => {
      e.stopPropagation();
      onCancel?.();
    },
    className: "loading-stop-btn",
    "aria-label": "Stop this request",
    title: "Stop this request"
  }, "STOP")), error && /* @__PURE__ */ React.createElement("div", {
    className: "italic body-font",
    style: { color: "var(--rose-ember)" }
  }, /* @__PURE__ */ React.createElement("div", null, error.message), error.detail && /* @__PURE__ */ React.createElement("div", {
    className: "mt-1",
    style: {
      fontSize: "12px",
      opacity: 0.6,
      fontStyle: "italic"
    }
  }, error.detail), /* @__PURE__ */ React.createElement(ErrorRawDetail, { raw: error.raw })), recovery && !loading && /* @__PURE__ */ React.createElement("div", {
    className: "mt-3 fade-in"
  }, /* @__PURE__ */ React.createElement("button", {
    onClick: (e) => {
      e.stopPropagation();
      onContinueNarration?.();
    },
    className: "icon-btn",
    style: {
      padding: "9px 20px",
      borderColor: `var(--${premise.realm}-border)`,
      color: `var(--${premise.realm})`
    },
    title: "Have the narrator finish the interrupted passage"
  }, "✦ CONTINUE THE NARRATION")))), /* @__PURE__ */ React.createElement("div", {
    className: "game-input-row relative px-6 py-5 border-t",
    style: {
      borderColor: "rgba(232, 222, 197, 0.1)",
      background: "rgba(5, 3, 9, 0.8)",
      backdropFilter: "blur(4px)"
    }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "max-w-3xl mx-auto"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex gap-3 items-start"
  }, /* @__PURE__ */ React.createElement("span", {
    className: "display-font text-2xl leading-none mt-2 select-none",
    style: {
      color: metaMode ? `var(--${premise.realm})` : "var(--rose-ember)"
    }
  }, metaMode ? "✦" : "›"), /* @__PURE__ */ React.createElement("textarea", {
    ref: textareaRef,
    value: input,
    onChange: onInputChange,
    onKeyDown,
    disabled: inputLocked,
    rows: 1,
    autoFocus: !ended || metaMode,
    placeholder: ended && !metaMode ? "The chronicle is closed." : metaMode ? "Ask the author. Speak frankly." : loading ? "" : "Speak. Move. Search your pockets. Lie. Run. Ask a question.",
    className: "borrowed-input flex-1 px-4 py-3 resize-none text-lg disabled:opacity-50",
    style: {
      minHeight: "52px",
      maxHeight: "160px",
      fontFamily: "'Cormorant Garamond', serif",
      lineHeight: 1.5
    }
  })), /* @__PURE__ */ React.createElement("div", {
    className: "text-xs mt-2 ml-8 italic body-font flex flex-wrap items-center gap-x-4 gap-y-1",
    style: { color: "var(--cream-faint)" }
  }, /* @__PURE__ */ React.createElement("span", null, "↵ ", metaMode ? "ask" : "act"), /* @__PURE__ */ React.createElement("span", null, "⇧ ↵ new line"), /* @__PURE__ */ React.createElement("span", null, "click the page to skip the writing"), metaMode && /* @__PURE__ */ React.createElement("button", {
    onClick: onExitMeta,
    className: "ml-auto",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--cream-dim)",
      fontStyle: "italic",
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: "12px",
      textDecoration: "underline",
      textUnderlineOffset: "3px"
    }
  }, "leave the author's table")))));
}
