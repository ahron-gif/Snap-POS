import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { handle401, isAuthEndpoint, isTokenExpiredOrMissing } from "./utils/authManager.ts";
import setupLocatorUI from "@locator/runtime";

if (process.env.NODE_ENV === "development") {
  setupLocatorUI();
}

// ─── Global fetch interceptor: 401 → refresh → retry ──────────────────────
const originalFetch = window.fetch.bind(window);

// Expose original fetch so authManager can call the refresh endpoint
// without triggering this interceptor recursively.
(window as any).__ORIGINAL_FETCH__ = originalFetch;

window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  try {
    const response = await originalFetch(...args);

    if (response.status === 401) {
      const url = typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : String(args[0]);

      console.warn('[fetch-interceptor] 401 detected | url:', url);

      if (!isAuthEndpoint(url)) {
        const result = await handle401(url);

        if (result === 'refreshed') {
          const token = localStorage.getItem('accessToken');
          const [input, init] = args;
          const retryInit: RequestInit = { ...(init || {}) };
          const existingHeaders = retryInit.headers instanceof Headers
            ? Object.fromEntries((retryInit.headers as Headers).entries())
            : (retryInit.headers || {}) as Record<string, string>;

          retryInit.headers = { ...existingHeaders, Authorization: `Bearer ${token}` };
          return originalFetch(input, retryInit);
        }
      }
    }

    return response;
  } catch (error) {
    // ─── CORS-blocked 401 handling ───────────────────────────────────
    // When the server returns 401 WITHOUT CORS headers, the browser blocks
    // the response entirely. JavaScript sees a TypeError("Failed to fetch")
    // instead of response.status === 401. The Network tab shows "401" but
    // our code only gets a generic network error.
    //
    // To handle this: if a fetch throws AND the token is expired/missing,
    // treat it as a 401 and trigger the refresh/logout flow.
    // ─────────────────────────────────────────────────────────────────
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const url = typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : String(args[0]);

      if (!isAuthEndpoint(url) && isTokenExpiredOrMissing()) {
        console.warn('[fetch-interceptor] CORS-blocked request + expired token → treating as 401 | url:', url);
        await handle401(url);
      }
    }

    throw error;
  }
};
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ThemeProvider>
  </StrictMode>
);
