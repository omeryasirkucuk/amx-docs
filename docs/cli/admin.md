# Admin

The `/admin` namespace manages workspace members, roles, and audit
trails when AMX is wired to a shared history store. It is the CLI
surface for the team-collaboration features (see
[Team setup](../collaboration/team-setup.md) for the bigger picture).

`/admin` only operates on workspaces with shared mode enabled. In a
purely local install where every member runs their own AMX against
their own laptop, this namespace is not used.

## Prerequisites

- A shared history store registered with `/history-store enable`.
  Running an `/admin` command before that prints a clear error and
  exits.
- For **write** commands (`promote`, `demote`, `revoke`, `unrevoke`)
  the invoking user must already hold the **admin** role. The error
  message lists the active admins so you know who to ping.
- **Read** commands (`members`, `audit`, `sessions`) are open to any
  registered member.

Identity is taken from `getpass.getuser()` + `socket.gethostname()`,
the same `(username, hostname)` pair that registered when the user
first connected to the shared store. This is cross-platform — no
POSIX assumptions, no shell scraping — and the same identity that
shows up in the Studio admin panel.

## Commands

### `/admin members`

List every workspace member with role, last-seen timestamp,
revocation status, and client version.

```text
> /admin members
┌──────────┬──────────────┬────────┬──────────────────┬─────────┬─────────┐
│ Username │ Hostname     │ Role   │ Last seen        │ Revoked │ Version │
├──────────┼──────────────┼────────┼──────────────────┼─────────┼─────────┤
│ jane     │ jane-mbp     │ admin  │ 2026-05-28 09:14 │ no      │ 0.18.0  │
│ kai      │ kai-thinkpad │ viewer │ 2026-05-27 18:02 │ no      │ 0.18.0  │
│ sam      │ sam-pc       │ viewer │ 2026-04-12 11:42 │ yes     │ 0.17.2  │
└──────────┴──────────────┴────────┴──────────────────┴─────────┴─────────┘
```

Open to any role — useful as a "who is on this workspace?" check
before you ask an admin for a role change.

### `/admin promote [username]`

Promote a member to **admin**.

Wizard form. Bare `/admin promote` lists the current members,
prompts you to pick one, then confirms.

Power-user form. `/admin promote kai` skips the picker. Fails with
a clear error if `kai` is not registered yet (i.e. has never
connected to the shared store).

### `/admin demote [username]`

Demote an admin back to **viewer**.

Has an explicit invariant: **the last admin cannot be demoted**.
The store raises `AdminInvariantError` so the workspace can never
end up with zero admins. To replace the last admin, promote the
new one first, then demote the old one.

### `/admin revoke [username]`

Mark a member as **revoked**. Revoked users are blocked from
future connections to the shared store; their existing audit and
session rows are preserved.

Like `demote`, the last-admin invariant applies — you cannot
revoke the only admin.

### `/admin unrevoke [username]`

Reinstate a previously revoked member. After `unrevoke`, the
member can connect again with their original `(username, hostname)`
identity; their role is whatever it was before the revoke (admins
who were revoked come back as admins).

### `/admin audit [-n LIMIT] [--actor USER] [--action NAME]`

Show recent admin audit log entries, newest first. Defaults to the
last 20 rows. Filter by `--actor` (the admin who performed the
action) or `--action` (the action type — `admin_promote`,
`admin_demote`, `admin_revoke`, `admin_unrevoke`).

```text
> /admin audit -n 5
┌─────────────────────┬────────┬───────────────┬────────────────┬────────────────┐
│ Time                │ Actor  │ Action        │ Target user ID │ Target resource│
├─────────────────────┼────────┼───────────────┼────────────────┼────────────────┤
│ 2026-05-28 09:14:11 │ jane   │ admin_promote │ usr_3b2c        │ -              │
│ 2026-05-27 18:02:33 │ jane   │ admin_revoke  │ usr_9d1f        │ -              │
│ 2026-05-25 11:42:55 │ jane   │ admin_demote  │ usr_4a7b        │ -              │
│ 2026-05-22 14:08:00 │ kai    │ admin_revoke  │ usr_a8c0        │ -              │
│ 2026-05-21 16:31:17 │ jane   │ admin_promote │ usr_5f9e        │ -              │
└─────────────────────┴────────┴───────────────┴────────────────┴────────────────┘
```

Audit events are append-only and reflect every successful write
through `/admin`.

### `/admin sessions [--since ISO_DATETIME] [-n LIMIT]`

Show recent session connection events — every time a member's
client opens the shared store. Useful when you suspect a stale or
unauthorised client.

```text
> /admin sessions --since 2026-05-28T00:00:00
┌─────────────────────┬──────────┬──────────────┬─────────────┬─────────┬──────────┐
│ Time                │ Username │ Hostname     │ Event       │ Version │ Platform │
├─────────────────────┼──────────┼──────────────┼─────────────┼─────────┼──────────┤
│ 2026-05-28 09:14:11 │ jane     │ jane-mbp     │ session_open│ 0.18.0  │ darwin   │
│ 2026-05-28 08:02:33 │ kai      │ kai-thinkpad │ session_open│ 0.18.0  │ linux    │
└─────────────────────┴──────────┴──────────────┴─────────────┴─────────┴──────────┘
```

## Identity bootstrap

When a member runs AMX for the first time against a shared store,
their `(username, hostname)` row is auto-registered with the
**viewer** role. The very first member to connect on an empty
workspace is promoted to **admin** automatically — so a fresh
workspace always has at least one admin. From that point on,
`/admin promote` is the only way to add more admins.

If the host running AMX changes (e.g. you switch machines), the
new `(username, hostname)` is a fresh row in the member registry
with the default **viewer** role. Ask an existing admin to
promote it or copy the role from the previous row, depending on
your team's policy.

## Studio counterpart

The same surface is available in [AMX Studio](../studio/index.md)
under Operations → Workspace admin, with the same role-gating and
the same audit trail.

## See also

- [Team setup](../collaboration/team-setup.md) — wiring the shared
  history store, what tables are shared, and the concurrent-edit
  safeguards that ride on top of the member registry.
- [History](history.md) — single-user audit on a non-shared
  install; `/admin audit` is the team equivalent.
