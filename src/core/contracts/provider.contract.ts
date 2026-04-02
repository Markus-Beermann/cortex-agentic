import { z } from "zod";

import { ApprovalModeSchema } from "./shared.contract";
import { ContextSelectionSchema } from "./context-selection.contract";
import { OutputSchema } from "./output.contract";
import { ProjectContextSchema } from "./project-context.contract";
import {
  IdentifierSchema,
  RoleIdSchema,
  TimestampSchema
} from "./shared.contract";
import { RunStatusSchema } from "./run-state.contract";
import { TaskSchema } from "./task.contract";

export const CompletedWorkItemSchema = z.object({
  taskId: IdentifierSchema,
  roleId: RoleIdSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  outputSummary: z.string().min(1),
  nextActionKind: z.enum(["complete", "handoff"])
});

export const RunProgressSchema = z.object({
  status: RunStatusSchema,
  activeTaskId: IdentifierSchema.nullable(),
  pendingApprovalIds: z.array(IdentifierSchema).default([]),
  queuedTaskIds: z.array(IdentifierSchema).default([]),
  completedTaskIds: z.array(IdentifierSchema).default([]),
  outputIds: z.array(IdentifierSchema).default([]),
  completedWork: z.array(CompletedWorkItemSchema).default([])
});

export const ExecutionProfileSchema = z.object({
  workType: z.enum(["content", "code", "analysis", "unknown"]),
  complexity: z.enum(["simple", "standard", "complex"]),
  routingStrategy: z.enum(["direct-implementer", "plan-then-implement", "full-pipeline"]),
  reviewMode: z.enum(["skip-review", "review-required"]),
  rationale: z.array(z.string()).default([])
});

export const ProviderRequestSchema = z.object({
  id: IdentifierSchema,
  providerId: z.string().min(1),
  runId: IdentifierSchema,
  taskId: IdentifierSchema,
  roleId: RoleIdSchema,
  technicalName: z.string().min(1),
  personaName: z.string().min(1),
  displayName: z.string().min(1),
  bootstrapPath: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  allowedHandoffs: z.array(RoleIdSchema).default([]),
  projectContext: ProjectContextSchema,
  selectedContext: ContextSelectionSchema,
  executionProfile: ExecutionProfileSchema,
  handoffApprovalMode: ApprovalModeSchema,
  runProgress: RunProgressSchema,
  task: TaskSchema,
  createdAt: TimestampSchema
});

export const ProviderResponseSchema = z.object({
  providerId: z.string().min(1),
  adapterVersion: z.literal("v1"),
  model: z.string().min(1).nullable(),
  diagnostics: z.array(z.string()).default([]),
  output: OutputSchema
});

export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
export type CompletedWorkItem = z.infer<typeof CompletedWorkItemSchema>;
export type RunProgress = z.infer<typeof RunProgressSchema>;
export type ExecutionProfile = z.infer<typeof ExecutionProfileSchema>;

export function validateProviderRequest(value: unknown): ProviderRequest {
  return ProviderRequestSchema.parse(value);
}

export function validateProviderResponse(value: unknown): ProviderResponse {
  return ProviderResponseSchema.parse(value);
}
