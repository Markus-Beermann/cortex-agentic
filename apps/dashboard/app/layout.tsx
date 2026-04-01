import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "Cortex Dashboard",
  description: "Run monitoring dashboard for the Cortex Agentic System."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111f"
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="en">
      <body className="app-body">
        <ClerkProvider
          afterSignOutUrl="/sign-in"
          signInFallbackRedirectUrl="/"
          signInUrl="/sign-in"
          signUpFallbackRedirectUrl="/"
        >
          <AppHeader />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
