import { createCliSessionRunner } from "./runtime";

function parseLimit(argv: string[]): number | null {
  const argument = argv.find((entry) => entry.startsWith("--limit="));

  if (!argument) {
    return null;
  }

  const value = Number(argument.replace("--limit=", ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function main(): Promise<void> {
  const runId = process.argv[2];

  if (!runId) {
    throw new Error("Usage: npm run events:show -- <run-id> [--limit=20]");
  }

  const limit = parseLimit(process.argv.slice(3));
  const rootPath = process.cwd();
  const { eventLogStore } = await createCliSessionRunner(rootPath);
  const events = await eventLogStore.list(runId);
  const visibleEvents = limit === null ? events : events.slice(-limit);

  console.log(
    JSON.stringify(
      {
        runId,
        count: visibleEvents.length,
        events: visibleEvents
      },
      null,
      2
    )
  );
}

void main();

