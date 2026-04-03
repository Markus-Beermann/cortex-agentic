import { z } from "zod";

import { IdentifierSchema, RoleIdSchema } from "./shared.contract";

export const AgentRoleIdSchema = z.union([
  RoleIdSchema,
  z.literal("hermes"),
  z.literal("sigmund")
]);

export const RegistryEntrySchema = z.object({
  id: IdentifierSchema,
  roleId: AgentRoleIdSchema,
  technicalName: z.string().min(1),
  personaName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  displayName: z.string().min(1),
  bootstrapPath: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  allowedHandoffs: z.array(RoleIdSchema).default([])
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type AgentRoleId = z.infer<typeof AgentRoleIdSchema>;

export function validateRegistryEntry(value: unknown): RegistryEntry {
  return RegistryEntrySchema.parse(value);
}
