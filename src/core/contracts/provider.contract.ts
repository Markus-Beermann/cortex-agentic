import { z } from "zod";

import { ContextSelectionSchema } from "./context-selection.contract";
import { OutputSchema } from "./output.contract";
import { ProjectContextSchema } from "./project-context.contract";
import { IdentifierSchema, RoleIdSchema, TimestampSchema } from "./shared.contract";
import { TaskSchema } from "./task.contract";

export const ProviderRequestSchema = z.object({
  id: IdentifierSchema,
  providerId: z.string().min(1),
  runId: IdentifierSchema,
  taskId: IdentifierSchema,
  roleId: RoleIdSchema,
  technicalName: z.string().min(1),
  personaName: z.string().min(1),
  projectContext: ProjectContextSchema,
  selectedContext: ContextSelectionSchema,
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

export function validateProviderRequest(value: unknown): ProviderRequest {
  return ProviderRequestSchema.parse(value);
}

export function validateProviderResponse(value: unknown): ProviderResponse {
  return ProviderResponseSchema.parse(value);
}

