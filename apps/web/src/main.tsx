import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Providers } from "@/app/providers";
import { AppRouter } from "@/app/router";
import "./index.css";

// ADR-005: service worker (апп-ын бүрхүүл, push). Шинэ хувилбар гарвал автоматаар шинэчилнэ.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <AppRouter />
    </Providers>
  </StrictMode>,
);
