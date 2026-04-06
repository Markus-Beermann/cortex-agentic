"use client";

import { createCortexApiClient } from "@cortex/api-client";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

type UseApiClientResult = {
  apiClient: ReturnType<typeof createCortexApiClient>;
  isAuthLoaded: boolean;
  sessionId: string | null;
};

export function useApiClient(): UseApiClientResult {
  const { getToken, isLoaded, userId } = useAuth();

  const apiClient = useMemo(
    () =>
      createCortexApiClient({
        baseUrl: process.env.NEXT_PUBLIC_RAILWAY_URL ?? "",
        getAccessToken: async () => getToken()
      }),
    [getToken]
  );

  return {
    apiClient,
    isAuthLoaded: isLoaded,
    sessionId: userId ?? null
  };
}
