import { z } from "zod";

import { IdentifierSchema, RoleIdSchema, TimestampSchema } from "./shared.contract";

export const ApprovalRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected"
]);

export const ApprovalSubjectTypeSchema = z.enum(["task", "handoff"]);

export const ApprovalRequestSchema = z.object({
  id: IdentifierSchema,
  runId: IdentifierSchema,
  subjectType: ApprovalSubjectTypeSchema,
  subjectId: IdentifierSchema,
  requestedRole: RoleIdSchema,
  proposedTaskId: IdentifierSchema.nullable(),
  summary: z.string().min(1),
  reason: z.string().min(1),
  status: ApprovalRequestStatusSchema,
  createdAt: TimestampSchema,
  decidedAt: TimestampSchema.nullable()
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type ApprovalRequestStatus = z.infer<typeof ApprovalRequestStatusSchema>;
export type ApprovalSubjectType = z.infer<typeof ApprovalSubjectTypeSchema>;

export function validateApprovalRequest(value: unknown): ApprovalRequest {
  return ApprovalRequestSchema.parse(value);
}

