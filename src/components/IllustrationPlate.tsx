import React, { useEffect, useState } from "react";
import type { Illustration } from "../types";

// Renders one illustration plate beneath a narration entry. Four states:
//   pending  → blurred sepia placeholder, then a "darkroom developing" reveal
//   ready    → framed image with a player-facing manuscript caption
//   failed   → "PLATE MISSING" stamp that fades out
//   vaulted  → never rendered here (caller filters those out)
//
// The caption is the Art Director's player-safe `caption` field — a purely
// descriptive line, like the engraving beneath a plate. The GM-facing
// `milestoneReason` (gate justification) is intentionally NOT shown: surfacing
// it leaks epistemic judgement ("routine conversation, no significant reveal").
//
// The reveal animation is CSS-driven; we just toggle `.is-developed` once the
// image element has actually loaded so blur lifts only when bytes are ready.
interface IllustrationPlateProps {
  plate?: Illustration;
  realm?: string;
}

export function IllustrationPlate({ plate, realm }: IllustrationPlateProps) {
  const [developed, setDeveloped] = useState(false);
  useEffect(() => { if (plate?.status !== "ready") setDeveloped(false); }, [plate?.status, plate?.url]);

  useEffect(() => {
    const url = plate?.url;
    if (typeof url === "string" && url.startsWith("blob:")) {
      return () => { try { URL.revokeObjectURL(url); } catch (_) {} };
    }
  }, [plate?.url]);

  // `vaulted` is filtered out by the caller and isn't part of IllustrationStatus,
  // but keep the defensive guard so a stray value never renders a broken plate.
  if (!plate || (plate.status as string) === "vaulted") return null;

  const realmColor = realm ? `var(--${realm}-border)` : "rgba(232,222,197,0.18)";
  const frameStyle = { borderColor: realmColor };

  if (plate.status === "failed") {
    return (
      <figure className="codex-plate" style={frameStyle} aria-hidden="true">
        <div className="codex-plate-frame">
          <div className="codex-plate-missing"><span className="divider-ornament">PLATE MISSING</span></div>
        </div>
      </figure>
    );
  }

  if (plate.status === "pending") {
    return (
      <figure className="codex-plate" style={frameStyle}>
        <div className="codex-plate-frame">
          <div className="codex-plate-pending" aria-label="An illustration is developing">
            <span className="divider-ornament">DEVELOPING</span>
          </div>
        </div>
      </figure>
    );
  }

  return (
    <figure className="codex-plate" style={frameStyle}>
      <div className="codex-plate-frame">
        <img
          src={plate.url}
          alt={plate.caption || "illustration plate"}
          className={`codex-plate-img${developed ? " is-developed" : ""}`}
          onLoad={() => setDeveloped(true)}
          onError={() => setDeveloped(false)}
          draggable={false}
        />
      </div>
      {plate.caption && (
        <figcaption className="codex-plate-caption">{plate.caption}</figcaption>
      )}
    </figure>
  );
}
