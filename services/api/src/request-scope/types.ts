import type {
  FirstOwnerSetupResult,
  LogoutResult,
  OwnerLoginResult,
  ResolveCurrentSessionResult,
} from '../auth/auth-use-cases.js';

/**
 * Request Scope exposes infrastructure-backed capabilities without route-shaped HTTP outcomes.
 * Status reads map persistence configuration and availability to a closed outcome union;
 * routes translate these to HTTP.
 */
export type PublicStatusActiveOwnerOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'ok'; hasActiveOwner: boolean };

export type RequestScopeStatusCapability = {
  activeOwnerExists(): Promise<PublicStatusActiveOwnerOutcome>;
};

/**
 * Current-session resolution: persistence gate plus closed session outcomes from auth use cases.
 */
export type PublicCurrentSessionOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | ResolveCurrentSessionResult;

export type RequestScopeCurrentSessionCapability = {
  resolveFromRawToken(rawToken: string): Promise<PublicCurrentSessionOutcome>;
};

/**
 * Logout: persistence gate plus closed logout outcomes from auth use cases.
 * Callers pass the raw token from transport; an absent token is treated as idempotent skip without persistence.
 */
export type PublicLogoutOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | LogoutResult;

export type RequestScopeLogoutCapability = {
  logoutWithRawToken(rawToken: string | undefined): Promise<PublicLogoutOutcome>;
};

/**
 * Owner login: persistence gate plus closed login outcomes from auth use cases.
 */
export type PublicOwnerLoginOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | OwnerLoginResult;

export type RequestScopeOwnerLoginCapability = {
  loginWithEmailPassword(
    rawEmail: string,
    rawPassword: string,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<PublicOwnerLoginOutcome>;
};

/**
 * First-owner setup: persistence gate plus closed outcomes from auth use cases.
 * When persistence is not configured, payload validation runs before `persistence_not_configured`.
 */
export type PublicFirstOwnerSetupOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | FirstOwnerSetupResult;

export type RequestScopeFirstOwnerSetupCapability = {
  setupFirstOwner(
    rawDisplayName: string,
    rawEmail: string,
    rawPassword: string,
    ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
  ): Promise<PublicFirstOwnerSetupOutcome>;
};

export type RequestScope = {
  status: RequestScopeStatusCapability;
  currentSession: RequestScopeCurrentSessionCapability;
  logout: RequestScopeLogoutCapability;
  ownerLogin: RequestScopeOwnerLoginCapability;
  firstOwnerSetup: RequestScopeFirstOwnerSetupCapability;
};
