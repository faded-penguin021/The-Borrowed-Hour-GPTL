// Vitest runs in Node, which can't process Vite's `?raw` CSS transforms.
// Mock any raw CSS imports here to prevent test crashes.
import { vi } from "vitest";
vi.mock("../styles/theme.css?raw", () => ({ default: "body { background: #0a0814; }" }));
