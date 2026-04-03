import { describe, expect, it } from "vitest";

import { getHermesConfig } from "../../src/hermes/config";

describe("Hermes config", () => {
  it("defaults HERMES_MAIL_FROM to onboarding@resend.dev", () => {
    const config = getHermesConfig({
      ANTHROPIC_API_KEY: "test",
      DATABASE_PUBLIC_URL: "postgres://example"
    });

    expect(config.mailFrom).toBe("onboarding@resend.dev");
  });

  it("prefers explicit HERMES_MAIL_FROM when provided", () => {
    const config = getHermesConfig({
      ANTHROPIC_API_KEY: "test",
      DATABASE_PUBLIC_URL: "postgres://example",
      HERMES_MAIL_FROM: "hello@example.com"
    });

    expect(config.mailFrom).toBe("hello@example.com");
  });
});
