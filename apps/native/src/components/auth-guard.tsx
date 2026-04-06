import { useAuth } from "@clerk/react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { LoadingScreen } from "./loading-screen";

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}
