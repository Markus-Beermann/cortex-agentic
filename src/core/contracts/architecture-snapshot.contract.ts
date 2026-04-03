import { z } from "zod";

import { IdentifierSchema, TimestampSchema } from "./shared.contract";

export const ArchitectureSnapshotSchema = z.object({
  id: IdentifierSchema,
  title: z.string().min(1),
  mermaid: z.string().min(1),
  notes: z.string().nullable().default(null),
  createdAt: TimestampSchema
});

export type ArchitectureSnapshot = z.infer<typeof ArchitectureSnapshotSchema>;

export function validateArchitectureSnapshot(value: unknown): ArchitectureSnapshot {
  return ArchitectureSnapshotSchema.parse(value);
}
