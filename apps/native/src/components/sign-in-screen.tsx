import type { ReactNode } from "react";

import { SignIn, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";

export function SignInScreen(): ReactNode {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <p className="eyebrow">Cortex Access</p>
        <SignIn fallbackRedirectUrl="/" />
      </div>
    </main>
  );
}
