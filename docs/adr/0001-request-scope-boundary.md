# ADR 0001: Request Scope boundary

## Status

Accepted.

## Context

The API needs a single, request-scoped seam between HTTP routes and persistence-backed auth/status work. Without a clear boundary, routes tend to open database handles, leak lifecycle concerns, or duplicate policy in “helper” layers that mirror HTTP responses.

## Decision

**Routes own HTTP concerns:** JSON request/response schemas, status codes, headers, and cookie mutation (for example session cookies). They translate between wire shapes and domain outcomes; they do not own how persistence is obtained for a request.

**Request Scope owns:**

- Configured persistence access (including whether persistence is configured and available).
- Request-derived inputs needed by capabilities (for example raw tokens, IP, user agent) and passes them into auth/status work without shaping HTTP.
- Construction of **capabilities** that return closed outcome unions (`Public*Outcome` types)—**not** Fastify replies, status codes, or “route-ready” HTTP objects.

When configured persistence is missing or unusable, Request Scope surfaces `persistence_not_configured` or `persistence_unavailable`-style outcomes; routes map those consistently to HTTP (including logging posture owned at the adapter).

### Implementation detail (lifecycle)

Request Scope obtains persistence via the Fastify **`databaseAdapter`** decorated at startup when `DATABASE_URL` is configured (process-owned Drizzle database plus teardown on app close). Per-request operations reuse that adapter rather than opening a new connection scope; callers never receive a raw handle or participate in connect/disconnect; that lifecycle remains hidden behind Request Scope.

### Future replacement point

Pooling parameters, retries, observability hooks, or other adapter-internal behavior belong **inside** the Database Adapter and Request Scope implementation—not in routes. This ADR does not prescribe connection limits, pooling policy, or application shutdown sequencing beyond documenting that shutdown flows through Fastify lifecycle.

## Rejected alternatives

### Route-ready HTTP outcomes

Returning pre-built HTTP results or Fastify-specific helpers from Request Scope was rejected: it duplicates the route layer, encourages policy and status-code decisions inside infrastructure seams, and makes testing hinge on HTTP artifacts instead of closed domain outcomes.

### Generic database callbacks

Exposing “run this function with a `db` handle” from Request Scope was rejected: it keeps connection lifecycle as a **caller** concern, invites routes to reach past the seam, and scatters persistence availability handling instead of centralizing it in Request Scope.

## Consequences

- New persistence-backed HTTP surfaces should add or extend capabilities on Request Scope and keep translation in routes.
- Tests can stub Request Scope without standing up HTTP or raw database wiring for every scenario.