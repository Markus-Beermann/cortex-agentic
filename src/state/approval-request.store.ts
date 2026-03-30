import { readdir } from "node:fs/promises";
import path from "node:path";

import type { ApprovalRequest } from "../core/contracts";
import { validateApprovalRequest } from "../core/contracts";
import { ensureDirectory, readJsonFile, writeJsonFile } from "./file-store";

export class ApprovalRequestStore {
  private readonly directoryPath: string;

  public constructor(rootPath: string) {
    this.directoryPath = path.join(rootPath, ".orchestrator", "approvals");
  }

  public async save(request: ApprovalRequest): Promise<ApprovalRequest> {
    const validatedRequest = validateApprovalRequest(request);
    await writeJsonFile(this.filePath(validatedRequest.id), validatedRequest);
    return validatedRequest;
  }

  public async get(approvalId: string): Promise<ApprovalRequest> {
    return validateApprovalRequest(
      await readJsonFile<ApprovalRequest>(this.filePath(approvalId))
    );
  }

  public async list(): Promise<ApprovalRequest[]> {
    await ensureDirectory(this.directoryPath);
    const entries = await readdir(this.directoryPath);

    const requests = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => this.get(entry.replace(/\.json$/u, "")))
    );

    return requests.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async listPending(): Promise<ApprovalRequest[]> {
    const requests = await this.list();
    return requests.filter((request) => request.status === "pending");
  }

  public async listByRun(runId: string): Promise<ApprovalRequest[]> {
    const requests = await this.list();
    return requests.filter((request) => request.runId === runId);
  }

  public async findPendingBySubject(
    runId: string,
    subjectId: string
  ): Promise<ApprovalRequest | null> {
    const requests = await this.listPending();
    return (
      requests.find(
        (request) => request.runId === runId && request.subjectId === subjectId
      ) ?? null
    );
  }

  private filePath(approvalId: string): string {
    return path.join(this.directoryPath, `${approvalId}.json`);
  }
}
