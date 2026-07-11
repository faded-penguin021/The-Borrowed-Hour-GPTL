import React, { useEffect, useSyncExternalStore } from "react";
import type { StreamingStore } from "../context/storyReducer";

interface StreamingNarrationProps {
  store: StreamingStore;
  scrollRef?: React.RefObject<HTMLElement | null>;
}

export function StreamingNarration({ store, scrollRef }: StreamingNarrationProps) {
  const text = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    if (!scrollRef?.current) return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text, scrollRef]);

  return <span>{text}</span>;
}
