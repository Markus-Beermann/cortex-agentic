import type { ReactNode } from "react";

import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { AppHeader } from "@/components/app-header";
import { AuthGuard } from "@/components/auth-guard";
import { ChatScreen } from "@/components/chat-screen";
import { DeferredTasksScreen } from "@/components/deferred-tasks-screen";
import { RunDetailScreen } from "@/components/run-detail-screen";
import { RunListScreen } from "@/components/run-list-screen";
import { SignInScreen } from "@/components/sign-in-screen";

function RunDetailWrapper(): ReactNode {
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("id");

  if (!runId) {
    return <Navigate to="/" replace />;
  }

  return <RunDetailScreen runId={runId} />;
}

export function App(): ReactNode {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/sign-in" element={<SignInScreen />} />
        <Route
          path="/"
          element={(
            <AuthGuard>
              <RunListScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/runs"
          element={(
            <AuthGuard>
              <RunDetailWrapper />
            </AuthGuard>
          )}
        />
        <Route
          path="/deferred-tasks"
          element={(
            <AuthGuard>
              <DeferredTasksScreen />
            </AuthGuard>
          )}
        />
        <Route
          path="/chat"
          element={(
            <AuthGuard>
              <ChatScreen />
            </AuthGuard>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
