import {
  RunStatusSchema,
  type RunState,
  type RunStatus
} from "../core/contracts";

export interface RunListOptions {
  status?: RunStatus;
}

function parseStatus(value: string): RunStatus {
  const result = RunStatusSchema.safeParse(value);

  if (!result.success) {
    throw new Error(
      `Invalid status "${value}". Expected one of: ${RunStatusSchema.options.join(", ")}.`
    );
  }

  return result.data;
}

export function parseRunListArguments(argv: string[]): RunListOptions {
  const options: RunListOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument?.startsWith("--status=")) {
      options.status = parseStatus(argument.replace("--status=", ""));
      continue;
    }

    if (argument === "--status") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --status.");
      }

      options.status = parseStatus(nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export function filterRuns(runs: RunState[], options: RunListOptions): RunState[] {
  if (!options.status) {
    return runs;
  }

  return runs.filter((run) => run.status === options.status);
}
