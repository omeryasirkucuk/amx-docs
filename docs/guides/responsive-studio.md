# Responsive Studio on phone

AMX Studio is a desktop-first dashboard, but the SPA ships a phone-first
responsive shell so you can keep an eye on a running batch, review a
pending row, or trigger a re-run from a tablet or phone without dropping
into a separate mobile build. This page is a quick map of what works well
on narrow viewports, what falls back to a denser desktop layout, and the
Tailwind pattern contributors use to keep the shell coherent.

## What you can do on phone

| Surface | Phone behaviour |
|---|---|
| Landing | Action cards stack vertically. Browse opens the off-canvas sidebar. |
| Browse (`/db/...`, `/cat/...`) | Off-canvas sidebar with the multi-profile tree. Tap a row to drill in; the breadcrumb stays sticky so you can pop back. |
| Runs list | Single-column row list. Status chips and timestamps stay on each row; the Compare button is reachable from the row action sheet. |
| Run detail | Tabs stack. The live SSE banner stays sticky at the top with current activity + USD cost. Per-row alternatives carousel works on touch. |
| Ask | The Sessions card stacks above the chat. The chat bubble width respects the viewport; long markdown wraps via `break-words` plus `overflow-x-auto` on tables and code blocks. |
| Pending | Row list with inline edit + skip. Apply confirmation modal is mobile-safe (no horizontal overflow). |
| System | Section nav hides on narrow viewports; the page collapses to a vertical stack of cards. |
| Schedules | One-card-per-schedule list. Edit dialog is full-screen on phone. |
| Pricing | Cost summary cards stack; usage tables drop into a horizontal scroll within their card. |

## What falls back to desktop

A few surfaces are denser than a phone can render comfortably and fall
back to a horizontally-scrolling card instead of a phone-native shape:

- **The Usage table** on `/system` (provider × model × tokens × cost × runs).
  The card itself fits the phone, the table inside scrolls horizontally
  inside the card so the columns stay readable.
- **The Compare grid** on `/runs/compare` — two- to four-run side-by-side
  is a desktop affordance. The page still loads on phone, but you'll want
  to rotate.
- **The Audit timeline diff column** — long before/after diffs scroll
  horizontally rather than re-flow.

## Contributor pattern — keep the shell coherent

Studio uses Tailwind for layout. Contributors keep the responsive surface
coherent by following one rule on every new page:

> **Stack on narrow.** Default layout is single-column; `sm:`, `md:`, and
> `lg:` prefixes are what introduce side-by-side grids — never the other
> way around.

Concretely:

```tsx
// good — phone-first, desktop adds the grid
<div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)] [&>*]:min-w-0">
  <SessionsCard />
  <AskChat />
</div>

// bad — desktop-first, phone gets a clipped multi-column layout
<div className="grid gap-4 grid-cols-[18rem_1fr] sm:grid-cols-1">
  ...
</div>
```

Three pitfalls worth calling out:

1. **`min-w-0` on grid children.** A bare `1fr` grid column doesn't shrink
   below its content's intrinsic width. On a phone, any nested element
   that's wider than the viewport (a long inline code, a wide chat bubble)
   will force the grid to overflow horizontally. Use
   `md:grid-cols-[Xrem_minmax(0,1fr)]` and `[&>*]:min-w-0` so children
   can shrink.
2. **`hideOnMobile` columns in DataTable.** The Studio DataTable component
   accepts a per-column `hideOnMobile` flag. Use it on columns that aren't
   load-bearing on phone (e.g. the host column on Audit) instead of letting
   the table overflow.
3. **Dialogs need an explicit width.** Material-style dialogs default to a
   centered 480 px width; that's too wide for a 360 px phone. Use the
   project's `<Dialog mobileSafe>` variant (or `w-full sm:max-w-md`) so
   the dialog content reflows on narrow viewports.

The `superpowers:writing-skills` and contributor guides reinforce the same
pattern — resize manually before shipping a new page. The pixel ruler in
your browser's dev tools is enough; the `360 × 800` preset is the most
honest target for the AMX user base.

## Service worker / cache

Studio registers a service worker that caches the SPA bundle. When you
ship a frontend change, the *new* bundle is in `amx/web/static/assets/`
right away but a phone that already loaded the *old* one stays on it
until the SW notices the new `index.html`. Hard refresh (or close + reopen
the tab) to force the swap.

## Verify

1. Resize the Studio window to `360px` wide in Chrome DevTools or open
   the URL on a phone.
2. Click through Landing → Browse → Runs → Run detail → Ask → System.
3. Confirm no surface scrolls horizontally except inside cards that
   intentionally allow it (Usage table, Compare grid, Audit diffs).
4. Open a Schedule edit dialog — it should fill the phone screen, not
   spill off the right edge.

## What's next

- [Studio overview](../cli/studio.md) — the desktop counterpart to this
  guide; same routes, denser surface.
- [Multi-profile scoping](../concepts/scoping.md) — the picker is the
  same on phone and desktop; the off-canvas sidebar is the phone shell
  for it.
