// AMX docs — light enhancements on top of Material.

// ── Page-slug data attribute (used by CSS to target home page) ──
function setPageSlug() {
  const path = window.location.pathname.replace(/\/$/, "");
  const slug = path.split("/").filter(Boolean).pop() || "index";
  document.body.dataset.page = slug;
}

// ─────────────────────────────────────────────────────────────────────
// Anchor-jump offset for the sticky header.
//
// CSS scroll-margin-top + scroll-padding-top would normally handle this,
// but mkdocs-material's navigation.instant intercepts in-page anchor
// clicks and runs its own window.scrollTo({top: y}) — that path bypasses
// scroll-margin-top entirely, so the heading lands right under the 56px
// sticky header and the user sees the previous section.
//
// Fix: capture-phase click handler that runs BEFORE Material's, computes
// the correct offset target, scrolls there ourselves, and stops the
// event so Material doesn't fight us.

const ANCHOR_OFFSET_PX = 80; // header (56px) + breathing room (24px)

document.addEventListener(
  "click",
  function (e) {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    const id = decodeURIComponent(href.slice(1));
    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    const y = target.getBoundingClientRect().top + window.scrollY - ANCHOR_OFFSET_PX;
    window.scrollTo({ top: y, behavior: "smooth" });

    // Reflect the anchor in the URL so back/forward + share-link work.
    if (window.history && window.history.pushState) {
      window.history.pushState(null, "", href);
    }
  },
  true // capture phase — fires before Material's listener
);

// On initial load with #fragment in URL, also re-apply the offset.
window.addEventListener("load", function () {
  if (!location.hash) return;
  const id = decodeURIComponent(location.hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return;
  // Wait for fonts/images so the heading's final position is settled.
  setTimeout(function () {
    const y = target.getBoundingClientRect().top + window.scrollY - ANCHOR_OFFSET_PX;
    window.scrollTo({ top: y, behavior: "auto" });
  }, 100);
});

// ─────────────────────────────────────────────────────────────────────
// Sidebar scroll preservation
//
// The left-sidebar scroll container is .md-sidebar__scrollwrap (Material's
// default). We continuously snapshot its scrollTop into sessionStorage on
// every scroll event, then restore on every page setup. We restore at
// multiple delays because Material may try to auto-scroll the sidebar to
// the active link after page load, and we want our saved position to win.

const SCROLL_KEY = "amx-sidebar-scrollTop";
const SCROLL_SELECTORS = [
  ".md-sidebar__scrollwrap",
  ".amx-sidebar__tree",
  ".md-sidebar--primary"
];

function getScrollContainer() {
  for (const sel of SCROLL_SELECTORS) {
    const el = document.querySelector(sel);
    if (!el) continue;
    // Only return one that actually has scrollable overflow.
    if (el.scrollHeight > el.clientHeight + 4) return el;
  }
  // Fallback to the first existing one even if it's not currently overflowing.
  for (const sel of SCROLL_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

let _scrollSaveTimer = null;
function attachScrollSaver() {
  // Listen on every candidate so we catch whichever element actually scrolls.
  SCROLL_SELECTORS.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      // Avoid double-binding
      if (el.dataset.amxScrollBound === "1") return;
      el.dataset.amxScrollBound = "1";
      el.addEventListener(
        "scroll",
        () => {
          if (_scrollSaveTimer) clearTimeout(_scrollSaveTimer);
          _scrollSaveTimer = setTimeout(() => {
            sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
          }, 40);
        },
        { passive: true }
      );
    });
  });
}

function restoreScroll() {
  const saved = parseInt(sessionStorage.getItem(SCROLL_KEY) || "0", 10);
  if (!saved) return;

  function apply() {
    SCROLL_SELECTORS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight + 4 && el.scrollTop !== saved) {
        el.scrollTop = saved;
      }
    });
  }

  // Multiple delays — Material's instant nav may scroll the sidebar to the
  // active link slightly after navigation. Re-apply our saved position
  // several times in the first 500ms so our value wins.
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 50);
  setTimeout(apply, 150);
  setTimeout(apply, 350);
}

function setup() {
  setPageSlug();
  attachScrollSaver();
  restoreScroll();
}

// ── Initial page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}

// ── mkdocs-material instant navigation: hook history.pushState + popstate.
(function patchHistory() {
  const orig = history.pushState;
  history.pushState = function () {
    const r = orig.apply(this, arguments);
    setTimeout(setup, 0);
    return r;
  };
  window.addEventListener("popstate", () => setTimeout(setup, 0));
})();

// ── Defensive: capture-phase click handler that snapshots scroll
// immediately before any link nav, so even if a scroll listener somehow
// hasn't fired yet, the latest position is captured.
document.addEventListener(
  "click",
  function (e) {
    const link = e.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#")) return;
    const el = getScrollContainer();
    if (el) sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
  },
  true
);
