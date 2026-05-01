# ADR 0003 — Reference Food architecture

**Status:** Accepted

## Context

The product needs source-owned nutrition catalog records (Reference Foods),
imported from external databases such as USDA FoodData Central, for search and
direct meal logging without merging those records into user-owned Pantry
catalogs. That introduces durable questions: where truth lives, how search
relates to persistence, how Food Log Entries stay stable when imports change,
and how admin parity expectations apply for this slice.

PRD issue **#103** (*Reference Food import and search*) records the agreed
product scope. This ADR captures the **architecture**
decisions that implementers and reviewers should treat as binding, aligned with
that PRD.

## Decision

### Separate source-owned Reference Foods from user-owned Pantry Items

**Reference Foods** are imported catalog rows: not user-owned, not editable in
the app, not listed under Pantry Foods or Recipes. **Pantry Items** remain the
user’s reusable Foods and Recipes. The two catalogs are distinct in domain
model and persistence; logging may choose one source per entry (see below).

### Postgres is authoritative for Reference Food details

Canonical Reference Food fields, lifecycle state, and import bookkeeping live
in **PostgreSQL**. Clients and APIs load authoritative details from Postgres
after search or by identifier. No other store replaces Postgres as the system of
record for Reference Food rows.

### Elasticsearch is a rebuildable search projection

**Elasticsearch** holds a **projection** used for weighted name/brand search,
ranking, and active-only visibility. It may duplicate display fields needed for
result cards, but it is **not** authoritative: it can be dropped and rebuilt
from Postgres (versioned indices, stable alias swap per PRD). If indexing lags
or fails after a successful Postgres import, committed Postgres data stands;
operators repair search via retry or reindex without re-importing source files.

### Food Log Entries link plus snapshot

Each **Food Log Entry** continues to **snapshot** display metadata and scaled
nutrients at log time (existing Pantry behavior). For Reference Foods, the entry
also stores a **durable link** to the Reference Food (for example internal UUID)
so history can resolve the source row. Snapshots are **immutable** for past
entries: import updates do not recalculate historical entries. Inactive
Reference Foods remain in Postgres for link resolution and historical display
but are not valid targets for new logs; search omits them.

### Admin UI parity for Reference Foods is deferred

Reference Food **operator import/reindex scripts** and **authenticated mobile
API** surfaces are in scope for the PRD slice. **Admin UI** parity (search,
detail, logging Reference Foods from admin on par with mobile) is **explicitly
deferred**, consistent with [ADR 0002 — Food Log: mobile-first slice; admin
parity deferred](0002-food-log-mobile-first-admin-parity-deferred.md) and the
product parity rule documented there. Deferral is **intentional**, not an
oversight.

### Relationship to shared vocabulary

Domain terms (**Reference Food**, **Pantry Item**, **Food Log Entry**,
active/inactive lifecycle, snapshot semantics) stay canonical in
[`CONTEXT.md`](../../CONTEXT.md). This ADR states **ownership and authority**
rules those terms rely on; it does not introduce new user-facing product names
beyond what the PRD already uses.

## Rejected alternatives

- **Treating Elasticsearch as source of truth for nutrients or lifecycle**:
  Would make search outages or reindex mistakes corrupt logging truth; conflicts
  with idempotent Postgres imports and historical snapshot stability.

- **Merging imported records into Pantry by default**: Would blur ownership,
  clutter user catalogs, and break the PRD requirement that Pantry stay
  user-curated.

- **Blocking the mobile/API slice on admin Reference Food UI**: Delays user
  value; PRD defers admin parity with explicit tracking (this ADR).

## Consequences

- Importers write Postgres first; indexers update Elasticsearch as a follow-on
  projection with clear failure and repair semantics.
- API and tests should assert Postgres invariants, snapshot behavior, and
  search/detail contracts per the PRD testing decisions—not client call order
  unless it is part of a published module boundary.
- When admin Reference Food surfaces ship later, they should reuse the same
  authority and snapshot rules rather than inventing parallel semantics.
