/** Thrown when setup tries to create the first owner but an active owner already exists. */
export class FirstOwnerAlreadyExistsError extends Error {
  readonly code = 'FIRST_OWNER_ALREADY_EXISTS' as const;
  constructor(message = 'An active owner already exists') {
    super(message);
    this.name = 'FirstOwnerAlreadyExistsError';
  }
}

/** Thrown when an operation would leave zero active owners. */
export class LastActiveOwnerInvariantError extends Error {
  readonly code = 'LAST_ACTIVE_OWNER_INVARIANT' as const;
  constructor(message = 'Cannot demote, disable, or delete the last active owner') {
    super(message);
    this.name = 'LastActiveOwnerInvariantError';
  }
}
