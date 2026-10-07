import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/i18n";
import "@/index.css";
import "@/workflows/styles.css";
import { registerDemoTools } from "@/demo/webmcp";

registerDemoTools();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
