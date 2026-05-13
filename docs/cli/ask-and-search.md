# `/ask` & `/search`

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

[2 profiles · 3.4 s · focus: prod-pg · 6,184 in / 412 out · $0.0029]
```

Every `/ask` answer ends with a `Cited:` block listing the catalog entries the LLM
actually used, plus a one-line footer with profile count, latency, the
auto-detected focus profile, and **per-turn token + USD cost**. If the
answer doesn't match the cited evidence, you've found a prompt or retrieval
bug — file it. Cost is computed against the same versioned per-(provider,
model) pricing table that powers the run cost surfaces; see
[Costs and pricing](../studio/pricing.md) for overrides and the
freshness badge.

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

### 4. Ask across multiple DB profiles

`/ask` operates over the **multi-profile scope** the SearchAgent collects at
startup — every DB profile in `cfg.active_db_profiles` (set via `/use-db a b c`)
or, when that list is empty, every saved DB profile in your config. Catalog
tools (`search_tables_by_concept`, `find_table_by_name`, `find_columns_by_dtype`,
`find_joinable_tables`) automatically span every profile in scope; live-DB tools
(`list_schemas`, `list_tables_in_schema`, `list_databases`) fan out per profile
in parallel with an 8-second per-profile timeout, so a slow / unreachable
profile never blocks the others.

```text
> /use-db sap warehouse                  # multi-profile scope
> /ask which tables hold customer data?
Reasoning over 14 results across 2 profiles ...

You have customer data in BOTH profiles:

  **sap.kna1** — Customer master (SAP). c_customer_id is the PK; FK targets
  in vbrk (billing), vbak (sales orders), kbn (campaigns).

  **warehouse.dim_customer** — Star-schema dimension (BigQuery). Different
  shape than SAP — tracks slowly-changing-dim history via valid_from /
  valid_to and a current_flag column. Joins to fct_orders.customer_sk.

Cited:
  - sap.public.kna1                  (table, profile=sap)
  - warehouse.analytics.dim_customer (table, profile=warehouse)
```

Every result row carries `db_profile` so the answer cites the right source.
You can also ask cross-profile join questions:

```text
> /ask what can I join sap.kna1 with from the warehouse profile?
Looking across warehouse for compatible columns ...

Top candidates (score = 0.30·name + 0.20·dtype + 0.40·vector + 0.10·fk):

  0.78  sap.public.kna1.kunnr (VARCHAR(10))  ↔  warehouse.analytics.dim_customer.cust_id (STRING)
        Strong: name overlap (cust↔kunnr via tokenisation), dtype family
        (string), FK pattern (kna1.kunnr is PK, dim_customer.cust_id ends in _id).

  0.61  sap.public.kna1.land1 (CHAR(3))      ↔  warehouse.ref.country.iso_code (STRING(3))
        Both 3-char ISO country codes. Caveat: weaker, the column comments
        don't share enough text to push the vector signal up.

Anything below 0.40 is coincidental and not recommended.
```

The cross-profile JOIN tool (`find_joinable_across_profiles`) kicks in
automatically when the question explicitly mentions cross-profile joining;
the LLM will fall back to the within-profile `find_joinable_tables` for
single-DB questions.

#### Per-question scope override

Need to scope a single question without changing the persisted scope?
Pass `--db-profile NAME` (multiple times for multi):

```text
> /ask --db-profile sap which schemas do I have?
> /ask --db-profile sap --db-profile warehouse cross-DB question
```

#### Sticky scope at the chat-session level

`/session scope <profiles>` pins a multi-profile scope to the active chat
session — separate from the persisted `/use-db` scope, so you can experiment
in one chat without disturbing the global default:

```text
> /session scope                         # show current scope
> /session scope sap warehouse           # pin to these two for THIS chat
> /session scope clear                   # back to config default
```

The Studio side has the equivalent control as a multi-select dropdown above
the Ask textarea — see [Studio → Ask](../studio/ask.md).

### 5. Manage chat sessions

Every `/ask` turn lives in a chat session that AMX persists to
`~/.amx/history.db`. Resume past sessions to continue a conversation —
prior turns flow back to the agent as context, so follow-ups like "describe
the first one" or "in Turkish" resolve without re-explaining.

```text
> /session list                          # most recent sessions for the active profile pair
ID    Started      Last active   State    Turns  Title             First question
→ 42  2026-05-06   2026-05-06    active   8      (auto)            which tables hold customer data?
  41  2026-05-05   2026-05-05    closed   3      Pricing tables    list every pricing-related table
  ...

> /session resume 42                     # make 42 the active session for the next /ask
> /ask describe the first one            # "first one" resolves to sap.public.kna1 from session 42's history

> /session new                           # start a fresh session
> /session end                           # close the active session; next /ask starts a new one
```

A few details worth knowing:

- **Cross-profile resume is refused.** Session #42 was created under
  `sap`/`gpt-4o`; switching to `warehouse`/`claude-3` and trying
  `/session resume 42` warns and bails — switch profiles first, or pass
  `--all-profiles` to `/session list` to find the right one.
- **`/session` works from every tab.** `/session list`, `/session resume`,
  etc. dispatch globally — no need to be at the root prompt.
- **Studio shares the store.** Sessions you start in CLI show up in
  Studio's Ask sidebar and vice versa — single source of truth at the
  SQLite level.

### 6. Cancelling a long question

Press <kbd>Ctrl-C</kbd> once to cancel a running `/ask` cleanly:

```text
ask> very-long-question-that-triggers-many-tool-calls
Search Agent: thinking with tools (3.4s)
^C
Cancelled by user.

ask>                                     # back at the prompt, chat session intact
```

The first press sets a `cancel_token` the agent loop checks between every
LLM iteration and tool dispatch — typically returns within a second or two.
A second press also raises `KeyboardInterrupt` so any blocked socket I/O
(rare; LiteLLM's HTTP retries) terminates immediately.

### 7. Drop to `/search` for raw retrieval

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
