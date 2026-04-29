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

Factory that builds Auth Use Cases from an existing Drizzle database handle plus
deterministic hashing and session collaborators. Implemented as
`services/api/src/auth/auth-use-case-scope.ts`:
`createAuthUseCasesForDatabase`; `AuthMeUser` is re-exported for consumers that anchor
on this module.

`createRequestScopeForApp` invokes that factory inside disposable database scopes.
Routes consume Request Scope capabilities only—they do not import this factory.

Policy tests construct `createAuthUseCases` with the Auth Test Adapter directly.
Repository shape in `@healthy/db` is unchanged in this seam.

### Request Scope

The **sanctioned request-scoped persistence boundary** for the API: configured
database access, persistence availability gates, request-derived inputs for auth
and status work, and construction of capabilities that return closed outcome
unions—not HTTP responses.

Routes own HTTP translation (schemas, status codes, headers) and cookie
mutation; they depend on Request Scope only for capabilities and outcomes.
They do not import auth use-case factories or open persistence handles.

Request Scope hides database lifecycle from callers (including disposable
connections in the current adapter); pooling or shutdown-oriented lifecycle is
a future adapter concern, not a route concern. Decision record:
`docs/adr/0001-request-scope-boundary.md`.

### Database Adapter

The process-owned persistence lifecycle object for a Healthy API app. It pairs a
typed Drizzle database with shutdown behavior for the underlying PostgreSQL
client.

Request Scope depends on Database Adapter-backed capabilities; routes depend on
Request Scope and do not own database construction, pooling, or teardown.

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