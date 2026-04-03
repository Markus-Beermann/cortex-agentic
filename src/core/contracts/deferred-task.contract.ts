import { z } from "zod";

import { IdentifierSchema, TimestampSchema } from "./shared.contract";

export const DeferredTaskStatusSchema = z.enum(["pending", "released"]);

export const DeferredTaskSchema = z.object({
  id: IdentifierSchema,
  addressee: z.string().min(1),
  goal: z.string().min(1),
  context: z.record(z.string(), z.unknown()).nullable().default(null),
  status: DeferredTaskStatusSchema,
  createdAt: TimestampSchema,
  releasedAt: TimestampSchema.nullable().default(null),
  createdBy: z.string().min(1)
});

export type DeferredTask = z.infer<typeof DeferredTaskSchema>;
export type DeferredTaskStatus = z.infer<typeof DeferredTaskStatusSchema>;

export function validateDeferredTask(value: unknown): DeferredTask {
  return DeferredTaskSchema.parse(value);
}
