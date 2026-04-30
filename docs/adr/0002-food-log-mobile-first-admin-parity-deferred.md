# ADR 0002 — Food Log: mobile-first slice; admin parity deferred

**Status:** Accepted

## Context

The Food Log ships first on mobile (#95 lineage). Individual edit, delete,
move/reschedule, and admin surfaces are deliberate follow-ups, not hidden
requirements—but product parity matters long term.

We need one durable place stating that equivalent admin tooling and workflows
stay **planned but not in the initial slice**, without blocking shipping the
composer and owner day reads on mobile.

## Decision

Implement Food Log persistence and authenticated mobile flows first. Ship no
parallel admin CRUD UI for Food Log Entries in that slice.

**Follow-up explicitly includes** admin views and mutations aligned with mobile
capabilities (individual time changes, deletion, quantity/serving edits,
batch semantics), once priorities allow.

Relationship to **`CONTEXT.md`**: the **Food Log Entry** glossary entry points
here for parity scope; terminology and row shape stay authoritative in
CONTEXT and **`@healthy/db`** schema docs.

## Rejected alternatives

- **Dual-track mobile + admin in one slice**: Doubles UX and QA surface area
  before validating the journaling flow end to end.

- **Deferring schema fields until “edit/delete” exists**: Blocks forward
  compatibility; **`food_log_entries`** already carries timestamps, servings,
  soft-delete, and snapshot nutrients for predictable future PATCH flows.

## Consequences

- Mobile remains the proving ground for log semantics; admin work is queued as
  **tracked follow-up**, not ad hoc drift.
- Acceptance tests stay focused on authenticated API and persistence;
  **`listFoodLogEntriesForOwnerDate`** retains `deleted_at IS NULL` so future
  delete UX cannot accidentally leak truncated rows into day lists.
