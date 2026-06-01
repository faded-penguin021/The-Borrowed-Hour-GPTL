// @ts-check
import React from "react";

/**
 * @typedef {{ children: React.ReactNode }} ErrorBoundaryProps
 * @typedef {{ error: Error | null }} ErrorBoundaryState
 */

/**
 * @extends {React.Component<ErrorBoundaryProps, ErrorBoundaryState>}
 */
export class ErrorBoundary extends React.Component {
  /** @param {ErrorBoundaryProps} props */
  constructor(props) {
    super(props);
    /** @type {ErrorBoundaryState} */
    this.state = { error: null };
  }
  /** @param {Error} error */
  static getDerivedStateFromError(error) {
    return { error };
  }
  /**
   * @param {Error} error
   * @param {React.ErrorInfo} info
   */
  componentDidCatch(error, info) {
    try {
      if (typeof console !== "undefined" && console.error) {
        console.error("[borrowed] render error caught by boundary", error, info);
      }
    } catch {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = (this.state.error && this.state.error.message) || String(this.state.error || "Unknown error");
    const reset = () => this.setState({ error: null });
    const reload = () => { try { window.location.reload(); } catch {} };
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0a0814",
          color: "#e8dec5",
          fontFamily: "'Cormorant Garamond', serif"
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div
            style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.4em", fontSize: 10, color: "#9a8d7a", marginBottom: 10 }}
          >
            ❦ THE PAGE FALTERED ❦
          </div>
          <h2
            style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: "#f4ecd8", letterSpacing: "0.04em", marginBottom: 14 }}
          >
            Something in the chronicle broke mid-stroke.
          </h2>
          <p style={{ fontStyle: "italic", lineHeight: 1.6, color: "#9a8d7a", marginBottom: 18 }}>
            Your saved hours are kept. You can try to recover the page in place, or reload to start fresh. If this keeps happening, the model may be returning state in an unexpected shape — try a different engine.
          </p>
          <pre
            style={{
              fontSize: 11,
              textAlign: "left",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(217,122,122,0.35)",
              padding: "8px 10px",
              borderRadius: 4,
              color: "#d97a7a",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 140,
              overflow: "auto",
              marginBottom: 18
            }}
          >
            {msg}
          </pre>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "transparent",
                border: "1px solid rgba(212,165,116,0.5)",
                color: "#f4ecd8",
                padding: "8px 18px",
                fontFamily: "'Cinzel', serif",
                fontSize: 10,
                letterSpacing: "0.25em",
                cursor: "pointer"
              }}
            >
              ↻ TRY AGAIN
            </button>
            <button
              onClick={reload}
              style={{
                background: "transparent",
                border: "1px solid rgba(232,222,197,0.3)",
                color: "#9a8d7a",
                padding: "8px 18px",
                fontFamily: "'Cinzel', serif",
                fontSize: 10,
                letterSpacing: "0.25em",
                cursor: "pointer"
              }}
            >
              ⟲ RELOAD
            </button>
          </div>
        </div>
      </div>
    );
  }
}
