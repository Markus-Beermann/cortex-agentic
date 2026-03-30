import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { FilesystemProjectAdapter } from "../../src/adapters/projects/filesystem-project.adapter";

const execFileAsync = promisify(execFile);
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
    await execFileAsync("git", ["init", "-b", "main"], { cwd: rootPath });
    await execFileAsync("git", ["remote", "add", "origin", "git@github.com:markus/george.git"], {
      cwd: rootPath
    });
    await execFileAsync("git", ["add", "."], { cwd: rootPath });
    await execFileAsync(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: rootPath }
    );
    await writeFile(path.join(rootPath, "AGENTS.md"), "# updated rules\n", "utf8");
    await writeFile(path.join(rootPath, "draft.txt"), "not yet tracked\n", "utf8");

    const adapter = new FilesystemProjectAdapter(rootPath);
    const projectContext = await adapter.loadContext("demo-project");

    expect(projectContext.repository.isGitRepo).toBe(true);
    expect(projectContext.repository.currentBranch).toBe("main");
    expect(projectContext.repository.remotes).toContain("origin");
    expect(projectContext.repository.isDirty).toBe(true);
    expect(projectContext.repository.changedFiles).toContain("AGENTS.md");
    expect(projectContext.repository.untrackedFiles).toContain("draft.txt");
    expect(projectContext.stack.packageManager).toBe("npm");
    expect(projectContext.stack.languages).toContain("TypeScript");
    expect(projectContext.documents.some((document) => document.kind === "governance")).toBe(
      true
    );
    expect(projectContext.focusPaths).toContain("AGENTS.md");
    expect(projectContext.focusPaths).toContain("draft.txt");
    expect(projectContext.runtimePath).toBe(path.join(rootPath, ".orchestrator"));
  });
});
