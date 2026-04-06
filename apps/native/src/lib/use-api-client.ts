"use client";

import { createCortexApiClient } from "@cortex/api-client";
import { useAuth } from "@clerk/react";
import { useMemo } from "react";

import { RAILWAY_URL } from "@/env";

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
        baseUrl: RAILWAY_URL ?? "",
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
