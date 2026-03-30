import { z } from "zod";

export const ContextPurposeSchema = z.enum([
  "planning",
  "implementation",
  "review"
]);

export const ContextSelectionSchema = z.object({
  purpose: ContextPurposeSchema,
  summary: z.string().min(1),
  focusPaths: z.array(z.string()).default([]),
  relevantDocuments: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

export const ProjectContextsSchema = z.object({
  planningContext: ContextSelectionSchema.extend({
    purpose: z.literal("planning")
  }),
  implementationContext: ContextSelectionSchema.extend({
    purpose: z.literal("implementation")
  }),
  reviewContext: ContextSelectionSchema.extend({
    purpose: z.literal("review")
  })
});

export type ContextPurpose = z.infer<typeof ContextPurposeSchema>;
export type ContextSelection = z.infer<typeof ContextSelectionSchema>;
export type ProjectContexts = z.infer<typeof ProjectContextsSchema>;

export function validateContextSelection(value: unknown): ContextSelection {
  return ContextSelectionSchema.parse(value);
}

