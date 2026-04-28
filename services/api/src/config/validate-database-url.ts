export function assertValidOptionalDatabaseUrl(value: string | undefined): void {
  if (value === undefined || value.trim() === '') {
    return;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL (could not parse: ${JSON.stringify(value)})`);
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error(
      `DATABASE_URL must use postgres:// or postgresql:// (got protocol ${JSON.stringify(url.protocol)})`,
    );
  }
}
