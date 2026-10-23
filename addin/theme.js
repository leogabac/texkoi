// The helper reads WPS's own skin setting; this is not the slide's design theme.
(function () {
  var link = document.getElementById('wps-theme');
  function refreshTheme() {
    if (!document.hidden) link.href = '/wps-theme.css?t=' + Date.now();
  }
  window.addEventListener('focus', refreshTheme);
  document.addEventListener('visibilitychange', refreshTheme);
  setInterval(refreshTheme, 2000);
})();
