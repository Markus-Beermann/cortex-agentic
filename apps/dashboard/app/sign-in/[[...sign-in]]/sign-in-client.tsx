"use client";

import { SignIn } from "@clerk/nextjs";

export function SignInClient() {
  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <div className="auth-grid">
          <div className="auth-copy">
            <span className="eyebrow">Cortex Access</span>
            <h1>Dashboard access requires an authenticated session.</h1>
            <p>
              Sign in with the Clerk user that Markus provisions. Everything
              else stays outside. A surprisingly healthy boundary for once.
            </p>
          </div>
          <div className="auth-card-wrap">
            <SignIn fallbackRedirectUrl="/" />
          </div>
        </div>
      </section>
    </main>
  );
}
