import type { Entry, MetaMessage, Premise } from "../types";
import { getImage } from "../storage/imageStore";

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAX_INLINE_PX = 1200;

/**
 * Fetches a blob: URL, draws it onto a canvas capped at MAX_INLINE_PX wide,
 * and returns a JPEG data URL. Returns the original src on any failure.
 * The cap prevents iOS Safari OOM crashes when inlining full-resolution images.
 */
async function toBase64Capped(src: string): Promise<string> {
  try {
    let blob: Blob;
    if (src.startsWith("blob:")) {
      const res = await fetch(src);
      blob = await res.blob();
    } else if (src.startsWith("idb:")) {
      // Export ran before rehydration swapped the marker for a blob: URL —
      // pull the bytes straight from IndexedDB.
      const stored = await getImage(src.slice("idb:".length));
      if (!stored) return src;
      blob = stored;
    } else if (src.startsWith("data:")) {
      return src;
    } else {
      return src;
    }

    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp;
    const scale = width > MAX_INLINE_PX ? MAX_INLINE_PX / width : 1;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bmp.close(); return src; }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return src;
  }
}

/**
 * Returns a new entries array where every ready blob illustration has been
 * replaced with a base64 data URL (capped at 1200px). Entries without
 * illustrations pass through unchanged.
 */
export async function inlineImages(entries: Entry[]): Promise<Entry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const ill = entry.illustration;
      if (!ill || ill.status !== "ready" || !ill.url) return entry;
      const inlined = await toBase64Capped(ill.url);
      return { ...entry, illustration: { ...ill, url: inlined } };
    })
  );
}

const REALM_COLORS: Record<string, { accent: string; border: string; bg: string }> = {
  echo:  { accent: "#b8c8d8", border: "rgba(184,200,216,0.4)",  bg: "rgba(184,200,216,0.06)" },
  neon:  { accent: "#e87faa", border: "rgba(232,127,170,0.45)", bg: "rgba(232,127,170,0.06)" },
  omen:  { accent: "#d4a574", border: "rgba(212,165,116,0.45)", bg: "rgba(212,165,116,0.06)" },
  dream: { accent: "#c8a8e0", border: "rgba(200,168,224,0.45)", bg: "rgba(200,168,224,0.06)" },
  wild:  { accent: "#b8c896", border: "rgba(184,200,150,0.45)", bg: "rgba(184,200,150,0.06)" },
};

/**
 * Builds a self-contained HTML keepsake document. Call `inlineImages` on entries
 * before passing them here so illustrations survive as embedded data URLs.
 */
