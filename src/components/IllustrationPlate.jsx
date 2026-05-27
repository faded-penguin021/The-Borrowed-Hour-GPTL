import React, { useEffect, useState } from "react";

// Renders one illustration plate beneath a narration entry. Four states:
//   pending  → blurred sepia placeholder, then a "darkroom developing" reveal
//   ready    → framed image with caption (milestone reason)
//   failed   → "PLATE MISSING" stamp that fades out
//   vaulted  → never rendered here (caller filters those out)
//
// The reveal animation is CSS-driven; we just toggle `.is-developed` once the
// image element has actually loaded so blur lifts only when bytes are ready.
export function IllustrationPlate({ plate, realm }) {
  const [developed, setDeveloped] = useState(false);
  useEffect(() => { if (plate?.status !== "ready") setDeveloped(false); }, [plate?.status, plate?.url]);

  if (!plate || plate.status === "vaulted") return null;

  const realmColor = realm ? `var(--${realm}-border)` : "rgba(232,222,197,0.18)";
  const frameStyle = { borderColor: realmColor };

  if (plate.status === "failed") {
    return /* @__PURE__ */ React.createElement("figure", {
      className: "codex-plate",
      style: frameStyle,
      "aria-hidden": "true"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "codex-plate-frame"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "codex-plate-missing"
    }, "❦ PLATE MISSING ❦")));
  }

  if (plate.status === "pending") {
    return /* @__PURE__ */ React.createElement("figure", {
      className: "codex-plate",
      style: frameStyle
    }, /* @__PURE__ */ React.createElement("div", {
      className: "codex-plate-frame"
    }, /* @__PURE__ */ React.createElement("div", {
      className: "codex-plate-pending",
      "aria-label": "An illustration is developing"
    }, "❦ DEVELOPING ❦")));
  }

  // ready
  return /* @__PURE__ */ React.createElement("figure", {
    className: "codex-plate",
    style: frameStyle
  }, /* @__PURE__ */ React.createElement("div", {
    className: "codex-plate-frame"
  }, /* @__PURE__ */ React.createElement("img", {
    src: plate.url,
    alt: plate.milestoneReason || "illustration plate",
    className: `codex-plate-img${developed ? " is-developed" : ""}`,
    onLoad: () => setDeveloped(true),
    onError: () => setDeveloped(false),
    draggable: false
  })), plate.milestoneReason && /* @__PURE__ */ React.createElement("figcaption", {
    className: "codex-plate-caption"
  }, plate.milestoneReason));
}
