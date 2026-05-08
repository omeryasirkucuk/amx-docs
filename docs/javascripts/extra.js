// AMX docs — light enhancements on top of Material.

// ─────────────────────────────────────────────────────────────────────
// Header social-proof badges: GitHub star count + PyPI monthly downloads.
//
// Both fetch from public APIs and cache for an hour in localStorage,
// so each unique browser makes at most ≤24 requests/day per source —
// well under any rate limit. Graceful fallback: if either API is
// unreachable or rate-limited, the "—" placeholder stays on screen
// while the other badge can still update independently.

function _amxFormatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function _amxLoadBadge(opts) {
  // opts: { cacheKey, ttlMs, url, extract, selector }
  function paint(n) {
    document.querySelectorAll(opts.selector).forEach(function (el) {
      el.textContent = _amxFormatCount(n);
    });
  }
  // Try cache first
  try {
    const raw = localStorage.getItem(opts.cacheKey);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && Date.now() - obj.t < opts.ttlMs && typeof obj.n === "number") {
        paint(obj.n);
        return;
      }
    }
  } catch (e) { /* ignore */ }
  // Fetch fresh
  fetch(opts.url, opts.headers ? { headers: opts.headers } : undefined)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      const n = j ? opts.extract(j) : null;
      if (typeof n !== "number") return;
      try {
        localStorage.setItem(opts.cacheKey, JSON.stringify({ n: n, t: Date.now() }));
      } catch (e) { /* storage full / disabled — ignore */ }
      paint(n);
    })
    .catch(function () { /* offline / rate-limited — keep the "—" fallback */ });
}

function _amxLoadAllBadges() {
  // GitHub star count (unauth API: 60/hr per IP)
  _amxLoadBadge({
    cacheKey: "amx-gh-star-count",
    ttlMs: 60 * 60 * 1000,
    url: "https://api.github.com/repos/omeryasirkucuk/amx",
    headers: { Accept: "application/vnd.github+json" },
    extract: function (j) { return j.stargazers_count; },
    selector: "[data-amx-github-stars]",
  });
  // PyPI monthly downloads — read from a same-origin JSON file baked at
  // deploy time by the GitHub Actions workflow. We can't fetch
  // pypistats.org directly from the browser because pypistats responses
  // carry no CORS headers, so the cross-origin fetch is blocked and the
  // badge stays at "—". The workflow runs `curl pypistats | jq` from the
  // server side (no CORS) and writes /assets/pypi.json before mkdocs
  // builds. JSON shape: {"n": <int>, "t": <epoch_ms>}.
  _amxLoadBadge({
    cacheKey: "amx-pypi-dl-month",
    ttlMs: 60 * 60 * 1000,
    url: "/assets/pypi.json",
    extract: function (j) {
      return j && typeof j.n === "number" ? j.n : null;
    },
    selector: "[data-amx-pypi-downloads]",
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _amxLoadAllBadges);
} else {
  _amxLoadAllBadges();
}

// ─────────────────────────────────────────────────────────────────────
// ⌘K / Ctrl-K shortcut to open the search modal.
// Material already binds "/" and "s" by default; we add the macOS-
// canonical ⌘K and the cross-platform Ctrl-K so the kbd hint in the
// header search trigger is honest.
document.addEventListener("keydown", function (e) {
  // Ignore if focus is in an editable surface
  const t = e.target;
  const inEditable =
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.isContentEditable);

  // ⌘K (mac) or Ctrl-K (others)
  if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
    const cb = document.getElementById("__search");
    if (!cb) return;
    e.preventDefault();
    if (!cb.checked) cb.click();
    // Focus the search input shortly after opening
    setTimeout(function () {
      const input = document.querySelector(".md-search__input");
      if (input) input.focus();
    }, 60);
  }
});

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

function scrollToAnchor(id, behavior) {
  const target = document.getElementById(id);
  if (!target) return false;
  const y = target.getBoundingClientRect().top + window.scrollY - ANCHOR_OFFSET_PX;
  window.scrollTo({ top: y, behavior: behavior || "smooth" });
  return true;
}

