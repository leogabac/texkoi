/* Lightweight enhancement for the native textareas, retaining their editing and undo behavior. */
(function () {
  function escapeText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function highlight(text, cursor) {
    var pair = {'{':'}', '[':']', '(':')', '}':'{', ']':'[', ')':'('};
    var at = cursor > 0 && pair[text[cursor - 1]] ? cursor - 1 : (pair[text[cursor]] ? cursor : -1);
    var other = -1;
    if (at >= 0) {
      var opening = '{[('.indexOf(text[at]) >= 0, step = opening ? 1 : -1, depth = 0;
      for (var i = at; i >= 0 && i < text.length; i += step) {
        if (text[i] === text[at]) depth++;
        else if (text[i] === pair[text[at]] && --depth === 0) { other = i; break; }
      }
    }
    var result = '', re = /\\(?:[a-zA-Z]+|[^a-zA-Z\s])|%[^\n]*|[{}\[\]()]/g, last = 0, match;
    while ((match = re.exec(text))) {
      result += escapeText(text.slice(last, match.index));
      var cls = match[0][0] === '%' ? 'tex-comment' : match[0][0] === '\\' ? 'tex-command' : 'tex-bracket';
      if (match.index === at || match.index === other) cls += ' tex-match';
      result += '<span class="' + cls + '">' + escapeText(match[0]) + '</span>';
      last = re.lastIndex;
    }
    return result + escapeText(text.slice(last)) + '\n';
  }
  function enhance(box) {
    var wrap = document.createElement('div'), gutter = document.createElement('div'), layer = document.createElement('pre');
    wrap.className = 'code-editor'; gutter.className = 'code-gutter'; layer.className = 'code-highlight';
    gutter.setAttribute('aria-hidden', 'true'); layer.setAttribute('aria-hidden', 'true');
    box.parentNode.insertBefore(wrap, box); wrap.appendChild(gutter); wrap.appendChild(layer); wrap.appendChild(box);
    box.wrap = 'off'; box.setAttribute('data-code-editor', '');
    function sync() {
      var lines = box.value.split('\n').length, numbers = [];
      for (var i = 1; i <= lines; i++) numbers.push(i);
      gutter.textContent = numbers.join('\n');
      layer.innerHTML = highlight(box.value, box.selectionStart);
      layer.scrollTop = box.scrollTop; layer.scrollLeft = box.scrollLeft; gutter.scrollTop = box.scrollTop;
    }
    box.addEventListener('input', sync); box.addEventListener('scroll', sync);
    box.addEventListener('click', sync); box.addEventListener('keyup', sync); box.addEventListener('select', sync);
    box.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      var start = box.selectionStart, end = box.selectionEnd, value = box.value;
      if (start === end && !event.shiftKey) {
        box.setRangeText('  ', start, end, 'end');
      } else {
        var first = value.lastIndexOf('\n', start - 1) + 1;
        var last = value.indexOf('\n', end); if (last < 0) last = value.length;
        var selected = value.slice(first, last), transformed = selected.split('\n').map(function (line) {
          return event.shiftKey ? line.replace(/^(?: {1,2}|\t)/, '') : '  ' + line;
        }).join('\n');
        box.setRangeText(transformed, first, last, 'select');
      }
      box.dispatchEvent(new Event('input', {bubbles:true}));
    });
    box.texkoiSync = sync; sync();
  }
  enhance(document.getElementById('source')); enhance(document.getElementById('preamble'));
}());
