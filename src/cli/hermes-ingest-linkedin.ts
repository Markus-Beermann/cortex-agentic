import "dotenv/config";

import { getPool } from "../server/db";
import { createHermesRuntime } from "../hermes/runtime";

async function main(): Promise<void> {
  if (!process.env.DATABASE_PUBLIC_URL) {
    throw new Error("DATABASE_PUBLIC_URL is required for Hermes LinkedIn ingestion.");
  }

  const args = process.argv.slice(2);
  const imagePath = readFlag(args, "--image");

  if (!imagePath) {
    throw new Error('Missing --image=/absolute/path.png for Hermes LinkedIn ingestion.');
  }

  const context = readFlag(args, "--context");
  const { linkedinPhotoExtractor } = createHermesRuntime(getPool());
  const result = await linkedinPhotoExtractor.ingest({
    imagePath,
    context
  });

  console.log(
    JSON.stringify(
      {
        inserted: result.inserted,
        item: result.item
      },
      null,
      2
    )
  );
}

function readFlag(args: string[], flagName: string): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg.startsWith(`${flagName}=`)) {
      return arg.slice(flagName.length + 1);
    }
    if (arg === flagName) {
      return args[i + 1];
    }
  }
  return undefined;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
