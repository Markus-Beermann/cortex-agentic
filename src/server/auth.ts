import { clerkMiddleware, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

const PUBLIC_ROUTES = new Set([
  "/health",
  "/hermes/feed-items",
  "/hermes/nightly"
]);

function readAuthorizedParties(): string[] | undefined {
  const configuredParties = process.env.CLERK_AUTHORIZED_PARTIES
    ?.split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!configuredParties || configuredParties.length === 0) {
    return undefined;
  }

  return configuredParties;
}

export function createClerkJwtMiddleware(): RequestHandler {
  return clerkMiddleware({
    ...(process.env.CLERK_JWT_KEY ? { jwtKey: process.env.CLERK_JWT_KEY } : {}),
    ...(process.env.CLERK_PUBLISHABLE_KEY ? { publishableKey: process.env.CLERK_PUBLISHABLE_KEY } : {}),
    ...(process.env.CLERK_SECRET_KEY ? { secretKey: process.env.CLERK_SECRET_KEY } : {}),
    ...(readAuthorizedParties() ? { authorizedParties: readAuthorizedParties() } : {})
  });
}

export function createRequireAuth(): RequestHandler {
  return (req, res, next) => {
    if (req.method === "OPTIONS" || PUBLIC_ROUTES.has(req.path)) {
      next();
      return;
    }

    const auth = getAuth(req);

    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
