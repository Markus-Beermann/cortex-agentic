import { z } from "zod";

import { IdentifierSchema, TimestampSchema } from "./shared.contract";

export const ReflectionPerspectiveSchema = z.enum([
  "user_intent",
  "communication",
  "friction",
  "risk",
  "motivation"
]);

export const ReflectionReportSchema = z.object({
  id: IdentifierSchema,
  runId: IdentifierSchema,
  taskId: IdentifierSchema.nullable(),
  perspective: ReflectionPerspectiveSchema,
  summary: z.string().min(1),
  observations: z.array(z.string()).min(1),
  tensions: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  createdAt: TimestampSchema
});

export type ReflectionPerspective = z.infer<typeof ReflectionPerspectiveSchema>;
export type ReflectionReport = z.infer<typeof ReflectionReportSchema>;

export function validateReflectionReport(value: unknown): ReflectionReport {
  return ReflectionReportSchema.parse(value);
}

