# `/ask` and `/search`

`/ask` is conversational metadata Q&A grounded in AMX's internal search catalog. You ask
in natural language; AMX retrieves the most relevant tables / columns / docs / code, and
the LLM answers using only that retrieved context (so answers don't hallucinate
columns that don't exist). `/search` is the lower-level command that powers `/ask` —
useful when you want to inspect what's indexed without involving the LLM.

## Prerequisites

- AMX installed.
- An active DB profile that has been introspected at least once (run `/sync` if not).
- An active LLM profile (used for the answer step in `/ask`; `/search` doesn't need one).

## Step-by-step

### 1. Sync the search catalog

```text
> /search status
Search catalog: 47 tables · 1,283 columns · 0 docs · 0 code refs
Last sync: 2 hours ago (2026-05-03 13:42)
Embedding model: openai/text-embedding-3-small
Index store: chroma at ~/.amx/chroma/

> /sync
[1/4] Refreshing introspection cache ......  ok (47 tables, 1,283 columns)
[2/4] Embedding 1,330 entries ..............  ok (4.1 s, $0.012)
[3/4] Updating Chroma index ................  ok
[4/4] Reconciling with description audit ...  ok
✓ /sync finished. Catalog ready for /ask.
```

The first `/sync` against a fresh DB takes a moment (one embedding call per table +
column). Subsequent syncs only re-embed entries whose names or descriptions changed.

### 2. Ask a natural-language question

```text
> /ask which tables hold customer addresses?
Searching catalog (top-k: 8) ...
Reasoning over 8 results ...

Customer addresses live in **sales.customer_address**, with foreign key columns to
sales.customer (ca_customer_sk) and to a normalised geography table (ca_country_id).
For shipping-only addresses, see sales.order_address — it's a per-order snapshot
that can diverge from the customer's current address.

Cited:
  - sales.customer_address  (table)        — Address records keyed to customer.
  - sales.customer_address.ca_customer_sk  (column) — FK to sales.customer.
  - sales.order_address     (table)        — Per-order snapshot; not the source of truth.
  - sales.customer          (table)        — Customer master; one current address per customer.
```

Every `/ask` answer ends with a `Cited:` block listing the catalog entries the LLM
actually used. If the answer doesn't match the cited evidence, you've found a prompt
or retrieval bug — file it.

### 3. The seven answer shapes

`/ask` adapts its answer shape to what the question is asking for. Same syntax —
`/ask <natural-language question>` — different output structures:

#### Shape 1 — Definition

```text
> /ask what is c_customer_sk?
sales.customer.c_customer_sk is the **surrogate key** for the customer master table —
an integer assigned at insert time, used as the FK target by every dependent table
(orders, addresses, payment methods).

Cited:
  - sales.customer.c_customer_sk
```

#### Shape 2 — Lookup (one specific table/column)

```text
> /ask where is total revenue computed?
**fct_order_summary.gross_revenue** holds gross revenue per order at the line-item
level (sum of line totals before discounts). For the daily aggregate, see
**fct_revenue_daily.daily_gross**.

Cited:
  - fct_order_summary.gross_revenue
  - fct_revenue_daily.daily_gross
```

#### Shape 3 — Listing (multiple matches)

```text
> /ask list every table with a "deleted_at" column
Found 7 tables with a deleted_at column:
  - sales.customer (deleted_at, soft-delete marker added 2023)
  - sales.customer_address (deleted_at)
  - sales.order_summary (deleted_at)
  - catalog.product (deleted_at)
  ...

Cited: (7 column entries elided)
```

#### Shape 4 — Cardinality / numeric

```text
> /ask how many tables in sales schema?
**18 tables** in the sales schema (16 base tables, 2 views — materialized views
counted separately: 1).

Cited:
  - /db inspect output (sales schema summary)
```

#### Shape 5 — Pathfinding (joins)

```text
> /ask how do I join orders to customers by region?
Join chain (3 hops):

  fct_orders
    ON o_customer_sk = c_customer_sk
  sales.customer
    ON c_address_sk = ca_address_sk
  sales.customer_address
    ON ca_country_id = country_id
  ref.country

There's also a denormalised path via fct_order_summary if you only need the
country code per order — that table joins customer_address up-front.

Cited:
  - fct_orders.o_customer_sk
  - sales.customer.c_address_sk
  - sales.customer_address.ca_country_id
  - ref.country.country_id
  - fct_order_summary (denormalised alternative)
```

#### Shape 6 — Reconciliation (which to trust)

```text
> /ask is fct_order_summary.gross_revenue the same as fct_revenue_daily.daily_gross?
**No — they differ in granularity and tax handling.**

  fct_order_summary.gross_revenue — per-order, sum of line items, BEFORE discounts.
  fct_revenue_daily.daily_gross   — daily aggregate, AFTER discounts but BEFORE tax.

If you're chasing a per-day number, `daily_gross` is the source of truth. To reconcile
to per-order, sum `gross_revenue` minus the matched discount rows in fct_order_discount.

Cited:
  - fct_order_summary.gross_revenue
  - fct_revenue_daily.daily_gross
  - fct_order_discount
```

#### Shape 7 — "I don't know"

```text
> /ask what is the retention policy for telemetry events?
I couldn't find a description of "retention policy" in this catalog. The closest
matches were:
  - events.telemetry_raw (no description on the table)
  - events.telemetry_aggregate (has a description but doesn't mention retention)

This is likely documented outside the database catalog. Try /add-doc-profile to point
AMX at your internal documentation, then /ask again.

Cited:
  - events.telemetry_raw
  - events.telemetry_aggregate
```

This shape is the most important — `/ask` must say "I don't know" rather than fabricate.

### 4. Drop to `/search` for raw retrieval

```text
> /search "customer addresses"
Top-8 results (cosine distance):
  0.142  sales.customer_address      (table)   Address records keyed to customer.
  0.198  sales.customer              (table)   Customer master; one current address per customer.
  0.214  sales.customer_address.ca_customer_sk  (col)   FK to sales.customer.
  0.301  sales.order_address         (table)   Per-order snapshot.
  0.318  sales.customer_address.ca_country_id    (col)   FK to ref.country.
  0.402  fct_order_summary.ship_country_code      (col)   Denormalised.
  0.411  ref.country.country_id      (col)   Country master PK.
  0.477  events.address_change_audit (table)   Append-only audit log.
```

`/search` is the same retrieval `/ask` runs internally, minus the LLM step. Useful
for confirming the catalog has the rows you expect before you blame the LLM for a bad
answer.

## Sample config

```yaml
search:
  embedding_model: openai/text-embedding-3-small
  top_k: 8
  index_store: ~/.amx/chroma
```

## Verify

1. `> /search status` — confirms catalog row count, last-sync time, and embedding-model identity.
2. `> /search "<a phrase you definitely know is in the catalog>"` — confirms retrieval works at all.
3. `> /ask <a question with a known answer>` — confirms the LLM step works and citations resolve.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/ask` says "I don't know" for everything | Catalog isn't synced or is empty | `> /sync` and re-check `/search status` |
| `/search` returns nothing for a known column | Embedding-model mismatch (you changed model after indexing) | `> /search rebuild` to drop and re-embed |
| Citations don't resolve to real rows | DB profile changed and catalog wasn't re-synced | `> /sync` after switching DB profile |
| `/ask` answer contradicts the citations | Prompt regression — file an issue with the run id from `/history list` | Workaround: lower `n_alternatives` to 1 to make answers more conservative |
| `/sync` is slow on every run | Embedding-model latency, not AMX | Use a smaller model: `embedding_model: openai/text-embedding-3-small` |
| Out-of-disk after several rebuilds | Chroma index isn't garbage-collected | `> /search rebuild` (drops the old index) or `rm -rf ~/.amx/chroma` and re-`/sync` |

## What's next

- [Search catalog](../data-sources/search-catalog.md) — how the catalog is built, when to `/sync` vs `/rebuild`.
- [Documents](../data-sources/documents.md) / [Codebase](../data-sources/codebase.md) — feed external context so `/ask` can answer "where is the retention policy" with real evidence.
- [Run & Apply](run-and-apply.md) — write descriptions back so `/ask` has more to retrieve from next time.
