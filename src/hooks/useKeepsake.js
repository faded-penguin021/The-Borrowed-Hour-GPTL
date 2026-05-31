// @ts-check
import { useState, useRef } from "react";
import { buildKeepsakeHTML, inlineImages } from "../export/keepsake.js";

/**
 * Two-tap keepsake download flow.
 *
 * Tap 1 — `generateKeepsake()`: async, inlines images and builds the HTML Blob.
 *   Call this from a button's onClick; the user waits for the Blob to be ready.
 *
 * Tap 2 — `downloadKeepsake()`: synchronous, must be called directly from an
 *   onClick handler with no preceding await. iOS Safari revokes the user-gesture
 *   token the moment an async boundary is crossed, silently blocking `<a download>`.
 *   By the time Tap 2 fires the Blob is already in memory, so no async work is
 *   needed and the gesture token stays valid.
 *
 * iOS PWA standalone fallback: if `window.navigator.standalone === true`, the
 *   anchor API is also blocked. In that case `downloadKeepsake` passes the HTML
 *   text to `setExportFallbackText` so the copy-paste modal can surface it.
 *
 * @param {{
 *   setExportFallbackText: (text: string) => void,
 * }} deps
 */
export function useKeepsake({ setExportFallbackText }) {
  const [keepsakeBlob, setKeepsakeBlob] = useState(/** @type {Blob | null} */ (null));
  const [keepsakeLoading, setKeepsakeLoading] = useState(false);
  const [keepsakeError, setKeepsakeError] = useState(/** @type {string | null} */ (null));
  const pendingBlobUrlRef = useRef(/** @type {string | null} */ (null));

  const revokePending = () => {
    if (pendingBlobUrlRef.current) {
      try { URL.revokeObjectURL(pendingBlobUrlRef.current); } catch {}
      pendingBlobUrlRef.current = null;
    }
  };

  /**
   * Tap 1: Inline images and assemble the HTML Blob. Stores the result in state;
   * does not trigger a download.
   * @param {{
   *   premise: Premise,
   *   entries: Entry[],
   *   revealText?: string,
   *   metaMessages?: any[],
   *   ended: boolean,
   * }} args
   */
  const generateKeepsake = async ({ premise, entries, revealText, metaMessages, ended }) => {
    if (keepsakeLoading) return;
    setKeepsakeLoading(true);
    setKeepsakeError(null);
    setKeepsakeBlob(null);
    revokePending();

    try {
      const inlinedEntries = await inlineImages(entries);
      const html = buildKeepsakeHTML({ premise, entries: inlinedEntries, revealText, metaMessages, ended });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      setKeepsakeBlob(blob);
    } catch (e) {
      setKeepsakeError(e instanceof Error ? e.message : "Could not generate the keepsake.");
    } finally {
      setKeepsakeLoading(false);
    }
  };

  /**
   * Tap 2: Trigger the file download. Must be called synchronously from an
   * onClick — no await before this call or iOS will block the download.
   * @param {string} filename
   */
  const downloadKeepsake = (filename) => {
    if (!keepsakeBlob) return;

    // iOS Safari in PWA standalone mode blocks <a download> even with a fresh
    // user gesture. Fall back to the copy-paste modal.
    if (typeof window !== "undefined" && /** @type {any} */ (window.navigator).standalone === true) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setExportFallbackText(reader.result);
      };
      reader.readAsText(keepsakeBlob);
      return;
    }

    const url = URL.createObjectURL(keepsakeBlob);
    pendingBlobUrlRef.current = url;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "the-borrowed-hour.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke after the browser has had time to start the download.
    setTimeout(() => {
      if (pendingBlobUrlRef.current === url) {
        revokePending();
      }
    }, 2000);
  };

  const resetKeepsake = () => {
    setKeepsakeBlob(null);
    setKeepsakeLoading(false);
    setKeepsakeError(null);
    revokePending();
  };

  return { keepsakeBlob, keepsakeLoading, keepsakeError, generateKeepsake, downloadKeepsake, resetKeepsake };
}
