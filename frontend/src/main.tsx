import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ToastProvider } from "./ui/Toast.js";
import ErrorBoundary from "./ui/ErrorBoundary.js";
import { initTheme } from "./ui/theme.js";
import { initDensidad } from "./ui/density.js";
import "./index.css";

initTheme();
initDensidad();

const container = document.getElementById("root");
if (container === null) {
  throw new Error("No se encontró el elemento #root");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
