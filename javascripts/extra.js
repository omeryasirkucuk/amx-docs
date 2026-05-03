// AMX docs — light enhancements on top of Material.

// Expose a body data attribute with the current page slug so CSS can target
// the homepage (used to hide the right TOC etc.).
function setPageSlug() {
  const path = window.location.pathname.replace(/\/$/, "");
  const slug = path.split("/").filter(Boolean).pop() || "index";
  document.body.dataset.page = slug;
}

// ─────────────────────────────────────────────────────────────────────
// Preserve the left sidebar's scroll position across navigation.
//
// The sidebar's nav HTML changes per page (active-class moves), so
// mkdocs-material's instant navigation can't preserve the scrollTop on
// the .amx-sidebar__tree element naturally — it re-renders. We bridge
// that by snapshotting the scroll position into sessionStorage right
// before a navigation fires, then restoring it after the new page is
// in place. Works for instant-nav (pushState) and full reload alike.

const SCROLL_KEY = "amx-sidebar-scrollTop";

function saveSidebarScroll() {
  const tree = document.querySelector(".amx-sidebar__tree");
  if (tree) sessionStorage.setItem(SCROLL_KEY, String(tree.scrollTop));
}

function restoreSidebarScroll() {
  const tree = document.querySelector(".amx-sidebar__tree");
  if (!tree) return;
  const saved = sessionStorage.getItem(SCROLL_KEY);
  if (saved === null) return;
  // Apply after the current frame so layout has settled.
  requestAnimationFrame(() => {
    tree.scrollTop = parseInt(saved, 10) || 0;
  });
}

// Capture click on any sidebar / header / breadcrumb link before it navigates.
// Use capture phase so we run before Material's own click handler.
document.addEventListener(
  "click",
  function (e) {
    const link = e.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    // Pure in-page anchor jumps don't navigate — keep current scroll.
    if (href.startsWith("#")) return;
    saveSidebarScroll();
  },
  true
);

// Initial page load (full reload path)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setPageSlug();
    restoreSidebarScroll();
  });
} else {
  setPageSlug();
  restoreSidebarScroll();
}

// Instant navigation path: mkdocs-material uses history.pushState() to swap
// pages without firing DOMContentLoaded on the new one. Hook pushState +
// popstate so we re-run our setup after every URL change.
(function patchHistory() {
  const orig = history.pushState;
  history.pushState = function () {
    const r = orig.apply(this, arguments);
    setTimeout(() => {
      setPageSlug();
      restoreSidebarScroll();
    }, 0);
    return r;
  };
  window.addEventListener("popstate", () => {
    setTimeout(() => {
      setPageSlug();
      restoreSidebarScroll();
    }, 0);
  });
})();
