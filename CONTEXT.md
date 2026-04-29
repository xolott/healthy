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

### Setup Status Persistence

The small persistence seam used by Request Scope status capabilities to surface
**first-owner setup eligibility**: whether the initial owner bootstrap flow is
still required. Public status checks consume that intent instead of expressing
the same rule as predicates over the Active Owner store.

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

`createRequestScopeForApp` invokes that factory with the configured **Database Adapter**'s
Drizzle client (`app.databaseAdapter.db`) when persistence is configured. Routes
consume Request Scope capabilities only—they do not import this factory.

Policy tests construct `createAuthUseCases` with the Auth Test Adapter directly.
Repository shape in `@healthy/db` is unchanged in this seam.

### Request Scope

The **sanctioned request-scoped persistence boundary** for the API: configured
database access, persistence availability gates, request-derived inputs for auth
and status work, and construction of capabilities that return closed outcome
unions—not HTTP responses.

Routes own HTTP translation (schemas, status codes, headers) and cookie
mutation. They depend on Request Scope only for capabilities and **closed
outcomes**—including persistence gates such as `persistence_not_configured` or
`persistence_unavailable`—and translate those outcomes to HTTP. They do not
import auth use-case factories, open persistence handles, or participate in
Database Adapter construction or teardown.

Request Scope obtains persistence through the Database Adapter but hides its
lifecycle from routes; pooling or shutdown-oriented refinements belong inside the
Database Adapter and Request Scope implementation, not in routes. Decision
record: `docs/adr/0001-request-scope-boundary.md`.

### Database Adapter

**Canonical term** for the API's app-owned persistence lifecycle: the
process-owned object (Fastify `databaseAdapter` when `DATABASE_URL` is set) that
pairs a typed Drizzle database with shutdown behavior for the underlying
PostgreSQL client.

Request Scope is built on Database Adapter-backed capabilities. Routes depend on
Request Scope outcomes, not on database construction, pooling, or teardown.

### Database Package Boundary

The public boundary of `@healthy/db`: **database lifecycle and schema**
primitives—creating and disposing the typed Drizzle database, lifecycle helpers
such as adapters, and schema-owned tables and types exported from `@healthy/db/schema`.
Downstream modules build intent-shaped persistence on top of these primitives;
the package boundary is not repository-factory-shaped exports as the stable API.

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