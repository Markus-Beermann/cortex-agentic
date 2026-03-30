import type { ProjectContext, ProjectDocument, ProjectStack } from "../../core/contracts";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function fallbackPaths(
  documents: ProjectDocument[],
  stack: ProjectStack,
  kinds: ProjectDocument["kind"][]
): string[] {
  return unique([
    ...documents
      .filter((document) => kinds.includes(document.kind))
      .map((document) => document.path),
    ...stack.manifests,
    ...stack.configs
  ]).slice(0, 12);
}

function dynamicPaths(repository: ProjectContext["repository"]): string[] {
  return unique([...repository.changedFiles, ...repository.untrackedFiles]).slice(0, 12);
}

export function buildProjectContexts(input: {
  documents: ProjectDocument[];
  stack: ProjectStack;
  repository: ProjectContext["repository"];
}): ProjectContext["contexts"] {
  const { documents, stack, repository } = input;
  const dynamicFocus = dynamicPaths(repository);
  const dirtySummary = repository.isDirty
    ? `Git reports ${repository.changedFiles.length} changed and ${repository.untrackedFiles.length} untracked files.`
    : "Git working tree is clean.";

  const planningContext: ProjectContext["contexts"]["planningContext"] = {
    purpose: "planning",
    summary: "Use architecture, governance, and active change signals to decompose work.",
    focusPaths:
      dynamicFocus.length > 0
        ? dynamicFocus
        : fallbackPaths(documents, stack, ["governance", "bootstrap", "architecture", "manifest"]),
    relevantDocuments: documents
      .filter((document) =>
        ["governance", "bootstrap", "architecture", "manifest"].includes(document.kind)
      )
      .map((document) => document.path),
    notes: [
      dirtySummary,
      "Planning should preserve governance and bootstrap separation."
    ]
  };

  const implementationContext: ProjectContext["contexts"]["implementationContext"] = {
    purpose: "implementation",
    summary: "Use changed files, manifests, and configs to execute bounded work.",
    focusPaths:
      dynamicFocus.length > 0
        ? dynamicFocus
        : fallbackPaths(documents, stack, ["manifest", "config", "architecture"]),
    relevantDocuments: documents
      .filter((document) => ["manifest", "config", "architecture"].includes(document.kind))
      .map((document) => document.path),
    notes: [
      dirtySummary,
      "Implementation should stay close to manifests, configs, and changed files."
    ]
  };

  const reviewContext: ProjectContext["contexts"]["reviewContext"] = {
    purpose: "review",
    summary: "Use changed files plus rules and configs to validate the delivered work.",
    focusPaths:
      dynamicFocus.length > 0
        ? dynamicFocus
        : fallbackPaths(documents, stack, ["governance", "config", "log"]),
    relevantDocuments: documents
      .filter((document) => ["governance", "config", "log"].includes(document.kind))
      .map((document) => document.path),
    notes: [
      dirtySummary,
      "Review should emphasize policy compliance, changed files, and explicit risks."
    ]
  };

  return {
    planningContext,
    implementationContext,
    reviewContext
  };
}