export function buildKeepsakeHTML({ premise, entries, revealText, metaMessages, ended }: {
  premise: Premise;
  entries: Entry[];
  revealText?: string;
  metaMessages?: MetaMessage[];
  ended: boolean;
}): string {
  const realm = premise.realm || "echo";
  const rc = REALM_COLORS[realm] || REALM_COLORS.echo;

  const css = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');
:root {
  --twilight: #0a0814;
  --gloaming: #14101e;
  --cream: #e8dec5;
  --cream-bright: #f4ecd8;
  --cream-dim: #9a8d7a;
  --cream-faint: #524a3e;
  --rose-gold: #d4a574;
  --rose-ember: #d97a7a;
}
html { background: var(--twilight); }
body {
  margin: 0 auto;
  max-width: 720px;
  padding: 56px 28px 96px;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  line-height: 1.75;
  background: var(--twilight);
  color: var(--cream);
}
h1 {
  font-family: 'Cinzel', serif;
  font-size: 2em;
  font-weight: 500;
  color: ${rc.accent};
  letter-spacing: 0.05em;
  margin: 0 0 0.25em;
}
.realm-label {
  display: inline-block;
  font-family: 'Cinzel', serif;
  font-size: 10px;
  letter-spacing: 0.4em;
  color: ${rc.accent};
  border: 1px solid ${rc.border};
  background: ${rc.bg};
  padding: 4px 10px;
  margin-bottom: 1.8em;
}
.teaser {
  font-style: italic;
  color: var(--cream-dim);
  border-left: 2px solid ${rc.border};
  padding-left: 1em;
  margin: 0 0 2em;
}
hr { border: none; border-top: 1px solid rgba(232,222,197,0.12); margin: 2.5em 0; }
.narration {
  color: var(--cream-bright);
  white-space: pre-wrap;
  margin-bottom: 1.4em;
}
.action {
  color: var(--cream-dim);
  font-style: italic;
  margin-bottom: 1.2em;
}
.action-glyph { color: var(--rose-ember); font-style: normal; margin-right: 0.4em; }
.keepsake-plate { margin: 1.5em 0; text-align: center; }
.keepsake-plate img {
  max-width: 100%;
  border: 1px solid ${rc.border};
  display: block;
  margin: 0 auto;
}
.keepsake-plate figcaption {
  font-size: 12px;
  font-style: italic;
  color: var(--cream-faint);
  margin-top: 0.5em;
  letter-spacing: 0.03em;
}
.ending-mark {
  text-align: center;
  font-family: 'Cinzel', serif;
  color: ${rc.accent};
  letter-spacing: 0.4em;
  font-size: 13px;
  margin: 2.5em 0;
}
.section-title {
  font-family: 'Cinzel', serif;
  font-size: 11px;
  letter-spacing: 0.35em;
  color: ${rc.accent};
  text-align: center;
  margin: 2.5em 0 1.2em;
}
.reveal-text {
  font-style: italic;
  color: var(--cream-dim);
  line-height: 1.8;
  white-space: pre-wrap;
}
.meta-question {
  color: var(--cream-bright);
  padding: 10px 16px;
  border-left: 2px solid ${rc.border};
  background: rgba(28,22,44,0.35);
  margin-bottom: 1em;
}
.meta-answer {
  color: var(--cream);
  margin-bottom: 1.5em;
  white-space: pre-wrap;
}
footer {
  font-size: 11px;
  color: var(--cream-faint);
  font-style: italic;
  text-align: center;
  margin-top: 2em;
}
@media print {
  body { background: #fff !important; color: #111 !important; }
  .narration { color: #111 !important; }
  .action { color: #444 !important; }
  .teaser { color: #555 !important; }
}
`.trim();

  const entryBlocks = entries.map((entry) => {
    if (entry.type === "narration") {
      const text = escapeHtml(entry.text).replace(/\n\n/g, "</p><p class=\"narration\">").replace(/\n/g, "<br>");
      const imgBlock =
        entry.illustration?.status === "ready" && entry.illustration.url
          ? `<figure class="keepsake-plate"><img src="${escapeHtml(entry.illustration.url)}" alt="${escapeHtml(entry.illustration.caption || "")}" loading="lazy">${entry.illustration.caption ? `<figcaption>${escapeHtml(entry.illustration.caption)}</figcaption>` : ""}</figure>`
          : "";
      return `<p class="narration">${text}</p>${imgBlock}`;
    }
    if (entry.type === "action" && entry.text) {
      return `<p class="action"><span class="action-glyph" aria-hidden="true">›</span>${escapeHtml(entry.text)}</p>`;
    }
    return "";
  }).filter(Boolean);

  const endingBlock = ended
    ? `<div class="ending-mark">❦ The Hour Is Spent ❦</div>`
    : "";

  const revealBlock = revealText
    ? `<hr><section><h2 class="section-title">✦ The Hidden Hour ✦</h2><p class="reveal-text">${escapeHtml(revealText)}</p></section>`
    : "";

  const metaBlocks = (metaMessages || []).map((m) => {
    if (m.role === "user") {
      return `<p class="meta-question">${escapeHtml(m.text)}</p>`;
    }
    return `<p class="meta-answer">${escapeHtml(m.text)}</p>`;
  });

  const metaBlock = metaBlocks.length > 0
    ? `<hr><section><h2 class="section-title">Director's Commentary</h2>${metaBlocks.join("\n")}</section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(premise.title)} — The Borrowed Hour</title>
<style>${css}</style>
</head>
<body>
<h1>${escapeHtml(premise.title)}</h1>
<div class="realm-label">${escapeHtml(premise.realmLabel || realm.toUpperCase())}</div>
${premise.teaser ? `<blockquote class="teaser">${escapeHtml(premise.teaser)}</blockquote>` : ""}
<hr>
${entryBlocks.join("\n")}
${endingBlock}
${revealBlock}
${metaBlock}
<hr>
<footer>The Borrowed Hour</footer>
</body>
</html>`;
}
