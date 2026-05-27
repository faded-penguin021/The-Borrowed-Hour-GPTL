import React, { useState, useEffect, useRef } from "react";

export function TypewriterText({
  text,
  instant = false,
  skipSignal = 0,
  onDone,
  scrollRef,
  fastMode = false
}) {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia)
      return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia)
      return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReducedMotion(e.matches);
    if (mq.addEventListener)
      mq.addEventListener("change", handler);
    else if (mq.addListener)
      mq.addListener(handler);
    return () => {
      if (mq.removeEventListener)
        mq.removeEventListener("change", handler);
      else if (mq.removeListener)
        mq.removeListener(handler);
    };
  }, []);
  const effectiveInstant = instant || reducedMotion;
  const [revealed, setRevealed] = useState(() => effectiveInstant ? text.length : 0);
  const doneFiredRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  useEffect(() => {
    setRevealed(effectiveInstant ? text.length : 0);
    doneFiredRef.current = false;
  }, [text, effectiveInstant]);
  const initialSkipRef = useRef(skipSignal);
  useEffect(() => {
    if (skipSignal !== initialSkipRef.current) {
      setRevealed((c) => c < text.length ? text.length : c);
    }
  }, [skipSignal]);
  useEffect(() => {
    if (revealed >= text.length && !doneFiredRef.current) {
      doneFiredRef.current = true;
      onDoneRef.current?.();
    }
  }, [revealed, text.length]);
  useEffect(() => {
    if (effectiveInstant || revealed >= text.length)
      return;
    const tickMs = fastMode ? 22 : 24;
    const charMs = fastMode ? 11 : 12.5;
    const minMs = fastMode ? 1200 : 1500;
    const maxMs = fastMode ? 8000 : 12000;
    const targetMs = Math.max(minMs, Math.min(maxMs, text.length * charMs));
    const ticks = Math.max(1, Math.floor(targetMs / tickMs));
    const stride = Math.max(1, Math.ceil(text.length / ticks));
    const recent = text.slice(Math.max(0, revealed - stride), revealed);
    let delay = tickMs;
    if (recent.includes(`
`))
      delay = fastMode ? 200 : 220;
    else if (/[.!?…]/.test(recent))
      delay = fastMode ? 80 : 90;
    const t = setTimeout(() => {
      setRevealed((c) => Math.min(c + stride, text.length));
    }, delay);
    return () => clearTimeout(t);
  }, [text, revealed, effectiveInstant, fastMode]);
  useEffect(() => {
    if (!scrollRef?.current)
      return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [revealed, scrollRef]);
  const isTyping = !effectiveInstant && revealed < text.length;
  const display = revealed >= text.length ? text : text.slice(0, revealed);
  return /* @__PURE__ */ React.createElement("span", {
    className: isTyping ? "cursor-blink" : ""
  }, display);
}
