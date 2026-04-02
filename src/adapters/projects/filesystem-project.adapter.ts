import { execFile } from "node:child_process";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { ProjectContext, ProjectDocument } from "../../core/contracts";
import { validateProjectContext } from "../../core/contracts";
import { buildProjectContexts } from "./context-selection";
import type { ProjectAdapterPort } from "./project-adapter.port";

const execFileAsync = promisify(execFile);

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

export class FilesystemProjectAdapter implements ProjectAdapterPort {
  public constructor(private readonly workspaceRootPath: string) {}

  public async loadContext(projectId: string): Promise<ProjectContext> {
    const projectRootPath = await this.resolveProjectRootPath(projectId);
    const projectRelativePath = this.relativeToWorkspace(projectRootPath);
    const documents = await this.collectDocuments(projectRootPath, projectRelativePath);
    const repository = await this.collectRepositoryInfo(projectRelativePath);
    const stack = await this.collectStackInfo(projectRootPath, projectRelativePath);
    const contexts = buildProjectContexts({
      documents,
      stack,
      repository
    });

    return validateProjectContext({
      projectId,
      rootPath: projectRootPath,
      runtimePath: path.join(this.workspaceRootPath, ".orchestrator"),
      documents,
      repository,
      stack,
      focusPaths: contexts.planningContext.focusPaths,
      contexts,
      notes: this.buildNotes(repository, projectRelativePath)
    });
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async isDirectory(filePath: string): Promise<boolean> {
    try {
      const entry = await stat(filePath);
      return entry.isDirectory();
    } catch {
      return false;
    }
  }

  private async resolveProjectRootPath(projectId: string): Promise<string> {
    const candidatePath = path.resolve(this.workspaceRootPath, projectId);

    if (!this.isInsideWorkspace(candidatePath) || candidatePath === this.workspaceRootPath) {
      return this.workspaceRootPath;
    }

    if (await this.isDirectory(candidatePath)) {
      return candidatePath;
    }

    return this.workspaceRootPath;
  }

  private isInsideWorkspace(candidatePath: string): boolean {
    return (
      candidatePath === this.workspaceRootPath ||
      candidatePath.startsWith(`${this.workspaceRootPath}${path.sep}`)
    );
  }

  private relativeToWorkspace(filePath: string): string {
    const relativePath = path.relative(this.workspaceRootPath, filePath);
    return relativePath.length === 0 ? "." : normalizePath(relativePath);
  }

  private resolveScopedPath(scopeRootPath: string, relativePath: string): string {
    return scopeRootPath === this.workspaceRootPath
      ? normalizePath(relativePath)
      : normalizePath(path.join(this.relativeToWorkspace(scopeRootPath), relativePath));
  }

  private async collectDocuments(
    projectRootPath: string,
    projectRelativePath: string
  ): Promise<ProjectDocument[]> {
    const workspaceCandidates: Array<ProjectDocument> = [
      { path: "AGENTS.md", kind: "governance" },
      { path: "docs/MASTER_Agent_Rules.md", kind: "governance" },
      { path: "docs/architecture/orchestrator-architecture.md", kind: "architecture" },
      { path: "docs/agent-context/agent-bootstrap-index.md", kind: "bootstrap" },
      { path: "docs/project/collaboration-log.md", kind: "log" }
    ];
    const projectCandidates: Array<ProjectDocument> = [
      { path: "package.json", kind: "manifest" },
      { path: "tsconfig.json", kind: "config" },
      { path: "vitest.config.ts", kind: "config" }
    ];

    const documents: ProjectDocument[] = [];

    for (const candidate of workspaceCandidates) {
      if (await this.exists(path.join(this.workspaceRootPath, candidate.path))) {
        documents.push(candidate);
      }
    }

    for (const candidate of projectCandidates) {
      if (await this.exists(path.join(projectRootPath, candidate.path))) {
        documents.push({
          ...candidate,
          path:
            projectRelativePath === "."
              ? candidate.path
              : this.resolveScopedPath(projectRootPath, candidate.path)
        });
      }
    }

    return documents;
  }

  private async collectRepositoryInfo(
    projectRelativePath: string
  ): Promise<ProjectContext["repository"]> {
    const isGitRepo =
      (await this.runGit(["rev-parse", "--is-inside-work-tree"], this.workspaceRootPath)) ===
      "true";

    if (!isGitRepo) {
      return {
        isGitRepo: false,
        currentBranch: null,
        remotes: [],
        isDirty: false,
        changedFiles: [],
        untrackedFiles: []
      };
    }

    const currentBranch =
      (await this.runGit(["branch", "--show-current"], this.workspaceRootPath)) || null;
    const remotesOutput = await this.runGit(["remote"], this.workspaceRootPath);
    const statusArgs =
      projectRelativePath === "."
        ? ["status", "--short", "--untracked-files=all"]
        : ["status", "--short", "--untracked-files=all", "--", projectRelativePath];
    const statusOutput = await this.runGit(statusArgs, this.workspaceRootPath);
    const statusEntries = (statusOutput || "")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    const remotes = (remotesOutput || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const untrackedFiles = statusEntries
      .filter((entry) => entry.startsWith("?? "))
      .map((entry) => this.parseStatusPath(entry));
    const changedFiles = statusEntries
      .filter((entry) => !entry.startsWith("?? "))
      .map((entry) => this.parseStatusPath(entry));

    return {
      isGitRepo: true,
      currentBranch,
      remotes,
      isDirty: statusEntries.length > 0,
      changedFiles: this.unique(changedFiles),
      untrackedFiles: this.unique(untrackedFiles)
    };
  }

  private async collectStackInfo(
    projectRootPath: string,
    projectRelativePath: string
  ): Promise<ProjectContext["stack"]> {
    const manifests = [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "pyproject.toml",
      "requirements.txt",
      "go.mod",
      "Gemfile"
    ];

    const configs = [
      "tsconfig.json",
      "vitest.config.ts",
      ".gitignore"
    ];

    const existingManifestNames: string[] = [];
    const existingConfigNames: string[] = [];
    const existingManifestPaths: string[] = [];
    const existingConfigPaths: string[] = [];

    for (const manifestPath of manifests) {
      if (await this.exists(path.join(projectRootPath, manifestPath))) {
        existingManifestNames.push(manifestPath);
        existingManifestPaths.push(
          projectRelativePath === "."
            ? manifestPath
            : this.resolveScopedPath(projectRootPath, manifestPath)
        );
      }
    }

    for (const configPath of configs) {
      if (await this.exists(path.join(projectRootPath, configPath))) {
        existingConfigNames.push(configPath);
        existingConfigPaths.push(
          projectRelativePath === "."
            ? configPath
            : this.resolveScopedPath(projectRootPath, configPath)
        );
      }
    }

    const languages = this.detectLanguages(existingManifestNames, existingConfigNames);

    return {
      packageManager: this.detectPackageManager(existingManifestNames),
      manifests: existingManifestPaths,
      configs: existingConfigPaths,
      languages
    };
  }

  private detectPackageManager(manifests: string[]): ProjectContext["stack"]["packageManager"] {
    if (manifests.includes("pnpm-lock.yaml")) {
      return "pnpm";
    }

    if (manifests.includes("yarn.lock")) {
      return "yarn";
    }

    if (manifests.includes("bun.lock") || manifests.includes("bun.lockb")) {
      return "bun";
    }

    if (manifests.includes("package.json") || manifests.includes("package-lock.json")) {
      return "npm";
    }

    return "unknown";
  }

  private detectLanguages(manifests: string[], configs: string[]): string[] {
    const languages = new Set<string>(["Markdown"]);

    if (manifests.includes("package.json")) {
      languages.add("JavaScript");
    }

    if (configs.includes("tsconfig.json")) {
      languages.add("TypeScript");
    }

    if (manifests.includes("pyproject.toml") || manifests.includes("requirements.txt")) {
      languages.add("Python");
    }

    if (manifests.includes("go.mod")) {
      languages.add("Go");
    }

    if (manifests.includes("Gemfile")) {
      languages.add("Ruby");
    }

    return Array.from(languages);
  }

  private buildNotes(
    repository: ProjectContext["repository"],
    projectRelativePath: string
  ): string[] {
    const notes = [
      "Human approval is treated as a runtime concern.",
      "Governance and bootstrap context stay separate."
    ];

    if (projectRelativePath !== ".") {
      notes.push(`Project context is scoped to ${projectRelativePath}.`);
    }

    if (repository.isGitRepo) {
      if (repository.isDirty) {
        notes.push(
          `Repository has ${repository.changedFiles.length} changed and ${repository.untrackedFiles.length} untracked files.`
        );
      } else {
        notes.push("Repository working tree is clean.");
      }
    } else {
      notes.push("Project context was loaded outside a git repository.");
    }

    return notes;
  }

  private parseStatusPath(entry: string): string {
    const rawPath = entry.slice(3).trim();

    if (rawPath.includes(" -> ")) {
      return rawPath.split(" -> ").at(-1) || rawPath;
    }

    return rawPath;
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.length > 0)));
  }

  private async runGit(args: string[], cwd: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd
      });

      return stdout.trimEnd();
    } catch {
      return null;
    }
  }
}
