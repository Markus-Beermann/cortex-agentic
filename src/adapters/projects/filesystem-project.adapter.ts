import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { ProjectContext, ProjectDocument } from "../../core/contracts";
import { validateProjectContext } from "../../core/contracts";
import { buildProjectContexts } from "./context-selection";
import type { ProjectAdapterPort } from "./project-adapter.port";

const execFileAsync = promisify(execFile);

export class FilesystemProjectAdapter implements ProjectAdapterPort {
  public constructor(private readonly rootPath: string) {}

  public async loadContext(projectId: string): Promise<ProjectContext> {
    const documents = await this.collectDocuments();
    const repository = await this.collectRepositoryInfo();
    const stack = await this.collectStackInfo();
    const contexts = buildProjectContexts({
      documents,
      stack,
      repository
    });

    return validateProjectContext({
      projectId,
      rootPath: this.rootPath,
      runtimePath: path.join(this.rootPath, ".orchestrator"),
      documents,
      repository,
      stack,
      focusPaths: contexts.planningContext.focusPaths,
      contexts,
      notes: this.buildNotes(repository)
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

  private async collectDocuments(): Promise<ProjectDocument[]> {
    const candidates: Array<ProjectDocument> = [
      { path: "AGENTS.md", kind: "governance" },
      { path: "docs/MASTER_Agent_Rules.md", kind: "governance" },
      { path: "docs/architecture/orchestrator-architecture.md", kind: "architecture" },
      { path: "docs/agent-context/agent-bootstrap-index.md", kind: "bootstrap" },
      { path: "docs/project/collaboration-log.md", kind: "log" },
      { path: "package.json", kind: "manifest" },
      { path: "tsconfig.json", kind: "config" },
      { path: "vitest.config.ts", kind: "config" }
    ];

    const documents: ProjectDocument[] = [];

    for (const candidate of candidates) {
      if (await this.exists(path.join(this.rootPath, candidate.path))) {
        documents.push(candidate);
      }
    }

    return documents;
  }

  private async collectRepositoryInfo(): Promise<ProjectContext["repository"]> {
    const isGitRepo = (await this.runGit(["rev-parse", "--is-inside-work-tree"])) === "true";

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

    const currentBranch = (await this.runGit(["branch", "--show-current"])) || null;
    const remotesOutput = await this.runGit(["remote"]);
    const statusOutput = await this.runGit([
      "status",
      "--short",
      "--untracked-files=all"
    ]);
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

  private async collectStackInfo(): Promise<ProjectContext["stack"]> {
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

    const existingManifests: string[] = [];
    const existingConfigs: string[] = [];

    for (const manifestPath of manifests) {
      if (await this.exists(path.join(this.rootPath, manifestPath))) {
        existingManifests.push(manifestPath);
      }
    }

    for (const configPath of configs) {
      if (await this.exists(path.join(this.rootPath, configPath))) {
        existingConfigs.push(configPath);
      }
    }

    const languages = this.detectLanguages(existingManifests, existingConfigs);

    return {
      packageManager: this.detectPackageManager(existingManifests),
      manifests: existingManifests,
      configs: existingConfigs,
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

  private buildNotes(repository: ProjectContext["repository"]): string[] {
    const notes = [
      "Human approval is treated as a runtime concern.",
      "Governance and bootstrap context stay separate."
    ];

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

  private async runGit(args: string[]): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd: this.rootPath
      });

      return stdout.trimEnd();
    } catch {
      return null;
    }
  }
}
