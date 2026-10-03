import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ToastProvider } from "./ui/Toast.js";
import { initTheme } from "./ui/theme.js";
import "./index.css";

initTheme();

const container = document.getElementById("root");
if (container === null) {
  throw new Error("No se encontro el elemento #root");
}

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
