// AMX docs — light enhancements on top of Material.

// Expose a body data attribute with the current page slug so CSS can target
// the homepage (used to hide the right TOC etc.).
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname.replace(/\/$/, "");
  const slug = path.split("/").filter(Boolean).pop() || "index";
  document.body.dataset.page = slug;
});
