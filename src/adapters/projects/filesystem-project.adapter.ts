import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ProjectContext, ProjectDocument } from "../../core/contracts";
import { validateProjectContext } from "../../core/contracts";
import type { ProjectAdapterPort } from "./project-adapter.port";

export class FilesystemProjectAdapter implements ProjectAdapterPort {
  public constructor(private readonly rootPath: string) {}

  public async loadContext(projectId: string): Promise<ProjectContext> {
    return validateProjectContext({
      projectId,
      rootPath: this.rootPath,
      runtimePath: path.join(this.rootPath, ".orchestrator"),
      documents: await this.collectDocuments(),
      repository: await this.collectRepositoryInfo(),
      stack: await this.collectStackInfo(),
      notes: [
        "Human approval is treated as a runtime concern.",
        "Governance and bootstrap context stay separate."
      ]
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
    const gitDirectory = path.join(this.rootPath, ".git");
    const headPath = path.join(gitDirectory, "HEAD");
    const configPath = path.join(gitDirectory, "config");

    if (!(await this.exists(headPath))) {
      return {
        isGitRepo: false,
        currentBranch: null,
        remotes: []
      };
    }

    const headContent = await readFile(headPath, "utf8");
    const currentBranch = headContent.startsWith("ref:")
      ? headContent.trim().split("/").at(-1) ?? null
      : null;

    const remotes =
      (await this.exists(configPath))
        ? Array.from(
            (await readFile(configPath, "utf8")).matchAll(/\[remote "([^"]+)"\]/gu),
            (match) => match[1]
          )
        : [];

    return {
      isGitRepo: true,
      currentBranch,
      remotes
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
}
