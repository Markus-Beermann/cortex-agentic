import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { CLERK_PUBLISHABLE_KEY } from "./env";
import "./styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found.");
}

createRoot(container).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
