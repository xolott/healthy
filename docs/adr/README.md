# Architecture Decision Records

Use ADRs when a choice is **hard to reverse**, would be **surprising without explanation**, and reflects **real trade-offs** (not routine fixes or obvious defaults). Skip them for small, reversible implementation details—ordinary architecture review can stay in PR discussion; reserve ADRs for decisions worth rereading months later.

## Files and status

- **Filename:** `NNNN-short-title-kebab-case.md` (four-digit sequence, increasing; short, stable slug).
- **Status line:** One of **Proposed**, **Accepted**, **Superseded** (optionally **Deprecated** if we need to mark obsolete text without a full superseding ADR). When superseding, point to the replacing ADR by number and title. Keep status language short and consistent so the index stays scannable.

## Required shape (compact)

Each ADR should include, in order:

1. **Status** — Current disposition (see above).
2. **Context** — Problem, constraints, and why a decision is needed now.
3. **Decision** — What we chose and enough detail to act on it.
4. **Rejected alternatives** — What we did not do and why (brief).
5. **Consequences** — What this implies for future work, tests, or operations.

Extra subsections (for example implementation notes) are fine when they clarify the decision; keep them subordinate so the five blocks stay easy to find.

## Historical record

**Accepted ADRs are not rewritten** to match the current codebase or mood. If the decision changes, add a new ADR that **supersedes** the old one and update the old ADR’s status to **Superseded** with a pointer to the replacement. That preserves reasoning for auditors and future maintainers.

### Superseding another ADR

When a newer ADR replaces an older one:

1. In the **new** ADR’s header or Context, name the superseded ADR by number and title and link its file.
2. In the **old** ADR, set **Status** to **Superseded**, and add a short line immediately after the title block (before Context) such as **Superseded by:** [ADR NNNN — Title](NNNN-short-title-kebab-case.md)—so readers who land on stale content are routed forward without reading obsolete decision text first.
3. Update the **Index** table below so the old row shows **Superseded** and the new row stays **Accepted** (or **Proposed** until merged).

Stale ADRs remain in the repo for audit history; redirects live in status and supersession links, not in silent edits to the accepted decision body.

### Relationship to `CONTEXT.md` and deepening notes

[CONTEXT.md](../../CONTEXT.md) defines **domain and boundary vocabulary** readers must align with across the repo; ADRs capture **specific, hard-to-reverse choices** (`docs/deepening/` notes are **not** substitutes for ADRs).

**Historical review write-ups** under **`docs/deepening/`** record exploration and review discussion. They complement ADRs but do **not** replace them: durable policy and glossary updates belong in **`CONTEXT.md`** or an ADR. When deepening work yields a constraint that should bind naming, ownership, or boundaries, promote it here or into a new ADR and link **`CONTEXT.md`** terms to that ADR only when the ADR materially constrains the term (see CONTEXT.md linking guidance)—not so every narrative thread becomes a mandatory glossary link.

## Index

| ADR | Title | Status |
|-----|--------|--------|
| [0001](0001-request-scope-boundary.md) | Request Scope boundary | Accepted |
| [0002](0002-food-log-mobile-first-admin-parity-deferred.md) | Food Log: mobile-first slice; admin parity deferred | Accepted |
