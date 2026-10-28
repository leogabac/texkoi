// This page is installed with the ribbon so it still opens if the server is down.
var connectionAttempt = 0;
var connectionTimer = null;
var connectionImage = null;
var connectionStatus = document.getElementById('connection-status');
var connectionHelp = document.getElementById('connection-help');
var connectionRetry = document.getElementById('connection-retry');
document.title = profileName();
document.querySelector('.brand').textContent = profileName();
if (typeof texkoiProfile !== 'undefined' && texkoiProfile.mode === 'server') {
  connectionHelp.textContent = 'Start the development server with ./texkoi, then retry.';
}
function checkConnection() {
  var attempt = ++connectionAttempt;
  if (connectionTimer !== null) clearTimeout(connectionTimer);
  if (connectionImage) { connectionImage.onload = null; connectionImage.onerror = null; }
  connectionRetry.disabled = true;
  connectionHelp.hidden = true;
  connectionStatus.textContent = 'Connecting to ' + profileName() + '…';
  function failed() {
    if (attempt !== connectionAttempt) return;
    if (connectionTimer !== null) clearTimeout(connectionTimer);
    if (connectionImage) { connectionImage.onload = null; connectionImage.onerror = null; }
    connectionStatus.textContent = profileName() + ' could not connect to its local renderer.';
    connectionHelp.hidden = false;
    connectionRetry.disabled = false;
  }
  try {
    var target = editorUrl(new URLSearchParams(window.location.search).get('mode') === 'edit' ? '?mode=edit' : '');
    // The connection screen can be a file URL, so resolve the theme against
    // the private companion URL rather than against this page.
    document.getElementById('wps-theme').href = new URL('wps-theme.css?t=' + Date.now(), target).href;
    // An image request can check a private loopback route from a local file page
    // without enabling CORS or exposing the compiler to arbitrary websites.
    connectionImage = new Image();
    connectionImage.onload = function () {
      if (attempt !== connectionAttempt) return;
      clearTimeout(connectionTimer);
      connectionImage.onload = null;
      connectionImage.onerror = null;
      try { window.location.replace(target); }
      catch (_) { failed(); }
    };
    connectionImage.onerror = failed;
    connectionTimer = setTimeout(failed, 8000);
    connectionImage.src = new URL('icons/new-equation.png?connection=' + Date.now(), target).href;
  } catch (_) { failed(); }
}
connectionRetry.onclick = checkConnection;
document.getElementById('connection-close').onclick = function () { window.close(); };
checkConnection();
