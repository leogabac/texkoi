function OnProbeLoad() { return true; }
function probeApplication() { return typeof Application === 'undefined' ? wps.WppApplication() : Application; }
function OnCheckOffline() {
  var app = probeApplication();
  var lines = ['TeXKoi offline package 0.0.1 loaded.', 'Page: ' + window.location.href];
  try {
    lines.push('ShellExecute: ' + typeof app.OAAssist.ShellExecute);
    ['mkdtempSync', 'writeFileString', 'ReadFile', 'Exists'].forEach(function (key) { lines.push('FileSystem.' + key + ': ' + typeof app.FileSystem[key]); });
    lines.push('Temporary path: ' + app.Env.GetTempPath());
  } catch (error) { lines.push(String(error)); }
  alert(lines.join('\n'));
}
function argument(value) { return '"' + value.replace(/([\\"])/g, '\\$1') + '"'; }
function OnCheckHelper() {
  var stage = 'initializing';
  try {
    var app = probeApplication();
    var helper = new URL('helper.py', window.location.href);
    if (helper.protocol !== 'file:') throw new Error('The probe must load from its installed file URL.');
    var scriptPath = decodeURIComponent(helper.pathname);
    var resultPath = decodeURIComponent(new URL('helper-result.json', window.location.href).pathname);
    var requestedAt = Date.now();
    stage = 'launching the executable helper without arguments';
    // Isolate process launching from WPS command-line parsing and filesystem writes.
    var launchReturn = app.OAAssist.ShellExecute(scriptPath, '');
    var deadline = Date.now() + 10000;
    var timer = setInterval(function () {
      try {
        if (app.FileSystem.Exists(resultPath)) {
          var result = JSON.parse(app.FileSystem.ReadFile(resultPath));
          // Ignore a result left by a previous invocation.
          if (result.started_ms >= requestedAt) {
            clearInterval(timer);
            alert('Direct executable helper succeeded.\nPython: ' + result.python);
            return;
          }
        }
        if (Date.now() > deadline) {
          clearInterval(timer);
          alert('Direct executable helper did not produce a fresh result.\nShellExecute returned: ' + String(launchReturn) + '\nNo command arguments or WPS file-writing calls were used.\nExecutable: ' + scriptPath);
        }
      } catch (error) { clearInterval(timer); alert('Reading helper result: ' + String(error)); }
    }, 200);
  } catch (error) { alert('Helper test failed while ' + stage + ':\n' + String(error)); }
}

var protocolProbeBusy = false;
function OnCheckProtocolNative() { testProtocolProbe('wps'); }
function OnCheckProtocolBrowser() {
  probeApplication().ShowDialog(new URL('protocol-dialog.html', window.location.href).href, 'TeXKoi — Protocol link test', 560, 320, true);
}
function testProtocolProbe(method, suppliedToken) {
  if (protocolProbeBusy) { alert('A protocol test is already running.'); return; }
  if (!texkoiProtocolProbeDirectory) { alert('Install the local protocol probe first.'); return; }
  var bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  var token = suppliedToken || Array.prototype.map.call(bytes, function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  var uri = 'texkoi://probe?token=' + token;
  var resultPath = texkoiProtocolProbeDirectory + '/' + token + '.json';
  var app = probeApplication();
  try {
    // Use separate clicks to distinguish native API handling from browser URL dispatch.
    if (method === 'wps') app.OAAssist.ShellExecute(uri, '');
    else if (method !== 'link') window.open(uri, '_blank');
  } catch (error) { alert('URI launch failed: ' + String(error)); return; }
  protocolProbeBusy = true;
  var deadline = Date.now() + 20000;
  var timer = setInterval(function () {
    try {
      if (app.FileSystem.Exists(resultPath)) {
        var result = JSON.parse(app.FileSystem.ReadFile(resultPath));
        if (result.ok && result.token === token) {
          clearInterval(timer); protocolProbeBusy = false;
          alert('Protocol handler succeeded via ' + method + '.\nPython: ' + result.python);
          return;
        }
      }
      if (Date.now() > deadline) {
        clearInterval(timer); protocolProbeBusy = false;
        alert('No protocol result via ' + method + '.\nToken: ' + token + '\nURI: ' + uri);
      }
    } catch (error) {
      clearInterval(timer); protocolProbeBusy = false;
      alert('Reading protocol result failed: ' + String(error) + '\nToken: ' + token);
    }
  }, 200);
}
