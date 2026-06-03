import React from "react";
import { RotateCcw, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-twilight text-cream font-body">
        <div className="max-w-[520px] text-center">
          <div className="font-display tracking-[0.4em] text-[10px] text-cream-dim mb-2.5">
            <span className="opacity-40">—</span> THE PAGE FALTERED <span className="opacity-40">—</span>
          </div>
          <h2 className="font-display text-[22px] text-cream-bright tracking-[0.04em] mb-[14px]">
            Something in the chronicle broke mid-stroke.
          </h2>
          <p className="italic leading-[1.6] text-cream-dim mb-[18px]">
            Your saved hours are kept. You can try to recover the page in place, or reload to start fresh. If this keeps happening, the model may be returning state in an unexpected shape — try a different engine.
          </p>
          <pre className="text-[11px] text-left bg-black/30 border border-[rgba(217,122,122,0.35)] py-2 px-2.5 rounded-[4px] text-rose-ember whitespace-pre-wrap break-words max-h-[140px] overflow-auto mb-[18px]">
            {msg}
          </pre>
          <div className="flex gap-2.5 justify-center flex-wrap">
            <button
              onClick={reset}
              className="bg-transparent border border-rose-gold/50 text-cream-bright py-2 px-[18px] font-display text-[10px] tracking-[0.25em] cursor-pointer"
            >
              <RefreshCw size={12} strokeWidth={1.5} className="mr-1" /> TRY AGAIN
            </button>
            <button
              onClick={reload}
              className="bg-transparent border border-cream/30 text-cream-dim py-2 px-[18px] font-display text-[10px] tracking-[0.25em] cursor-pointer"
            >
              <RotateCcw size={12} strokeWidth={1.5} className="mr-1" /> RELOAD
            </button>
          </div>
        </div>
      </div>
    );
  }
}
