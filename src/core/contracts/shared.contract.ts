import { z } from "zod";

export const IdentifierSchema = z.string().min(1);
export const TimestampSchema = z.string().datetime({ offset: true });

export const ApprovalModeSchema = z.enum(["auto", "needs-approval", "blocked"]);
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;

export const RoleIdSchema = z.enum([
  "coordinator",
  "architect",
  "implementer",
  "reviewer"
]);
export type RoleId = z.infer<typeof RoleIdSchema>;

