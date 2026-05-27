import "./storage/shim.js";
import "./styles/tailwind.css";
import "./styles/theme.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { App } from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
