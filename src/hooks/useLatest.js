// @ts-check
import { useRef } from "react";

/**
 * Mirror the latest value of `value` into a ref, updated synchronously during
 * render. Use this when a callback needs the freshest value but you do NOT want
 * the callback (or a memoized context value that holds it) to depend on that
 * value as a hook dependency.
 *
 * The assignment happens in the render pass — NOT in an effect — so microtasks,
 * event callbacks, and streaming continuations always observe the current value
 * rather than a one-render-stale one.
 *
 * @template T
 * @param {T} value
 * @returns {{ current: T }}
 */
export function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
