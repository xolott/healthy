export const PASSWORD_MIN_LENGTH = 12;

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export type FirstOwnerSuccessBody = {
  user: CurrentUser;
  session: { token: string; expiresAt: string };
};

export class AuthMeUnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
  }
}

export class SetupNotFoundError extends Error {
  constructor() {
    super("Setup is not available");
  }
}

export class PasswordPolicyApiError extends Error {
  constructor(
    public readonly minLength: number,
    message: string,
  ) {
    super(message);
  }
}

export class InvalidInputApiError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Fetches the current user using the API session (HttpOnly cookie and/or future Bearer token wiring).
 */
export async function fetchAuthMe(apiBaseUrl: string): Promise<CurrentUser> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/auth/me`, { credentials: "include" });
  if (res.status === 401) {
    throw new AuthMeUnauthorizedError();
  }
  if (!res.ok) {
    throw new Error(`HTTP ${String(res.status)}`);
  }
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid /auth/me response");
  }
  const u = (body as { user?: CurrentUser }).user;
  if (
    u === undefined ||
    typeof u.id !== "string" ||
    typeof u.email !== "string" ||
    typeof u.displayName !== "string" ||
    typeof u.role !== "string"
  ) {
    throw new Error("Invalid /auth/me response");
  }
  return u;
}

/**
 * Create the first owner. Stores HttpOnly session cookie for the API origin; returns response body for display.
 */
export async function postFirstOwnerSetup(
  apiBaseUrl: string,
  input: { displayName: string; email: string; password: string },
): Promise<FirstOwnerSuccessBody> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/setup/first-owner`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 400) {
    const body: unknown = await res.json().catch(() => ({}));
    if (typeof body === "object" && body !== null) {
      const o = body as { error?: string; minLength?: number; message?: string; field?: string };
      if (o.error === "password_policy" && typeof o.minLength === "number" && typeof o.message === "string") {
        throw new PasswordPolicyApiError(o.minLength, o.message);
      }
      if (o.error === "invalid_input" && typeof o.field === "string" && typeof o.message === "string") {
        throw new InvalidInputApiError(o.field, o.message);
      }
    }
    throw new Error("Bad request");
  }
  if (res.status === 404) {
    throw new SetupNotFoundError();
  }
  if (res.status === 503) {
    throw new Error("Server unavailable");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${String(res.status)}`);
  }
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid setup response");
  }
  const b = body as { user?: CurrentUser; session?: { token: string; expiresAt: string } };
  if (
    b.user === undefined ||
    b.session === undefined ||
    typeof b.session.token !== "string" ||
    typeof b.session.expiresAt !== "string"
  ) {
    throw new Error("Invalid setup response");
  }
  return { user: b.user, session: b.session };
}
