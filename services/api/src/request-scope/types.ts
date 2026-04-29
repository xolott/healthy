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

export type RequestScope = {
  status: RequestScopeStatusCapability;
};
