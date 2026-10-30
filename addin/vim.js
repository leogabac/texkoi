/* A deliberately small Vim-style editor for the two native textareas. */
(function () {
  var toggle = document.getElementById('vim-toggle');
  var label = document.getElementById('vim-mode');
  var fields = [document.getElementById('source'), document.getElementById('preamble')];
  var active = null, states = [], clipboard = '', linewise = false, enabled = false, userToggled = false;

  function indicator() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? 'Vim: on' : 'Vim: off';
    label.textContent = enabled && active ? '-- ' + active.mode.toUpperCase() + ' --' : '';
    states.forEach(function (state) {
      var block = enabled && state.mode === 'normal';
      state.box.texkoiBlockCursor = block;
      state.box.setAttribute('data-vim-normal', String(block));
      if (state.box.texkoiSync) state.box.texkoiSync();
    });
  }
  function clipboardApi() {
    return typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : null;
  }
  function clipboardStatus(message) {
    if (typeof showStatus === 'function') showStatus(message, true);
  }
  function setRegister(text, isLinewise) {
    clipboard = text; linewise = isLinewise;
    var api = clipboardApi();
    if (!api || typeof api.writeText !== 'function') {
      clipboardStatus('System clipboard unavailable; copied to TeXKoi’s local register.');
      return;
    }
    try {
      Promise.resolve(api.writeText(text)).catch(function () {
        clipboardStatus('Could not write to the system clipboard; copied to TeXKoi’s local register.');
      });
    } catch (_) { clipboardStatus('Could not write to the system clipboard; copied to TeXKoi’s local register.'); }
  }
  function put(s, text, isLinewise, at, before) {
    if (!text) return;
    var value = s.box.value;
    if (isLinewise) {
      var clip = text.replace(/\n$/, '');
      if (!value) { change(s, 0, 0, clip + '\n', 0); }
      else if (before) { var first = lineStart(value, at); change(s, first, first, clip + '\n', first); }
      else { var pos = lineEnd(value, at); change(s, pos, pos, '\n' + clip, pos + 1); }
    } else {
      var insert = before ? at : Math.min(lineEnd(value, at), at + 1);
      change(s, insert, insert, text, insert + text.length - 1);
    }
  }
  function readClipboard() {
    var api = clipboardApi(), browserRead;
    try { browserRead = api && typeof api.readText === 'function' ? api.readText() : Promise.reject(); }
    catch (_) { browserRead = Promise.reject(); }
    // Some embedded browsers leave a denied clipboard request pending.
    var timer;
    var deadline = new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('Clipboard read timed out')); }, 800); });
    return Promise.race([Promise.resolve(browserRead), deadline]).then(function (text) {
      clearTimeout(timer); return text;
    }, function () {
      clearTimeout(timer);
      return fetch('clipboard-read', {method:'POST', headers:{'X-TeXKoi':'clipboard-read'}})
        .then(function (response) { if (!response.ok) throw new Error('Clipboard unavailable'); return response.json(); })
        .then(function (result) { if (typeof result.text !== 'string') throw new Error('Invalid clipboard text'); return result.text; });
    });
  }
  function paste(s, at, before) {
    var original = s.box.value;
    readClipboard().then(function (text) {
      if (!enabled || s.mode !== 'normal' || document.activeElement !== s.box ||
          s.box.value !== original || s.box.selectionStart !== at) {
        clipboardStatus('Paste cancelled because the editor changed while reading the clipboard.'); return;
      }
      put(s, text, text === clipboard && linewise, at, before);
    }).catch(function () {
      if (!enabled || s.mode !== 'normal' || document.activeElement !== s.box ||
          s.box.value !== original || s.box.selectionStart !== at) return;
      if (clipboard) { clipboardStatus('System clipboard unavailable; pasted TeXKoi’s local register.'); put(s, clipboard, linewise, at, before); }
      else clipboardStatus('Could not read the system clipboard. Use Ctrl+V in insert mode.');
    });
  }
  function notify(box) { box.dispatchEvent(new Event('input', {bubbles:true})); }
  function remember(s) {
    var snapshot = {value:s.box.value, cursor:s.box.selectionStart};
    if (!s.undo.length || s.undo[s.undo.length - 1].value !== snapshot.value) s.undo.push(snapshot);
    if (s.undo.length > 200) s.undo.shift();
    s.redo = [];
  }
  function setCursor(s, pos) {
    var box = s.box; pos = Math.max(0, Math.min(box.value.length, pos));
    if (s.mode === 'visual') {
      box.setSelectionRange(Math.min(s.anchor, pos), Math.min(box.value.length, Math.max(s.anchor, pos) + 1), pos < s.anchor ? 'backward' : 'forward');
      s.cursor = pos;
    } else { box.setSelectionRange(pos, pos); s.cursor = pos; }
    if (box.texkoiSync) box.texkoiSync();
  }
  function change(s, start, end, text, cursor) {
    remember(s); s.box.setRangeText(text, start, end, 'end');
    setCursor(s, cursor == null ? start + text.length : cursor); notify(s.box);
  }
  function restore(s, from, to) {
    if (!from.length) return;
    to.push({value:s.box.value, cursor:s.box.selectionStart});
    var snapshot = from.pop(); s.box.value = snapshot.value;
    s.mode = 'normal'; s.insertRecorded = false; setCursor(s, snapshot.cursor); notify(s.box); indicator();
  }
  function lineStart(text, p) { return p <= 0 ? 0 : text.lastIndexOf('\n', p - 1) + 1; }
  function lineEnd(text, p) { var n = text.indexOf('\n', p); return n < 0 ? text.length : n; }
  function word(c) { return !!c && /[A-Za-z0-9_]/.test(c); }
  function motion(text, p, key) {
    var start = lineStart(text, p), end = lineEnd(text, p), q = p;
    if (key === 'h') return Math.max(start, p - 1);
    if (key === 'l') return Math.min(Math.max(start, end - 1), p + 1);
    if (key === '0') return start;
    if (key === '^') { while (start < end && /[ \t]/.test(text[start])) start++; return start; }
    if (key === '$') return Math.max(start, end - 1);
    if (key === 'w') {
      if (q < text.length) { var kind = word(text[q]); while (q < text.length && !/\s/.test(text[q]) && word(text[q]) === kind) q++; }
      while (q < text.length && /\s/.test(text[q])) q++; return q;
    }
    if (key === 'b') {
      if (q > 0) q--; while (q > 0 && /\s/.test(text[q])) q--;
      var kindB = word(text[q]); while (q > 0 && !/\s/.test(text[q - 1]) && word(text[q - 1]) === kindB) q--; return q;
    }
    if (key === 'e') {
      if (q < text.length - 1) q++; while (q < text.length && /\s/.test(text[q])) q++;
      var kindE = word(text[q]); while (q + 1 < text.length && !/\s/.test(text[q + 1]) && word(text[q + 1]) === kindE) q++; return q;
    }
    if (key === 'j' && end < text.length) { var next = end + 1; return Math.min(next + p - start, Math.max(next, lineEnd(text, next) - 1)); }
    if (key === 'k' && start > 0) { var prev = lineStart(text, start - 1); return Math.min(prev + p - start, Math.max(prev, start - 2)); }
    if (key === 'G') return lineStart(text, text.length);
    return null;
  }
  function act(s, key, event) {
    var box = s.box, text = box.value, p = s.mode === 'visual' ? s.cursor : box.selectionStart;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (s.mode === 'insert') { s.mode = 'normal'; setCursor(s, Math.max(lineStart(text, p), p - 1)); }
      else { s.mode = 'normal'; setCursor(s, p); }
      s.pending = ''; s.insertRecorded = false; indicator(); return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (key.toLowerCase() === 'z' || key.toLowerCase() === 'y' || key.toLowerCase() === 'r')) {
      key = key.toLowerCase();
      if (key === 'r' && s.mode === 'insert') return;
      event.preventDefault(); event.stopPropagation();
      restore(s, (key === 'y' || key === 'r' || event.shiftKey) ? s.redo : s.undo, (key === 'y' || key === 'r' || event.shiftKey) ? s.undo : s.redo); return;
    }
    if (s.mode === 'insert' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (key.length !== 1 && key !== 'Backspace') return;
    event.preventDefault(); event.stopPropagation();
    var target;
    if (s.pending === 'g') { s.pending = ''; if (key === 'g') setCursor(s, 0); return; }
    if (s.mode === 'visual' && 'dxyc'.indexOf(key) >= 0) {
      var a = Math.min(s.anchor, p), b = Math.min(text.length, Math.max(s.anchor, p) + 1);
      setRegister(text.slice(a, b), false); s.mode = key === 'c' ? 'insert' : 'normal';
      if (key !== 'y') change(s, a, b, '', a); else setCursor(s, a);
      if (key === 'c') s.insertRecorded = true;
      indicator(); return;
    }
    if (s.pending) {
      var op = s.pending; s.pending = '';
      if (key === op) {
        var begin = lineStart(text, p), finish = lineEnd(text, p);
        if (finish < text.length) finish++; else if (begin > 0) begin--;
        setRegister(text.slice(lineStart(text, p), lineEnd(text, p)) + '\n', true);
        if (op !== 'y') change(s, begin, finish, '', begin);
        if (op === 'c') { s.mode = 'insert'; s.insertRecorded = true; indicator(); }
        return;
      }
      target = motion(text, p, key); if (target === null) return;
      var from = Math.min(p, target), to = Math.max(p, target);
      if (key === 'e' || key === '$') to = Math.min(text.length, to + 1);
      setRegister(text.slice(from, to), false);
      if (op !== 'y') change(s, from, to, '', from);
      if (op === 'c') { s.mode = 'insert'; s.insertRecorded = true; indicator(); }
      return;
    }
    if (key === 'g') { s.pending = 'g'; return; }
    if ('dcy'.indexOf(key) >= 0) { s.pending = key; return; }
    if (key === 'v') { s.mode = 'visual'; s.anchor = p; setCursor(s, p); indicator(); return; }
    if ('iIaA'.indexOf(key) >= 0) {
      if (key === 'I') p = motion(text, p, '^');
      if (key === 'a') p = Math.min(lineEnd(text,p), p + 1);
      if (key === 'A') p = lineEnd(text,p);
      s.mode = 'insert'; s.insertRecorded = false; setCursor(s, p); indicator(); return;
    }
    if (key === 'o' || key === 'O') {
      var where = key === 'o' ? lineEnd(text, p) : lineStart(text,p);
      s.mode = 'insert'; change(s, where, where, '\n', where + (key === 'o' ? 1 : 0)); s.insertRecorded = true; indicator(); return;
    }
    if (key === 'u') { restore(s, s.undo, s.redo); return; }
    if (key === 'x') { if (p < lineEnd(text,p)) { setRegister(text[p], false); change(s,p,p+1,'',p); } return; }
    if (key === 'p' || key === 'P') { paste(s, p, key === 'P'); return; }
    target = motion(text, p, key); if (target !== null) setCursor(s, target);
  }
  fields.forEach(function (box) {
    var state = {box:box, mode:'normal', pending:'', cursor:0, anchor:0, undo:[], redo:[]};
    states.push(state);
    if (document.activeElement === box) active = state;
    box.addEventListener('focus', function () { active = state; indicator(); });
    box.addEventListener('beforeinput', function (event) {
      if (!enabled) return;
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        event.preventDefault(); restore(state, event.inputType === 'historyUndo' ? state.undo : state.redo, event.inputType === 'historyUndo' ? state.redo : state.undo); return;
      }
      if (state.mode === 'insert') {
        if (!state.insertRecorded) { remember(state); state.insertRecorded = true; }
      }
      else event.preventDefault();
    });
    box.addEventListener('keydown', function (event) { if (enabled) act(state, event.key, event); });
  });
  toggle.addEventListener('click', function () {
    enabled = !enabled;
    userToggled = true;
    states.forEach(function (state) {
      state.mode = 'normal'; state.pending = ''; state.insertRecorded = false;
      setCursor(state, state.box.selectionStart);
    });
    indicator(); if (active) active.box.focus();
  });
  indicator();
  // The shared settings endpoint applies to new and existing equations alike.
  // Do not overwrite an explicit toggle made while the request is in flight.
  fetch('settings').then(function (response) { return response.ok ? response.json() : {}; })
    .then(function (settings) {
      if (!userToggled && typeof settings.vim_mode === 'boolean') { enabled = settings.vim_mode; indicator(); }
    }).catch(function () {});
}());
