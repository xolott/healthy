# Healthy Context

## Shared context scope

This file is authoritative for **domain terms** (product-relevant concepts) and **stable boundary vocabulary**—language that callers, routes, persistence seams, and tests must agree on so architectural boundaries stay legible across the repo.

Keep it deliberately narrow. Do **not** treat `CONTEXT.md` as:

- A broad catalog of modules, packages, folders, or “where everything lives”
- A changelog, release narrative, or history of edits
- A stand-in for [Architecture Decision Records](docs/adr/) (use ADRs for hard-to-reverse trade-offs)

**Stable vocabulary versus incidental naming.** Entries belong here when a name denotes a sanctioned concept or boundary the team must reuse consistently (for example persistence seams aligned with policy and HTTP translation). Ordinary helpers, constructors, factories, or test adapters stay documented next to implementation unless they are explicitly promoted to shared boundary terms (when they are, define the boundary here, not the incidental mechanics).

**When this file must change in the same PR.** Update `CONTEXT.md` together with code when the PR **introduces** a new domain or boundary term, **renames** one, or **materially redefines** what a documented term means (ownership, invariants, or caller-visible contract).

**Reviewers and term drift.** If implementation, tests, or docs diverge from a definition here, fix that in **the same PR**: align names and wording to the canonical term in this file, **or** deliberately revise the glossary entry when the underlying model legitimately changed. Unresolved drift—or silent synonym swaps—is the problem to avoid.

**File paths and links.** Brief pointers (for example to the module that owns a seam) are fine when they clarify **ownership** without tying the definition to incidental layout or filenames that refactor often.

**Linking a domain term to an ADR.** Add a link under a glossary entry **only when** the [Architecture Decision Record](docs/adr/) **materially constrains** how that term is used: its **meaning**, **ownership**, or **boundary** in code and reviews. If an ADR merely mentions a term or walks past it without setting a durable rule for that vocabulary, leave the definition here self-contained—**do not** treat ADR links as exhaustive history trails or require a link every time a term appears in a decision record. Reviewers apply this rule pragmatically: one strong pointer beats a checklist of mentions.

The **Request Scope** glossary entry below illustrates the linking rule: it includes **one** pointer to ADR 0001 where that decision constrains responsibility at the persistence seam (versus repeating the link wherever the vocabulary appears elsewhere).

**Durable vocabulary and policy versus deepening notes.** This file and [docs/adr/](docs/adr/README.md) are the **canonical, durable** place for shared terms and load-bearing architectural decisions—what newcomers and auditors should rely on day to day. Exploratory or historical architecture review narratives live under **`docs/deepening/`**. Deepening notes may motivate ADRs or glossary updates, but they are **not** operating policy by themselves; when a review conclusion should bind the repo, lift it into `CONTEXT.md` or an ADR and link from here as appropriate.

## Domain Terms

### Pantry

The user's reusable catalog of nutrition items for meal logging: Foods and
Recipes with serving and nutrient definitions, not an inventory of quantities on
hand.

_Avoid_: inventory, stock, cupboard.

Each authenticated user owns their own Pantry.
Pantry items may carry a stable app-owned icon key.

### Pantry Item

A user-owned Food or Recipe in the Pantry.

### Food

A single product or ingredient in the Pantry with its own serving and nutrient
definitions.

Foods define nutrients against a measurable base amount and may expose multiple
serving options that convert to that base. Serving options use common predefined
units or user-defined serving labels. Food mass is normalized to grams.
Foods require values for Calories, Protein, Fat, and Carbohydrates.

### Recipe

A reusable Pantry item composed from one or more Foods or Recipes and a declared
number of servings.

Recipes may include other Recipes but must not form cycles.
Recipe nutrients are computed from ingredient amounts and serving count.
Each Recipe ingredient identifies a Pantry item, one of that item's serving
options, and a quantity.
Recipes expose a serving label that defaults to "serving" and does not require a
weight conversion.
Recipes require at least one ingredient.

### Nutrient

A measurable nutrition fact from a catalog of supported nutrients, initially
Calories, Protein, Fat, and Carbohydrates.

Each Nutrient defines its canonical unit, and nutrient amounts are recorded in
that unit.

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

Stable wiring that builds Auth Use Cases from an existing Drizzle handle plus hashing
and session collaborators (`services/api/src/auth/auth-use-case-scope.ts`).
`createRequestScopeForApp` invokes it with the configured **Database Adapter**'s Drizzle
client when persistence is configured. Routes consume Request Scope capabilities only;
they do not import this module.

Policy tests construct Auth Use Cases with the Auth Test Adapter directly. Repository
shape in `@healthy/db` at this seam is unchanged.

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
Database Adapter and Request Scope implementation, not in routes. [ADR 0001 — Request Scope boundary](docs/adr/0001-request-scope-boundary.md) constrains route versus persistence ownership for this vocabulary.

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