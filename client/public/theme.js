// Applies the stored theme before first paint to avoid a flash. The only
// writer of this key is the Appearance setting. Lives in its own file (not
// inline) so the static Content-Security-Policy can stay at script-src 'self'.
(function () {
  try {
    var t = localStorage.getItem("internops_theme");
    var dark = t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
