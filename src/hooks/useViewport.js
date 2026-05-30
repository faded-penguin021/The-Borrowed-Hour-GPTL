// @ts-check
import { useEffect } from "react";

export function useViewport() {
  useEffect(() => {
    let lastH = -1;
    let rafId = 0;
    const apply = () => {
      rafId = 0;
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (h === lastH) return;
      lastH = h;
      document.documentElement.style.setProperty("--app-vh", `${h}px`);
    };
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(apply);
    };
    apply();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);
}
