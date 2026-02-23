export function parseArgValue(args: string[], argName: string): string | undefined {
  const prefixed = `--${argName}=`;
  const withEquals = args.find((arg) => arg.startsWith(prefixed));
  if (withEquals) {
    return withEquals.slice(prefixed.length);
  }

  const index = args.indexOf(`--${argName}`);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

export function parseIntegerArg(
  args: string[],
  argName: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = parseArgValue(args, argName);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid --${argName} value: ${raw}. Expected integer between ${min} and ${max}.`);
  }

  return parsed;
}
