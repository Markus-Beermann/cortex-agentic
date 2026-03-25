import { z } from "zod";

import { IdentifierSchema, TimestampSchema } from "./shared.contract";

export const RunEventSchema = z.object({
  id: IdentifierSchema,
  runId: IdentifierSchema,
  eventType: z.string().min(1),
  timestamp: TimestampSchema,
  payload: z.record(z.string(), z.unknown())
});

export type RunEvent = z.infer<typeof RunEventSchema>;

export function validateRunEvent(value: unknown): RunEvent {
  return RunEventSchema.parse(value);
}

