# Team setup

A recommended workflow for onboarding a team to AMX with [shared history store](shared-history-store.md)
enabled.

## 0. Pick a shared backend

Most teams already have a Postgres, Snowflake, Databricks, BigQuery, MySQL, Oracle, MSSQL,
or Redshift instance the team can write to. Use that. Don't stand up a new database for
AMX.

The shared backend should:

- Be reachable from every engineer's workstation (or at least every machine that will run
  AMX).
- Have permissions to `CREATE SCHEMA` and the four AMX tables. A read-write service
  account is fine.
- Be **separate from your production data warehouse** if possible — AMX's writes are
  small but they do go to the same engine.

## 1. One person enables shared mode

The first engineer to enable shared mode is the bootstrapper. They:

1. Add a DB profile pointing at the shared backend (`/add-db-profile shared_backend`).
2. Open the picker: `/db` → `/history-store`.
3. Pick **Enable**, choose `shared_backend`, accept the default schema (`AMX`) or pick
   another.
4. AMX bootstraps the schema and tables.
5. Pick **Migrate from local** to copy their existing local history rows up. This is
   idempotent — safe to re-run.

After enabling, every subsequent run on this machine is dual-written.

## 2. Hand the schema/profile name to the team

Send teammates a snippet they can drop into their `config.yml`:

```yaml
history_store_enabled: true
history_store_profile: shared_backend
history_store_schema: AMX
```

Or have them re-run `/setup` and add the same shared backend as a DB profile, then
`/db` → `/history-store` → **Enable** without bootstrap (they'll see the existing schema
and skip the DDL).

## 3. (Optional) Verify with `Status`

```text
/db
/history-store
1   # Status
```

Status shows:

- Shared mode state (on / off).
- Which profile and schema.
- The local `pending_shared_writes` outbox depth — should be `0` on a healthy install.

## 4. Recommended team conventions

### Use stable LLM and DB profile names

If everyone names their DB profile `prod_pg` for production Postgres, `/history compare`
and aggregate analysis across machines stays meaningful. Mixed names work but make later
analysis harder.

### Write CONTRIBUTING for AMX-specific norms

A short page in your team's wiki listing:

- Which DB profiles map to which environments.
- Which LLM profile is the team's default for paid runs.
- What the team's `/llm-thresholds` are (so confidence bands are comparable across runs).

### Run `/usage` weekly

```text
/usage 7d
```

Token cost is the most common surprise. Knowing the weekly burn lets the team decide
when to switch from synchronous to Batch.

### Tag big migrations with manual notes

Before a big run, add a one-liner to your team's wiki: "Running AMX against the SAP
upgrade tables, run id will start around 1340". When someone joins later and asks "what
were these runs?", you'll have context.

## Failure modes to watch

| Symptom | Likely cause | Fix |
|---|---|---|
| `pending_shared_writes` depth keeps growing | Shared backend is unreachable | Check network / VPN / credentials; then `Flush pending` |
| One engineer's runs not visible | Their `history_store_enabled` is `false` | Walk them through `/db` → `/history-store` → Enable |
| `ConfigSchemaTooNewError` on one machine | That AMX is older than the config | `pip install --upgrade amx` |
| Migration didn't pick up old runs | The migrate ran before the rows were written, or filtering excluded them | Re-run **Migrate from local** — it's idempotent |

## Disabling shared mode

```text
/db
/history-store
2   # Disable (when shared mode is on)
```

Existing shared rows are **not deleted**. Local writes go back to local-only. Re-enable
later without bootstrap (the schema and tables stay).

## Off-boarding

When an engineer leaves the team:

- Their workstation's `~/.amx/` no longer pushes to shared.
- Existing shared rows attributed to them stay (auditability).
- The team can identify their rows via the `created_by` and `hostname` columns.

There's no "purge a user" command — by design, the audit trail stays.
