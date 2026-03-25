import { z } from "zod";

import {
  ApprovalModeSchema,
  IdentifierSchema,
  RoleIdSchema,
  TimestampSchema
} from "./shared.contract";

export const OutputArtifactSchema = z.object({
  kind: z.enum(["note", "file", "decision"]),
  path: z.string().min(1).optional(),
  content: z.string().min(1),
  note: z.string().min(1).optional()
});

export const NextActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("complete")
  }),
  z.object({
    kind: z.literal("handoff"),
    targetRole: RoleIdSchema,
    taskTitle: z.string().min(1),
    taskObjective: z.string().min(1),
    acceptanceCriteria: z.array(z.string()).min(1),
    context: z.array(z.string()).default([]),
    rationale: z.string().min(1),
    approvalMode: ApprovalModeSchema
  })
]);

export const OutputSchema = z.object({
  id: IdentifierSchema,
  taskId: IdentifierSchema,
  roleId: RoleIdSchema,
  summary: z.string().min(1),
  decisions: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  artifacts: z.array(OutputArtifactSchema).default([]),
  nextAction: NextActionSchema,
  createdAt: TimestampSchema
});

export type OutputArtifact = z.infer<typeof OutputArtifactSchema>;
export type NextAction = z.infer<typeof NextActionSchema>;
export type Output = z.infer<typeof OutputSchema>;

export function validateOutput(value: unknown): Output {
  return OutputSchema.parse(value);
}

