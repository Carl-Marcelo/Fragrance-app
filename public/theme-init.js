// Applies the saved theme before first paint to avoid a light/dark flash.
// Kept as a tiny external file so the Content-Security-Policy can forbid inline scripts.
;(function () {
  try {
    var pref = localStorage.getItem('sillage.theme')
    var dark =
      pref === 'dark' || ((!pref || pref === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
  } catch (e) {}
})()
