import { z } from "zod";

import { IdentifierSchema, RoleIdSchema } from "./shared.contract";

export const RoleSchema = z.object({
  id: IdentifierSchema,
  roleId: RoleIdSchema,
  summary: z.string().min(1),
  boundaries: z.array(z.string()).default([])
});

export type Role = z.infer<typeof RoleSchema>;

