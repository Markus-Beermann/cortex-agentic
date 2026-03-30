import { z } from "zod";

import { ProjectContextsSchema } from "./context-selection.contract";
import { IdentifierSchema } from "./shared.contract";

export const ProjectDocumentKindSchema = z.enum([
  "governance",
  "bootstrap",
  "architecture",
  "log",
  "manifest",
  "config"
]);

export const ProjectDocumentSchema = z.object({
  path: z.string().min(1),
  kind: ProjectDocumentKindSchema
});

export const ProjectRepositorySchema = z.object({
  isGitRepo: z.boolean(),
  currentBranch: z.string().min(1).nullable(),
  remotes: z.array(z.string()).default([]),
  isDirty: z.boolean(),
  changedFiles: z.array(z.string()).default([]),
  untrackedFiles: z.array(z.string()).default([])
});

export const ProjectStackSchema = z.object({
  packageManager: z.enum(["npm", "pnpm", "yarn", "bun", "unknown"]),
  manifests: z.array(z.string()).default([]),
  configs: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([])
});

export const ProjectContextSchema = z.object({
  projectId: IdentifierSchema,
  rootPath: z.string().min(1),
  runtimePath: z.string().min(1),
  documents: z.array(ProjectDocumentSchema).default([]),
  repository: ProjectRepositorySchema,
  stack: ProjectStackSchema,
  focusPaths: z.array(z.string()).default([]),
  contexts: ProjectContextsSchema,
  notes: z.array(z.string()).default([])
});

export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
export type ProjectDocumentKind = z.infer<typeof ProjectDocumentKindSchema>;
export type ProjectRepository = z.infer<typeof ProjectRepositorySchema>;
export type ProjectStack = z.infer<typeof ProjectStackSchema>;
export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export function validateProjectContext(value: unknown): ProjectContext {
  return ProjectContextSchema.parse(value);
}
