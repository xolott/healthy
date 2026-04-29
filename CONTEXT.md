# Healthy Context

## Domain Terms

### Auth Use Cases

The API module that owns authentication policy: first-owner setup, owner login,
current-session resolution, and logout. Routes translate HTTP into inputs and
outputs; Auth Use Cases own ordering, eligibility rules, session issuance, and
transaction scope.

Auth Use Cases accept raw input strings from routes and own trimming and
validation for auth policy: email shape, display-name shape, and password
policy. Routes validate only JSON shape and translate result kinds to HTTP.

Implementation: `services/api/src/auth/auth-use-cases.ts`.

### Auth Persistence

The auth-intent-shaped persistence seam used by Auth Use Cases. It exposes the
operations auth policy needs without requiring callers or tests to depend on a
raw Drizzle database handle.

Auth Persistence is currently one adapter for the auth slice. It returns
intent-shaped records with enough facts for Auth Use Cases to decide eligibility,
and it exposes a transaction capability so Auth Use Cases can own transaction
scope. Login and First-Owner Setup are transactional; current-session resolution
and logout are not transactional unless their invariants grow.

The first Drizzle-backed Auth Persistence adapter composes the existing
`@healthy/db` repositories. Repository cleanup is separate work.

Adapter code: `services/api/src/auth/auth-persistence.ts`.

### Auth Result

Expected Auth Use Cases outcomes are closed tagged unions, not domain
exceptions. Infrastructure failures may still throw.

### Auth Test Adapter

An in-memory Auth Persistence adapter used by policy tests. It gives fast,
deterministic tests for auth rules without requiring PostgreSQL, Argon2, random
session tokens, or wall-clock time.

Adapter code: `services/api/src/auth/auth-persistence-memory.ts`.

### Auth Use Case Scope

A request helper that creates Auth Use Cases from the configured database and
deterministic collaborators. Routes use this helper instead of receiving raw
Drizzle database handles.

Implemented as `services/api/src/auth/auth-use-case-scope.ts` (`createAuthUseCasesForDatabase`,
`*FromAppRequest` helpers, and types such as `AuthMeUser` re-exported for route
layers). Policy tests construct `createAuthUseCases` with the Auth Test Adapter
directly; repository shape in `@healthy/db` is unchanged in this seam.

### Active Owner

A user with the `owner` role, `active` status, and no soft-delete timestamp.
Active Owner existence determines whether first-owner setup is available.

### First-Owner Setup

The bootstrap flow that creates the initial Active Owner for a Healthy server
when no Active Owner exists.

### Session

An opaque, revocable authentication credential. Only a hash of the raw token is
stored in the database; browsers may carry the raw token in an HttpOnly cookie,
and mobile clients may carry it as a Bearer token.