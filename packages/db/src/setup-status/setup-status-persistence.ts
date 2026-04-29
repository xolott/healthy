import type { Database } from '../client.js';
import { createUserRepository } from '../users/repository.js';

/**
 * Intent-shaped persistence for coarse setup bootstrap state.
 * Callers ask whether first-owner onboarding is required rather than interpreting user-table predicates.
 */
export function createSetupStatusPersistence(db: Database) {
  return {
    async isFirstOwnerSetupRequired(): Promise<boolean> {
      const users = createUserRepository(db);
      const hasActiveOwner = await users.hasActiveOwner();
      return !hasActiveOwner;
    },
  };
}

export type SetupStatusPersistence = ReturnType<typeof createSetupStatusPersistence>;
