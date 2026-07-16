import { describe, it, expect } from "vitest";
import { buildKeepsakeHTML, escapeHtml } from "../export/keepsake";
import type { Entry, MetaMessage, Premise } from "../types";

// Freezes the HTML-escaping contract of the keepsake export. Every dynamic
// interpolation site in buildKeepsakeHTML's template (grep the source for `${`)
// funnels attacker/model-controlled text through escapeHtml — narration and
// action carry model output, premise fields carry Wild-mode user input, and the
// reveal/meta/director's-notes carry both. A regression that drops an escape
// turns the downloaded keepsake .html into stored XSS the moment it's opened.
//
// The CSS `${rc.*}` sites are intentionally excluded: they read from the fixed
// REALM_COLORS record keyed by realm (with an `echo` fallback), never raw input.
// The realm-fallback test below pins that no unlisted realm can reach the CSS.

// A payload that exercises both tag-injection (<script>) and attribute-breakout
// (the embedded double quote would escape an unquoted or double-quoted attr).
const XSS = `<script>alert("pwn")</script>`;

/** Asserts a payload placed at some site survived as escaped text, not markup. */
function expectNeutralized(html: string) {
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("</script>");
  // Raw double-quote from the payload must be entity-encoded, so the verbatim
  // `alert("pwn")` (with a real quote) can never appear in the output.
  expect(html).not.toContain(`alert("pwn")`);
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&quot;");
}

const basePremise: Premise = {
  id: "p1",
  realm: "echo",
  realmLabel: "ECHO",
  title: "A Quiet Title",
  teaser: "A quiet teaser.",
  seed: "seed",
  gmNote: "note",
};

function build(overrides: {
  premise?: Partial<Premise>;
  entries?: Entry[];
  revealText?: string;
  metaMessages?: MetaMessage[];
  ended?: boolean;
  hiddenState?: string;
}): string {
  return buildKeepsakeHTML({
    premise: { ...basePremise, ...overrides.premise },
    entries: overrides.entries ?? [],
    revealText: overrides.revealText,
    metaMessages: overrides.metaMessages,
    ended: overrides.ended ?? false,
    hiddenState: overrides.hiddenState,
  });
}

describe("escapeHtml", () => {
  it("encodes all five HTML-significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("escapes ampersand first so entities do not double-decode to markup", () => {
    // `&lt;` must not become a live `<` — the & is encoded, yielding `&amp;lt;`.
    expect(escapeHtml("&lt;script&gt;")).toBe("&amp;lt;script&amp;gt;");
  });

  it("coerces non-strings without throwing", () => {
    expect(escapeHtml(null as unknown as string)).toBe("null");
    expect(escapeHtml(undefined as unknown as string)).toBe("undefined");
  });
});

describe("buildKeepsakeHTML escapes every interpolation site", () => {
  it("narration text", () => {
    const html = build({
      entries: [{ type: "narration", text: XSS, fullyRevealed: true }],
    });
    expectNeutralized(html);
  });

  it("narration illustration url (img src)", () => {
    const html = build({
      entries: [
        {
          type: "narration",
          text: "plain",
          fullyRevealed: true,
          illustration: { status: "ready", url: `x"><script>alert("pwn")</script>` },
        },
      ],
    });
    expect(html).toContain("<img");
    expectNeutralized(html);
    // The breakout sequence closing the src attr must not survive intact.
    expect(html).not.toContain(`"><script`);
  });

  it("narration illustration caption (img alt and figcaption)", () => {
    const html = build({
      entries: [
        {
          type: "narration",
          text: "plain",
          fullyRevealed: true,
          illustration: { status: "ready", url: "blob:ok", caption: XSS },
        },
      ],
    });
    expect(html).toContain("<figcaption>");
    expectNeutralized(html);
  });

  it("action text", () => {
    const html = build({
      entries: [{ type: "action", text: XSS, fullyRevealed: true }],
    });
    expect(html).toContain(`class="action"`);
    expectNeutralized(html);
  });

  it("premise title (both <title> and <h1>)", () => {
    const html = build({ premise: { title: XSS } });
    expectNeutralized(html);
    // Escaped title appears at both sites: the document <title> and the <h1>.
    const occurrences = html.split("&lt;script&gt;").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("premise realmLabel", () => {
    const html = build({ premise: { realmLabel: XSS } });
    expectNeutralized(html);
  });

  it("premise teaser", () => {
    const html = build({ premise: { teaser: XSS } });
    expect(html).toContain(`class="teaser"`);
    expectNeutralized(html);
  });

  it("reveal text (through renderInlineMarkdown)", () => {
    const html = build({ revealText: XSS });
    expect(html).toContain(`class="reveal-text"`);
    expectNeutralized(html);
  });

  it("meta question (user) and answer (assistant)", () => {
    const html = build({
      metaMessages: [
        { role: "user", text: XSS, fullyRevealed: true },
        { role: "assistant", text: XSS, fullyRevealed: true },
      ],
    });
    expect(html).toContain(`class="meta-question"`);
    expect(html).toContain(`class="meta-answer"`);
    expectNeutralized(html);
  });

  it("director's notes (hidden state)", () => {
    const html = build({ ended: true, hiddenState: XSS });
    expect(html).toContain(`class="directors-notes"`);
    expectNeutralized(html);
  });
});

describe("buildKeepsakeHTML markdown rendering cannot be abused", () => {
  it("bold/italic/code emphasis wraps only escaped content", () => {
    // renderInlineMarkdown runs AFTER escapeHtml, so a payload inside emphasis
    // markers still can't smuggle a tag — only <strong>/<em>/<code> appear.
    const html = build({ revealText: `**<script>alert("pwn")</script>**` });
    expect(html).toContain("<strong>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildKeepsakeHTML realm never reaches the CSS unchecked", () => {
  it("an unlisted realm falls back to the echo palette", () => {
    const injected = "echo; } body { background: url(javascript:alert(1)); }";
    const html = build({ premise: { realm: injected, realmLabel: "R" } });
    // The malicious realm string must not appear anywhere in the CSS block.
    expect(html).not.toContain("javascript:alert(1)");
    // Fallback palette (echo accent) is used instead.
    expect(html).toContain("#b8c8d8");
  });
});

describe("buildKeepsakeHTML entity edge cases", () => {
  it("ampersands and pre-existing entities are encoded, not passed through", () => {
    const html = build({ premise: { title: "Tom & Jerry &amp; <b>bold</b>" } });
    expect(html).toContain("Tom &amp; Jerry &amp;amp; &lt;b&gt;bold&lt;/b&gt;");
    expect(html).not.toContain("<b>bold</b>");
  });
});
