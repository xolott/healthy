# ADR 0004 — USDA Reference Food import snapshot (multi-file contract)

**Status:** Accepted

**Parent product context:** GitHub issue **#113** (*Support multi-file USDA
Reference Food snapshots*).

## Context

USDA FoodData Central publishes **Foundation Foods** and **Branded Foods** as
**separate** bulk JSON files. The platform keeps **`usda_fdc`** as a **single**
Reference Food source ([ADR 0003 — Reference Food
architecture](0003-reference-food-architecture.md) retains Postgres as authority
for rows and lifecycle).

Historically, a one-file import run behaved as if **that file alone** were the
complete `usda_fdc` snapshot: after a successful pass, rows not present in the
file were **deactivated**. Importing only Foundation Foods therefore
**deactivated** Branded Foods (and the reverse), even though both datasets are
required for a combined USDA catalog.

Operators need **one operator command**—with **one** `sourceVersion` for the
whole run—to represent **one complete USDA snapshot**, spanning **all** files
that define that snapshot. Reviews and tests need shared language for snapshot
boundary, **audit evidence**, **duplicate identity** behavior, and **failure**
semantics before and after streaming imports complete.

## Decision

### Snapshot boundary

A **Reference Food Import Snapshot** for USDA is the **complete, validated
multi-file input** to **one** import invocation for source `usda_fdc`, not the
contents of a **single** JSON file in isolation.

- **Default completeness:** The snapshot is expected to include **Foundation
  Foods and Branded Foods** unless the operator supplies an **explicit expected
  dataset set** override (for future USDA packaging changes or intentional
  universe reduction).
- **Override semantics:** An explicit expected-set override defines the **full
  intended active universe** for that source at that version: records belonging
  to datasets **outside** the override may be **deactivated** after a **fully
  successful** snapshot, consistent with intentional removal of a dataset from
  support.

One physical file is therefore **never** treated as the complete `usda_fdc`
snapshot when the operator’s intent is the **default** USDA catalog: **both**
default datasets must be present and validated **before** publication-style
steps (below) run.

### Identity and duplicates within one snapshot

- **Provider identity** for USDA rows remains **`fdcId`** as the source food
  identifier, scoped to `usda_fdc` ([CONTEXT.md](../../CONTEXT.md)).
- **Duplicate `fdcId`** values **within one snapshot** (across files after merge
  of the planned inputs) **fail** the import: conflicting provider identity
  must not be applied silently.

### Deactivation (publication step)

- **Deactivation** (marking active Reference Foods inactive when their source
  food ids are **missing** from the snapshot’s key set) runs **only after** the
  **entire** snapshot is judged **successful** (all files processed and
  validation satisfied for the chosen expected set).
- A **failed** snapshot run **must not** execute that deactivation step: the
  catalog’s prior **active/inactive** outcome from the **last successful**
  snapshot remains authoritative for lifecycle.

### Failure semantics and partial persistence

- **Failed imports** do **not** deactivate rows (same as above).
- **Large / streaming** processing does **not** require a **single
  all-or-nothing** database transaction over every row upsert. If a run **fails
  mid-stream**, **some rows may already have been upserted** in Postgres;
  operators accept that **partial upserts** may remain until a subsequent
  successful run repairs or completes the snapshot. This trades strict
  all-or-nothing row persistence for **operable** imports of very large files.

**Out of scope:** Automatically repairing Elasticsearch; reindex remains an
explicit operator step after import, consistent with ADR 0003.

### Audit manifest (per file)

Each snapshot run records an **auditable per-file manifest** sufficient to
reconstruct **what** was imported. At the decision level it includes:

- **File identity** (path or stable label available to the operator).
- **Detected USDA dataset** (Foundation vs Branded, etc.) per file—using
  content-first detection with filename fallback as specified in the PRD, with
  failure on ambiguity or disagreement.
- **Cryptographic file hash** (e.g. SHA-256 over the file bytes read for
  import).
- **Record counts** (foods read / normalized at least at aggregate level; exact
  field layout is an implementation concern).

Import **run** history persists **multi-file** manifest data so audits remain
useful after moving beyond single-file imports.

### Deterministic snapshot hash (run level)

Each successful planning phase yields a **deterministic snapshot hash** for the
**whole** multi-file snapshot so operators can **compare** two runs for
equivalence of inputs.

- Inputs are combined in a **stable order** (defined by the implementation;
  document the rule in code comments or operator docs when implemented—e.g.
  ordered by a canonical key such as dataset type then path).
- The hash is derived from **per-file identity and hashes** (and any other
  canonical planning inputs required for equivalence) so that **the same files
  and dataset plan** produce **the same** run-level hash.

Exact serialization is implementation-defined; the **decision** is: **one hash
per multi-file snapshot**, stable given the same inputs and options, suitable for
audit and verification.

### Planning versus execution

**Validation** of file set, dataset detection, duplicate keys, and manifest /
snapshot-hash computation should live in a **planning** boundary that can be
tested without the database; the **runner** focuses on streaming, upserts,
import-run state, and **conditional** deactivation after success (as sketched in
the PRD).

## Rejected alternatives

- **One file = full `usda_fdc` snapshot (status quo):** Breaks combined
  Foundation + Branded operation; causes accidental mass deactivation.
- **Split Foundation and Branded into separate Reference Food sources:** Adds
  product and search complexity; PRD keeps one `usda_fdc` source.
- **Mandatory single transaction for all USDA upserts:** Impractical for very
  large dumps; rejected in favor of streaming with explicit partial-failure
  semantics.

## Consequences

- CLI and import code move from “single `filePath`” to **validated multi-file**
  snapshot semantics; integration tests should cover multi-file success,
  default expected-set rejection of a single partial file, failed runs without
  deactivation, and override behavior (per PRD testing decisions).
- **Persistence** for import runs must carry **multi-file** manifest fields;
  snapshot hash and status remain central to audit.
- Shared vocabulary for **Reference Food Import Snapshot** stays in
  [CONTEXT.md](../../CONTEXT.md); this ADR constrains **USDA multi-file**
  meaning and failure/manifest expectations—link from the glossary entry.
