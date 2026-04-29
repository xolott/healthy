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

## Index

| ADR | Title | Status |
|-----|--------|--------|
| [0001](0001-request-scope-boundary.md) | Request Scope boundary | Accepted |
