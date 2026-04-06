const rawClerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const rawRailwayUrl = import.meta.env.VITE_RAILWAY_URL as string | undefined;

if (!rawClerkPublishableKey || rawClerkPublishableKey.length === 0) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required");
}

if (!rawRailwayUrl || rawRailwayUrl.length === 0) {
  throw new Error("VITE_RAILWAY_URL is required");
}

export const CLERK_PUBLISHABLE_KEY: string = rawClerkPublishableKey;
export const RAILWAY_URL: string = rawRailwayUrl;
