import { z } from "zod";

import { IdentifierSchema, TimestampSchema } from "./shared.contract";

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "waiting_approval",
  "completed",
  "failed"
]);

export const RunStateSchema = z.object({
  id: IdentifierSchema,
  projectId: IdentifierSchema,
  goal: z.string().min(1),
  status: RunStatusSchema,
  activeTaskId: IdentifierSchema.nullable(),
  pendingApprovalIds: z.array(IdentifierSchema).default([]),
  queuedTaskIds: z.array(IdentifierSchema).default([]),
  completedTaskIds: z.array(IdentifierSchema).default([]),
  outputIds: z.array(IdentifierSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type RunState = z.infer<typeof RunStateSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;

export function validateRunState(value: unknown): RunState {
  return RunStateSchema.parse(value);
}
