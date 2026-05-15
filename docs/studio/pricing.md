# Pricing

`/pricing` is the LLM pricing browser. It surfaces the cached
per-(provider, model) rates AMX uses to compute USD cost on every run.

## Where the numbers come from

AMX fetches rates from two sources:

- **LiteLLM** — community-maintained pricing catalogue, broad coverage
- **OpenRouter** — authoritative for OpenRouter-routed models

Rates are cached on disk with a freshness timestamp. The top-bar
**pricing-cache badge** turns warm-yellow when the cache is more than 24
hours old; clicking it forces a refresh.

A bundled fallback ships with AMX so a brand-new install with no
network access still has reasonable estimates.

## Table

| Column | Notes |
|---|---|
| Model | `model_id`, mono font |
| Provider | Provider hint |
| Input $/Mtok | Per-million-token input price |
| Output $/Mtok | Per-million-token output price |
| Source | litellm / openrouter / fallback |
| Fetched | Relative age of the cached price ("2 h ago") |

The table is searchable (by model ID, provider, source) and filterable
by source. Sort by clicking any column header.

## Staleness banner

When the cache is older than 24 hours, a yellow banner appears above
the table:

> These prices are more than 24 h old. Click the refresh icon in the
> topbar to pull fresh data.

The same staleness signal drives the topbar badge colour and the cost
columns on [Overview](overview.md) (no warning, but the totals are
pinned to the rates that were live when each run ran).

## Empty state

A brand-new install with no cache and no network falls back to the
bundled rates. The empty state renders:

> No price data loaded yet. Click the refresh icon in the topbar or
> check that the AMX process can reach the public LiteLLM /
> OpenRouter endpoints.

## CLI equivalents

| Studio | CLI |
|---|---|
| Pricing table | `/refresh-prices` (re-fetches into the same cache) |
| Per-model override | `/cost <input> <output>` on the active profile |