// Capture-phase click handler — fires before Material's instant-nav
// listener, calls preventDefault + stopImmediatePropagation so Material
// can't run its own scrollTo on the same click.
//
// Search-result links (inside .md-search__output) are skipped so
// Material's own search handler can navigate + close the modal cleanly.
document.addEventListener(
  "click",
  function (e) {
    // Don't hijack clicks inside the search result list
    if (e.target.closest(".md-search__output")) return;

    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    const id = decodeURIComponent(href.slice(1));
    if (!document.getElementById(id)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    scrollToAnchor(id, "smooth");
    if (window.history && window.history.pushState) {
      window.history.pushState(null, "", href);
    }
  },
  true
);

// When a search result is clicked, close the modal so the user lands
// on the navigated page without the panel still in the way. (Material
// closes it on full-page nav already, but for same-page hash nav the
// modal would otherwise stay open.)
document.addEventListener("click", function (e) {
  if (!e.target.closest(".md-search__output a[href]")) return;
  const cb = document.getElementById("__search");
  if (cb && cb.checked) {
    // Defer one frame so Material's own navigation handler runs first
    requestAnimationFrame(function () {
      cb.checked = false;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
});

// hashchange fallback — if for any reason Material's scroll still won
// (e.g. an event bubbled up before our handler ran), this fires after
// and re-applies the correct offset. Negligible jank: a single
// 0-distance scrollTo when our handler already did the right thing,
// or a corrective scrollTo when it didn't.
window.addEventListener("hashchange", function () {
  if (!location.hash) return;
  const id = decodeURIComponent(location.hash.slice(1));
  // Defer so any in-flight smooth-scroll has a chance to settle.
  setTimeout(function () { scrollToAnchor(id, "auto"); }, 50);
});

// Initial-load deep-link with #fragment
window.addEventListener("load", function () {
  if (!location.hash) return;
  const id = decodeURIComponent(location.hash.slice(1));
  setTimeout(function () { scrollToAnchor(id, "auto"); }, 100);
});

// ─────────────────────────────────────────────────────────────────────
// Custom right-TOC active-state tracker
//
// Material's stock IntersectionObserver for the "On this page" panel
// uses a threshold that doesn't match our 80px sticky-header offset,
// so the active vertical bar points one section ABOVE where the user
// actually is. We replace it with a scroll-driven check that flips
// the active class based on which heading's top is closest to (and
// above) the 100px-from-top mark.

const TOC_ACTIVE_OFFSET = 100; // header (56) + buffer below

function updateTocActive() {
  const headings = document.querySelectorAll(
    ".md-content h1[id], .md-content h2[id], .md-content h3[id], .md-content h4[id]"
  );
  if (!headings.length) return;

  // Find the last heading whose top is at or above the offset line.
  let activeId = headings[0].id;
  for (const h of headings) {
    const top = h.getBoundingClientRect().top;
    if (top <= TOC_ACTIVE_OFFSET) {
      activeId = h.id;
    } else {
      break;
    }
  }

  const links = document.querySelectorAll(".md-sidebar--secondary .md-nav__link");
  if (!links.length) return;
  links.forEach(function (link) {
    const isMatch = link.getAttribute("href") === "#" + activeId;
    link.classList.toggle("md-nav__link--active", isMatch);
  });
}

let _tocTickQueued = false;
function _onScrollForToc() {
  if (_tocTickQueued) return;
  _tocTickQueued = true;
  requestAnimationFrame(function () {
    updateTocActive();
    _tocTickQueued = false;
  });
}

window.addEventListener("scroll", _onScrollForToc, { passive: true });
window.addEventListener("load", updateTocActive);
window.addEventListener("hashchange", updateTocActive);

// MutationObserver — definitively win the race against Material's own
// active-state observer. Every time Material rewrites a TOC link's
// class attribute, this fires and re-applies our correct active state.
// Without this, Material's intersection observer keeps stamping the
// wrong link as active on every threshold crossing.
let _mutationGuard = false;
function _watchTocMutations() {
  const panel = document.querySelector(".md-sidebar--secondary");
  if (!panel) return;
  const obs = new MutationObserver(function () {
    if (_mutationGuard) return;       // ignore mutations caused by our own writes
    _mutationGuard = true;
    updateTocActive();
    // Release the guard on the next frame so our writes settle before
    // we re-arm.
    requestAnimationFrame(function () { _mutationGuard = false; });
  });
  obs.observe(panel, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}
window.addEventListener("load", _watchTocMutations);

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

// ── Landing page scroll reveal ─────────────────────────────────
// Sections fade + slide up when they enter the viewport. The hero
// itself uses CSS-only staggered keyframes; this only handles
// subsequent sections. The scroll-down chevron at the bottom of the
// hero hides itself once the user has scrolled past the hero.
(function () {
  if (typeof window === "undefined") return;
  if (!("IntersectionObserver" in window)) return;

  const init = () => {
    const targets = document.querySelectorAll(
      ".amx-landing__section, .amx-landing__why-section .amx-why, .amx-landing__cta-card"
    );
    if (!targets.length) return;

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("amx-revealed");
            reveal.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach((t) => reveal.observe(t));

    // Hide scroll-down chevron after the user leaves the hero. Toggle
    // class instead of removing the element so reverse-scroll restores
    // it without re-running the entry animation.
    const chevron = document.querySelector(".amx-landing__scroll-down");
    const hero = document.querySelector(".amx-landing__hero");
    if (chevron && hero && "IntersectionObserver" in window) {
      const heroObs = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          chevron.classList.toggle("amx-landing__scrolled", !e.isIntersecting || e.intersectionRatio < 0.5);
        },
        { threshold: [0, 0.5, 1] }
      );
      heroObs.observe(hero);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

// ── Landing back-to-top button ─────────────────────────────────
// Smooth-scroll to the top of the page on click instead of letting
// the browser snap there. Element is opt-in via data-amx-scroll-top.
(function () {
  if (typeof document === "undefined") return;
  const init = () => {
    document.querySelectorAll("[data-amx-scroll-top]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const supports = "scrollBehavior" in document.documentElement.style;
        const opts = supports ? { top: 0, behavior: "smooth" } : { top: 0 };
        // Material's instant nav is disabled in this site so window.scrollTo
        // is reliable; fall back to documentElement for older browsers.
        try { window.scrollTo(opts); }
        catch { document.documentElement.scrollTop = 0; }
      });
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

// ── Sidebar collapsible groups ───────────────────────────────────────
// Per-group expand state stored in localStorage. On load, the group
// containing the active page is force-opened (we never hide the page
// the user is on); other groups fall back to saved state, default closed.
(function () {
  const STORAGE_KEY = "amx-sidebar-groups";

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* storage disabled — fine */ }
  }

  function init() {
    const groups = document.querySelectorAll(".amx-sidebar__group[data-amx-group-key]");
    if (!groups.length) return;
    const state = readState();

    groups.forEach(function (group) {
      const key = group.dataset.amxGroupKey;
      const button = group.querySelector(":scope > .amx-sidebar__group-title");
      const body = group.querySelector(":scope > .amx-sidebar__group-body");
      if (!button || !body) return;

      const hasActive = !!body.querySelector(".amx-sidebar__link--active");
      const saved = state[key];
      const open = hasActive || saved === "open";
      button.setAttribute("aria-expanded", open ? "true" : "false");

      button.addEventListener("click", function () {
        const isOpen = button.getAttribute("aria-expanded") === "true";
        const next = !isOpen;
        button.setAttribute("aria-expanded", next ? "true" : "false");
        const s = readState();
        s[key] = next ? "open" : "closed";
        writeState(s);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
