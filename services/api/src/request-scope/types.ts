import type { ResolveCurrentSessionResult } from '../auth/auth-use-cases.js';

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

export type RequestScope = {
  status: RequestScopeStatusCapability;
  currentSession: RequestScopeCurrentSessionCapability;
};
