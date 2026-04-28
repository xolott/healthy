export type HealthyPublicStatus = {
  api: { name: string; version: string };
  setupRequired: boolean;
};

export function parseHealthyPublicStatus(body: unknown): HealthyPublicStatus {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid Healthy status response");
  }
  const o = body as Record<string, unknown>;
  const api = o.api;
  if (typeof api !== "object" || api === null) {
    throw new Error("Invalid Healthy status response");
  }
  const apiObj = api as Record<string, unknown>;
  if (
    apiObj.name !== "healthy-api" ||
    typeof apiObj.version !== "string" ||
    typeof o.setupRequired !== "boolean"
  ) {
    throw new Error("Invalid Healthy status response");
  }
  return {
    api: { name: apiObj.name as "healthy-api", version: apiObj.version },
    setupRequired: o.setupRequired,
  };
}

export async function fetchHealthyPublicStatus(apiBaseUrl: string): Promise<HealthyPublicStatus> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/status`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return parseHealthyPublicStatus(await res.json());
}
