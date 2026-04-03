import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Pool } from "pg";

import { pgSaveArchitectureSnapshot } from "./pg-queries";

const SNAPSHOT_RELATIVE_PATH = path.join(
  "docs",
  "architecture",
  "snapshots",
  "2026-04-03-debussy-architecture.md"
);

export async function seedDebussyArchitectureSnapshot(
  pool: Pool,
  repositoryRootPath: string
): Promise<void> {
  const snapshotPath = path.join(repositoryRootPath, SNAPSHOT_RELATIVE_PATH);
  const markdown = await readFile(snapshotPath, "utf8");
  const { title, mermaid, notes } = parseSnapshotMarkdown(markdown);

  await pgSaveArchitectureSnapshot(pool, {
    id: "snapshot/2026-04-03-debussy-architecture",
    title,
    mermaid,
    notes
  });
}

function parseSnapshotMarkdown(markdown: string): {
  title: string;
  mermaid: string;
  notes: string | null;
} {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const mermaidMatch = markdown.match(/```mermaid\s*([\s\S]*?)```/m);

  if (!titleMatch) {
    throw new Error("Debussy architecture snapshot is missing a top-level title.");
  }

  if (!mermaidMatch) {
    throw new Error("Debussy architecture snapshot is missing a mermaid block.");
  }

  const title = titleMatch[1].trim();
  const mermaid = mermaidMatch[1].trim();
  const notes = markdown
    .replace(mermaidMatch[0], "")
    .trim();

  return {
    title,
    mermaid,
    notes: notes.length > 0 ? notes : null
  };
}
