import { z } from "zod";

import {
  ApprovalModeSchema,
  IdentifierSchema,
  RoleIdSchema,
  TimestampSchema
} from "./shared.contract";

export const TaskStatusSchema = z.enum([
  "queued",
  "in_progress",
  "completed",
  "failed"
]);

export const TaskSchema = z.object({
  id: IdentifierSchema,
  runId: IdentifierSchema,
  projectId: IdentifierSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  requestedRole: RoleIdSchema,
  constraints: z.array(z.string()).default([]),
  inputContext: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).min(1),
  status: TaskStatusSchema,
  approvalMode: ApprovalModeSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export function validateTask(value: unknown): Task {
  return TaskSchema.parse(value);
}

