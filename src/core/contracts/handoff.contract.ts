import { z } from "zod";

import {
  ApprovalModeSchema,
  IdentifierSchema,
  RoleIdSchema,
  TimestampSchema
} from "./shared.contract";

export const HandoffSchema = z.object({
  id: IdentifierSchema,
  runId: IdentifierSchema,
  taskId: IdentifierSchema,
  fromRole: RoleIdSchema,
  toRole: RoleIdSchema,
  rationale: z.string().min(1),
  briefing: z.array(z.string()).min(1),
  approvalMode: ApprovalModeSchema,
  createdAt: TimestampSchema
});

export type Handoff = z.infer<typeof HandoffSchema>;

export function validateHandoff(value: unknown): Handoff {
  return HandoffSchema.parse(value);
}

