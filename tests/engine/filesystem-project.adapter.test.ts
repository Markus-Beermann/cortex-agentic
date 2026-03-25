import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FilesystemProjectAdapter } from "../../src/adapters/projects/filesystem-project.adapter";

const temporaryDirectories: string[] = [];

describe("FilesystemProjectAdapter", () => {
  afterEach(async () => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("builds structured repository context from the filesystem", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "george-project-"));
    temporaryDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "docs", "agent-context"), { recursive: true });
    await mkdir(path.join(rootPath, ".git"), { recursive: true });
    await writeFile(path.join(rootPath, "AGENTS.md"), "# rules\n", "utf8");
    await writeFile(
      path.join(rootPath, "docs", "MASTER_Agent_Rules.md"),
      "# master rules\n",
      "utf8"
    );
    await writeFile(
      path.join(rootPath, "docs", "agent-context", "agent-bootstrap-index.md"),
      "# bootstraps\n",
      "utf8"
    );
    await writeFile(path.join(rootPath, "package.json"), "{}\n", "utf8");
    await writeFile(path.join(rootPath, "package-lock.json"), "{}\n", "utf8");
    await writeFile(path.join(rootPath, "tsconfig.json"), "{}\n", "utf8");
    await writeFile(path.join(rootPath, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    await writeFile(
      path.join(rootPath, ".git", "config"),
      '[remote "origin"]\n\turl = git@github.com:markus/george.git\n',
      "utf8"
    );

    const adapter = new FilesystemProjectAdapter(rootPath);
    const projectContext = await adapter.loadContext("demo-project");

    expect(projectContext.repository.isGitRepo).toBe(true);
    expect(projectContext.repository.currentBranch).toBe("main");
    expect(projectContext.repository.remotes).toContain("origin");
    expect(projectContext.stack.packageManager).toBe("npm");
    expect(projectContext.stack.languages).toContain("TypeScript");
    expect(projectContext.documents.some((document) => document.kind === "governance")).toBe(
      true
    );
    expect(projectContext.runtimePath).toBe(path.join(rootPath, ".orchestrator"));
  });
});
